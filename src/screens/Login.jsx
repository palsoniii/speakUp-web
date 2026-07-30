import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Body, Button, Card, Label, Logo, Title } from "../components/UI";
import { signIn, signUp } from "../lib/auth";

// Real account auth via Supabase. Reached from Landing's "Sign in" / "Start
// free" buttons — initialMode seeds which tab is active, onBack returns to
// the marketing page.
export default function Login({ initialMode = "signin", onBack }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [signupDone, setSignupDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "signin") {
        await signIn({ email: email.trim(), password });
        // onAuthStateChange in App.jsx picks up the new session from here.
      } else {
        await signUp({ email: email.trim(), password, name: name.trim() });
        // Supabase's default project settings require confirming via a
        // sent email before the account can sign in — surface that instead
        // of silently doing nothing, since there's no session yet at this
        // point if confirmation is required.
        setSignupDone(true);
      }
    } catch (err) {
      setError(err?.message || "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        {onBack ? (
          <button
            onClick={onBack}
            type="button"
            style={{ alignSelf: "flex-start", border: "none", background: "none", cursor: "pointer", padding: 0 }}
          >
            <Logo />
          </button>
        ) : (
          <Logo />
        )}

        {signupDone ? (
          <>
            <Title style={{ marginTop: 14 }}>Check your email</Title>
            <Body className="dim" style={{ marginTop: 10 }}>
              We sent a confirmation link to <strong>{email}</strong>. Click it, then come back and
              sign in below.
            </Body>
            <Button
              title="Back to sign in"
              variant="secondary"
              onClick={() => {
                setSignupDone(false);
                setMode("signin");
                setPassword("");
              }}
              style={{ marginTop: 20 }}
            />
          </>
        ) : (
          <>
            <Title style={{ marginTop: 14 }}>{mode === "signin" ? "Welcome back." : "Two minutes a day starts here."}</Title>
            <Body className="dim" style={{ marginTop: 6 }}>
              Your sessions, streak and badges follow the account — not the browser you happened to
              use.
            </Body>

            <Card large style={{ marginTop: 24 }}>
              <form onSubmit={submit}>
                {mode === "signup" ? (
                  <>
                    <Label>Name</Label>
                    <input
                      className="field-input"
                      style={{ marginTop: 8 }}
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      autoFocus
                    />
                  </>
                ) : null}

                <Label style={{ marginTop: mode === "signup" ? 14 : 0 }}>Email</Label>
                <input
                  className="field-input"
                  style={{ marginTop: 8 }}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus={mode === "signin"}
                />

                <Label style={{ marginTop: 14 }}>Password</Label>
                <input
                  className="field-input"
                  style={{ marginTop: 8 }}
                  type="password"
                  placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={6}
                />

                {error ? (
                  <Body className="ai-feedback-error" style={{ marginTop: 12 }}>
                    {error}
                  </Body>
                ) : null}

                <Button
                  title={submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
                  icon={mode === "signin" ? LogIn : UserPlus}
                  disabled={submitting || !email.trim() || password.length < 6}
                  style={{ marginTop: 18 }}
                />
              </form>
            </Card>

            <Button
              title={mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
              variant="ghost"
              onClick={() => {
                setMode((m) => (m === "signin" ? "signup" : "signin"));
                setError(null);
              }}
              style={{ marginTop: 14 }}
            />

            <Body className="faint" style={{ marginTop: 20, fontSize: 12 }}>
              Microphone access is asked for once, on your first session.
            </Body>
          </>
        )}
      </div>
    </div>
  );
}
