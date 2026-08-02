// Optional production error monitoring via Sentry — off by default, and
// entirely opt-in, same "is it configured" pattern src/lib/supabaseClient.js
// already uses for its own optional setup (no VITE_SENTRY_DSN set = this
// module is a no-op, the app works exactly the same either way).
//
// Why this exists: the fail-soft cleanup across App.jsx, Home/Progress/
// Badges/Settings, and Record.jsx replaced a lot of fully-silent failures
// with real, specific messages — but every one of those messages was still
// only ever visible to the one person who hit it, in their own browser.
// There was no way to find out a real user hit a real error without them
// reporting it directly. This closes that gap: reportError() below is
// called from the same catch blocks that already show a message to the
// person, so the same failure shows up in Sentry's dashboard too, when
// configured — no more waiting for a complaint to know something broke.
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

export const errorMonitoringConfigured = Boolean(dsn);

export function initErrorMonitoring() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Tags dev-machine noise apart from real production errors in Sentry's
    // dashboard, in the unlikely case anyone sets a DSN locally too.
    environment: import.meta.env.MODE,
    // This app needs error capture, not detailed performance tracing — a
    // low, fixed sample rate keeps it on Sentry's free tier without trying
    // to be a full APM tool it doesn't need to be.
    tracesSampleRate: 0.1,
  });
}

// Shared by every catch block that already surfaces a real message to the
// person (session check, Home/Progress/Badges/Settings data loads, Settings
// saves, Record's transcription failures) — always logs to the console
// (cheap, and the only signal at all when Sentry isn't configured), and
// also reports to Sentry when it is. `context` is a short static label (the
// screen/operation name), not the dynamic error text, so Sentry can group
// occurrences of the same failure point together instead of treating every
// slightly-different error message as a new issue.
export function reportError(error, context) {
  console.error(context ? `[${context}]` : "", error);
  if (dsn) {
    Sentry.captureException(error, context ? { tags: { context } } : undefined);
  }
}
