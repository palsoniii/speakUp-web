import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Body, Button, Card, Label, Logo, Title } from "../components/UI";
import { updatePassword } from "../lib/auth";

// Shown instead of the normal signed-in app when App.jsx sees a
// PASSWORD_RECOVERY auth event — i.e. someone just landed back here via the
// link from a "forgot password" email. Supabase's recovery link creates a
// real (if temporary-feeling) session so updatePassword() below can run;
// once it succeeds, onDone() hands control back to App.jsx, which then just
// renders the normal signed-in app since the session is already active.
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Shown as a quiet inline hint the moment the two fields disagree, rather
  // than saved up as an error the person only finds out about after
  // hitting submit — one less round trip for the single most common typo
  // on a "type your password twice" form.
  const mismatch = confirm.length > 0 && password !== confirm;

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6 || mismatch) return;
    setSubmitting(true);
    setError(null);
    try {
      await updatePassword(password);
      onDone();
    } catch (err) {
      setError(err?.message || "Something went wrong — try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <Logo />
        <Title style={{ marginTop: 14 }}>Set a new password.</Title>
        <Body className="dim" style={{ marginTop: 6 }}>
          You'll be signed back in with it right away.
        </Body>

        <Card large style={{ marginTop: 24 }}>
          <form onSubmit={submit}>
            <Label>New password</Label>
            <input
              className="field-input"
              style={{ marginTop: 8 }}
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              autoFocus
            />

            <Label style={{ marginTop: 14 }}>Confirm password</Label>
            <input
              className="field-input"
              style={{ marginTop: 8 }}
              type="password"
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={6}
            />
            {mismatch ? (
              <Body className="faint" style={{ marginTop: 6, fontSize: 12 }}>
                Passwords don't match yet.
              </Body>
            ) : null}

            {error ? (
              <Body className="ai-feedback-error" style={{ marginTop: 12 }}>
                {error}
              </Body>
            ) : null}

            <Button
              title={submitting ? "Please wait…" : "Set new password"}
              icon={KeyRound}
              disabled={submitting || password.length < 6 || confirm.length < 6 || mismatch}
              style={{ marginTop: 18 }}
            />
          </form>
        </Card>
      </div>
    </div>
  );
}
