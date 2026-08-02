// AI coaching feedback proxy — forwards a pre-built prompt to Groq's free,
// open-weight-model-hosting API (https://console.groq.com) and hands back
// the raw text response in the same { response: string } shape the client
// (src/lib/aiCoach.js) already expects from its old direct-to-Ollama calls.
//
// Why a proxy at all: GROQ_API_KEY must never reach the browser bundle, so
// this Edge Function holds it server-side as a Supabase secret
// (`supabase secrets set GROQ_API_KEY=...`) and is the only thing that ever
// talks to Groq directly. Deployed with verify_jwt=true, so only requests
// carrying a signed-in user's Supabase session can reach it — not an open
// proxy anyone could point at our Groq quota.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

// SUPABASE_URL/SUPABASE_ANON_KEY are auto-injected into every Edge
// Function's environment (same as SUPABASE_SERVICE_ROLE_KEY in
// generate-content/index.ts) — never something this function has to be
// handed explicitly as a secret.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Per-signed-in-user caps, enforced by check_rate_limit() in
// supabase/schema.sql (see that file for the table + function). A
// completed session normally costs 2 calls here (coaching feedback +
// assignment-fit judgment — see aiCoach.js), so at ~55 users this app
// currently expects, 30/day comfortably clears the "everyone gets at least
// 5 sessions a day" floor (10 calls) with 3x headroom left over for retries
// and people who practice more than the minimum, while still capping any
// single account to a small slice (30 of Groq's 1,000/day free-tier bucket
// for the default model) rather than letting one account take the whole
// shared quota. Not sized to guarantee throughput if every single user maxes
// this out simultaneously — Groq's own daily bucket is the hard ceiling
// there, and this app has no control over raising it on the free tier.
// Revisit both numbers if the user count or the free-tier limits change.
const RATE_LIMIT_PER_MINUTE = 8;
const RATE_LIMIT_PER_DAY = 30;

// Kept in sync with src/lib/aiCoach.js's DEFAULT_MODEL — GPT-OSS 120B on
// Groq is free-tier, open-weight, and Groq's own recommended replacement for
// llama-3.3-70b-versatile (deprecated, shuts down 08/16/26 — see
// console.groq.com/docs/deprecations).
const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Groq's free tier publishes rate limits PER MODEL, not one pooled bucket —
// openai/gpt-oss-120b is capped at 30 req/min, 1K req/day, 8K tokens/min,
// 200K tokens/day, all shared org-wide across every signed-in user of this
// app (see the redesign plan doc for the math: that's roughly 60-65
// completed sessions/day system-wide at this app's current per-session
// token cost). openai/gpt-oss-20b has its own separate free-tier bucket on
// the same account, so a 429 on the primary model doesn't have to mean "no
// AI feedback" — it can mean "try the other bucket". Overridable via the
// `GROQ_FALLBACK_MODEL` secret without a code change if Groq's lineup shifts
// again the way llama-3.3-70b-versatile did.
const FALLBACK_MODEL = Deno.env.get("GROQ_FALLBACK_MODEL") || "openai/gpt-oss-20b";

// Every real prompt aiCoach.js builds (a ~2 minute transcript plus fixed
// instructions) comes in well under this — it exists to cap the blast
// radius of a bug or a signed-in user deliberately hammering the endpoint
// with oversized input, since the whole point of proxying through here is
// that everyone's requests draw against one shared Groq free-tier quota.
const MAX_PROMPT_CHARS = 12000;
// 1300, not 1000: aiCoach.js's Structure call now asks for four extra JSON
// fields (deliveryScore/wordChoiceScore/strongPhrases/weakPhrases) and
// requests up to 1100 max_tokens for it — this ceiling is a safety cap on
// what a (possibly tampered) client request can ask for, not a target, so it
// only needs to sit above the largest real request this app makes.
const MAX_TOKENS_CEILING = 1300;

// GPT-OSS models (openai/gpt-oss-20b, openai/gpt-oss-120b) on Groq have a
// documented rough edge: `reasoning_format` isn't a supported parameter for
// this model family at all (see console.groq.com/docs/reasoning, "GPT-OSS
// Models" section), and forcing `response_format: { type: "json_object" }`
// on them is a known-buggy combination — Groq's community forum has open
// reports of intermittent 400s and reasoning/chain-of-thought content
// leaking into what should be plain JSON output when json_object mode is
// forced on gpt-oss (community.groq.com/t/structured-outputs-ignored-by-
// openai-gpt-oss-120b). This surfaced here as "Structure"/"assignment fit"
// intermittently failing with "Edge Function returned a non-2xx status
// code" even though nothing about the request itself was invalid.
//
// Every prompt this app sends (see aiCoach.js's buildCoachingPrompt /
// buildExerciseFitPrompt) already explicitly instructs "Respond with ONLY a
// JSON object", and the client already tolerantly extracts JSON out of any
// stray text (extractJsonObject in aiCoach.js) with a graceful raw-text
// fallback if parsing fails. So json_object mode was never load-bearing —
// skipping it for GPT-OSS models removes the buggy combination instead of
// trying to work around its exact failure conditions.
//
// Separately: `include_reasoning: false` only hides GPT-OSS's chain-of-
// thought from the *response* — it still gets generated and drawn from the
// same `max_tokens` budget as the visible answer. Left uncapped, that
// showed up as the Structure tab coming back "successful" but completely
// empty on shorter transcripts: the model spent its whole token budget
// reasoning and had nothing left to actually write the JSON. Capping
// `reasoning_effort` at "low" (the lightest of GPT-OSS's three levels —
// low/medium/high, see the same reasoning doc) keeps that internal
// reasoning bounded so there's reliably room left for the real answer,
// on top of the larger max_tokens budgets aiCoach.js now requests.
function isGptOssModel(model: string): boolean {
  return /^openai\/gpt-oss/.test(model);
}

// Shared by the primary attempt and the fallback-model retry below — pulled
// out so both calls build their request the same way instead of the retry
// path silently drifting from the primary path over time.
function buildGroqBody(
  model: string,
  prompt: string,
  format: string | undefined,
  temperature: number | undefined,
  maxTokens: unknown
): Record<string, unknown> {
  const gptOss = isGptOssModel(model);
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: temperature ?? 0.5,
    // Client-requested value is a ceiling, not a blank check — clamped so a
    // tampered request can't ask Groq for an unbounded completion.
    max_tokens: Math.min(Number(maxTokens) || 500, MAX_TOKENS_CEILING),
  };

  // Groq's OpenAI-compatible JSON mode — see the isGptOssModel comment above
  // for why this is deliberately skipped for GPT-OSS models rather than
  // applied unconditionally.
  if (format === "json" && !gptOss) body.response_format = { type: "json_object" };

  if (gptOss) {
    // Suppress GPT-OSS's chain-of-thought from the response (the documented
    // control for this model family — reasoning_format is not supported
    // here)...
    body.include_reasoning = false;
    // ...and bound how much of the token budget that reasoning is allowed to
    // consume in the first place, so the visible answer reliably has room
    // left after it (see the isGptOssModel comment above).
    body.reasoning_effort = "low";
  }

  return body;
}

function callGroq(model: string, prompt: string, format: string | undefined, temperature: number | undefined, maxTokens: unknown) {
  return fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGroqBody(model, prompt, format, temperature, maxTokens)),
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY is not configured on the server." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { prompt, model, format, temperature, maxTokens } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'prompt' string in request body." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (prompt.length > MAX_PROMPT_CHARS) {
      return new Response(JSON.stringify({ error: `Prompt too long (max ${MAX_PROMPT_CHARS} characters).` }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-user throttle — see check_rate_limit() in supabase/schema.sql.
    // Runs as the calling user (their JWT is forwarded, not the service
    // role), so RLS/SECURITY DEFINER on that function scopes the count to
    // this one account automatically; there's no user id to trust from the
    // request body. A failure here (missing table, RPC error) fails OPEN —
    // this is a cost/abuse control, not a security boundary, so an infra
    // hiccup in the rate limiter shouldn't take AI feedback down for
    // everyone.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: limitResult, error: limitError } = await userClient.rpc("check_rate_limit", {
      p_function: "ai-feedback",
      p_max_per_minute: RATE_LIMIT_PER_MINUTE,
      p_max_per_day: RATE_LIMIT_PER_DAY,
    });
    if (limitError) {
      console.error("check_rate_limit failed, allowing request through:", limitError.message);
    } else if (limitResult !== "ok") {
      const message =
        limitResult === "minute"
          ? "You're requesting AI feedback a little fast — wait a few seconds and try again."
          : "You've reached today's AI feedback limit for your account (there's plenty left for everyone else) — it resets at midnight UTC.";
      return new Response(JSON.stringify({ error: message, code: "rate_limited", scope: limitResult }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedModel = model || DEFAULT_MODEL;
    let groqRes = await callGroq(resolvedModel, prompt, format, temperature, maxTokens);
    let servedModel = resolvedModel;

    // Groq's free-tier rate limits are published PER MODEL, not pooled into
    // one shared bucket — a 429 on the requested model means THAT model's
    // bucket is briefly saturated (likely by other users, since everyone
    // shares one Groq account through this function), not that the free
    // tier is exhausted outright. Retrying once against a separate model's
    // bucket turns a hard failure into (at worst) a slightly-lower-quality
    // answer instead of a broken feedback screen. Skipped if the request
    // already targeted the fallback model, and left as the original 429 if
    // the fallback bucket is ALSO saturated — no point retrying a second
    // model that's just going to say the same thing.
    if (groqRes.status === 429 && resolvedModel !== FALLBACK_MODEL) {
      const fallbackRes = await callGroq(FALLBACK_MODEL, prompt, format, temperature, maxTokens);
      if (fallbackRes.status !== 429) {
        groqRes = fallbackRes;
        servedModel = FALLBACK_MODEL;
      }
    }

    if (!groqRes.ok) {
      const text = await groqRes.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Groq error (${groqRes.status}): ${text || "unknown error"}` }), {
        status: groqRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await groqRes.json();
    const response = data.choices?.[0]?.message?.content || "";
    // servedModel lets the client know when it got a fallback-quality
    // answer instead of the model it actually asked for — not surfaced in
    // the UI today, but worth having in the payload for when usage grows
    // enough to want to log/monitor how often the fallback kicks in.
    return new Response(JSON.stringify({ response, servedModel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
