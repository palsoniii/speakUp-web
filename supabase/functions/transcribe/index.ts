// Hosted transcription proxy — forwards a recorded clip to Groq's free
// Whisper endpoint and returns { transcript, segments } in the same shape
// src/lib/whisper.js's local whisper-server client already returns, so
// analysis.js's segment handling doesn't need to know which source it got.
//
// Why this exists: the local whisper-server (see /whisper-server) only
// works for whoever is running it on their own machine — fine for local
// dev, useless for anyone using the deployed site. This is the fallback
// that makes verbatim (disfluencies-included) transcription work for every
// visitor with no local setup. GROQ_API_KEY stays server-side, same
// reasoning as ai-feedback/index.ts. verify_jwt=true so only signed-in
// SpeakUp users can spend our Groq transcription quota.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

// Auto-injected into every Edge Function's environment — see the same note
// in ai-feedback/index.ts.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Per-signed-in-user caps — see check_rate_limit() in supabase/schema.sql.
// Unlike ai-feedback, a completed session normally costs exactly ONE call
// here (only when the local whisper-server isn't running — see
// src/lib/whisper.js), so 20/day is already 4x the "5 sessions a day"
// floor this app is sized for at ~55 users, while still keeping any single
// account to 1% of Groq's 2,000/day free-tier transcription bucket.
const RATE_LIMIT_PER_MINUTE = 5;
const RATE_LIMIT_PER_DAY = 20;

// Free-tier, fast, and — crucially — same as the local server's default
// verbatim behavior: no aggressive disfluency cleanup, so filler words this
// app is specifically trying to measure survive the transcript.
const MODEL = "whisper-large-v3-turbo";

// A real ~2 minute practice recording (webm/opus) is a few MB at most —
// this exists to cap the blast radius of a bug or a signed-in user
// deliberately uploading oversized files, since every request here draws
// against one shared Groq free-tier quota.
const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB

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
    const incomingForm = await req.formData();
    const audio = incomingForm.get("audio");
    if (!audio || !(audio instanceof File)) {
      return new Response(JSON.stringify({ error: "Missing 'audio' file in form data." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return new Response(JSON.stringify({ error: `Audio file too large (max ${MAX_AUDIO_BYTES / (1024 * 1024)}MB).` }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Per-user throttle — see the matching block + comment in
    // ai-feedback/index.ts for why this forwards the caller's own JWT
    // (scopes the count to this one account) and fails open on an infra
    // error rather than blocking transcription outright.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: limitResult, error: limitError } = await userClient.rpc("check_rate_limit", {
      p_function: "transcribe",
      p_max_per_minute: RATE_LIMIT_PER_MINUTE,
      p_max_per_day: RATE_LIMIT_PER_DAY,
    });
    if (limitError) {
      console.error("check_rate_limit failed, allowing request through:", limitError.message);
    } else if (limitResult !== "ok") {
      const message =
        limitResult === "minute"
          ? "You're requesting transcription a little fast — wait a few seconds and try again."
          : "You've reached today's transcription limit for your account (there's plenty left for everyone else) — it resets at midnight UTC.";
      return new Response(JSON.stringify({ error: message, code: "rate_limited", scope: limitResult }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SpeakUp's exercise prompt / target word, passed through as Whisper's
    // initial prompt so it's primed toward that vocabulary — identical intent
    // to the local server's `context` param (see whisper-server/server.py).
    const context = (incomingForm.get("context") as string | null) || "";

    const groqForm = new FormData();
    groqForm.append("file", audio, "recording.webm");
    groqForm.append("model", MODEL);
    groqForm.append("response_format", "verbose_json");
    if (context) groqForm.append("prompt", context.slice(0, 400));

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: groqForm,
    });

    if (!groqRes.ok) {
      const text = await groqRes.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Groq error (${groqRes.status}): ${text || "unknown error"}` }), {
        status: groqRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await groqRes.json();
    const segments = Array.isArray(data.segments)
      ? data.segments.map((s: { text: string; start: number; end: number }) => ({
          text: (s.text || "").trim(),
          start: s.start,
          end: s.end,
        }))
      : [];
    const transcript = (data.text || segments.map((s: { text: string }) => s.text).join(" ")).trim();

    return new Response(JSON.stringify({ transcript, segments, language: data.language }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
