// Qualitative coaching feedback via a hosted, free-tier open-weight model
// (GPT-OSS 120B on Groq, by default — see DEFAULT_MODEL below), reached
// through the `ai-feedback` Supabase Edge Function rather than called
// directly from the browser: the Groq API key lives server-side only (a
// Supabase secret), never in the client bundle. See supabase/functions/ai-
// feedback/index.ts for the proxy itself.
//
// This used to call a locally-running Ollama instance directly
// (localhost:11434) — great for solo local dev, but useless for anyone
// using the deployed site, since their browser can't reach the developer's
// machine. Routing through Supabase means the exact same feature works for
// every signed-in visitor with zero setup on their end, and it's still a
// free, open-weight model underneath — just hosted instead of local.
//
// Deliberately separate from analysis.js: wpm/fillers/pauses/power-weak-
// words/articulation stay simple deterministic math (see the note at the
// top of that file); this is the one place the app asks a model for a
// judgment call that math genuinely can't make — argument structure,
// clarity, which line lands hardest, which line to cut. Runs automatically
// once a session has a transcript (see Reflect.jsx) rather than waiting for
// a button press, so it's a required part of the feedback, not a bonus.
import { supabase } from "./supabaseClient";

// Free-tier on Groq (console.groq.com) — open-weight (OpenAI), no cost, and
// Groq's own recommended replacement for llama-3.3-70b-versatile (which Groq
// has deprecated — shuts down 08/16/26, see console.groq.com/docs/deprecations).
// Swappable per-request via the `model` param (see storage.js's
// aiFeedbackModel setting) — e.g. "openai/gpt-oss-20b" for the smallest/
// fastest option. Full current list: https://console.groq.com/docs/models
export const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Ideal time allocation this app coaches toward — surfaced in the prompt so
// the model's structure judgment is measured against the same target the
// UI displays.
const IDEAL_OPENING_PCT = 20;
const IDEAL_BODY_PCT = 60;
const IDEAL_CLOSING_PCT = 20;

function buildCoachingPrompt({ exerciseTitle, promptText, transcript }) {
  return `You are a warm, specific public-speaking coach reviewing a short practice recording.

Exercise: ${exerciseTitle}
They were asked to speak about: "${promptText}"

Transcript of what they said:
"""
${transcript}
"""

Respond with ONLY a single JSON object — no markdown, no code fences, no text outside the JSON — with exactly these keys:

{
  "summary": "3-5 warm, specific sentences covering argument structure, clarity, and word choice. Be specific to what they actually said, not generic advice. Do not mention filler words, speaking pace, or words-per-minute — those are already measured separately elsewhere in the app.",
  "openingPct": <integer 0-100: your estimate of what share of the response functioned as an opening/framing>,
  "bodyPct": <integer 0-100: your estimate of what share functioned as the developed middle/argument>,
  "closingPct": <integer 0-100: your estimate of what share functioned as a closing/wrap-up>,
  "structureNote": "one short sentence of qualitative advice on the balance — e.g. which part ran long or short and what to trim or expand. Do NOT restate openingPct/bodyPct/closingPct or any other numbers/percentages in this sentence — they're already shown separately right next to this text, and repeating them risks getting the two out of sync",
  "strongestLine": "the single strongest sentence or phrase they said, quoted verbatim from the transcript",
  "tightenLine": "the single weakest or most cuttable sentence or phrase, quoted verbatim from the transcript — empty string if nothing stands out",
  "tightenSuggestion": "one sentence on why to cut or tighten that line — empty string if tightenLine is empty",
  "deliveryScore": <integer 0-100: YOUR OWN holistic judgment of how well this was delivered out loud — pacing control, energy, confidence, clarity of articulation. This is not derived from any fixed word list or from the wpm/filler/pause counts the app already computes by counting — form your own independent read of delivery quality, the way a real coach listening would, so someone who delivers well in a style your rubric doesn't anticipate still scores well>,
  "deliveryNote": "1-2 sentences reading HOW this was delivered, not what it measured — e.g. where pacing shifted, whether energy dropped or built, whether filler words clustered at a specific moment (like the opening, or right after a hard sentence) rather than spreading evenly. This sits next to raw pace/filler/pause counts the app already computes by counting, so do NOT restate a words-per-minute number, a filler word count, or a pause count — say something about the pattern or moment those numbers can't capture on their own, and explain what's behind deliveryScore. Empty string if the transcript is too short to say anything real about delivery.",
  "wordChoiceScore": <integer 0-100: YOUR OWN holistic judgment of the quality of the vocabulary and phrasing used — vividness, precision, variety, whether strong/precise words land naturally in context rather than feeling dropped in. This is NOT a count of words matching any fixed list — judge the actual writing, so a strong, precise word choice that isn't on any list still scores well, and a listed "power word" used awkwardly doesn't get free credit>,
  "wordChoiceNote": "1-2 sentences reading the actual vocabulary used — is it vivid, specific, and varied, or vague and repetitive; do strong/precise words land naturally in context or feel dropped in; is there a word or phrase leaned on too often. Go beyond naming which listed words appeared — say something about the writing itself a fixed list can't capture, and explain what's behind wordChoiceScore. Empty string if the transcript is too short to say anything real about word choice.",
  "strongPhrases": ["up to 3 short exact quotes from the transcript that best show strong, vivid, or precise word choice — copied verbatim, empty array if nothing stands out"],
  "weakPhrases": ["up to 3 short exact quotes from the transcript that best show vague, repetitive, or weak word choice — copied verbatim, empty array if nothing stands out"]
}

openingPct + bodyPct + closingPct must sum to exactly 100. deliveryScore and wordChoiceScore must be your own independent judgment based on reading/hearing the transcript as a whole, not a tally of words matching some list. Quotes for strongestLine/tightenLine/strongPhrases/weakPhrases must be copied exactly from the transcript, not paraphrased. Be encouraging but honest. Respond with the JSON object only.`;
}

// Rescales whatever the model returned so the three segments always sum to
// exactly 100 — a small/medium model asked for three independent integers
// won't reliably hit 100 on its own, and a bar chart of 3 segments that
// don't sum to 100 either leaves a gap or overflows. Pure math, not another
// model call, so it can't introduce a new inconsistency.
function normalizeStructurePcts(openingRaw, bodyRaw, closingRaw) {
  const o = Math.max(0, Number(openingRaw) || 0);
  const b = Math.max(0, Number(bodyRaw) || 0);
  const c = Math.max(0, Number(closingRaw) || 0);
  const sum = o + b + c;
  if (sum <= 0) return { openingPct: 0, bodyPct: 0, closingPct: 0 };
  const scale = 100 / sum;
  const openingPct = Math.round(o * scale);
  const bodyPct = Math.round(b * scale);
  // closing absorbs the rounding remainder so the three always sum to
  // exactly 100 (rather than each rounding independently and drifting).
  const closingPct = Math.max(0, 100 - openingPct - bodyPct);
  return { openingPct, bodyPct, closingPct };
}

// Models occasionally wrap valid JSON in ```json fences or add a stray
// sentence despite instructions — this pulls out the first {...} block
// before parsing so those don't cause an otherwise-fine response to fail.
function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

// Shared 0-100 integer clamp for every AI-judged score in this file
// (deliveryScore/wordChoiceScore here, exercise-fit's score below) — a
// small/medium model asked for "0-100" won't always stay in range or return
// an integer, so this is the one place that guarantee gets enforced rather
// than trusting the model's raw output everywhere it's rendered.
function clampScore(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

// Trims/dedupes/caps a model-returned array of quote strings — used for
// strongPhrases/weakPhrases/evidenceQuotes. Tolerant of the model returning
// something other than an array (falls back to empty) since this rides on
// the same "never crash the panel over a malformed field" philosophy as the
// rest of this file's parsing.
function sanitizePhrases(raw, max) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

function parseAiResponse(rawText) {
  const text = (rawText || "").trim();
  try {
    const data = JSON.parse(extractJsonObject(text));
    const hasStructure =
      Number.isFinite(data.openingPct) || Number.isFinite(data.bodyPct) || Number.isFinite(data.closingPct);
    const tightenLine = typeof data.tightenLine === "string" ? data.tightenLine.trim() : "";
    return {
      summary: typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : text,
      structure: hasStructure
        ? {
            ...normalizeStructurePcts(data.openingPct, data.bodyPct, data.closingPct),
            idealOpeningPct: IDEAL_OPENING_PCT,
            idealBodyPct: IDEAL_BODY_PCT,
            idealClosingPct: IDEAL_CLOSING_PCT,
            note: typeof data.structureNote === "string" ? data.structureNote.trim() : "",
          }
        : null,
      strongestLine:
        typeof data.strongestLine === "string" && data.strongestLine.trim() ? data.strongestLine.trim() : null,
      tighten: tightenLine
        ? { line: tightenLine, suggestion: typeof data.tightenSuggestion === "string" ? data.tightenSuggestion.trim() : "" }
        : null,
      // Same model call, same transcript read — these ride along on the
      // Structure request instead of firing their own separate Groq calls,
      // so Delivery and Words get a qualitative read too without doubling
      // how much of the shared free-tier quota one session uses.
      deliveryNote:
        typeof data.deliveryNote === "string" && data.deliveryNote.trim() ? data.deliveryNote.trim() : null,
      wordChoiceNote:
        typeof data.wordChoiceNote === "string" && data.wordChoiceNote.trim() ? data.wordChoiceNote.trim() : null,
      // The model's own holistic judgment — this is now the primary grade
      // for Delivery/Words, not the fixed word-list scans in analysis.js
      // (those still render, but as fallback/supporting evidence — see
      // Reflect.jsx). null (not 0) when the model didn't return a usable
      // number, so the UI can tell "the model said zero" apart from "we
      // don't have a score to show".
      deliveryScore: clampScore(data.deliveryScore),
      wordChoiceScore: clampScore(data.wordChoiceScore),
      strongPhrases: sanitizePhrases(data.strongPhrases, 3),
      weakPhrases: sanitizePhrases(data.weakPhrases, 3),
    };
  } catch {
    // Model didn't return valid JSON — still show something rather than
    // erroring out entirely; the raw text becomes the summary.
    return {
      summary: text,
      structure: null,
      strongestLine: null,
      tighten: null,
      deliveryNote: null,
      wordChoiceNote: null,
      deliveryScore: null,
      wordChoiceScore: null,
      strongPhrases: [],
      weakPhrases: [],
    };
  }
}

// --- Exercise-specific "did you actually do the assignment" judgment ------
// buildCoachingPrompt above asks the same question for every exercise
// (structure/clarity/word choice). This asks a different, narrower question
// depending on which exercise was just done — the kind of conceptual call a
// word-list scan can't make, like "was word_of_day's target word used with
// its actual meaning" or "is this Explain It Simply answer simple *and*
// actually correct". See exerciseEvaluation.js for the deterministic
// word/phrase counts this supplements (not replaces) in the UI.
function buildExerciseFitPrompt(typeId, { exerciseTitle, promptText, transcript, word, wordDefinition, pair }) {
  const instructionsByType = {
    word_of_day: `The exercise required using the word "${word}" (meaning: "${wordDefinition}") naturally inside a real sentence, with its actual meaning — not just naming the word in isolation, and not using it with the wrong meaning.

Judge:
1. Did they use "${word}" inside an actual sentence (not just saying the word on its own)?
2. Does their usage match its real meaning ("${wordDefinition}")? A grammatically fine sentence that uses the word with the wrong meaning should score low.

Respond with ONLY a JSON object, no markdown, no extra text:
{
  "score": <integer 0-100: 100 = used naturally and correctly at least once, 50 = used but the meaning is shaky or half-right, 0 = not used, or used with the wrong meaning>,
  "verdict": "a 2-5 word label, e.g. 'Used correctly', 'Wrong meaning', 'Not used'",
  "summary": "2-3 sentences: did they use it in a real sentence, and did they get the meaning right? Be specific about what they actually said.",
  "evidenceQuotes": ["up to 2 exact quotes from the transcript backing your verdict — e.g. the sentence where they used the word — copied verbatim, empty array if they never used it"]
}`,

    word_ladder: `The exercise was to connect the two words "${pair?.[0]}" and "${pair?.[1]}" in one continuous riff — genuinely linking them with a real idea, not just mentioning both somewhere unrelated.

Judge whether both words were used AND whether there's an actual coherent connection drawn between them (a real link, image, or idea — not two unrelated sentences that each happen to contain one word).

Respond with ONLY a JSON object:
{
  "score": <integer 0-100: 100 = both words used with a genuinely coherent link between them, 50 = both used but the link is weak or forced, 0 = one or both words missing, or no real connection attempted>,
  "verdict": "a 2-5 word label, e.g. 'Strong connection', 'Words used, no link', 'Missing a word'",
  "summary": "2-3 sentences on how they connected the two words, or why they didn't.",
  "evidenceQuotes": ["up to 2 exact quotes from the transcript where they drew the connection, verbatim — empty array if none"]
}`,

    explain_simply: `The exercise was to explain "${promptText}" as if to a five-year-old — plain words, concrete comparisons, no jargon, and crucially, a correct and complete-enough explanation of the actual concept, not just simple-sounding filler.

Judge whether a five-year-old could actually follow it AND whether the explanation is substantively correct/complete enough to count as a real explanation.

Respond with ONLY a JSON object:
{
  "score": <integer 0-100: 100 = a five-year-old could follow it and it's a genuinely correct, complete explanation, 50 = simple but thin/vague or partly incorrect, 0 = too complex, or substantively wrong>,
  "verdict": "a 2-5 word label, e.g. 'Clear and correct', 'Too vague', 'Too technical'",
  "summary": "2-3 sentences on where it succeeded or lost the simple thread.",
  "evidenceQuotes": ["up to 2 exact quotes that best show the issue (or the strongest simplifying moments if it went well), verbatim — empty array if none stand out"]
}`,

    snap_opinion: `The exercise was to pick a side on "${promptText}" and make the case for it — a real stance with real reasoning, not a list of pros and cons with no side taken.

Judge whether they actually took a side and whether the reasoning for it holds up as a real argument, rather than restating the question or listing both sides evenly.

Respond with ONLY a JSON object:
{
  "score": <integer 0-100: 100 = clear side with genuinely convincing reasoning, 50 = a side is taken but the reasoning is thin or circular, 0 = no real side taken, or the reasoning doesn't support the stance>,
  "verdict": "a 2-5 word label, e.g. 'Clear and convincing', 'Sat on the fence', 'Weak reasoning'",
  "summary": "2-3 sentences on the strength of the stance and the argument for it.",
  "evidenceQuotes": ["up to 2 exact quotes that state their stance or best reasons, verbatim — empty array if none"]
}`,

    wiki_roulette: `The exercise ("Reflection Roulette") asked a personal or philosophical question and wanted a genuine, specific, first-person reflection — not a generic or hypothetical answer that dodges the personal angle.

Judge whether the response is actually personal and specific (a real memory, feeling, or belief of theirs) rather than a vague generalization or a third-person answer about "people in general".

Respond with ONLY a JSON object:
{
  "score": <integer 0-100: 100 = genuinely personal, specific, reflective, 50 = somewhat personal but stays fairly generic, 0 = generic/impersonal, dodges the question>,
  "verdict": "a 2-5 word label, e.g. 'Genuinely personal', 'Stayed generic', 'Dodged the question'",
  "summary": "2-3 sentences on how personal and specific the reflection actually was.",
  "evidenceQuotes": ["up to 2 exact quotes that are most personal/specific, verbatim — empty array if none stand out"]
}`,
  };

  const body = instructionsByType[typeId];
  if (!body) return null;

  return `You are a specific, honest speaking coach grading ONE narrow thing about a short practice recording — not overall speaking quality, just whether they actually did what this particular exercise asked.

Exercise: ${exerciseTitle}
They were asked: "${promptText}"

Transcript:
"""
${transcript}
"""

${body}`;
}

function parseExerciseFitResponse(rawText) {
  const text = (rawText || "").trim();
  try {
    const data = JSON.parse(extractJsonObject(text));
    return {
      score: clampScore(data.score),
      verdict: typeof data.verdict === "string" && data.verdict.trim() ? data.verdict.trim() : null,
      summary: typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : text,
      evidenceQuotes: sanitizePhrases(data.evidenceQuotes, 2),
    };
  } catch {
    // Model didn't return valid JSON — still show something rather than
    // erroring out entirely; the raw text becomes the summary.
    return { score: null, verdict: null, summary: text, evidenceQuotes: [] };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The Edge Function already retries a rate-limited request against a
// separate free-tier model bucket server-side (see the ai-feedback function)
// — this is what's left after that: if the server-side fallback ALSO comes
// back 429 (both model buckets briefly saturated by concurrent users on the
// shared free tier), one client-side retry after a short random delay is
// enough to smooth over a momentary spike without hammering an already-tight
// quota with an aggressive retry loop. Only retries on 429 specifically —
// every other error (bad auth, network down, malformed prompt) fails fast.
function isRateLimitError(error) {
  const status = error?.context?.status ?? error?.status;
  return status === 429;
}

// supabase-js doesn't populate `data` on a non-2xx response (only `error`,
// whose `.context` is the raw, not-yet-read Response) — so the Edge
// Function's actual JSON body (the specific error message, and the
// rate_limited/scope fields the ai-feedback function now sends — see
// supabase/functions/ai-feedback/index.ts) has to be read off there
// instead of `data`. Tolerant of the body already being consumed or not
// being JSON, since this is a "nice to have a better message" path, not
// something that should itself throw.
async function readFunctionErrorBody(error) {
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === "function") return await ctx.json();
  } catch {
    // ignore — caller falls back to a generic message
  }
  return null;
}

// Thin wrapper around supabase.functions.invoke("ai-feedback", ...) — the
// Edge Function that actually talks to Groq (see
// supabase/functions/ai-feedback/index.ts). Centralizes the two failure
// modes worth surfacing distinctly: the request itself failing (network/
// auth/Edge Function down) vs. the model responding with something that
// doesn't parse as JSON (handled by the callers' own parse* functions, not
// here).
async function callAiFeedback({ prompt, model, format = "json", temperature, maxTokens, timeoutMs, retriesLeft = 1 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let result;
  try {
    result = await supabase.functions.invoke("ai-feedback", {
      body: { prompt, model, format, temperature, maxTokens },
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`Timed out waiting for "${model}". Try again in a moment.`);
    }
    throw new Error("Couldn't reach the AI feedback service. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  const { data, error } = result;
  if (error) {
    if (isRateLimitError(error)) {
      const body = await readFunctionErrorBody(error);
      // A 429 with code "rate_limited"/scope "day" is THIS account's own
      // daily cap (see check_rate_limit() in supabase/schema.sql) — not
      // Groq's shared free-tier bucket being briefly busy. Retrying can't
      // help (the cap doesn't reset for hours) and would just spend another
      // check against the same limit, so this fails immediately with the
      // real reason instead of falling into the generic retry-then-"high
      // demand" path below, which is for Groq's own transient 429s.
      if (body?.code === "rate_limited" && body?.scope === "day") {
        throw new Error(body.error || "You've reached today's AI feedback limit for your account — it resets at midnight UTC.");
      }
      if (retriesLeft > 0) {
        await sleep(600 + Math.random() * 700);
        return callAiFeedback({ prompt, model, format, temperature, maxTokens, timeoutMs, retriesLeft: retriesLeft - 1 });
      }
      throw new Error(body?.error || "AI feedback is in high demand right now (shared free-tier quota) — try again in a minute.");
    }
    throw new Error(data?.error || error.message || "AI feedback service returned an error.");
  }
  return data?.response || "";
}

// typeId with no case in buildExerciseFitPrompt's instructionsByType (a
// future exercise type without a dedicated judgment yet) resolves to null
// rather than throwing, so callers can just skip rendering the AI section.
export async function getExerciseFitAiFeedback({
  typeId,
  exerciseTitle,
  promptText,
  transcript,
  word,
  wordDefinition,
  pair,
  model = DEFAULT_MODEL,
  timeoutMs = 45000,
}) {
  if (!transcript || !transcript.trim()) {
    throw new Error("No transcript to judge for this session.");
  }
  const prompt = buildExerciseFitPrompt(typeId, { exerciseTitle, promptText, transcript, word, wordDefinition, pair });
  if (!prompt) return null;

  // Same reasoning-token-budget issue as getAiFeedback above, smaller
  // schema here so a smaller bump covers it. +100 over the previous 550 for
  // evidenceQuotes now being a short array instead of one string.
  const responseText = await callAiFeedback({ prompt, model, temperature: 0.4, maxTokens: 650, timeoutMs });
  return parseExerciseFitResponse(responseText);
}

// Throws descriptive errors instead of failing silently, so Reflect.jsx can
// show a one-line explanation rather than a silent blank AI section.
export async function getAiFeedback({
  exerciseTitle,
  promptText,
  transcript,
  model = DEFAULT_MODEL,
  timeoutMs = 45000,
}) {
  if (!transcript || !transcript.trim()) {
    throw new Error("No transcript to give feedback on for this session.");
  }
  const prompt = buildCoachingPrompt({ exerciseTitle, promptText, transcript });
  // 1100, not 900: GPT-OSS is a reasoning model, and its internal reasoning
  // tokens are drawn from this same budget even though include_reasoning:
  // false (see the ai-feedback Edge Function) keeps them out of the visible
  // response. A tight budget here doesn't trim the reasoning — it starves
  // the actual JSON answer after the reasoning eats most or all of it,
  // which came back as a "successful" but empty Structure tab rather than
  // an error. Ten JSON fields now (summary/structure/two line calls/
  // delivery score+note/word-choice score+note/two short phrase arrays)
  // need real headroom regardless — the 200 token bump over the old 900
  // covers the four new fields without meaningfully denting the shared
  // per-session token budget (see the redesign plan doc for the math).
  const responseText = await callAiFeedback({ prompt, model, temperature: 0.6, maxTokens: 1100, timeoutMs });
  return parseAiResponse(responseText);
}
