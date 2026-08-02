import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import CrashFallback from './components/CrashFallback.jsx'
import { initErrorMonitoring } from './lib/errorMonitoring'

initErrorMonitoring()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Catches a render-time crash anywhere in the tree — previously nothing
        did, so a bug outside the async catch blocks this app already
        handles (a bad render, not a failed fetch) would blank the whole
        screen with no explanation and no way back except guessing to
        reload. Reports through the same pipeline as reportError() in
        errorMonitoring.js when a DSN is configured, and is a safe no-op
        (renders the fallback, reports nowhere) when it isn't. */}
    <Sentry.ErrorBoundary fallback={({ error }) => <CrashFallback error={error} />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
