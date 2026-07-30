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
  ai_feedback_model text not null default 'llama-3.3-70b-versatile',
  display_name text,
  age integer,
  updated_at timestamptz not null default now()
);

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
