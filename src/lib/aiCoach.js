// Qualitative coaching feedback via a hosted, free-tier open-weight model
// (Llama 3.3 70B on Groq, by default — see DEFAULT_MODEL below), reached
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

// Free-tier on Groq (console.groq.com) — open-weight (Meta), no cost, and a
// large step up in judgment quality from the 8B model this app ran locally
// before. Swappable per-request via the `model` param (see storage.js's
// aiFeedbackModel setting) — e.g. "qwen/qwen3-32b" for a faster/cheaper
// alternative, or "openai/gpt-oss-20b" for the smallest/fastest option.
// Full current list: https://console.groq.com/docs/models
export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

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
  "tightenSuggestion": "one sentence on why to cut or tighten that line — empty string if tightenLine is empty"
}

openingPct + bodyPct + closingPct must sum to exactly 100. Quotes for strongestLine/tightenLine must be copied exactly from the transcript, not paraphrased. Be encouraging but honest. Respond with the JSON object only.`;
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
    };
  } catch {
    // Model didn't return valid JSON — still show something rather than
    // erroring out entirely; the raw text becomes the summary.
    return { summary: text, structure: null, strongestLine: null, tighten: null };
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
  "evidenceQuote": "the exact sentence from the transcript where they used the word, verbatim — empty string if they never used it"
}`,

    word_ladder: `The exercise was to connect the two words "${pair?.[0]}" and "${pair?.[1]}" in one continuous riff — genuinely linking them with a real idea, not just mentioning both somewhere unrelated.

Judge whether both words were used AND whether there's an actual coherent connection drawn between them (a real link, image, or idea — not two unrelated sentences that each happen to contain one word).

Respond with ONLY a JSON object:
{
  "score": <integer 0-100: 100 = both words used with a genuinely coherent link between them, 50 = both used but the link is weak or forced, 0 = one or both words missing, or no real connection attempted>,
  "verdict": "a 2-5 word label, e.g. 'Strong connection', 'Words used, no link', 'Missing a word'",
  "summary": "2-3 sentences on how they connected the two words, or why they didn't.",
  "evidenceQuote": "the exact sentence(s) where they drew the connection, verbatim — empty string if none"
}`,

    explain_simply: `The exercise was to explain "${promptText}" as if to a five-year-old — plain words, concrete comparisons, no jargon, and crucially, a correct and complete-enough explanation of the actual concept, not just simple-sounding filler.

Judge whether a five-year-old could actually follow it AND whether the explanation is substantively correct/complete enough to count as a real explanation.

Respond with ONLY a JSON object:
{
  "score": <integer 0-100: 100 = a five-year-old could follow it and it's a genuinely correct, complete explanation, 50 = simple but thin/vague or partly incorrect, 0 = too complex, or substantively wrong>,
  "verdict": "a 2-5 word label, e.g. 'Clear and correct', 'Too vague', 'Too technical'",
  "summary": "2-3 sentences on where it succeeded or lost the simple thread.",
  "evidenceQuote": "the sentence that best shows the issue (or the strongest simplifying moment if it went well), verbatim — empty string if none stands out"
}`,

    snap_opinion: `The exercise was to pick a side on "${promptText}" and make the case for it — a real stance with real reasoning, not a list of pros and cons with no side taken.

Judge whether they actually took a side and whether the reasoning for it holds up as a real argument, rather than restating the question or listing both sides evenly.

Respond with ONLY a JSON object:
{
  "score": <integer 0-100: 100 = clear side with genuinely convincing reasoning, 50 = a side is taken but the reasoning is thin or circular, 0 = no real side taken, or the reasoning doesn't support the stance>,
  "verdict": "a 2-5 word label, e.g. 'Clear and convincing', 'Sat on the fence', 'Weak reasoning'",
  "summary": "2-3 sentences on the strength of the stance and the argument for it.",
  "evidenceQuote": "the sentence that states their stance or best reason, verbatim — empty string if none"
}`,

    wiki_roulette: `The exercise ("Reflection Roulette") asked a personal or philosophical question and wanted a genuine, specific, first-person reflection — not a generic or hypothetical answer that dodges the personal angle.

Judge whether the response is actually personal and specific (a real memory, feeling, or belief of theirs) rather than a vague generalization or a third-person answer about "people in general".

Respond with ONLY a JSON object:
{
  "score": <integer 0-100: 100 = genuinely personal, specific, reflective, 50 = somewhat personal but stays fairly generic, 0 = generic/impersonal, dodges the question>,
  "verdict": "a 2-5 word label, e.g. 'Genuinely personal', 'Stayed generic', 'Dodged the question'",
  "summary": "2-3 sentences on how personal and specific the reflection actually was.",
  "evidenceQuote": "the most personal/specific sentence they said, verbatim — empty string if none stands out"
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
    const score = Number.isFinite(Number(data.score)) ? Math.max(0, Math.min(100, Math.round(Number(data.score)))) : null;
    return {
      score,
      verdict: typeof data.verdict === "string" && data.verdict.trim() ? data.verdict.trim() : null,
      summary: typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : text,
      evidenceQuote: typeof data.evidenceQuote === "string" && data.evidenceQuote.trim() ? data.evidenceQuote.trim() : null,
    };
  } catch {
    // Model didn't return valid JSON — still show something rather than
    // erroring out entirely; the raw text becomes the summary.
    return { score: null, verdict: null, summary: text, evidenceQuote: null };
  }
}

// Thin wrapper around supabase.functions.invoke("ai-feedback", ...) — the
// Edge Function that actually talks to Groq (see
// supabase/functions/ai-feedback/index.ts). Centralizes the two failure
// modes worth surfacing distinctly: the request itself failing (network/
// auth/Edge Function down) vs. the model responding with something that
// doesn't parse as JSON (handled by the callers' own parse* functions, not
// here).
async function callAiFeedback({ prompt, model, format = "json", temperature, maxTokens, timeoutMs }) {
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

  const responseText = await callAiFeedback({ prompt, model, temperature: 0.4, maxTokens: 350, timeoutMs });
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
  const responseText = await callAiFeedback({ prompt, model, temperature: 0.6, maxTokens: 500, timeoutMs });
  return parseAiResponse(responseText);
}
