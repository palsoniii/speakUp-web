# Speak Up — Deployment Readiness Checklist (Phase 2)

Date: 2026-08-02
Follows Phase 1 (`SPEAKUP_AUDIT_PHASE1.md`), whose one High finding (no per-user rate limiting) and several error-handling gaps have since been fixed. This phase checks what's left before a real deploy, per the original audit prompt's Phase 2 list. Same rule as Phase 1: where something depends on a dashboard, hosting account, or a choice you haven't made yet, I say so rather than assume it's fine.

Context this checklist runs against: no git remote is configured yet (this is still a local-only repo) and no hosting platform (Vercel/Netlify/etc.) or CI config exists in the repo — so several items below are less "broken" than "not set up yet," which is normal for a project that hasn't deployed for real yet.

## 1. Secrets management

**Not done yet (code is correct; the actual production setup hasn't happened).**

The code itself is right: `GROQ_API_KEY` and the Supabase `service_role` key are only ever read via `Deno.env.get(...)` inside Edge Functions, never in client code or the browser bundle, and `.env`/`.env.local` are gitignored and have never been committed (confirmed in Phase 1). `VITE_SUPABASE_ANON_KEY` is the one credential shipped client-side, correctly so — Supabase's model treats it as safe to expose, protected by Row Level Security rather than secrecy.

What's not done: since there's no deployed project yet, nobody has run `supabase secrets set GROQ_API_KEY=...` against a real production Supabase project, and `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` haven't been set as environment variables in a hosting platform's dashboard (Vercel/Netlify/etc.) — both are one-time setup steps documented in the README but not yet performed against a live project as far as this repo shows. Do these before go-live:
- `supabase secrets set GROQ_API_KEY=your-key-here` (and optionally `GROQ_FALLBACK_MODEL` if you want to override the default) on the real project.
- Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as build-time env vars on whatever host serves `dist/`.

Minor holdover from Phase 1, not a leak but worth a look before this repo is pushed anywhere public: `supabase/schema.sql`'s cron job hardcodes one specific project's anon key + URL, which makes the schema file itself reveal which Supabase project it was written against.

## 2. Cost & abuse controls on LLM calls

**Done.** Per-user rate limiting (`check_rate_limit()` in `supabase/schema.sql`, enforced in both `ai-feedback` and `transcribe` Edge Functions) went in this session — 30 `ai-feedback` calls/user/day, 20 `transcribe` calls/user/day, both with a per-minute cap on top, sized so every user clears 5+ sessions/day with headroom while capping any one account's share of the shared Groq free-tier quota. Request-size caps (`MAX_PROMPT_CHARS`, `MAX_AUDIO_BYTES`, `MAX_TOKENS_CEILING`) already existed and are unchanged.

**Not done:** no budget/usage alert. Groq's free tier has no dollar cost, so there's no runaway-bill risk the way there would be on a paid API — but there's also nothing that tells you when the app is getting close to Groq's daily request ceiling before users start seeing 429s. Worth a periodic manual check of Supabase's Edge Function invocation logs, or (better) a small scheduled check that alerts you (email/webhook) if `rate_limit_events` volume for a day is approaching Groq's published daily limits. Low urgency at ~55 users given the headroom already built in.

## 3. Error handling & monitoring

**Half done.**

Errors are caught gracefully and no raw stack traces reach the user — this was the focus of the fail-soft cleanup earlier this session (App.jsx's session check, Home/Progress/Badges/Settings' data loads, Settings' save path, Record's transcription failures all now show real, specific messages instead of failing silently or crashing). Confirmed via `npm test` (67/67 passing) and a full read-through; no unguarded `.then()` without a `.catch` remains anywhere a real user-facing consequence follows from it.

**Not done:** there's no error-tracking/monitoring service (Sentry, Bugsnag, or similar) and no analytics. This means every error message this session's work now surfaces is only visible to the one user who hit it, in their own browser console or on their own screen — you have no way to find out about a production error unless that user reports it to you directly. For a project this size, the cheapest fix is Sentry's free tier (a few lines to initialize + wrap the app), which would give you an actual dashboard of what's breaking for real users instead of relying entirely on complaints. I did not add this without your sign-off since it's a new third-party dependency and account to set up — say the word and I'll wire it in.

## 4. Environment separation

**Not done — single environment.** There's one `.env`/one Supabase project referenced anywhere in this repo, no `import.meta.env.MODE`-based branching, and no evidence of a separate dev/staging project. In practice this means local development and production would point at the same Supabase project unless you deliberately keep two `.env` files (a personal dev project's credentials locally, the real project's credentials only in the host's dashboard). That's a common, often-acceptable tradeoff at this scale, but worth being deliberate about — testing locally against the live project means local QA can consume real Groq quota and, if you're not careful with which account you're signed in as, write test rows into real user-facing tables. No CI/CD pipeline exists either (no GitHub Actions, no `vercel.json`/`netlify.toml`) — deploys would currently be a manual `npm run build` + upload, or a manual "connect repo to host" step.

## 5. Scalability basics

**Done**, with one caveat that isn't fixable in code. Both Edge Functions are stateless/serverless (no in-memory counters — even the new rate limiter's state lives in Postgres, not a module-level variable that would reset or misbehave across concurrent invocations), everything is `async`/`await` with no blocking calls, and the frontend is a static Vite build that scales trivially on any CDN-backed host regardless of user count. The one real ceiling is Groq's free-tier daily/per-minute quota, which this app cannot raise from its own code — the new rate limiting caps how much of that shared ceiling any single user can take, but the ceiling itself is external and would need a paid Groq plan to move. Not a defect, just a fact worth knowing before assuming "scalable" means "unlimited."

## 6. Legal/compliance basics

**Not done.** No Terms of Use and no Privacy Policy exist anywhere in the app or repo. AI-generated content is partially disclosed in-product — Reflect.jsx and the marketing page both visually label model-derived scores as "AI read" vs. "Measured," which is a genuinely good, honest touch — but there's no explicit statement that recordings and transcripts are sent to a third party (Groq) for processing, and no age-appropriate-use notice anywhere, even though Settings collects an optional age field with no floor enforced beyond "1." As flagged in Phase 1, this is the item most likely to actually block a genuinely public launch, especially paired with the public (if unlisted) recordings bucket. I'm not drafting the actual legal text — that needs real legal review before it's binding — but I can put together a plain-language draft placeholder (clearly marked as not-a-substitute-for-legal-review) if that's useful as a starting point, or you can go straight to a template service/lawyer.

## 7. Rollback plan

**Not set up, but straightforward once a host is chosen.** `dist/` is a plain static build deployable to Vercel/Netlify/GitHub Pages/etc., and all of those platforms keep deployment history with one-click rollback built in — but no host is actually connected yet (no `vercel.json`/`netlify.toml`, no git remote). On the Supabase side, `schema.sql` is idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` throughout, safe to re-run), but there's no down-migration script — undoing a schema change means hand-writing the reverse SQL, and Edge Function rollback would rely on Supabase's own deployment history in its dashboard rather than anything in this repo. None of this is hard to set up, it just isn't yet.

## Summary

| Item | Status |
|---|---|
| Secrets management | Not done — code is correct, production secrets not yet set on a real project |
| Cost & abuse controls | **Done** |
| Error handling (no raw errors shown) | **Done** |
| Error monitoring/alerting | Not done — no Sentry/equivalent |
| Environment separation | Not done — single Supabase project, no CI/CD |
| Scalability basics | **Done** (Groq free-tier ceiling is an external, non-code constraint) |
| Legal/compliance (ToS, Privacy Policy, AI disclosure, age notice) | Not done |
| Rollback plan | Not set up — straightforward once a host is chosen |

## Go/no-go recommendation

**Not yet ready for a fully public, unrestricted launch** — the legal/compliance gap and the lack of any error monitoring are the two items I'd genuinely block on, not because the app is unsafe technically (it isn't — Phase 1's only High is now fixed, and this session closed out the error-handling gaps too), but because "public, unknown audience, no ToS/Privacy Policy, no way to find out when something breaks for a real user" is a combination worth fixing first.

**Ready for a limited/soft launch** (the ~50-55 known/invited users you mentioned, not open public sign-up) once you: set the production secrets on a real Supabase project, and make a deliberate call on the legal-basics question — even a short, clearly-labeled placeholder Privacy Policy/ToS plus an explicit "recordings and transcripts are sent to Groq for processing" line beats having nothing, and buys time for real legal review before opening this up further.

Your call on next steps — I can wire up Sentry, draft placeholder legal copy (clearly marked as not a substitute for real review), help pick and configure a host with rollback in mind, or something else entirely.
