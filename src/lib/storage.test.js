import { describe, expect, it } from "vitest";
import {
  computeFeedbackTrend,
  computeStats,
  computeStreak,
  didCompleteToday,
  filterUnspokenTopics,
  topicIdentityKey,
} from "./storage";

// getSessions/addSession/getSettings/setSettings are now real Supabase
// network calls (see the Supabase migration — sessions/settings live in
// Postgres, scoped per account via Row Level Security, not localStorage
// namespaced by a local profile anymore). Unit-testing those would mean
// mocking the Supabase client rather than testing this app's own logic, so
// this file now only covers the pure, synchronous derived-stats functions
// that operate on whatever session array they're handed — same as before.

// Mirrors storage.js's todayStr() — local calendar date, not
// d.toISOString() (which converts to UTC first and can land on the wrong
// day depending on timezone/time of day). Keeping this helper in sync with
// that function is what makes these date-comparison tests reliable.
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("computeStreak", () => {
  it("is 0 with no sessions", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const sessions = [{ date: isoDaysAgo(0) }, { date: isoDaysAgo(1) }, { date: isoDaysAgo(2) }];
    expect(computeStreak(sessions)).toBe(3);
  });

  it("still counts a streak that ended yesterday (grace day)", () => {
    const sessions = [{ date: isoDaysAgo(1) }, { date: isoDaysAgo(2) }];
    expect(computeStreak(sessions)).toBe(2);
  });

  it("breaks the streak on a gap", () => {
    const sessions = [{ date: isoDaysAgo(0) }, { date: isoDaysAgo(5) }];
    expect(computeStreak(sessions)).toBe(1);
  });
});

describe("computeStats", () => {
  it("sums duration into minutes and reports session count", () => {
    const sessions = [{ date: isoDaysAgo(0), durationSeconds: 90 }, { date: isoDaysAgo(0), durationSeconds: 30 }];
    const stats = computeStats(sessions);
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalMinutes).toBe(2); // 120s -> 2min
    expect(stats.last7).toHaveLength(7);
  });

  it("always lays out last7 as the current Sunday-through-Saturday week, not a rolling window", () => {
    const stats = computeStats([]);
    // Regardless of what day it is today, day 0 of the week strip should be
    // a Sunday and day 6 a Saturday — this used to instead be "today minus
    // 6 days" through "today", which reorders depending on the weekday.
    expect(new Date(stats.last7[0].date).getUTCDay()).toBe(0);
    expect(new Date(stats.last7[6].date).getUTCDay()).toBe(6);
    expect(stats.last7.map((d) => new Date(d.date).getUTCDay())).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("didCompleteToday", () => {
  it("true only if a session exists dated today", () => {
    expect(didCompleteToday([{ date: isoDaysAgo(1) }])).toBe(false);
    expect(didCompleteToday([{ date: isoDaysAgo(0) }])).toBe(true);
  });
});

describe("topicIdentityKey", () => {
  it("keys word_of_day entries by word, case/whitespace-insensitively", () => {
    expect(topicIdentityKey("word_of_day", { word: "  Pragmatic " })).toBe("pragmatic");
    expect(topicIdentityKey("word_of_day", { word: null })).toBeNull();
  });

  it("keys every other category by exact prompt text", () => {
    expect(topicIdentityKey("wiki_roulette", { prompt: "Talk about a pet." })).toBe("Talk about a pet.");
    expect(topicIdentityKey("word_ladder", { prompt: 'Connect "a" and "b".' })).toBe('Connect "a" and "b".');
  });
});

describe("filterUnspokenTopics", () => {
  const bank = [{ prompt: "A" }, { prompt: "B" }, { prompt: "C" }];

  it("returns the full bank untouched when nothing has been spoken", () => {
    const result = filterUnspokenTopics("wiki_roulette", bank, new Set());
    expect(result).toEqual({ entries: bank, exhausted: false });
  });

  it("excludes only entries whose prompt was already saved", () => {
    const result = filterUnspokenTopics("wiki_roulette", bank, new Set(["B"]));
    expect(result.entries.map((e) => e.prompt)).toEqual(["A", "C"]);
    expect(result.exhausted).toBe(false);
  });

  it("does NOT exclude an entry just because it was spun — only isDuplicate keys ever get to spokenKeys, which only ever come from real saved sessions", () => {
    // i.e. this function has no notion of "spun but not saved" at all —
    // it only ever sees what getSpokenTopicKeys pulled from `sessions`,
    // which only gets a row on an actual save (see Reflect.jsx's save()).
    const result = filterUnspokenTopics("wiki_roulette", bank, new Set());
    expect(result.entries).toHaveLength(3);
  });

  it("falls back to the full bank (and reports exhausted) once every entry has been saved", () => {
    const result = filterUnspokenTopics("wiki_roulette", bank, new Set(["A", "B", "C"]));
    expect(result.entries).toEqual(bank);
    expect(result.exhausted).toBe(true);
  });

  it("matches word_of_day entries by word, not prompt", () => {
    const vocabBank = [
      { word: "Ephemeral", prompt: "Talk about something ephemeral." },
      { word: "Ubiquitous", prompt: "Describe something ubiquitous." },
    ];
    const result = filterUnspokenTopics("word_of_day", vocabBank, new Set(["ephemeral"]));
    expect(result.entries.map((e) => e.word)).toEqual(["Ubiquitous"]);
  });
});

describe("computeFeedbackTrend", () => {
  const feedbackSession = (wpm, fillerRate) => ({ feedback: { wordCount: 50, wpm, fillerRate } });

  it("returns null when the current session has no transcript", () => {
    expect(computeFeedbackTrend([], { hasTranscript: false })).toBeNull();
  });

  it("reports not-ready with fewer than 3 past sessions with feedback", () => {
    const result = computeFeedbackTrend([feedbackSession(120, 5)], { hasTranscript: true, wpm: 130, fillerRate: 4 });
    expect(result.ready).toBe(false);
    expect(result.sampleSize).toBe(1);
  });

  it("computes deltas against the average once there are enough samples", () => {
    const past = [feedbackSession(100, 10), feedbackSession(100, 10), feedbackSession(100, 10)];
    const current = { hasTranscript: true, wpm: 130, fillerRate: 4 };
    const result = computeFeedbackTrend(past, current);
    expect(result.ready).toBe(true);
    expect(result.avgWpm).toBe(100);
    expect(result.wpmDelta).toBe(30);
    expect(result.avgFillerRate).toBe(10);
    expect(result.fillerRateDelta).toBe(-6);
  });

  it("ignores sessions without feedback or with an empty transcript", () => {
    const past = [feedbackSession(100, 10), feedbackSession(100, 10), feedbackSession(100, 10), { feedback: null }, { note: "no feedback field at all" }];
    const result = computeFeedbackTrend(past, { hasTranscript: true, wpm: 100, fillerRate: 10 });
    expect(result.sampleSize).toBe(3);
  });
});
