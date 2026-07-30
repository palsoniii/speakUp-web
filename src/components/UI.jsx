import { Moon, Sun } from "lucide-react";

const FEELING_WORDS = ["", "rough", "okay", "good", "great"];

// Self-rating renders as 1–4 growing bar marks, not an emoji face — shared
// by Reflect (the picker), Progress's Trends/History rows, and anywhere
// else a past session's "how did that feel" needs a compact readout.
export function FeelingMarks({ value, color }) {
  if (!value) return null;
  return (
    <span className="feeling-marks" aria-label={`felt ${FEELING_WORDS[value]}`}>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`feeling-mark ${n <= value ? "on" : ""}`}
          style={{ height: 4 + n * 3, ...(n <= value && color ? { background: color } : null) }}
        />
      ))}
    </span>
  );
}

export function Card({ children, style, className = "", onClick, large }) {
  const interactive = Boolean(onClick);
  return (
    <div
      className={`card ${large ? "card-lg" : ""} ${interactive ? "card-clickable" : ""} ${className}`}
      style={style}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

// variant: primary | secondary | ghost | glass | panel
export function Button({ title, onClick, variant = "primary", disabled, style, small, icon: Icon, iconSpin, type }) {
  const cls = `button button-${variant} ${small ? "button-small" : ""}`;
  return (
    <button className={cls} onClick={onClick} disabled={disabled} style={style} type={type}>
      {Icon ? <Icon size={16} strokeWidth={2.25} className={iconSpin ? "icon-spin" : undefined} /> : null}
      {title}
    </button>
  );
}

export function TextButton({ title, onClick, icon: Icon, style }) {
  return (
    <button className="text-button" onClick={onClick} style={style} type="button">
      {title}
      {Icon ? <Icon size={13} strokeWidth={2.5} /> : null}
    </button>
  );
}

export function Pill({ label, color, icon: Icon }) {
  const style = color ? { color, borderColor: color + "40", background: color + "16" } : undefined;
  return (
    <span className="pill" style={style}>
      {Icon ? <Icon size={11} strokeWidth={2.5} /> : null}
      {label}
    </span>
  );
}

// Wordmark used in every header: violet dot + "SpeakUp" in title case. Not
// styled as an all-caps label — that's a distinct, smaller treatment used
// for eyebrow/section labels elsewhere.
export function Logo({ style }) {
  return (
    <span className="app-logo" style={style}>
      <span className="app-logo-dot" />
      SpeakUp
    </span>
  );
}

export function EyebrowPill({ children }) {
  return (
    <span className="eyebrow-pill">
      <span className="eyebrow-dot" />
      {children}
    </span>
  );
}

export function IconBadge({ icon: Icon, color, size = 34 }) {
  return (
    <div className="exercise-icon" style={{ width: size, height: size, background: color + "16", color }}>
      <Icon size={size * 0.5} strokeWidth={2.25} />
    </div>
  );
}

export function Label({ children }) {
  return <div className="label">{children}</div>;
}

export function Title({ children, style }) {
  return (
    <h1 className="title" style={style}>
      {children}
    </h1>
  );
}

export function Subtitle({ children, style }) {
  return (
    <p className="subtitle" style={style}>
      {children}
    </p>
  );
}

export function Body({ children, style, className = "" }) {
  return (
    <p className={`body-text ${className}`} style={style}>
      {children}
    </p>
  );
}

export function Switch({ value, onChange, disabled }) {
  return (
    <button
      className={`switch ${value ? "on" : ""}`}
      onClick={() => onChange(!value)}
      disabled={disabled}
      style={disabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
      type="button"
    >
      <span className="switch-knob" />
    </button>
  );
}

// Pill-switcher used for Reflect's four tabs, Progress's Trends|History,
// Login's sign-in/sign-up mode toggle, and Badges filters. `block` stretches
// each tab to fill the available width instead of hugging its label.
export function Tabs({ tabs, value, onChange, block }) {
  return (
    <div className={`tabs ${block ? "tabs-block" : ""}`}>
      {tabs.map((t) => (
        <button
          key={t.value}
          className={`tab-btn ${value === t.value ? "active" : ""}`}
          onClick={() => onChange(t.value)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({ value, label }) {
  return (
    <Card className="stat-tile">
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-label">{label}</div>
    </Card>
  );
}

export function ThemeToggle({ theme, onToggle, style }) {
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      style={style}
      type="button"
    >
      <span style={{ opacity: 0 }}>{theme === "dark" ? <Moon size={1} /> : <Sun size={1} />}</span>
    </button>
  );
}

// 3px rail used across the practice flow (pick -> spin -> prep -> record ->
// reflect), filled in the active category's colour.
export function ProgressRail({ pct, color }) {
  return (
    <div className="progress-rail">
      <div className="progress-rail-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
