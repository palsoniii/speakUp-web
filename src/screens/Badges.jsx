import { useEffect, useState } from "react";
import { Body, Card, Label, LoadErrorNote, Title } from "../components/UI";
import { BADGE_ICONS } from "../lib/icons";
import { BADGE_DEFS, computeBadges } from "../lib/badges";
import { computeStats, getSessions } from "../lib/storage";
import { reportError } from "../lib/errorMonitoring";

// Purely presentational "how far away is this" text — the earned/locked
// truth still comes entirely from computeBadges() in lib/badges.js; this
// just mirrors the same thresholds to phrase the gap.
function remainingText(id, stats, exploredCount) {
  switch (id) {
    case "streak_3":
      return `${Math.max(0, 3 - stats.streak)} DAYS TO GO`;
    case "streak_7":
      return `${Math.max(0, 7 - stats.streak)} DAYS TO GO`;
    case "streak_30":
      return `${Math.max(0, 30 - stats.streak)} DAYS TO GO`;
    case "sessions_10":
      return `${Math.max(0, 10 - stats.totalSessions)} SESSIONS TO GO`;
    case "sessions_50":
      return `${Math.max(0, 50 - stats.totalSessions)} SESSIONS TO GO`;
    case "sessions_100":
      return `${Math.max(0, 100 - stats.totalSessions)} SESSIONS TO GO`;
    case "minutes_60":
      return `${Math.max(0, 60 - stats.totalMinutes)} MIN TO GO`;
    case "minutes_300":
      return `${Math.max(0, 300 - stats.totalMinutes)} MIN TO GO`;
    case "explorer":
      return `${Math.max(0, 5 - exploredCount)} MORE TO TRY`;
    case "clean_speaker":
      return "SPEAK ONE CLEAN SESSION";
    default:
      return "FINISH YOUR FIRST SESSION";
  }
}

// Same localStorage stale-while-revalidate cache as Home.jsx, and for the
// same reason: without it, every hard refresh briefly renders every badge as
// locked (defaults to `earned: false` for all of them) and every "N to go"
// counter at its zeroed distance, even for someone who's already earned
// most of them — a flash that's arguably more misleading here than on Home,
// since it looks like lost progress rather than just a loading state. Only
// caches the small derived values (badges, stats, explored count), not the
// full session rows — those carry transcripts/AI feedback/recording URLs
// and would bloat localStorage for no benefit, since nothing here needs the
// raw sessions beyond that one count.
function badgesCacheKey(userId) {
  return `speakup:badgesCache:${userId}`;
}

function loadCachedBadges(userId) {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(badgesCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.badges || !parsed.stats) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedBadges(userId, data) {
  if (!userId) return;
  try {
    window.localStorage.setItem(badgesCacheKey(userId), JSON.stringify(data));
  } catch {
    // Fine to fail silently — worst case this one user keeps seeing the old
    // zeroed-flash behavior, nothing else depends on this succeeding.
  }
}

// Its own tab rather than a strip on Home — badges are a "check in on your
// progress" thing, not something that needs to compete for space with
// today's exercise every time the app opens.
export default function Badges({ refreshKey, user }) {
  const cached = useState(() => loadCachedBadges(user?.id))[0];
  const [badges, setBadges] = useState(cached?.badges || BADGE_DEFS.map((b) => ({ ...b, earned: false })));
  const [stats, setStats] = useState(cached?.stats || { streak: 0, totalMinutes: 0, totalSessions: 0 });
  const [exploredCount, setExploredCount] = useState(cached?.exploredCount || 0);
  // Same as `statsLoaded` on Home — a cached snapshot counts as already
  // loaded so the summary line doesn't say "Loading…" over real numbers.
  const [loading, setLoading] = useState(!cached);
  // Previously this fetch had no .catch — the `.finally` still flipped
  // `loading` to false on failure (so the screen didn't hang on "Loading…"
  // forever), but it silently fell through to whatever the cache (or the
  // all-locked defaults, on a first-ever visit) had, with no indication
  // that the "earned"/"locked" state on screen might not be current.
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSessions()
      .then((data) => {
        if (cancelled) return;
        const s = computeStats(data);
        const b = computeBadges(data, s);
        const explored = new Set(data.map((sess) => sess.typeId)).size;
        setExploredCount(explored);
        setStats(s);
        setBadges(b);
        setLoadError(null);
        saveCachedBadges(user?.id, { badges: b, stats: s, exploredCount: explored });
      })
      .catch((err) => {
        if (cancelled) return;
        reportError(err, "Badges.getSessions");
        setLoadError(err?.message || "Couldn't refresh your badges — check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, user?.id, retryTick]);

  const earnedCount = badges.filter((b) => b.earned).length;
  const nextUp = badges.find((b) => !b.earned);

  return (
    <div className="screen">
      <Label>MILESTONES</Label>
      <Title>Badges</Title>
      <Body className="dim" style={{ marginTop: 6 }}>
        {loading
          ? "Loading…"
          : `${earnedCount} of ${badges.length} earned. Locked ones stay visible so the next goal is obvious.`}
      </Body>

      <LoadErrorNote message={loadError} onRetry={() => setRetryTick((t) => t + 1)} style={{ marginTop: 10 }} />

      {!loading && nextUp ? (
        <div className="next-up-banner">
          <div className="next-up-mark">
            {(() => {
              const Icon = BADGE_ICONS[nextUp.id];
              return Icon ? <Icon size={22} strokeWidth={2.25} /> : null;
            })()}
          </div>
          <div style={{ flex: 1 }}>
            <div className="label" style={{ color: "var(--primary)" }}>
              NEXT UP
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{nextUp.label}</div>
            <Body className="dim" style={{ marginTop: 2, fontSize: 12.5 }}>
              {remainingText(nextUp.id, stats, exploredCount)}
            </Body>
          </div>
        </div>
      ) : null}

      <div className="badge-grid">
        {badges.map((b) => {
          const Icon = BADGE_ICONS[b.id];
          return (
            <Card key={b.id} className={`badge-card ${b.earned ? "" : "locked"}`}>
              <div className={`badge-mark ${b.earned ? "earned" : "locked"}`}>
                {Icon ? <Icon size={20} strokeWidth={2.25} /> : null}
              </div>
              <div>
                <div className="badge-label">{b.label}</div>
                <Body className="dim" style={{ marginTop: 2, fontSize: 12 }}>
                  {b.description}
                </Body>
              </div>
              <span className={`badge-status ${b.earned ? "earned" : "locked"}`}>
                {b.earned ? "Earned" : remainingText(b.id, stats, exploredCount)}
              </span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
