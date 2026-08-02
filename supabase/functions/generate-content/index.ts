// generate-content — periodic batch growth for content_bank (see
// supabase/schema.sql). Asks Groq for a handful of NEW prompts per exercise
// category in one combined call, dedupes against what's already in
// content_bank, and inserts the rest as source='generated' rows using the
// service role key (auto-injected into every Edge Function's environment by
// Supabase — never a value this function has to be handed explicitly).
//
// Deliberately NOT on the per-session request path: src/lib/storage.js's
// getFreshContentBank reads whatever is already in content_bank at spin
// time and never calls this function directly. This runs on its own
// schedule (see the Cron job wired up alongside this deploy) — a slow,
// occasional, quota-cheap batch job, not something a user's roulette spin
// ever waits on. See the redesign plan doc for why per-session generation
// was deliberately ruled out (a third call on an already-tight shared
// free-tier token budget, plus real added latency on what's currently an
// instant local/DB read).
//
// Auth model: verify_jwt=true (same as ai-feedback) — any request needs a
// valid Supabase-signed JWT, which the project's own anon/publishable key
// already is (that's why the client SDK's anonymous calls to Edge Functions
// work at all). The Cron job that triggers this on a schedule authenticates
// with that same anon key — not a secret, already shipped in the browser
// bundle. To stop that from being an open door to spamming Groq calls, the
// MIN_INTERVAL_HOURS guard below makes repeated triggers within one window
// a cheap no-op regardless of who or what calls this.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
// Same default as ai-feedback/index.ts and src/lib/aiCoach.js — kept as a
// separate constant (not imported) because Edge Functions deploy
// independently; duplicating one line here is simpler and more reliable
// than wiring up a shared module for a single constant.
const MODEL = "openai/gpt-oss-120b";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Every category this app has, plus the style guidance/examples the model
// needs to match content.js's existing tone — this is the one place the
// generation "house style" is defined, separate from the exercise-fit
// judging prompts in aiCoach.js (that file grades a transcript against an
// exercise; this file grows the pool of exercises themselves).
const CATEGORY_GUIDE: Record<string, string> = {
  wiki_roulette: `Reflection Roulette: a personal or philosophical prompt inviting a genuine, specific, first-person answer — not a survey question. Second person ("you"), open-ended, often starting with "Talk about..." or "What does... mean to you". Examples: "Talk about a habit or ritual that grounds you.", "What does it mean to you to belong somewhere?"`,
  explain_simply: `Explain It Simply: a short topic phrase (not a full sentence, no question mark) naming something to explain as if to a five-year-old — a mix of everyday science, technology, and finance/economics concepts. Examples: "How the internet works", "Why the sky is blue", "What a credit score is".`,
  snap_opinion: `Snap Opinion: a binary debate question people can actually take a side on, ending in "?". Often "Is X better than Y?" or "Should...?". Examples: "Is remote work better than working in an office?", "Should university education be free?"`,
  word_of_day: `Word of the Day: one moderately advanced but real, commonly-useful English adjective (not a topic noun), a one-sentence plain-English definition, and a short second-person speaking prompt that asks the reader to use the word naturally at least twice. Examples: word "Ephemeral", definition "Lasting for a very short time.", prompt "Talk about something ephemeral in your own life — use the word naturally at least twice."`,
};

// word_ladder needs a PAIR of very different concrete nouns (one everyday
// object, one much bigger/wilder image) to connect in a riff — different
// enough shape from the other four categories (two words, not a prompt
// sentence) that it gets its own schema entry below rather than reusing
// CATEGORY_GUIDE's single-string shape.
const WORD_LADDER_GUIDE = `Word Ladder: TWO ordinary, unrelated concrete nouns (everyday objects, animals, weather, geography, tools — not abstract concepts) that someone has to improvise a connection between. Deliberately mismatched in scale/domain. Examples: ["umbrella", "volcano"], ["kettle", "canyon"], ["violin", "prairie"].`;

const ALL_TYPE_IDS = ["wiki_roulette", "explain_simply", "snap_opinion", "word_ladder", "word_of_day"];

// No new Groq calls within this window regardless of who/what invokes the
// function — see the file header comment on why this matters even though
// the request itself is JWT-gated the same way ai-feedback is.
const MIN_INTERVAL_HOURS = 20;
const DEFAULT_PER_TYPE = 6;
const MAX_PER_TYPE = 15;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function buildPrompt(typeIds: string[], perType: number): string {
  const sections = typeIds
    .map((id) => (id === "word_ladder" ? `"word_ladder": ${WORD_LADDER_GUIDE}` : `"${id}": ${CATEGORY_GUIDE[id]}`))
    .join("\n\n");

  const schemaLines = typeIds
    .map((id) =>
      id === "word_ladder"
        ? `  "word_ladder": [ { "wordA": "...", "wordB": "..." }, ... exactly ${perType} entries ],`
        : id === "word_of_day"
        ? `  "word_of_day": [ { "word": "...", "definition": "...", "prompt": "..." }, ... exactly ${perType} entries ],`
        : `  "${id}": [ { "prompt": "..." }, ... exactly ${perType} entries ],`
    )
    .join("\n");

  return `You write new content for a daily speaking-practice app. Generate ${perType} brand-new entries for each of the following categories, matching the style and difficulty of the examples exactly, but NOT reusing the examples themselves or close variations of them:

${sections}

Respond with ONLY a single JSON object, no markdown, no code fences, no text outside the JSON, with exactly this shape:
{
${schemaLines}
}

Every entry must be genuinely different from the others in its category (no near-duplicates within your own output). Respond with the JSON object only.`;
}

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

async function callGroq(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9, // higher than the coaching calls — variety is the point here, not consistency
      max_tokens: maxTokens,
      include_reasoning: false,
      reasoning_effort: "low",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq error (${res.status}): ${text || "unknown error"}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// Mirrors src/lib/storage.js's topicIdentityKey exactly — this table's
// unique index is on (type_id, identity_key), so a generated entry that
// doesn't compute to the same key as the code expects would silently never
// get matched by the roulette's "already spoken" filter even if it inserted
// fine. Kept in sync by hand (two small, stable functions in two runtimes
// that rarely change) rather than trying to share a module across a browser
// bundle and a Deno Edge Function for one four-line function.
function identityKey(typeId: string, entry: Record<string, unknown>): string | null {
  if (typeId === "word_of_day") {
    const word = typeof entry.word === "string" ? entry.word : "";
    return word ? word.toLowerCase().trim() : null;
  }
  return typeof entry.prompt === "string" ? entry.prompt : null;
}

function normalizeEntry(typeId: string, raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeId === "word_ladder") {
    const a = typeof r.wordA === "string" ? r.wordA.trim() : "";
    const b = typeof r.wordB === "string" ? r.wordB.trim() : "";
    if (!a || !b) return null;
    return { prompt: `Connect "${a}" and "${b}" in one continuous riff.`, pair: [a, b] };
  }
  if (typeId === "word_of_day") {
    const word = typeof r.word === "string" ? r.word.trim() : "";
    const definition = typeof r.definition === "string" ? r.definition.trim() : "";
    const prompt = typeof r.prompt === "string" ? r.prompt.trim() : "";
    if (!word || !definition || !prompt) return null;
    return { word, definition, prompt };
  }
  const prompt = typeof r.prompt === "string" ? r.prompt.trim() : "";
  return prompt ? { prompt } : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!GROQ_API_KEY) return jsonResponse({ error: "GROQ_API_KEY is not configured on the server." }, 500);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let body: { types?: string[]; perType?: number } = {};
    try {
      body = await req.json();
    } catch {
      // No body (e.g. a bare Cron POST) is fine — defaults below cover it.
    }
    const typeIds = Array.isArray(body.types) && body.types.length ? body.types.filter((t) => ALL_TYPE_IDS.includes(t)) : ALL_TYPE_IDS;
    const perType = Math.max(1, Math.min(MAX_PER_TYPE, Number(body.perType) || DEFAULT_PER_TYPE));

    if (typeIds.length === 0) return jsonResponse({ error: "No valid type in 'types'." }, 400);

    // Rate-limit guard — see the file header comment. Checks the most
    // recent generated row across ALL categories, not per-category, since
    // the whole point is "don't fire another Groq call too soon", not
    // "don't fire one for THIS category too soon".
    const { data: recent, error: recentError } = await supabase
      .from("content_bank")
      .select("created_at")
      .eq("source", "generated")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentError) throw recentError;
    if (recent) {
      const hoursSince = (Date.now() - new Date(recent.created_at).getTime()) / 3600000;
      if (hoursSince < MIN_INTERVAL_HOURS) {
        return jsonResponse({ skipped: true, reason: `Last generation was ${hoursSince.toFixed(1)}h ago; minimum interval is ${MIN_INTERVAL_HOURS}h.` });
      }
    }

    const prompt = buildPrompt(typeIds, perType);
    // Rough budget: ~40 tokens/entry across the heavier categories (word_of_day),
    // times perType, times number of categories, plus JSON structure overhead.
    const maxTokens = Math.min(4000, typeIds.length * perType * 45 + 300);
    const responseText = await callGroq(prompt, maxTokens);
    const parsed = JSON.parse(extractJsonObject(responseText));

    const results: Record<string, { requested: number; inserted: number; skipped: number; sampleFailure?: string }> = {};

    for (const typeId of typeIds) {
      const rawEntries = Array.isArray(parsed[typeId]) ? parsed[typeId] : [];
      const normalized = rawEntries.map((e: unknown) => normalizeEntry(typeId, e)).filter((e: unknown): e is Record<string, unknown> => e !== null);

      const rows = normalized
        .map((entry) => ({ type_id: typeId, identity_key: identityKey(typeId, entry), entry, source: "generated" }))
        .filter((row) => row.identity_key);

      let inserted = 0;
      if (rows.length > 0) {
        // on_conflict do-nothing via upsert with ignoreDuplicates — a
        // generated entry that happens to collide with an existing
        // (type_id, identity_key) (seed OR a past generated batch) is
        // silently dropped rather than erroring the whole batch out.
        const { data: insertedRows, error: insertError } = await supabase
          .from("content_bank")
          .upsert(rows, { onConflict: "type_id,identity_key", ignoreDuplicates: true })
          .select("id");
        if (insertError) throw insertError;
        inserted = insertedRows?.length || 0;
      }

      const skipped = rawEntries.length - inserted;
      // If everything for this category got skipped, keep one raw sample in
      // the response — normalizeEntry rejecting the model's shape and an
      // identity_key collision with existing content both land here as
      // "skipped", and without a sample the two are indistinguishable from
      // the response alone (see get_logs for this function if this shows up
      // in Cron runs and the cause needs digging into further).
      const sampleFailure = skipped > 0 && inserted === 0 && rawEntries.length > 0 ? JSON.stringify(rawEntries[0]).slice(0, 300) : undefined;

      results[typeId] = sampleFailure ? { requested: perType, inserted, skipped, sampleFailure } : { requested: perType, inserted, skipped };
    }

    return jsonResponse({ ok: true, results });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
