import { useEffect, useState } from "react";
import { KeyRound, LogOut, MessageSquareHeart, Mic, Moon, Send, Sparkles, Sun, User } from "lucide-react";
import { Body, Button, Card, IconBadge, Label, LoadErrorNote, Switch, Title } from "../components/UI";
import { updatePassword } from "../lib/auth";
import { isSpeechRecognitionSupported } from "../lib/speech";
import { DEFAULT_SETTINGS, getSettings, setSettings, submitFeedback } from "../lib/storage";
import { reportError } from "../lib/errorMonitoring";

const speechSupported = isSpeechRecognitionSupported();

// Both options are ones the ai-feedback Edge Function already knows how to
// serve (see DEFAULT_MODEL/FALLBACK_MODEL in src/lib/aiCoach.js and
// supabase/functions/ai-feedback/index.ts) — not just any Groq model id.
// gpt-oss-20b in particular gets special-cased there for the same
// structured-output workaround as gpt-oss-120b, so switching to it here is
// safe rather than a shot in the dark at an untested model.
const AI_MODEL_OPTIONS = [
  { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B — default, most capable" },
  { value: "openai/gpt-oss-20b", label: "GPT-OSS 20B — lighter & faster" },
];

// Same localStorage stale-while-revalidate cache as Home.jsx/Badges.jsx, and
// for the same reason: App.jsx unmounts this whole screen every time you
// navigate away from the "You" tab and mounts a fresh instance when you come
// back (`{tab === "settings" && <Settings />}`), so without a cache this
// always starts from DEFAULT_SETTINGS and pops to the real saved value a
// beat after the Supabase round-trip resolves. For someone whose speech-
// feedback toggle is off, that pop is a visible snap — the Switch has its
// own on/off transition (see .switch/.switch-knob in index.css), so every
// single visit briefly renders the toggle at the default and then animates
// to the real value, as if it were just clicked. Caching the last-known
// settings means the very first paint already shows the right value with no
// animated transition, and the Sign out card (which mounts and unmounts in
// lockstep with everything else on this screen, since it's all one
// component) stops flickering along with it.
function settingsCacheKey(userId) {
  return `speakup:settingsCache:${userId}`;
}

function loadCachedSettings(userId) {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(settingsCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedSettings(userId, data) {
  if (!userId) return;
  try {
    window.localStorage.setItem(settingsCacheKey(userId), JSON.stringify(data));
  } catch {
    // Storage full/disabled — worst case this one user sees the old
    // zeroed-flash behavior again, not worth failing the render over.
  }
}

export default function Settings({ user, onSignOut, theme, onToggleTheme }) {
  // Starts from a cached snapshot if we have one for this user, falling
  // back to DEFAULT_SETTINGS only on a genuinely first-ever visit — see the
  // comment above for why that matters every time this tab is revisited,
  // not just on first load.
  const cached = useState(() => loadCachedSettings(user?.id))[0];
  const [settings, setLocalSettings] = useState(cached || DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(Boolean(cached));
  const [signingOut, setSigningOut] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [ageDraft, setAgeDraft] = useState("");
  const [profileSynced, setProfileSynced] = useState(false);

  // Previously getSettings() here had no .catch — a failure fell straight
  // through to the cache (or DEFAULT_SETTINGS, on a first-ever visit /
  // different device) with no indication anything was wrong. Separate from
  // settingsSaveError below since a load failure and a save failure are
  // different problems needing different explanations, even though both
  // render through the same LoadErrorNote.
  const [settingsLoadError, setSettingsLoadError] = useState(null);
  const [loadRetryTick, setLoadRetryTick] = useState(0);

  // update() below previously had no try/catch at all — a failed save (name,
  // age, the speech-feedback toggle, or the AI model picker) was a fully
  // silent unhandled rejection. Worse than just "no message": the input
  // field's own local draft state (nameDraft/ageDraft) already reflects
  // what was typed regardless of whether the save actually landed, so
  // without this, a failed save looked identical to a successful one right
  // up until the next reload quietly reverted it. `lastFailedPartial` lets
  // Retry resend exactly what didn't save, not just re-fetch.
  const [settingsSaveError, setSettingsSaveError] = useState(null);
  const [lastFailedPartial, setLastFailedPartial] = useState(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Same "collapsed row -> expanded form" pattern as the password card
  // above. feedbackSent stays true once a submission lands so re-opening
  // the card after a successful send shows "Thanks — got it!" instead of
  // silently resetting to a blank form, in case someone wants to send a
  // second note.
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackWorking, setFeedbackWorking] = useState("");
  const [feedbackNotWorking, setFeedbackNotWorking] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((s) => {
        if (cancelled) return;
        setLocalSettings(s);
        setSettingsLoaded(true);
        setSettingsLoadError(null);
        saveCachedSettings(user?.id, s);
      })
      .catch((err) => {
        if (cancelled) return;
        reportError(err, "Settings.getSettings");
        setSettingsLoaded(true);
        setSettingsLoadError(err?.message || "Couldn't load your latest settings — showing the last saved version.");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loadRetryTick]);

  // Seed the name/age inputs once the *real* saved settings have arrived
  // (gated on settingsLoaded, not just `settings` being truthy — settings
  // is always truthy now since it starts from DEFAULT_SETTINGS) and leave
  // them alone after that — otherwise every re-render after a save (which
  // refreshes `settings`) would stomp on whatever the user is mid-typing.
  useEffect(() => {
    if (settingsLoaded && !profileSynced) {
      setNameDraft(settings.displayName || "");
      setAgeDraft(settings.age != null ? String(settings.age) : "");
      setProfileSynced(true);
    }
  }, [settingsLoaded, settings, profileSynced]);

  const update = async (partial) => {
    try {
      const updated = await setSettings(partial);
      setLocalSettings(updated);
      setSettingsSaveError(null);
      setLastFailedPartial(null);
    } catch (err) {
      reportError(err, "Settings.setSettings");
      setSettingsSaveError(err?.message || "Couldn't save that change — check your connection and try again.");
      setLastFailedPartial(partial);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await onSignOut();
  };

  // Same 6-char minimum and "type it twice" pattern as ResetPassword.jsx's
  // recovery-link flow — this is the same updatePassword() call, just
  // reachable from a normal signed-in session instead of only via a
  // password-reset email.
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const openPasswordForm = () => {
    setShowPasswordForm(true);
    setPasswordSaved(false);
    setPasswordError(null);
  };

  const cancelPasswordForm = () => {
    setShowPasswordForm(false);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  };

  const submitPasswordChange = async () => {
    if (newPassword.length < 6 || passwordMismatch) return;
    setPasswordSubmitting(true);
    setPasswordError(null);
    try {
      await updatePassword(newPassword);
      setShowPasswordForm(false);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(err?.message || "Couldn't update your password — try again.");
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const openFeedbackForm = () => {
    setShowFeedbackForm(true);
    setFeedbackError(null);
  };

  const cancelFeedbackForm = () => {
    setShowFeedbackForm(false);
    setFeedbackError(null);
  };

  const submitFeedbackForm = async () => {
    if (!feedbackWorking.trim() && !feedbackNotWorking.trim()) return;
    setFeedbackSubmitting(true);
    setFeedbackError(null);
    try {
      await submitFeedback({ whatsWorking: feedbackWorking, whatsNotWorking: feedbackNotWorking });
      setShowFeedbackForm(false);
      setFeedbackWorking("");
      setFeedbackNotWorking("");
      setFeedbackSent(true);
    } catch (err) {
      reportError(err, "Settings.submitFeedback");
      setFeedbackError(err?.message || "Couldn't send that — check your connection and try again.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="screen">
      <Label>YOUR SETUP</Label>
      <Title>Settings</Title>

      <LoadErrorNote message={settingsLoadError} onRetry={() => setLoadRetryTick((t) => t + 1)} style={{ marginTop: 10 }} />
      <LoadErrorNote
        message={settingsSaveError}
        onRetry={lastFailedPartial ? () => update(lastFailedPartial) : undefined}
        style={{ marginTop: 10 }}
      />

      {/* Back to the two-column grid — Local Engines and the About blurb
          used to fill the right column; now that's just the Sign out card,
          which is why it stays up top on the right instead of getting
          stacked under everything else in a single column. */}
      <div className="settings-grid">
        <div>
          {user ? (
            <Card>
              <div className="settings-row" style={{ paddingTop: 0 }}>
                <IconBadge icon={User} color="#6e5ef2" size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }}>{user.email}</div>
                  <Body className="dim" style={{ marginTop: 2, fontSize: 12.5 }}>
                    Signed in · everything follows this account
                  </Body>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Label>Name</Label>
                  <input
                    className="field-input"
                    style={{ marginTop: 8 }}
                    type="text"
                    placeholder="Your name"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => {
                      if (nameDraft !== (settings.displayName || "")) update({ displayName: nameDraft.trim() });
                    }}
                  />
                </div>
                <div style={{ width: 84 }}>
                  <Label>Age</Label>
                  <input
                    className="field-input"
                    style={{ marginTop: 8 }}
                    type="number"
                    min="1"
                    max="120"
                    placeholder="—"
                    value={ageDraft}
                    onChange={(e) => setAgeDraft(e.target.value)}
                    onBlur={() => {
                      const parsed = ageDraft === "" ? null : Math.max(1, Math.min(120, Number(ageDraft) || 0));
                      if (parsed !== settings.age) update({ age: parsed });
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                {!showPasswordForm ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }}>Password</div>
                      <Body className="dim" style={{ marginTop: 2, fontSize: 12.5 }}>
                        {passwordSaved ? "Updated." : "••••••••"}
                      </Body>
                    </div>
                    <Button title="Change password" icon={KeyRound} variant="secondary" small onClick={openPasswordForm} />
                  </div>
                ) : (
                  <>
                    <Label>New password</Label>
                    <input
                      className="field-input"
                      style={{ marginTop: 8 }}
                      type="password"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      autoFocus
                    />
                    <Label style={{ marginTop: 12 }}>Confirm password</Label>
                    <input
                      className="field-input"
                      style={{ marginTop: 8 }}
                      type="password"
                      placeholder="Type it again"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                    />
                    {passwordMismatch ? (
                      <Body className="faint" style={{ marginTop: 8, fontSize: 12 }}>
                        Passwords don't match yet.
                      </Body>
                    ) : null}
                    {passwordError ? (
                      <Body className="ai-feedback-error" style={{ marginTop: 8 }}>
                        {passwordError}
                      </Body>
                    ) : null}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <Button
                        title={passwordSubmitting ? "Saving…" : "Save password"}
                        icon={KeyRound}
                        small
                        onClick={submitPasswordChange}
                        disabled={passwordSubmitting || newPassword.length < 6 || confirmPassword.length < 6 || passwordMismatch}
                      />
                      <Button title="Cancel" variant="ghost" small onClick={cancelPasswordForm} disabled={passwordSubmitting} />
                    </div>
                  </>
                )}
              </div>
            </Card>
          ) : null}

          <Card style={{ marginTop: 16 }}>
            <div className="settings-row" style={{ paddingTop: 0 }}>
              {theme === "dark" ? (
                <IconBadge icon={Sun} color="#F2B84B" size={34} />
              ) : (
                <IconBadge icon={Moon} color="#6C8CFF" size={34} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }}>Appearance</div>
                <Body className="dim" style={{ marginTop: 2, fontSize: 12.5 }}>
                  {theme === "dark" ? "Dark" : "Light"}
                </Body>
              </div>
              {onToggleTheme ? (
                <Button
                  title={theme === "dark" ? "Switch to light" : "Switch to dark"}
                  variant="secondary"
                  small
                  onClick={onToggleTheme}
                />
              ) : null}
            </div>

            <div className="settings-row">
              <IconBadge icon={Mic} color="#2fae83" size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }}>Live captions while recording</div>
                <Body className="dim" style={{ marginTop: 2, fontSize: 12.5 }}>
                  {!speechSupported
                    ? "Not supported in this browser"
                    : settings.speechFeedbackEnabled
                    ? "On — shows what you're saying as you speak"
                    : "Off"}
                </Body>
              </div>
              <Switch
                value={settings.speechFeedbackEnabled}
                onChange={(v) => update({ speechFeedbackEnabled: v })}
                disabled={!speechSupported}
              />
            </div>
            <Body className="faint" style={{ marginTop: 14, fontSize: 11.5 }}>
              {speechSupported
                ? "Chrome/Edge send audio to a cloud speech service for this specific on-screen feature. It doesn't control your saved feedback, which is transcribed separately either way."
                : "This browser doesn't support the Web Speech API — recording, playback, self-rating, and saved-session feedback still work normally."}
            </Body>
          </Card>

        </div>

        <div>
          <Card>
            <div className="settings-row" style={{ paddingTop: 0 }}>
              <IconBadge icon={Sparkles} color="#6e5ef2" size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }}>AI feedback model</div>
                <Body className="dim" style={{ marginTop: 2, fontSize: 12.5 }}>
                  Which model judges your delivery, word choice, and structure
                </Body>
              </div>
            </div>
            <Body className="faint" style={{ marginTop: 10, fontSize: 11.5 }}>
              This is a free, student-built project running on Groq's free tier, which caps how many requests each
              model can serve per day across everyone using the app — so it's possible to occasionally hit a rate
              limit. If that happens, switching to the lighter model below runs on a separate quota and often gets
              through when the default one is busy.
            </Body>
            <select
              className="field-input"
              style={{ marginTop: 12 }}
              value={settings.aiFeedbackModel || DEFAULT_SETTINGS.aiFeedbackModel}
              onChange={(e) => update({ aiFeedbackModel: e.target.value })}
            >
              {AI_MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Card>

          <Card style={{ marginTop: 16 }}>
            <div className="settings-row" style={{ paddingTop: 0 }}>
              <IconBadge icon={MessageSquareHeart} color="#e0648a" size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }}>Feedback</div>
                <Body className="dim" style={{ marginTop: 2, fontSize: 12.5 }}>
                  {feedbackSent && !showFeedbackForm ? "Thanks — got it!" : "Tell us what's working and what's not"}
                </Body>
              </div>
              {!showFeedbackForm ? (
                <Button title="Send feedback" icon={MessageSquareHeart} variant="secondary" small onClick={openFeedbackForm} />
              ) : null}
            </div>

            {showFeedbackForm ? (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <Label>What's working well?</Label>
                <textarea
                  className="note-input"
                  style={{ minHeight: 60 }}
                  placeholder="Optional"
                  value={feedbackWorking}
                  onChange={(e) => setFeedbackWorking(e.target.value)}
                />
                <Label style={{ marginTop: 12 }}>What's not working / could be better?</Label>
                <textarea
                  className="note-input"
                  style={{ minHeight: 60 }}
                  placeholder="Optional"
                  value={feedbackNotWorking}
                  onChange={(e) => setFeedbackNotWorking(e.target.value)}
                />
                {feedbackError ? (
                  <Body className="ai-feedback-error" style={{ marginTop: 8 }}>
                    {feedbackError}
                  </Body>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Button
                    title={feedbackSubmitting ? "Sending…" : "Send"}
                    icon={Send}
                    small
                    onClick={submitFeedbackForm}
                    disabled={feedbackSubmitting || (!feedbackWorking.trim() && !feedbackNotWorking.trim())}
                  />
                  <Button title="Cancel" variant="ghost" small onClick={cancelFeedbackForm} disabled={feedbackSubmitting} />
                </div>
              </div>
            ) : null}
          </Card>

          <Card style={{ marginTop: 16 }}>
            <Button
              title={signingOut ? "…" : "Sign out"}
              variant="ghost"
              icon={LogOut}
              onClick={handleSignOut}
              disabled={signingOut}
            />
          </Card>

          <Body className="faint" style={{ marginTop: 14, fontSize: 11.5, display: "flex", gap: 14 }}>
            <a href="/terms.html" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              Terms of Use
            </a>
            <a href="/privacy.html" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              Privacy Policy
            </a>
          </Body>
        </div>
      </div>
    </div>
  );
}
