// Rendered by the Sentry.ErrorBoundary wrapping <App /> in main.jsx when a
// render-time crash happens anywhere in the tree — previously nothing
// caught this, so an unexpected bug would just blank the whole screen with
// no explanation and no way back except guessing to reload. Kept in its
// own file (rather than inline in main.jsx) purely so main.jsx stays a
// component-free entry point — same reasoning oxlint's fast-refresh rule
// nudges toward everywhere else in this app.
export default function CrashFallback({ error }) {
  return (
    <div className="app-shell">
      <div className="center-screen">
        <div>
          <div className="label">SOMETHING WENT WRONG</div>
          <h1 className="title" style={{ marginTop: 8 }}>
            SpeakUp hit an unexpected error.
          </h1>
          <p className="body-text dim" style={{ marginTop: 10 }}>
            {error?.message || "An unknown error occurred."} Reloading usually fixes this — your
            saved sessions and recordings aren't affected.
          </p>
          <button
            className="button button-primary"
            style={{ marginTop: 20, width: "auto" }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
