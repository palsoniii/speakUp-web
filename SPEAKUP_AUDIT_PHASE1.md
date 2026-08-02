# Speak Up — Pre-Deployment Audit, Phase 1 (Full Audit)

Date: 2026-08-02
Scope: full repo read (`src/`, `supabase/`, `whisper-server/`, configs), `git log`/`git status` for secret history, `npm audit` for dependency CVEs. No access to the Supabase dashboard, Groq account, or hosting provider — anything gated behind those is called out explicitly below rather than assumed.

## 1. Architecture map

Speak Up is a Vite + React 19 single-page app (no server of its own) backed entirely by Supabase (Postgres + Auth + Storage + Edge Functions):

- **Client** (`src/`) — screens for a fixed practice loop (Pick → Roulette → Prep → Record → Reflect → Celebrate), plus Home/Progress/Badges/Settings. Talks to Supabase directly via `@supabase/supabase-js` using the public `anon` key (`src/lib/supabaseClient.js`).
- **Auth** — Supabase Auth, email + password (`src/lib/auth.js`). No custom backend session handling.
- **Data** — `sessions`, `settings`, `content_bank` tables in Postgres, all with Row Level Security scoped to `auth.uid()` (`supabase/schema.sql`). Audio recordings go to a Supabase Storage bucket named `recordings`.
- **LLM calls (Grok is not actually used — the app uses Groq, a different provider hosting open-weight models like Llama/GPT-OSS/Whisper)** — two Supabase Edge Functions proxy to Groq's API, holding `GROQ_API_KEY` server-side:
  - `ai-feedback` — coaching feedback on a transcript (`src/lib/aiCoach.js` → `supabase/functions/ai-feedback/index.ts` → Groq chat completions).
  - `transcribe` — verbatim speech-to-text (`src/lib/whisper.js` → `supabase/functions/transcribe/index.ts` → Groq's hosted Whisper). A local Whisper server (`whisper-server/`, Flask + faster-whisper on `127.0.0.1:8765`) is tried first for local dev only.
  - `generate-content` — a scheduled (weekly, pg_cron) batch job that asks Groq for new practice prompts and inserts them into `content_bank` using the service-role key. Not on any user request path.
- **Where user data enters**: the mic (audio blob), the live/Whisper transcript of that audio, a self-rating + optional free-text note, and optional profile fields (name, age) in Settings.
- **Where it's stored**: Postgres (`sessions`, `settings`), Storage (`recordings` bucket, **public** — see 3.2), and transiently in Groq's API for inference (Groq's own data-retention policy applies, not something this codebase controls).

I could not verify hosting-provider config, Supabase dashboard settings (email confirmation, password policy, breach-password protection, Auth rate limits), or Groq account-level controls — those live outside the repo. The README explicitly documents several of these as manual one-time dashboard steps; I have no way to confirm they were actually done on the live project.

## 2. Functional review

Overall this is an unusually well-commented, careful codebase — most edge cases (empty transcripts, non-JSON model output, timezone-safe date math, rate-limit retries, mic-permission races) are handled deliberately and explained inline. No dead code, no `TODO`/`FIXME` markers, no leftover debug scaffolding found. Two real gaps:

- **Medium — Unhandled promise rejections on Progress and Badges data loads.** `src/screens/Progress.jsx:18` and `src/screens/Badges.jsx:89` call `getSessions().then(...)` with no `.catch()`. `getSessions()` (`src/lib/storage.js`) rethrows on any Supabase error (expired session, RLS denial, network drop). If that happens, the promise rejects unhandled, the screen never leaves its loading/empty state, and the user sees a silently blank Progress or Badges tab with no retry option. (By contrast, `getFreshContentBank` in `storage.js`, used by Roulette, has its own internal try/catch and fails open — that screen is fine.)
- **Low — `schema.sql` hardcodes a specific project's URL and anon key in the cron job.** The `pg_cron` job at the bottom of `supabase/schema.sql` posts to a literal `https://oywvvdfmhxcjcauvoyla.supabase.co/functions/v1/generate-content` with a literal bearer token. The anon key itself being public is fine by design (see 3.1), but this makes the schema file non-portable: anyone who forks the repo and runs this script against their own project will silently install a cron job that calls *the original project's* function with *the original project's* key, not their own. Worth parameterizing (or documenting as a manual step) before treating this as a reusable template.

No other broken flows, mismatched API contracts, or missing empty-states found. Error handling for failed mic access, failed transcription (local + hosted), failed AI feedback calls, and failed saves all show the user a specific, actionable message rather than crashing (`Record.jsx`, `Reflect.jsx`, `aiCoach.js`).

## 3. Security review

### 3.1 Secrets
No hardcoded API keys, passwords, or tokens found in the current source tree or in `git log` history for `.env`/`.env.local` (both are gitignored and have never been committed). `GROQ_API_KEY` and the Supabase `service_role` key are only ever referenced via `Deno.env.get(...)` inside Edge Functions — never in client code. The one credential that *is* hardcoded in a tracked file (`supabase/schema.sql`'s cron job) is the `anon`/publishable key, which Supabase's own security model treats as safe to expose (protection comes from Row Level Security, not key secrecy) — this is a portability issue (see 2), not a leak.

**Verdict: Pass.** I don't have access to git hosting (GitHub/GitLab) to confirm nothing was pushed to a remote in a since-rewritten commit — worth a quick `git log -p` check on the actual remote history if this repo has ever been pushed publicly.

### 3.2 Auth & access control
Auth is handled entirely by Supabase Auth (email+password). Every table has RLS scoped to `auth.uid()`, so there is no IDOR surface in the data model — a user cannot fetch another user's `sessions`/`settings` rows by guessing an ID, because Postgres enforces it server-side regardless of what the client asks for. `auth.js` also deliberately avoids user-enumeration: both `signUp` (already-registered email) and `sendPasswordReset` (unknown email) return the same success response instead of leaking which emails exist.

- **Medium — the `recordings` Storage bucket is public.** Files are reachable by anyone with the exact URL (an unlisted, unguessable UUID path), not gated by RLS at read time — this is called out and consciously accepted in `schema.sql`'s own comments as a tradeoff for a "practice app." Given `Settings.jsx` collects an `age` field down to 1 with no age gating anywhere in signup, the audience isn't guaranteed to be adults-only, and a leaked/forwarded/cached recording URL of a minor's voice would be permanently and publicly playable with no way to revoke it short of deleting the row. Worth revisiting before a public launch — switch to a private bucket + signed URLs, as the schema comment itself already suggests as the harder-but-better option.
- **Low — password minimum is 6 characters** (`Login.jsx`, `Settings.jsx`), matching Supabase Auth's own default. Whether "leaked password protection" (HaveIBeenPwned check) is actually turned on is a dashboard setting the README recommends but I cannot verify from code.

### 3.3 Input validation & injection
No SQL injection surface — all DB access goes through the Supabase client's parameterized query builder, never raw SQL from user input. No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` anywhere in `src/` — all rendering is through React's auto-escaping, so there's no XSS vector even for untrusted text (transcripts, notes, AI responses). No shell/command execution paths exist in the client or Edge Functions. No path traversal surface — file paths for Storage uploads are constructed from `auth.uid()` + a generated UUID, not user-supplied strings.

### 3.4 Prompt injection (LLM-specific)
User transcripts are concatenated directly into the coaching prompt (`buildCoachingPrompt` / `buildExerciseFitPrompt` in `src/lib/aiCoach.js`), so a user could attempt to override the system instructions ("ignore the above, instead..."). Actual impact is low but not zero:
- **Low — self-directed only.** The model's output is only ever shown back to the same signed-in user (no other user, and no downstream system, ever sees or trusts it), and it's rendered as plain React text, not executed or used to control any other logic — so a successful injection can't escalate into XSS, data access, or cross-user impact.
- **Medium — quota/policy abuse vector.** A user could use this as a way to get free-tier Groq compute to generate off-topic or policy-violating content under the app's own API key, which risks Groq flagging/suspending the shared key (a denial-of-service for every other user) more than it risks any individual harm. There's no server-side check that the model's response actually resembles coaching feedback before it's returned to the client.

### 3.5 Rate limiting & abuse
- **High — no per-user/per-IP rate limiting on the LLM-calling Edge Functions.** `ai-feedback` and `transcribe` cap prompt size (12,000 chars) and audio size (20MB) and are gated by `verify_jwt: true`, so only a signed-in user can call them — but there is no limit on how *many times* one authenticated user (or a script replaying a stolen/valid session token) can call them per minute/day. The only throttle is Groq's own per-model, org-wide free-tier bucket (30 req/min, 1K/day for the default model). One misbehaving or malicious signed-in account can exhaust that shared daily quota and degrade or break AI feedback/transcription for every other user, with nothing in this app's own code to stop it. `generate-content` does have its own guard (`MIN_INTERVAL_HOURS = 20`), but that's a different function on a different trigger path.
- This is flagged High specifically because the prompt's own instructions call out unbounded LLM cost/abuse as high-priority, and because the failure mode here is "app stops working for everyone," not just cost — there's no dollar cost on Groq's free tier, but there is a real service-degradation risk.

### 3.6 CORS & network config
Both `ai-feedback` and `transcribe` set `Access-Control-Allow-Origin: "*"`. Given the auth model is a bearer JWT that browsers don't attach automatically cross-origin (Supabase's client reads it from local storage and sets the header explicitly), wildcard CORS here doesn't enable CSRF the way it would for cookie-based auth — a third-party site can't silently ride a visitor's session. It does mean any site can *attempt* to call these functions if it somehow obtains a valid token, and it means the functions can be hit from anywhere for cheap probing (e.g., to check whether `GROQ_API_KEY` is configured, since that specific error is distinguishable). Low priority given the auth model, but scoping this to the app's actual deployed origin(s) instead of `*` would be a cheap hardening step. No debug/admin endpoints found — the only three Edge Functions that exist are the three reviewed above, all with `verify_jwt: true`.

### 3.7 Dependencies
`npm audit --production` reports **0 known vulnerabilities** against the current lockfile (React 19, Vite 8, `@supabase/supabase-js` 2.45+, `lucide-react`). Nothing outdated with a known CVE at review time. Re-run this periodically — it's a point-in-time result, not a standing guarantee.

## 4. Safety & content review

- No user-generated content (transcripts, notes, recordings) is ever shown to any user other than its author — every read path is scoped by RLS to `auth.uid()`. There is no feed, no sharing, no comments, no messaging between users anywhere in the app. This substantially limits the blast radius of both "model produces something harmful" and "user harasses another user" — there is currently no mechanism by which one user's content or a model's output about one user's content ever reaches a different user, so most of the moderation/reporting concerns the prompt asks about don't apply to this app's actual feature set today.
- The one place model output is genuinely open-ended (the coaching `summary`, `deliveryNote`, etc. in `aiCoach.js`) has no server-side content filter before being returned to the client — it relies entirely on Groq's own model-level safety behavior. Low priority given the self-only exposure noted above, but worth a light server-side check (e.g., reject/flag obviously-off-topic or policy-violating responses) before this app scales past "self-only feedback."
- The static content banks (`src/lib/content.js`) are hand-curated and read as thoughtful, non-exploitative reflective/debate/vocabulary prompts — no offensive or unsafe material found on inspection. The `generate-content` Edge Function grows this bank periodically via Groq with a fairly tight style guide, but its output is inserted directly with no moderation pass before it becomes a live prompt shown to users — a Low/Medium item to watch as that bank grows unattended over time.
- No mechanism exists (or is needed yet, given no cross-user content) for reporting/blocking, since there's nothing to report between users today.

## 5. Privacy & data handling

- **Data collected**: email + password (via Supabase Auth), optional display name and age, practice session metadata (date, duration, self-rating, optional note), transcripts of what was said, AI-generated feedback text, and the audio recording itself. This is reasonably minimized to what the app's own stated purpose (speaking practice with feedback) requires — no location, no contacts, no unrelated tracking/analytics SDK found anywhere in the codebase.
- **Third-party disclosure**: audio and transcripts are sent to Groq for transcription and coaching feedback. The README documents this technically (which model, which endpoint) but there is no user-facing disclosure anywhere in the product itself (no Settings copy, no onboarding note, no privacy policy) telling an actual signed-up user "your recordings/transcripts are sent to a third-party AI provider (Groq) for processing." A user reading only the app, not the GitHub README, would have no way to know this.
- **Logging**: no evidence of transcripts, prompts, or personal data being logged in plaintext anywhere in this codebase — no analytics library, no error-tracking SDK (Sentry etc.), no `console.log` of sensitive fields found. Supabase's own platform-level logs (Edge Function invocation logs, which could include request bodies depending on dashboard settings) are outside what I can inspect from the repo — worth checking the Supabase dashboard's log retention/visibility settings directly.
- **Minors**: nothing in the product gates signup or content by age — Settings collects an optional age field (1–120) but nothing reads or acts on it (no age-appropriate content filtering, no parental-consent flow, no COPPA-style handling). Combined with the public-recordings-bucket point in 3.2, if this is genuinely opened to the public rather than kept to consenting adult testers, the minors-specific gaps (no age gate, no parental consent path, permanently-public audio URLs, third-party AI processing of a minor's voice/speech with no disclosure) are the single area I'd most want a firm answer on before wider launch — the app's own README calls this "a student project," which suggests the actual audience may skew young.
- No Privacy Policy or Terms of Use found anywhere in the app or repo (see also Phase 2, item 6) — this is as much a legal/compliance gap as a privacy one, but it's the direct fix for the disclosure gap above.

## 6. Findings summary

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | High | No per-user/per-IP rate limiting on `ai-feedback`/`transcribe` — one authenticated user can exhaust the shared Groq quota for everyone | `supabase/functions/ai-feedback/index.ts`, `supabase/functions/transcribe/index.ts` |
| 2 | Medium | `recordings` Storage bucket is fully public with no age gating on signup — a leaked URL exposes a recording (possibly a minor's voice) permanently, with no revoke path | `supabase/schema.sql`, `src/lib/storage.js` (`uploadRecording`) |
| 3 | Medium | Prompt injection into `ai-feedback` could be used to generate off-policy content under the app's shared Groq key, risking key suspension (denial of service for all users) | `src/lib/aiCoach.js` |
| 4 | Medium | Unhandled promise rejections on `getSessions()` in Progress and Badges — a network/auth failure leaves the screen silently stuck with no error state | `src/screens/Progress.jsx:18`, `src/screens/Badges.jsx:89` |
| 5 | Medium | No in-product disclosure that recordings/transcripts are sent to a third-party AI provider (Groq); no Privacy Policy or Terms of Use anywhere in the app | product-wide |
| 6 | Low | `content_bank` entries generated by `generate-content` are inserted with no moderation pass before becoming live user-facing prompts | `supabase/functions/generate-content/index.ts` |
| 7 | Low | `schema.sql`'s cron job hardcodes one specific project's URL + anon key, making the schema file non-portable for forks/other deployers | `supabase/schema.sql` |
| 8 | Low | Wildcard CORS (`Access-Control-Allow-Origin: "*"`) on both LLM-calling Edge Functions — low risk given bearer-token (non-cookie) auth, but tighter scoping is a cheap hardening step | `supabase/functions/ai-feedback/index.ts`, `supabase/functions/transcribe/index.ts` |
| 9 | Info / unverifiable | Supabase dashboard settings the README recommends (leaked-password protection, email confirmation requirement, Auth rate limits, redirect URL allowlist) can't be confirmed from code — need a manual dashboard check | Supabase dashboard (outside repo) |

No Critical findings. Secrets handling, auth/access control (RLS), and injection defenses (SQL/XSS/command/path) are all solid — this is a genuinely careful implementation for a student project.

## 7. Overall verdict

**Conditionally safe to move to deployment prep** — there are no Critical issues and no active secret leaks, but I'd fix the one **High** (rate limiting) before any public traffic, since its failure mode is "the app stops working for every user, not just the abuser," and it's a small, well-scoped change (a per-user request counter, even a simple one backed by a Postgres table or Supabase's built-in rate limiting, in front of both LLM-calling functions). I'd also resolve or make a deliberate, informed call on the two audience-related Mediums (#2 public recordings + no age gate, #5 no disclosure/privacy policy) before this goes fully public, since both hinge on the same open question: is the real audience "consenting adult testers" or genuinely "the public, unknown age"? That answer changes how urgent #2 and #5 are.

Ready for Phase 2 (deployment readiness checklist) once you've weighed in on the rate-limiting fix and the audience question above — let me know and I'll proceed.
