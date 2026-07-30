import { useState } from "react";
import { LogIn, Mail, UserPlus } from "lucide-react";
import { Body, Button, Card, Label, Logo, Title } from "../components/UI";
import { sendPasswordReset, signIn, signUp } from "../lib/auth";

// Real account auth via Supabase. Reached from Landing's "Sign in" / "Start
// free" buttons — initialMode seeds which tab is active, onBack returns to
// the marketing page. mode 'forgot' is reached only from within this
// screen (the "Forgot password?" link under sign-in) — never seeded via
// initialMode, since nothing outside this screen links to it directly.
export default function Login({ initialMode = "signin", onBack }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [signupDone, setSignupDone] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const goToMode = (nextMode) => {
    setMode(nextMode);
    setError(null);
    setPassword("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "forgot") {
        await sendPasswordReset(email.trim());
        // Deliberately shown whether or not this email actually has an
        // account — see the comment on sendPasswordReset in auth.js for why
        // that's not a bug.
        setResetSent(true);
      } else if (mode === "signin") {
        if (!password) return;
        await signIn({ email: email.trim(), password });
        // onAuthStateChange in App.jsx picks up the new session from here.
      } else {
        if (!password) return;
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

  const submitLabel = submitting
    ? "Please wait…"
    : mode === "forgot"
    ? "Send reset link"
    : mode === "signin"
    ? "Sign in"
    : "Sign up";
  const submitIcon = mode === "forgot" ? Mail : mode === "signin" ? LogIn : UserPlus;
  const submitDisabled =
    submitting || !email.trim() || (mode !== "forgot" && password.length < 6);

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
                goToMode("signin");
              }}
              style={{ marginTop: 20 }}
            />
          </>
        ) : resetSent ? (
          <>
            <Title style={{ marginTop: 14 }}>Check your email</Title>
            <Body className="dim" style={{ marginTop: 10 }}>
              If there's an account for <strong>{email}</strong>, we've sent a link to reset its
              password. Click it, then come back and sign in with your new password.
            </Body>
            <Button
              title="Back to sign in"
              variant="secondary"
              onClick={() => {
                setResetSent(false);
                goToMode("signin");
              }}
              style={{ marginTop: 20 }}
            />
          </>
        ) : (
          <>
            <Title style={{ marginTop: 14 }}>
              {mode === "forgot" ? "Reset your password." : mode === "signin" ? "Welcome back." : "Two minutes a day starts here."}
            </Title>
            <Body className="dim" style={{ marginTop: 6 }}>
              {mode === "forgot"
                ? "Enter the email on your account and we'll send you a link to set a new password."
                : "Your sessions, streak and badges follow the account — not the browser you happened to use."}
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
                  autoFocus={mode !== "signup"}
                />

                {mode !== "forgot" ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 14 }}>
                      <Label>Password</Label>
                      {mode === "signin" ? (
                        <button
                          type="button"
                          className="text-button"
                          style={{ fontSize: 12.5 }}
                          onClick={() => goToMode("forgot")}
                        >
                          Forgot password?
                        </button>
                      ) : null}
                    </div>
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
                  </>
                ) : null}

                {error ? (
                  <Body className="ai-feedback-error" style={{ marginTop: 12 }}>
                    {error}
                  </Body>
                ) : null}

                <Button title={submitLabel} icon={submitIcon} disabled={submitDisabled} style={{ marginTop: 18 }} />
              </form>
            </Card>

            {mode === "forgot" ? (
              <Button title="Back to sign in" variant="ghost" onClick={() => goToMode("signin")} style={{ marginTop: 14 }} />
            ) : (
              <Button
                title={mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
                variant="ghost"
                onClick={() => goToMode(mode === "signin" ? "signup" : "signin")}
                style={{ marginTop: 14 }}
              />
            )}

            <Body className="faint" style={{ marginTop: 20, fontSize: 12 }}>
              Microphone access is asked for once, on your first session.
            </Body>
          </>
        )}
      </div>
    </div>
  );
}
