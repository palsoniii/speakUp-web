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

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

// Kept in sync with src/lib/aiCoach.js's DEFAULT_MODEL — Llama 3.3 70B on
// Groq is free-tier, open-weight, and a large step up in judgment quality
// from the 8B model this app used to run locally via Ollama.
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

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

    const body: Record<string, unknown> = {
      model: model || DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: temperature ?? 0.5,
      max_tokens: maxTokens ?? 500,
    };
    // Groq's OpenAI-compatible JSON mode — same idea as Ollama's `format:
    // "json"` this replaces, still requires the prompt itself to ask for JSON
    // (already true of every prompt aiCoach.js builds).
    if (format === "json") body.response_format = { type: "json_object" };

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Groq error (${groqRes.status}): ${text || "unknown error"}` }), {
        status: groqRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await groqRes.json();
    const response = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
