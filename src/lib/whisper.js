// Verbatim transcription (disfluencies included) via Whisper, tried in two
// places in order:
//
//  1. A local Whisper server on this machine (see whisper-server/), if it's
//     running — zero network hop, nothing leaves the device.
//  2. The hosted `transcribe` Supabase Edge Function, which forwards the
//     clip to Groq's free-tier Whisper API (see
//     supabase/functions/transcribe/index.ts). This is what makes
//     transcription actually work for anyone using the deployed site
//     without them installing anything locally — the local server only
//     ever helps the one machine it's running on.
//
// Both preserve filler words ("um"/"uh"/"er") the way the browser's built-in
// SpeechRecognition (used only for live on-screen captions — see speech.js)
// does not: that API sends audio to a cloud dictation service whose
// "cleaned transcript" post-processing strips disfluencies before they ever
// reach this app, which is exactly the signal filler-word detection needs.
// Record.jsx prefers whichever of the two responds; if both are
// unavailable, it falls back to whatever the browser's live captions
// captured.
import { supabase } from "./supabaseClient";

const WHISPER_BASE = "http://localhost:8765";

// Cheap existence check (hits /health, not /transcribe) so we can commit to
// one path with its full timeout budget rather than racing an actual audio
// upload against a short timeout — a real local transcription of a ~2
// minute clip can legitimately take a while the first time a model is
// warming up, and cutting that off early would wrongly bounce every local
// request to the hosted path.
async function isLocalWhisperUp() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${WHISPER_BASE}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function transcribeLocal(blob, context, timeoutMs) {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  if (context) form.append("context", context);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${WHISPER_BASE}/transcribe`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Whisper server error (${res.status})`);
    const data = await res.json();
    return { transcript: data.transcript || "", segments: data.segments || [], source: "whisper_local" };
  } finally {
    clearTimeout(timer);
  }
}

// supabase-js leaves `data` empty on a non-2xx response, so the Edge
// Function's real error text (including the per-user daily-limit message
// from check_rate_limit() — see supabase/functions/transcribe/index.ts)
// has to be read off `error.context` (the raw Response) instead. Same
// pattern as aiCoach.js's readFunctionErrorBody, kept local here rather
// than shared since it's a few lines and the two files' error shapes could
// legitimately drift.
async function readFunctionErrorBody(error) {
  try {
    const ctx = error?.context;
    if (ctx && typeof ctx.json === "function") return await ctx.json();
  } catch {
    // ignore — caller falls back to a generic message
  }
  return null;
}

async function transcribeHosted(blob, context, timeoutMs) {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");
  if (context) form.append("context", context);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { data, error } = await supabase.functions.invoke("transcribe", {
      body: form,
      signal: controller.signal,
    });
    if (error) {
      const body = await readFunctionErrorBody(error);
      const err = new Error(body?.error || data?.error || error.message || "Hosted transcription failed.");
      // Lets callers (Record.jsx) tell "you hit your own daily transcription
      // cap" apart from every other failure (network hiccup, Groq down,
      // local server unreachable) — see check_rate_limit() in
      // supabase/schema.sql and the matching block in
      // supabase/functions/transcribe/index.ts for where these come from.
      // Everything else stays a silent fallback to the browser's live
      // captions (if any); this one specific case is worth telling the
      // person about since it explains a real gap in their feedback, not
      // just a transient blip.
      if (body?.code === "rate_limited") {
        err.code = body.code;
        err.scope = body.scope;
      }
      throw err;
    }
    return { transcript: data?.transcript || "", segments: data?.segments || [], source: "whisper_hosted" };
  } finally {
    clearTimeout(timer);
  }
}

// Transcribing a ~2 minute clip on CPU can take a while the first time a
// local model is warming up, hence the generous timeout — Record.jsx shows
// a "Transcribing…" state while this runs rather than blocking silently.
//
// `context` (optional) is whatever SpeakUp already knows this recording is
// about — the exercise prompt, and the exact target word for Word of the
// Day — passed through as Whisper's initial_prompt so it's primed to
// recognize that specific vocabulary instead of guessing at the nearest
// sound-alike. See the comment in whisper-server/server.py and
// supabase/functions/transcribe/index.ts.
export async function transcribeWithWhisper(blob, context = "", { timeoutMs = 90000 } = {}) {
  if (!blob) throw new Error("No recording to transcribe.");

  if (await isLocalWhisperUp()) {
    return transcribeLocal(blob, context, timeoutMs);
  }
  return transcribeHosted(blob, context, timeoutMs);
}
