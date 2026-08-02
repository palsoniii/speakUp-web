import { useEffect, useState } from "react";
import { Body, Button, Card, LoadErrorNote, Logo, StatTile, TextButton, ThemeToggle, Title } from "../components/UI";
import { EXERCISE_TYPES, getDailyExercise } from "../lib/content";
import { computeStats, didCompleteToday, getSessions, getSettings } from "../lib/storage";
import { reportError } from "../lib/errorMonitoring";

const WEEK_ORDER = ["S", "M", "T", "W", "T", "F", "S"]; // Sunday -> Saturday, matches storage.js's last7

// Stale-while-revalidate cache for the numbers on this page. A hard page
// refresh can't skip the Supabase round-trip the way a tab switch can (there's
// no in-memory state left to reuse), so without this, every single reload
// paints "0 day streak / DAY 0 / 0 of 5 tried" for as long as that request
// takes, then pops to the real numbers a beat later. Caching the last good
// result in localStorage means the very first paint after a refresh already
// shows real (if possibly a few minutes stale) numbers, which then get
// silently replaced once the fresh fetch resolves — same trade already made
// for isNew above, just extended to survive a full reload, not just a tab
// switch.
//
// Also holds displayName (fetched from a separate getSettings() call, not
// getSessions()) for the exact same reason — without it, the greeting
// flashed from the email-prefix fallback ("Ready when you are,
// palsonirocks.") to the real name ("...Pal Soni.") on every refresh, same
// class of bug as the numbers this cache was originally built for.
function homeCacheKey(userId) {
  return `speakup:homeCache:${userId}`;
}

function loadCachedHome(userId) {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(homeCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.stats) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Merges into whatever's already cached rather than overwriting wholesale —
// the sessions fetch and the settings fetch resolve independently (separate
// promises, no shared ordering), so each needs to be able to save its own
// slice without clobbering whatever the other one already wrote.
function saveCachedHome(userId, partial) {
  if (!userId) return;
  try {
    const existing = loadCachedHome(userId) || {};
    window.localStorage.setItem(homeCacheKey(userId), JSON.stringify({ ...existing, ...partial }));
  } catch {
    // Storage can be full or disabled (private browsing) — worst case we
    // just fall back to the zeroed-flash behavior for this one user, so
    // failing silently here is fine.
  }
}

function weekSummary(last7) {
  const today = new Date().getDay(); // 0 = Sunday
  const soFar = last7.slice(0, today + 1);
  const done = soFar.filter((d) => d.done).length;
  if (done === soFar.length) return "You've spoken every day this week. Keep it going.";
  if (done === 0) return "No sessions yet this week — today's a good day to start.";
  return `You've spoken ${done} of ${soFar.length} days this week. Keep it going.`;
}

// Topic selection happens in the Roulette screen — Home only needs to know
// which category is featured today, not what today's actual prompt is.
export default function Home({ onStartExercise, refreshKey, user, theme, onToggleTheme }) {
  const cached = useState(() => loadCachedHome(user?.id))[0];
  const [stats, setStats] = useState(cached?.stats || { totalMinutes: 0, streak: 0, last7: [], totalSessions: 0 });
  // If we had a cached snapshot for this user, treat stats as already
  // "loaded" from the first paint — that's the whole point of the cache: it
  // lets isNew and the rest of the layout resolve to the right branch
  // immediately instead of waiting on the network, same as if the fetch had
  // already completed.
  const [statsLoaded, setStatsLoaded] = useState(Boolean(cached));
  const [completedToday, setCompletedToday] = useState(cached?.completedToday || false);
  const [displayName, setDisplayName] = useState(cached?.displayName || "");
  const [exploredCount, setExploredCount] = useState(cached?.exploredCount || 0);
  const [today] = useState(() => getDailyExercise());
  // Set only if the background fetch below actually fails — previously
  // neither getSessions() nor getSettings() here had a .catch at all, so a
  // failure was an unhandled promise rejection: the screen just sat on
  // whatever the cache (or the zeroed defaults, on a first-ever visit) had,
  // with nothing telling the person their streak/stats might be stale or
  // wrong. `retryTick` gives the Retry button a way to re-run the effect
  // without duplicating its body.
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getSessions()
      .then((sessions) => {
        if (cancelled) return;
        const nextStats = computeStats(sessions);
        const nextCompletedToday = didCompleteToday(sessions);
        const nextExploredCount = new Set(sessions.map((s) => s.typeId)).size;
        setStats(nextStats);
        setCompletedToday(nextCompletedToday);
        setExploredCount(nextExploredCount);
        setStatsLoaded(true);
        setLoadError(null);
        saveCachedHome(user?.id, { stats: nextStats, completedToday: nextCompletedToday, exploredCount: nextExploredCount });
      })
      .catch((err) => {
        if (cancelled) return;
        reportError(err, "Home.getSessions");
        setStatsLoaded(true);
        setLoadError(err?.message || "Couldn't load your stats — check your connection and try again.");
      });
    getSettings()
      .then((s) => {
        if (cancelled) return;
        const nextDisplayName = s.displayName || "";
        setDisplayName(nextDisplayName);
        saveCachedHome(user?.id, { displayName: nextDisplayName });
      })
      .catch((err) => {
        if (cancelled) return;
        reportError(err, "Home.getSettings");
        // Doesn't overwrite a getSessions() failure above if both happen to
        // fail — either message is a real, actionable "something's wrong",
        // and showing whichever fired first/last is fine for a screen that
        // only shows one error line.
        setLoadError((prev) => prev || err?.message || "Couldn't load your profile settings.");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, user?.id, retryTick]);

  // Gated on statsLoaded, not just `stats.totalSessions === 0` — that
  // condition is also true for a split second on every single refresh,
  // before the real session count comes back from Supabase, since `stats`
  // starts zeroed. Same app.jsx-conditional-remount cause as the Settings/
  // Progress flash: this component starts from scratch on every visit, and
  // isNew doesn't just change a number here, it swaps in an entirely
  // different heading, tagline, pill label, and an extra "Getting started"
  // panel — so that zeroed instant used to render a completely different
  // page (a returning user with 3 sessions would flash "Welcome, Day One"
  // for a moment on every reload). Holding isNew at `false` until the real
  // data lands means a returning user always sees their real layout, just
  // with the numbers popping in a beat later — the same tradeoff already
  // made elsewhere (Badges, Settings). The cost is a genuinely brand-new
  // user briefly sees "returning user" copy before it corrects to "Day
  // One" — a one-time, low-stakes flash instead of a permanent, every-
  // reload one.
  const isNew = statsLoaded && stats.totalSessions === 0;
  const name = displayName || user?.email?.split("@")[0] || "there";
  const weekday = new Date().toLocaleDateString(undefined, { weekday: "long" });

  return (
    <div className="screen">
      <div className="app-header">
        <Logo />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="streak-pill">
            <span className="dot" style={{ width: 7, height: 7, background: stats.streak > 0 ? "var(--accent)" : "var(--faint)" }} />
            {stats.streak}
            <span className="dim" style={{ fontWeight: 600 }}>
              {" "}
              day streak
            </span>
          </span>
          {onToggleTheme ? <ThemeToggle theme={theme} onToggle={onToggleTheme} /> : null}
        </div>
      </div>

      <LoadErrorNote message={loadError} onRetry={() => setRetryTick((t) => t + 1)} style={{ marginTop: 14 }} />

      <div style={{ marginTop: 22 }}>
        <span className="demo-card-eyebrow">{isNew ? "Day one" : `${weekday} · day ${stats.streak}`}</span>
        <Title style={{ marginTop: 8 }}>{isNew ? `Welcome, ${name}.` : `Ready when you are, ${name}.`}</Title>
        <Body className="dim" style={{ marginTop: 9 }}>
          {isNew ? "One session is about two minutes. Nothing to set up first." : weekSummary(stats.last7)}
        </Body>
      </div>

      <div className="home-grid">
        <Card className="today-card" large style={{ borderColor: today.color + "40" }}>
          <div className="today-card-bloom" style={{ background: today.color }} />
          <div style={{ position: "relative" }}>
            <span className="pill" style={completedToday ? { color: "var(--good)", borderColor: "var(--good)", background: "color-mix(in srgb, var(--good) 16%, transparent)" } : { color: today.color, borderColor: today.color + "40", background: today.color + "16" }}>
              {completedToday ? "Done today" : "Today's pick"}
            </span>

            <div style={{ marginTop: 14 }}>
              {/* Dot sits in its own row with just the title, not the
                  title+tagline block together — otherwise centering it
                  against that whole two-line block visually pulls it down
                  toward the gap between the lines instead of next to the
                  title text itself. */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span
                  className="dot"
                  style={{ width: 15, height: 15, background: today.color, boxShadow: `0 6px 16px -4px ${today.color}` }}
                />
                <Title style={{ fontSize: 22, flex: 1, minWidth: 0 }}>{today.title}</Title>
              </div>
              <Body className="dim" style={{ marginTop: 6 }}>
                {today.tagline}
              </Body>
            </div>

            <div className="dim" style={{ marginTop: 16, fontSize: 12.5, fontWeight: 600 }}>
              {today.prepSeconds}s think · {today.speakSeconds}s speak · prompt is a spin
            </div>

            <Button
              title={completedToday ? "Practise again" : "Start today's session"}
              onClick={() => onStartExercise(today)}
              style={{ marginTop: 20, background: today.color }}
            />
            <TextButton title="Choose a different category" onClick={() => onStartExercise(null)} style={{ marginTop: 12 }} />
          </div>
        </Card>

        <div>
          <Card className="week-card">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span className="feedback-metric-label" style={{ fontSize: 11 }}>
                THIS WEEK
              </span>
              <span className="dim" style={{ fontSize: 12, fontWeight: 700 }}>
                {stats.last7.filter((d) => d.done).length} of 7 days
              </span>
            </div>
            <div className="week-strip">
              {stats.last7.map((d, i) => {
                const isToday = i === new Date().getDay();
                return (
                  <div className="week-day" key={d.date}>
                    <div className={`week-dot ${d.done ? "done" : ""} ${isToday && !d.done ? "today" : ""}`} />
                    <span className={`week-label ${isToday ? "today" : ""}`}>{WEEK_ORDER[i]}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="stat-tiles-row">
            <StatTile value={stats.totalMinutes} label="Minutes spoken" />
            <StatTile value={stats.totalSessions} label="Sessions done" />
          </div>
        </div>
      </div>

      {isNew ? (
        <div className="getting-started-panel">
          <span className="demo-card-eyebrow" style={{ color: "var(--primary)" }}>
            Getting started
          </span>
          <Body style={{ marginTop: 9, fontSize: 14, lineHeight: 1.55 }}>
            Nothing here yet — that's the correct state on day one. Do one two-minute session and this
            page fills up: a streak, a week strip, and your first badge. Word Ladder is the shortest one
            if you want an easy start.
          </Body>
        </div>
      ) : null}

      <div style={{ marginTop: 32, display: "flex", alignItems: "baseline", gap: 12 }}>
        <span className="demo-card-eyebrow">All five exercises</span>
        <span className="faint" style={{ fontSize: 12.5, marginLeft: "auto" }}>
          {exploredCount} of 5 tried
        </span>
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="exercise-grid">
          {EXERCISE_TYPES.map((ex) => (
            <Card className="exercise-mini-card card-clickable" key={ex.id} onClick={() => onStartExercise(ex)}>
              <div className="exercise-mini-bloom" style={{ background: ex.color }} />
              {/* Same fix as the Today card above: dot rides alongside just
                  the title line, tagline sits below as its own block, so
                  the dot doesn't end up centered against the taller
                  title+tagline pair and drift down between the two lines. */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="dot" style={{ width: 11, height: 11, background: ex.color }} />
                  <div className="exercise-title">{ex.title}</div>
                </div>
                <div className="exercise-tagline" style={{ marginTop: 4 }}>
                  {ex.tagline}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
