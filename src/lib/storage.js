import { supabase } from "./supabaseClient";

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
  reminderEnabled: false,
  reminderHour: 9,
  reminderMinute: 0,
  speechFeedbackEnabled: true,
  aiFeedbackModel: "llama-3.3-70b-versatile",
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
    reminderEnabled: row.reminder_enabled,
    reminderHour: row.reminder_hour,
    reminderMinute: row.reminder_minute,
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
    reminder_enabled: merged.reminderEnabled,
    reminder_hour: merged.reminderHour,
    reminder_minute: merged.reminderMinute,
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
