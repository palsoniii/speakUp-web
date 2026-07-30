# SpeakUp — Web

Daily spoken-fluency practice, as a plain web app (Vite + React). No mobile app.

Real accounts now (Supabase Auth) — sessions, streak, badges, and settings live in your account and follow you across devices, not tied to one browser like the old localStorage-only version.

## Set up Supabase (one-time)

1. Create a free project at [supabase.com](https://supabase.com) — no credit card needed.
2. In the Supabase dashboard: **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and run it. This creates the `sessions`/`settings` tables, the `recordings` storage bucket, and the Row Level Security policies that keep every account's data separate.
3. In **Project Settings → API**, copy your Project URL and `anon` `public` key.
4. In this repo, copy `.env.example` to `.env` and fill those two values in.
5. By default, new accounts need to click a confirmation link sent to their email before they can sign in. For quick local testing you can turn that off in **Authentication → Providers → Email → Confirm email**, but leave it on for a real deployment.
6. "Forgot password" emails link back to this app's own URL — add every URL you run this from (`http://localhost:5173` for local dev, plus your real deployed domain once you have one) to **Authentication → URL Configuration → Redirect URLs**, or those emails will bounce visitors to the wrong place.
7. Recommended, free: **Authentication → Policies → Password → enable "Leaked password protection"** — rejects passwords that show up in known breach databases, checked via HaveIBeenPwned.

## Set up hosted AI (one-time)

AI coaching and transcription run through two Supabase Edge Functions (`supabase/functions/ai-feedback` and `supabase/functions/transcribe`), which forward requests to [Groq](https://console.groq.com) — a free-tier API that hosts open-weight models (Llama, Qwen, Whisper) at very fast inference speed. This is what makes both features work for every visitor to the deployed site, not just whoever has Ollama/whisper-server running on their own machine.

1. Create a free Groq API key at [console.groq.com/keys](https://console.groq.com/keys) — no credit card needed. Free tier is roughly 1,000 chat requests/day and 2,000 transcription requests/day, far more than a single user needs.
2. Deploy the two functions in `supabase/functions/` to your project (via the Supabase CLI: `supabase functions deploy ai-feedback` and `supabase functions deploy transcribe` — or paste each `index.ts` into the dashboard's Edge Functions editor).
3. Set the key as a server-side secret so it never reaches the browser: `supabase secrets set GROQ_API_KEY=your-key-here` (or **Project Settings → Edge Functions → Secrets** in the dashboard).

Both functions require a signed-in Supabase session (`verify_jwt: true`), so only your app's own users can spend your Groq quota.

### Optional: local Whisper for faster/offline dev

`whisper-server/` (a small Python server, see its own README) still works exactly as before for local development — `transcribeWithWhisper` in `src/lib/whisper.js` checks for it first and only falls back to the hosted Groq function if it isn't running. Nothing about running it locally changed; it's just no longer required for the app to work for anyone else.

## Run it

```
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Grant microphone access when prompted — needed to record practice sessions. If `.env` isn't set up yet, the app shows a setup screen instead of the login page.

For a production build:

```
npm run build
npm run preview
```

`dist/` is a static folder — deployable to any static host (Vercel, Netlify, GitHub Pages, etc.). Remember to set the same `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` as environment variables in that host's dashboard — `.env` itself isn't deployed (it's git-ignored). `GROQ_API_KEY` is a Supabase secret, not a frontend env var — it's never set here.

Recordings upload to Supabase Storage on save (a public bucket — reachable by anyone with the exact link, which embeds a random session id, but not otherwise access-controlled; see the note in `supabase/schema.sql` if you want to harden that to private + signed URLs later). Session metadata, transcripts, and feedback live in Postgres, gated by Row Level Security so an account only ever sees its own rows.

## What's in v1

- **Home** — today's exercise, streak, minutes spoken, 7-day activity strip, quick access to all 5 exercise types.
- **5 exercise types**: Wiki Roulette, Explain It Simply, Snap Opinion, Word of the Day, Word Ladder — each with its own prep/speak timers and content bank (`src/lib/content.js`).
- **Practice flow**: prep countdown → timed recording (browser MediaRecorder API) → playback → self-rating + optional note.
- **History** — every past session with playback, notes, and mood rating.
- **Settings** — reminder toggle (preference only, not wired to real notifications), exercise reference list, about section.

## What's not in yet

Real browser push notifications for the daily reminder (the toggle in Settings currently just stores a preference).

## Browser support note

Recording requires `MediaRecorder` + microphone permission, supported in current Chrome, Firefox, Edge, and Safari. Needs HTTPS (or localhost) to access the mic — that's a browser security requirement, not something this app can work around.

## Project structure

```
src/
  App.jsx                  auth-gated routing (Supabase session state, plain React state otherwise — no router lib)
  screens/                 Home, History, Settings, Login, ResetPassword, Roulette, Prep, Record, Reflect
  components/UI.jsx        shared Card/Button/Pill/Switch/Text components
  lib/content.js           exercise types + prompt/topic/vocab banks + daily assignment
  lib/supabaseClient.js    Supabase client + "is it configured" check
  lib/auth.js              sign up / sign in / sign out / password reset / session helpers
  lib/storage.js           Supabase-backed sessions/settings/recordings + streak/stat calculations
  lib/badges.js            badge definitions + which ones are earned
  lib/analysis.js          rule-based speaking feedback (pace, fillers, power/weak words, articulation score)
  lib/aiCoach.js            AI coaching (structure, strongest line, tighten-this) via the ai-feedback Edge Function
  lib/whisper.js           Whisper transcription client — local server first, hosted Edge Function fallback
  lib/recorder.js          MediaRecorder wrapper hook
  index.css                theme + all styling
supabase/schema.sql        tables, Row Level Security policies, storage bucket — run once per project
supabase/functions/
  ai-feedback/             Edge Function: proxies coaching prompts to Groq (holds GROQ_API_KEY)
  transcribe/              Edge Function: proxies audio to Groq's hosted Whisper (holds GROQ_API_KEY)
whisper-server/            optional local Whisper server for local dev — see its own README
```
