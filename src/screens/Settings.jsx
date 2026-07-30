import { useEffect, useState } from "react";
import { Bell, LogOut, Mic, Moon, Sun, User } from "lucide-react";
import { Body, Button, Card, IconBadge, Label, Switch, Title } from "../components/UI";
import { isSpeechRecognitionSupported } from "../lib/speech";
import { DEFAULT_SETTINGS, getSettings, setSettings } from "../lib/storage";

const speechSupported = isSpeechRecognitionSupported();

// Same localStorage stale-while-revalidate cache as Home.jsx/Badges.jsx, and
// for the same reason: App.jsx unmounts this whole screen every time you
// navigate away from the "You" tab and mounts a fresh instance when you come
// back (`{tab === "settings" && <Settings />}`), so without a cache this
// always starts from DEFAULT_SETTINGS (reminderEnabled: false) and pops to
// the real saved value a beat after the Supabase round-trip resolves. For
// someone who actually has the reminder on, that pop is a visible snap — the
// Switch has its own on/off transition (see .switch/.switch-knob in
// index.css), so every single visit briefly renders the toggle off and then
// animates it on, as if it were just clicked. Caching the last-known
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

  useEffect(() => {
    let cancelled = false;
    getSettings().then((s) => {
      if (cancelled) return;
      setLocalSettings(s);
      setSettingsLoaded(true);
      saveCachedSettings(user?.id, s);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
    const updated = await setSettings(partial);
    setLocalSettings(updated);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await onSignOut();
  };

  const reminderTime = `${String(settings.reminderHour).padStart(2, "0")}:${String(
    settings.reminderMinute
  ).padStart(2, "0")}`;

  return (
    <div className="screen">
      <Label>YOUR SETUP</Label>
      <Title>Settings</Title>

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
            </Card>
          ) : null}

          <Card style={{ marginTop: 16 }}>
            <div className="settings-row">
              <IconBadge icon={Bell} color="#6e5ef2" size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }}>Daily reminder</div>
                <Body className="dim" style={{ marginTop: 2, fontSize: 12.5 }}>
                  {settings.reminderEnabled ? `Reminds you at ${reminderTime}` : "Off"}
                </Body>
              </div>
              <Switch value={settings.reminderEnabled} onChange={(v) => update({ reminderEnabled: v })} />
            </div>

            <div className="settings-row">
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
            <Button
              title={signingOut ? "…" : "Sign out"}
              variant="ghost"
              icon={LogOut}
              onClick={handleSignOut}
              disabled={signingOut}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
