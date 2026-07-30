// Badge thresholds are intentionally simple and derived entirely from data
// already available (computeStats/computeStreak in storage.js, plus a
// quick scan of the session list itself) — same "transparent, nothing
// hidden" spirit as analysis.js's rule-based feedback, just applied to
// progress/gamification instead of speaking feedback.
export const BADGE_DEFS = [
  {
    id: "first_session",
    label: "First Step",
    description: "Complete your first session.",
    check: ({ stats }) => stats.totalSessions >= 1,
  },
  {
    id: "streak_3",
    label: "3-Day Streak",
    description: "Practice 3 days in a row.",
    check: ({ stats }) => stats.streak >= 3,
  },
  {
    id: "streak_7",
    label: "Week Strong",
    description: "Practice 7 days in a row.",
    check: ({ stats }) => stats.streak >= 7,
  },
  {
    id: "streak_30",
    label: "Month Strong",
    description: "Practice 30 days in a row.",
    check: ({ stats }) => stats.streak >= 30,
  },
  {
    id: "sessions_10",
    label: "Getting Started",
    description: "Complete 10 sessions.",
    check: ({ stats }) => stats.totalSessions >= 10,
  },
  {
    id: "sessions_50",
    label: "Dedicated",
    description: "Complete 50 sessions.",
    check: ({ stats }) => stats.totalSessions >= 50,
  },
  {
    id: "sessions_100",
    label: "Centurion",
    description: "Complete 100 sessions.",
    check: ({ stats }) => stats.totalSessions >= 100,
  },
  {
    id: "minutes_60",
    label: "Hour of Power",
    description: "Speak for 60 minutes total.",
    check: ({ stats }) => stats.totalMinutes >= 60,
  },
  {
    id: "minutes_300",
    label: "Marathoner",
    description: "Speak for 300 minutes total.",
    check: ({ stats }) => stats.totalMinutes >= 300,
  },
  {
    id: "explorer",
    label: "Explorer",
    description: "Try all 5 exercise types at least once.",
    check: ({ sessions }) => new Set(sessions.map((s) => s.typeId)).size >= 5,
  },
  {
    id: "clean_speaker",
    label: "Clean Speaker",
    description: "Finish a session with zero filler words.",
    check: ({ sessions }) =>
      sessions.some((s) => s.feedback && s.feedback.wordCount > 0 && s.feedback.totalFillers === 0),
  },
];

// Returns every badge (earned or not) so the UI can show locked ones too —
// seeing what's next is most of the point of a badge list.
export function computeBadges(sessions, stats) {
  const ctx = { sessions, stats };
  return BADGE_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    description: def.description,
    earned: def.check(ctx),
  }));
}
