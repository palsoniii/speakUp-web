-- SpeakUp — Supabase schema
--
-- Run this once, after creating your Supabase project: Project dashboard ->
-- SQL Editor -> New query -> paste this whole file -> Run. Safe to re-run
-- (uses IF NOT EXISTS / DROP POLICY IF EXISTS throughout).
--
-- This replaces the old localStorage-per-browser-profile model with real
-- per-account data: every table has Row Level Security on, scoped to
-- auth.uid(), so a user only ever sees their own rows — enforced by
-- Postgres itself, not app code.

-- ---------------------------------------------------------------------------
-- sessions: one row per completed practice session. user_id defaults to
-- auth.uid() so the client never has to pass it explicitly on insert — it's
-- taken from whoever is authenticated when the insert happens.
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date text not null,
  created_at timestamptz not null default now(),
  type_id text,
  title text,
  prompt text,
  word text,
  duration_seconds integer default 0,
  feeling integer,
  note text,
  recording_uri text,
  source_url text,
  transcript text,
  transcript_source text,
  ai_feedback jsonb,
  feedback jsonb
);

create index if not exists sessions_user_id_created_at_idx on public.sessions (user_id, created_at desc);

alter table public.sessions enable row level security;

drop policy if exists "sessions_select_own" on public.sessions;
create policy "sessions_select_own" on public.sessions for select
  using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on public.sessions;
create policy "sessions_insert_own" on public.sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "sessions_update_own" on public.sessions;
create policy "sessions_update_own" on public.sessions for update
  using (auth.uid() = user_id);

drop policy if exists "sessions_delete_own" on public.sessions;
create policy "sessions_delete_own" on public.sessions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- settings: exactly one row per user (upserted from the app), holding the
-- same preferences that used to live in localStorage per local profile.
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  reminder_enabled boolean not null default false,
  reminder_hour integer not null default 9,
  reminder_minute integer not null default 0,
  speech_feedback_enabled boolean not null default true,
  ai_feedback_model text not null default 'openai/gpt-oss-120b',
  display_name text,
  age integer,
  updated_at timestamptz not null default now()
);

-- Safe to re-run against a project whose table predates the Groq migration:
-- only affects rows inserted after this runs, not existing rows already
-- pinned to an older/invalid model id (e.g. a leftover Ollama-style tag like
-- "llama3.1:8b") — fix those directly with an UPDATE if you hit that.
alter table public.settings alter column ai_feedback_model set default 'openai/gpt-oss-120b';

-- Safe to re-run against a project that already had this table from before
-- the profile fields existed — ALTER ... ADD COLUMN IF NOT EXISTS is a
-- no-op if they're already there.
alter table public.settings add column if not exists display_name text;
alter table public.settings add column if not exists age integer;

alter table public.settings enable row level security;

drop policy if exists "settings_select_own" on public.settings;
create policy "settings_select_own" on public.settings for select
  using (auth.uid() = user_id);

drop policy if exists "settings_insert_own" on public.settings;
create policy "settings_insert_own" on public.settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "settings_update_own" on public.settings;
create policy "settings_update_own" on public.settings for update
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- rate_limit_events + check_rate_limit(): per-user request throttling for
-- the two Groq-backed Edge Functions (ai-feedback, transcribe). Both
-- functions already cap prompt/audio size and are JWT-gated, but neither
-- previously limited HOW MANY requests one signed-in account could make —
-- Groq's own free-tier limits are pooled per model, org-wide, across every
-- user of this app, so one account hammering either function could exhaust
-- that shared daily quota and break AI feedback/transcription for everyone
-- else. This is a plain event log + a SECURITY DEFINER function that counts
-- a user's own recent rows and inserts a new one atomically per call — not
-- trying to be a general-purpose rate limiter, just enough to stop a single
-- account from taking the whole quota.
--
-- RLS is enabled with NO policies granted to any client role, so the table
-- itself is unreadable/unwritable directly from the anon/authenticated
-- roles — the only way to touch it is through check_rate_limit() below,
-- which runs as this script's owner (SECURITY DEFINER), and table owners
-- are exempt from their own RLS by default. So this blocks a client from
-- forging rows or reading other users' call counts, without needing
-- explicit policies to reason about.
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  function_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (user_id, function_name, created_at desc);

alter table public.rate_limit_events enable row level security;

-- Returns 'ok' (and records the call) if under both caps, or 'minute'/'day'
-- naming whichever cap was hit, without recording anything — so a blocked
-- request doesn't itself count against the next window. Per-day is a UTC
-- calendar day, not a rolling 24h window, to match how Groq's own daily
-- buckets reset and so "resets at midnight UTC" in the Edge Functions'
-- error messages is actually true.
create or replace function public.check_rate_limit(
  p_function text,
  p_max_per_minute int,
  p_max_per_day int
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_minute_count int;
  v_day_count int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_minute_count
  from public.rate_limit_events
  where user_id = v_user and function_name = p_function
    and created_at > now() - interval '1 minute';
  if v_minute_count >= p_max_per_minute then
    return 'minute';
  end if;

  select count(*) into v_day_count
  from public.rate_limit_events
  where user_id = v_user and function_name = p_function
    and created_at >= date_trunc('day', now() at time zone 'utc');
  if v_day_count >= p_max_per_day then
    return 'day';
  end if;

  insert into public.rate_limit_events (user_id, function_name) values (v_user, p_function);
  return 'ok';
end;
$$;

-- authenticated (not anon) — only a signed-in user can consume their own
-- quota check; matches the verify_jwt=true gate already on both functions.
grant execute on function public.check_rate_limit(text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for practice recordings — replaces the old
-- base64-in-localStorage approach (which would have blown through the free
-- database size budget fast; audio belongs in object storage, not a DB
-- column). Public bucket for simplicity: files are reachable by anyone with
-- the exact URL (which embeds a random session UUID — unlisted, not
-- indexed, not enumerable) but not truly private/access-controlled. Good
-- enough for a practice app; if you want real per-user access control
-- later, switch this to a private bucket and generate signed URLs on
-- playback instead of storing a permanent public URL.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', true)
on conflict (id) do update set public = true;

-- Uploads are still locked to the owner: files must be stored under
-- <user_id>/... so this policy can check the first path segment against
-- auth.uid(). storage.js uploads to exactly that path shape.
--
-- The select policy below is required, not optional: Storage's upload
-- endpoint does an INSERT ... RETURNING to hand back the created object's
-- metadata, and Postgres RLS needs a SELECT policy (separate from the
-- insert with_check) to allow that RETURNING projection. Without it, every
-- upload's row satisfies with_check and gets written, then the RETURNING
-- step is rejected — surfacing as "new row violates row-level security
-- policy for table objects" even though the insert itself was fine.
drop policy if exists "recordings_select_own" on storage.objects;
create policy "recordings_select_own" on storage.objects for select
  using (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name)) [1]);

drop policy if exists "recordings_insert_own" on storage.objects;
create policy "recordings_insert_own" on storage.objects for insert
  with check (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name)) [1]);

drop policy if exists "recordings_update_own" on storage.objects;
create policy "recordings_update_own" on storage.objects for update
  using (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name)) [1]);

drop policy if exists "recordings_delete_own" on storage.objects;
create policy "recordings_delete_own" on storage.objects for delete
  using (bucket_id = 'recordings' and auth.uid()::text = (storage.foldername(name)) [1]);

-- ---------------------------------------------------------------------------
-- content_bank: shared, growing reference data for the roulette's content
-- banks (reflective prompts, "explain simply" topics, opinion questions,
-- word-ladder pairs, vocab words) — see src/lib/content.js's LLM-evaluation
-- redesign plan. Not user-owned like sessions/settings above: every signed-
-- in user reads the same rows, so RLS here is read-only for authenticated
-- users rather than scoped to auth.uid(). Seeded once from content.js's
-- static arrays (which remain the fallback if this table is ever empty or
-- unreachable — see getFreshContentBank in src/lib/storage.js), then grown
-- over time by the generate-content Edge Function using the service role
-- key, which bypasses RLS entirely by design.
-- ---------------------------------------------------------------------------
create table if not exists public.content_bank (
  id uuid primary key default gen_random_uuid(),
  type_id text not null check (type_id in ('wiki_roulette', 'explain_simply', 'snap_opinion', 'word_ladder', 'word_of_day')),
  -- Same identity a saved session's (type_id, prompt/word) resolves to via
  -- storage.js's topicIdentityKey — lets the roulette's "already spoken"
  -- filter and this table's own dedup-on-insert use one consistent key.
  identity_key text not null,
  -- Normalized to the same shape content.js's getContentBank returns:
  -- { prompt } for most categories, { prompt, pair } for word_ladder,
  -- { prompt, word, definition } for word_of_day.
  entry jsonb not null,
  source text not null default 'seed' check (source in ('seed', 'generated')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One entry per (type_id, identity_key) — the same guarantee content.js's
-- static arrays give implicitly by just not having duplicates written in by
-- hand; enforced here since generate-content inserts programmatically.
create unique index if not exists content_bank_type_identity_idx on public.content_bank (type_id, identity_key);
create index if not exists content_bank_type_active_idx on public.content_bank (type_id, active) where active;

alter table public.content_bank enable row level security;

-- Read-only for signed-in users — this is shared content, not per-user data.
-- No insert/update/delete policy is defined at all, which means RLS blocks
-- every client-side write; the only way to write is the service role key
-- (generate-content Edge Function, or a developer running SQL directly).
drop policy if exists "content_bank_select_authenticated" on public.content_bank;
create policy "content_bank_select_authenticated" on public.content_bank
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- app_feedback: free-text "what's working / what's not" submissions from
-- the Settings screen's Feedback card (src/screens/Settings.jsx). Same
-- owner-scoped RLS shape as sessions/settings above — a user can insert
-- and read back their own submissions, nothing more. There's deliberately
-- no client-facing "read everyone else's feedback" policy: reviewing
-- submissions is a developer task, done via the Supabase dashboard's Table
-- Editor/SQL Editor (or the Supabase MCP) using the project owner's
-- credentials, which bypass RLS entirely.
-- ---------------------------------------------------------------------------
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) default auth.uid(),
  category text not null default 'general' check (category in ('bug', 'feature_request', 'general')),
  whats_working text,
  whats_not_working text,
  message text,
  rating integer check (rating between 1 and 5),
  contact_email text,
  app_version text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.app_feedback enable row level security;

drop policy if exists "Users can insert their own feedback" on public.app_feedback;
create policy "Users can insert their own feedback" on public.app_feedback for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can view their own feedback" on public.app_feedback;
create policy "Users can view their own feedback" on public.app_feedback for select
  to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Cron: periodic, quota-cheap batch growth of content_bank via the
-- generate-content Edge Function — one combined Groq call across all five
-- categories, gated by that function's own MIN_INTERVAL_HOURS guard so a
-- re-run of this script (or a manual trigger) can't fire it more often than
-- intended. The Authorization header below uses the project's anon/
-- publishable key, not a secret — the same key already shipped in the
-- browser bundle, safe to embed here (generate-content is JWT-gated the
-- same way ai-feedback is, not an open proxy). Requires pg_cron and pg_net,
-- enabled below.
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule('content-bank-refresh') where exists (
  select 1 from cron.job where jobname = 'content-bank-refresh'
);

select cron.schedule(
  'content-bank-refresh',
  '0 6 * * 1', -- every Monday at 06:00 UTC
  $$
  select net.http_post(
    url := 'https://oywvvdfmhxcjcauvoyla.supabase.co/functions/v1/generate-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95d3Z2ZGZtaHhjamNhdXZveWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTk5MjEsImV4cCI6MjEwMDczNTkyMX0.qujKvGjsx46uZzjiuI4wgxjp0hJN8rcNwgsVo4cX6rw'
    ),
    body := jsonb_build_object('perType', 6),
    timeout_milliseconds := 35000
  );
  $$
);

-- Keeps rate_limit_events small — only the last ~1 minute and ~1 day of any
-- row are ever read by check_rate_limit(), so nothing older than 2 days
-- (a bit of slack past one UTC day) needs to stick around.
select cron.unschedule('rate-limit-cleanup') where exists (
  select 1 from cron.job where jobname = 'rate-limit-cleanup'
);

select cron.schedule(
  'rate-limit-cleanup',
  '0 3 * * *', -- daily at 03:00 UTC
  $$ delete from public.rate_limit_events where created_at < now() - interval '2 days'; $$
);
