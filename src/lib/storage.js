import { supabase } from "./supabaseClient";
import { getContentBank } from "./content";

// All persistence now goes through Supabase (Postgres + Storage), scoped to
// the signed-in account via Row Level Security — see supabase/schema.sql.
// This used to be synchronous localStorage reads/writes namespaced by a
// local "profile"; every read/write here is async now since it's a real
// network call, and data follows the account across devices instead of
// staying in one browser.
//
// DB columns are snake_case (Postgres convention); everything returned to
// the rest of the app stays camelCase, same shape as before, so screens
// that already expect e.g. `session.durationSeconds` didn't need to change
// — only the few places that now need to `await` these calls.

// Groq-hosted model id (see lib/aiCoach.js — coaching now runs through the
// `ai-feedback` Supabase Edge Function, not a local Ollama install).
// Exported so Settings.jsx can use it as the initial state instead of
// `null` — App.jsx conditionally renders each tab (`{tab === "settings" &&
// <Settings/>}`), which unmounts Settings entirely when you navigate away
// and mounts a fresh instance (settings state reset to its initial value)
// every time you come back. Starting from `null` meant that fresh mount
// rendered nothing at all until getSettings() round-tripped to Supabase —
// the whole page blanked out and the sticky bottom nav visibly jumped to
// sit right under the header instead of at the bottom, on every single
// visit to that tab. Starting from these defaults instead means the page
// renders immediately and just re-renders with the real values a moment
// later, same pattern Home/Badges already use for their own async data.
export const DEFAULT_SETTINGS = {
  speechFeedbackEnabled: true,
  aiFeedbackModel: "openai/gpt-oss-120b",
  displayName: "",
  age: null,
};

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Not signed in.");
  return data.user.id;
}

// Local calendar date, not UTC — d.toISOString() converts to UTC first,
// which flips the date a day early/late for anyone west/east of UTC once
// it's late/early enough in the day locally. That used to silently mislabel
// which day a session counted toward and made the week-strip's Sunday
// alignment flaky near midnight; building the string from local
// year/month/day fields keeps "today" anchored to the user's own clock.
function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sessionFromRow(row) {
  return {
    id: row.id,
    date: row.date,
    createdAt: row.created_at,
    typeId: row.type_id,
    title: row.title,
    prompt: row.prompt,
    word: row.word,
    durationSeconds: row.duration_seconds || 0,
    feeling: row.feeling,
    note: row.note,
    recordingUri: row.recording_uri,
    sourceUrl: row.source_url,
    transcript: row.transcript,
    transcriptSource: row.transcript_source,
    aiFeedback: row.ai_feedback,
    feedback: row.feedback,
  };
}

function settingsFromRow(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    speechFeedbackEnabled: row.speech_feedback_enabled,
    aiFeedbackModel: row.ai_feedback_model,
    displayName: row.display_name || "",
    age: row.age ?? null,
  };
}

// Client generates the id up front (rather than letting Postgres default
// it) so a recording can be uploaded to Storage under a known path *before*
// the session row is inserted — see uploadRecording below and how
// Reflect.jsx sequences the two.
export function newSessionId() {
  return crypto.randomUUID();
}

export async function getSessions() {
  const { data, error } = await supabase.from("sessions").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(sessionFromRow);
}

export async function addSession(session) {
  const userId = await getCurrentUserId();
  const id = session.id || newSessionId();
  const row = {
    id,
    user_id: userId,
    date: session.date || todayStr(),
    type_id: session.typeId,
    title: session.title,
    prompt: session.prompt,
    word: session.word || null,
    duration_seconds: session.durationSeconds || 0,
    feeling: session.feeling,
    note: session.note || "",
    recording_uri: session.recordingUri || null,
    source_url: session.sourceUrl || null,
    transcript: session.transcript || "",
    transcript_source: session.transcriptSource || "none",
    ai_feedback: session.aiFeedback || null,
    feedback: session.feedback || null,
  };
  const { data, error } = await supabase.from("sessions").insert(row).select().single();
  if (error) throw error;
  return sessionFromRow(data);
}

// --- Roulette "already spoken on and saved" exclusion ---
//
// A topic should stop appearing in a profile's roulette once they've
// actually saved a session on it (Reflect.jsx's save(), the only place
// addSession() gets called) — spinning past it, or discarding without
// saving, must NOT remove it. Since `sessions` already records exactly
// that (one row per real save, with `type_id`/`prompt`/`word`), there's
// nothing new to persist: this just reads what's already there and
// filters the content bank against it.
//
// Every category is identified by its exact prompt text (matches
// content.js's getContentBank output verbatim — confirmed against real
// saved rows), except word_of_day, which is identified by the word
// itself. The word is the more stable key there: it's a short, stable
// token the rest of the app already treats as the entry's identity
// (session.word), whereas the prompt sentence for a word is free-form
// text that a future content edit could easily reword without changing
// which vocab word it's teaching.
export function topicIdentityKey(typeId, { prompt, word }) {
  if (typeId === "word_of_day") return word ? word.toLowerCase().trim() : null;
  return prompt || null;
}

// Pure filtering step, split out from getFreshContentBank so it's testable
// without mocking Supabase (same split this file already uses for
// computeStreak/computeStats vs. getSessions). `spokenKeys` is whatever
// getSpokenTopicKeys resolved to. `exhausted: true` means every entry in
// the bank has already been saved, so nothing could be filtered without
// leaving zero options — falls back to the full bank rather than breaking,
// and says so, so the caller can tell the user instead of silently
// repeating a "fresh" spin that isn't.
export function filterUnspokenTopics(typeId, bank, spokenKeys) {
  if (!spokenKeys || spokenKeys.size === 0) return { entries: bank, exhausted: false };

  const fresh = bank.filter((entry) => {
    const key = topicIdentityKey(typeId, entry);
    return key ? !spokenKeys.has(key) : true;
  });

  return fresh.length > 0 ? { entries: fresh, exhausted: false } : { entries: bank, exhausted: true };
}

// getCurrentUserId's supabase.auth.getUser() re-validates the JWT against
// the Auth server on every call — the right call for a write (addSession,
// setSettings) but an extra network round trip this read doesn't need:
// getSpokenTopicKeys ran it, then made a second round trip for the actual
// query, back to back, on every single Roulette screen load — a big chunk
// of why the roulette was slow to show real content. getSession() resolves
// from the locally-stored session instead (no network call in the normal
// case), and that's enough here: RLS on `sessions` enforces access by
// auth.uid() server-side regardless of what id we filter by client-side, so
// there's no security reason to pay for the extra validation on a read.
async function getSessionUserIdFast() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.user) throw new Error("Not signed in.");
  return data.session.user.id;
}

// The set of topic keys (see topicIdentityKey) this user has already saved
// a session for, within one exercise type.
export async function getSpokenTopicKeys(typeId) {
  const userId = await getSessionUserIdFast();
  const { data, error } = await supabase
    .from("sessions")
    .select("prompt, word")
    .eq("user_id", userId)
    .eq("type_id", typeId);
  if (error) throw error;
  const keys = new Set();
  for (const row of data || []) {
    const key = topicIdentityKey(typeId, row);
    if (key) keys.add(key);
  }
  return keys;
}

// Per-typeId in-memory cache for the DB-backed content bank (see
// fetchContentBankFromDb below) — avoids re-querying content_bank on every
// roulette spin within one page load. The bank changes at most a few times
// a week (generate-content's batch runs), so a stale copy for the rest of
// one session is a non-issue; a full page reload clears it naturally.
const contentBankCache = new Map();

// content_bank is shared, growing reference data (see
// supabase/schema.sql's content_bank table and the redesign plan doc) —
// content.js's static arrays are now the SEED for that table and the
// fallback if it's ever empty or unreachable, not the primary source. This
// is the one place that fallback decision gets made, so every caller (just
// getFreshContentBank below) gets it automatically rather than needing to
// know the DB table exists at all.
async function fetchContentBankFromDb(typeId) {
  if (contentBankCache.has(typeId)) return contentBankCache.get(typeId);
  const { data, error } = await supabase.from("content_bank").select("entry").eq("type_id", typeId).eq("active", true);
  if (error) throw error;
  const bank = (data || []).map((row) => row.entry);
  contentBankCache.set(typeId, bank);
  return bank;
}

// This category's full content bank with every already-saved topic
// filtered out, for the Roulette screen to spin across. Reads from
// content_bank first (so the bank can grow over time via generate-content
// without a client release) and falls back to content.js's static arrays —
// fail open, same "don't block the roulette" spirit as the topic-filtering
// catch below — if the table is empty (e.g. seed hasn't run on this
// project) or unreachable (network hiccup, not signed in yet).
export async function getFreshContentBank(typeId) {
  let bank;
  try {
    const dbBank = await fetchContentBankFromDb(typeId);
    bank = dbBank.length > 0 ? dbBank : getContentBank(typeId);
  } catch (e) {
    // Deliberately fails open to the static bank rather than blocking the
    // roulette — content is content either way, so this isn't worth a user-
    // visible error. Logged so "why does content feel repetitive/stale"
    // (a plausible complaint if the DB bank is silently never being read)
    // is traceable rather than invisible.
    console.warn(`getFreshContentBank(${typeId}): content_bank fetch failed, using static fallback:`, e);
    bank = getContentBank(typeId);
  }
  try {
    const spokenKeys = await getSpokenTopicKeys(typeId);
    return filterUnspokenTopics(typeId, bank, spokenKeys);
  } catch (e) {
    // Not signed in yet, or a network hiccup — fail open to the unfiltered
    // bank rather than blocking the roulette from working at all. Logged
    // for the same reason as above: this is the mechanism behind "already
    // spoken" topics getting excluded, so a silent failure here would look
    // like a real bug (repeat prompts) with no trace of the actual cause.
    console.warn(`getFreshContentBank(${typeId}): couldn't load spoken-topic history, showing unfiltered bank:`, e);
    return { entries: bank, exhausted: false };
  }
}

// Uploads to <user_id>/<session_id>.webm, matching the path shape
// supabase/schema.sql's storage policies check against auth.uid(). Returns
// a public URL — see the tradeoff noted in schema.sql (unlisted, not truly
// access-controlled; fine for a practice app, swap to signed URLs off a
// private bucket if that's not good enough later).
export async function uploadRecording(blob, sessionId) {
  if (!blob) return null;
  const userId = await getCurrentUserId();
  const path = `${userId}/${sessionId}.webm`;
  const { error } = await supabase.storage
    .from("recordings")
    .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("recordings").getPublicUrl(path);
  return data.publicUrl;
}

export async function getSettings() {
  const { data, error } = await supabase.from("settings").select("*").maybeSingle();
  if (error) throw error;
  return settingsFromRow(data);
}

export async function setSettings(partial) {
  const userId = await getCurrentUserId();
  const current = await getSettings();
  const merged = { ...current, ...partial };
  const row = {
    user_id: userId,
    speech_feedback_enabled: merged.speechFeedbackEnabled,
    ai_feedback_model: merged.aiFeedbackModel,
    display_name: merged.displayName || null,
    age: merged.age === "" || merged.age === undefined ? null : merged.age,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("settings").upsert(row).select().single();
  if (error) throw error;
  return settingsFromRow(data);
}

// --- Derived stats (pure functions — unchanged by the Supabase migration,
// they just operate on whatever session array they're given) ---

export function computeStreak(sessions) {
  if (sessions.length === 0) return 0;
  const uniqueDays = [...new Set(sessions.map((s) => s.date))].sort().reverse();
  let streak = 0;
  let cursor = new Date();

  for (let i = 0; i < uniqueDays.length; i++) {
    const expected = todayStr(cursor);
    if (uniqueDays[i] === expected) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0 && uniqueDays[i] !== expected) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (uniqueDays[i] === todayStr(yesterday)) {
        streak += 1;
        cursor = yesterday;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return streak;
}

export function computeStats(sessions) {
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const streak = computeStreak(sessions);

  // Fixed Sunday-through-Saturday calendar week, not a rolling "last 7
  // days" window — otherwise the dot order shifts depending on what day of
  // the week it currently is (e.g. showing "T W T F S S M" on a Tuesday).
  // getDay() is 0 for Sunday, so subtracting it from today lands on this
  // week's Sunday regardless of what day today is.
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());

  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const key = todayStr(d);
    last7.push({
      date: key,
      dayLabel: d.toLocaleDateString(undefined, { weekday: "narrow" }),
      done: sessions.some((s) => s.date === key),
    });
  }

  return {
    totalSessions: sessions.length,
    totalMinutes,
    streak,
    last7,
  };
}

// How the just-finished session's wpm/fillerRate compare to the recent
// average, so feedback isn't just a number in isolation. Needs a handful of
// past sessions with feedback before a trend means anything.
const TREND_MIN_SAMPLES = 3;
const TREND_LOOKBACK = 10;

export function computeFeedbackTrend(pastSessions, current) {
  if (!current || !current.hasTranscript) return null;
  const withFeedback = pastSessions
    .filter((s) => s.feedback && s.feedback.wordCount > 0)
    .slice(0, TREND_LOOKBACK);
  if (withFeedback.length < TREND_MIN_SAMPLES) {
    return { ready: false, sampleSize: withFeedback.length, needed: TREND_MIN_SAMPLES };
  }
  const avg = (key) => withFeedback.reduce((sum, s) => sum + (s.feedback[key] || 0), 0) / withFeedback.length;
  const avgWpm = avg("wpm");
  const avgFillerRate = avg("fillerRate");
  return {
    ready: true,
    sampleSize: withFeedback.length,
    wpmDelta: Math.round(current.wpm - avgWpm),
    avgWpm: Math.round(avgWpm),
    fillerRateDelta: Math.round((current.fillerRate - avgFillerRate) * 10) / 10,
    avgFillerRate: Math.round(avgFillerRate * 10) / 10,
  };
}

export function didCompleteToday(sessions) {
  const today = todayStr();
  return sessions.some((s) => s.date === today);
}
