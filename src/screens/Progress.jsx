import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Globe, Pause, Play } from "lucide-react";
import { Body, Button, Card, FeelingMarks, IconBadge, Label, Pill, Tabs, Title } from "../components/UI";
import { EXERCISE_TYPES, getExerciseType } from "../lib/content";
import { EXERCISE_ICONS } from "../lib/icons";
import { tokenizeFillers } from "../lib/analysis";
import { getSessions } from "../lib/storage";

const FEELING_WORDS = ["", "rough", "okay", "good", "great"];
const MIN_TREND_SESSIONS = 3;

export default function Progress({ refreshKey, onStartExercise }) {
  const [progressTab, setProgressTab] = useState("trends");
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getSessions().then((data) => {
      if (!cancelled) setSessions(data);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="screen">
      <Label>YOUR PROGRESS</Label>
      <Title>The long game</Title>

      <div style={{ marginTop: 16 }}>
        <Tabs
          tabs={[
            { value: "trends", label: "Trends" },
            { value: "history", label: "History" },
          ]}
          value={progressTab}
          onChange={setProgressTab}
        />
      </div>

      {/* Renders straight off `sessions` (starts as [], not gated behind a
          loading flag) so switching to this tab shows the real empty
          states below (Trends' "need three sessions" card, History's "no
          sessions yet" card) immediately instead of a blank gap under the
          tabs while getSessions() round-trips to Supabase — same fix as
          Settings.jsx, same underlying cause: this tab remounts fresh
          every time you navigate to it. */}
      {progressTab === "trends" ? (
        <Trends sessions={sessions} onStartExercise={onStartExercise} />
      ) : (
        <History sessions={sessions} onStartExercise={onStartExercise} />
      )}
    </div>
  );
}

// --- Trends -----------------------------------------------------------

function Trends({ sessions, onStartExercise }) {
  const withFeedback = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.feedback && s.feedback.wordCount > 0)
        .reverse(), // getSessions() is newest-first; charts read left-to-right chronologically
    [sessions]
  );

  if (withFeedback.length < MIN_TREND_SESSIONS) {
    return (
      <Card className="empty-state" large style={{ textAlign: "center" }}>
        <Body style={{ fontWeight: 700, fontSize: 17 }}>Trends need three sessions</Body>
        <Body className="dim" style={{ marginTop: 8, fontSize: 14, maxWidth: "32em", marginLeft: "auto", marginRight: "auto" }}>
          One session is a data point, not a trend. After your third, this fills with pace, filler rate
          and articulation over time — and we'll tell you which way each is moving.
        </Body>
        {onStartExercise ? (
          <Button
            title="Start session one"
            onClick={() => onStartExercise(null)}
            style={{ width: "auto", marginTop: 18 }}
          />
        ) : null}
      </Card>
    );
  }

  const articulation = withFeedback.map((s) => s.feedback.articulation?.score).filter((v) => v != null);
  const pace = withFeedback.map((s) => s.feedback.wpm).filter((v) => v != null);
  const fillerRate = withFeedback.map((s) => s.feedback.fillerRate).filter((v) => v != null);

  const categoryMinutes = EXERCISE_TYPES.map((ex) => {
    const total = sessions
      .filter((s) => s.typeId === ex.id)
      .reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    return { ...ex, minutes: Math.round(total / 60) };
  });
  const maxMinutes = Math.max(1, ...categoryMinutes.map((c) => c.minutes));

  return (
    <>
      <div className="trend-cards">
        <TrendCard label="Articulation" data={articulation} suffix="" color="var(--primary)" />
        <TrendCard label="Pace" data={pace} suffix=" wpm" color="var(--accent)" settled />
        <TrendCard label="Filler rate" data={fillerRate} suffix="/100w" color="var(--warnc)" invert />
      </div>

      <div style={{ marginTop: 32 }}>
        <Label>Where your minutes go</Label>
        <div className="category-bars">
          {categoryMinutes.map((c, i) => (
            <div className="category-bar-row" key={c.id}>
              <div className="category-bar-label">
                <span>
                  <span className="dot" style={{ background: c.color, display: "inline-block", marginRight: 7 }} />
                  {c.title}
                </span>
                <span className="dim">{c.minutes}m</span>
              </div>
              <div className="category-bar-track">
                <div
                  className="category-bar-fill"
                  style={{
                    width: `${Math.max(3, (c.minutes / maxMinutes) * 100)}%`,
                    background: c.color,
                    animationDelay: `${i * 0.06}s`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TrendCard({ label, data, suffix, color, invert, settled }) {
  if (data.length === 0) return null;
  const current = data[data.length - 1];
  const restAvg = data.length > 1 ? data.slice(0, -1).reduce((a, b) => a + b, 0) / (data.length - 1) : current;
  const delta = Math.round((current - restAvg) * 10) / 10;
  const isGood = invert ? delta <= 0 : delta >= 0;

  return (
    <Card>
      <div className="trend-card-head">
        <span className="feedback-metric-label" style={{ fontSize: 11 }}>
          {label.toUpperCase()}
        </span>
        {delta !== 0 ? (
          <span className={`trend-chip ${isGood ? "trend-good" : "trend-bad"}`}>
            {delta > 0 ? "▲" : "▼"} {delta > 0 ? "+" : ""}
            {delta}
            {suffix}
          </span>
        ) : settled ? (
          <span className="trend-chip">settled</span>
        ) : null}
      </div>
      <div className="trend-card-value" style={{ color }}>
        {Math.round(current)}
        <span style={{ fontSize: 15, fontWeight: 700 }}>{suffix}</span>
      </div>
      <Sparkline data={data} color={color} />
    </Card>
  );
}

function Sparkline({ data, color }) {
  const width = 240;
  const height = 56;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(max - min, 1);
  const points = data.map((v, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * width : width / 2,
    y: height - 6 - ((v - min) / span) * (height - 12),
  }));
  let d = points.length < 3 ? points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") : "";
  if (points.length >= 3) {
    d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
      d += ` Q${points[i].x},${points[i].y} ${mid.x},${mid.y}`;
    }
    d += ` L${points[points.length - 1].x},${points[points.length - 1].y}`;
  }
  const area = `${d} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" preserveAspectRatio="none">
      <path d={area} style={{ fill: color }} opacity={0.14} stroke="none" />
      <path d={d} style={{ fill: "none", stroke: color }} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- History ------------------------------------------------------------

function History({ sessions, onStartExercise }) {
  const [playingId, setPlayingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [audio, setAudio] = useState(null);

  useEffect(() => () => audio?.pause(), [audio]);

  const togglePlay = (item) => {
    if (!item.recordingUri) return;
    if (playingId === item.id) {
      audio?.pause();
      setPlayingId(null);
      return;
    }
    audio?.pause();
    const next = new Audio(item.recordingUri);
    next.onended = () => setPlayingId(null);
    setAudio(next);
    next.play();
    setPlayingId(item.id);
  };

  if (sessions.length === 0) {
    return (
      <Card className="empty-state" large>
        <Body style={{ fontWeight: 700, fontSize: 17 }}>No sessions yet</Body>
        <Body className="dim" style={{ marginTop: 8, fontSize: 14, maxWidth: "32em", marginLeft: "auto", marginRight: "auto" }}>
          Every session you finish is kept here with its recording, transcript and feedback — so
          you can hear the difference six weeks from now.
        </Body>
        {onStartExercise ? (
          <Button
            title="Record your first"
            onClick={() => onStartExercise(null)}
            style={{ width: "auto", marginTop: 18 }}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <div className="session-list">
      {sessions.map((item) => {
        const type = getExerciseType(item.typeId);
        const Icon = EXERCISE_ICONS[item.typeId];
        const mins = Math.floor((item.durationSeconds || 0) / 60);
        const secs = (item.durationSeconds || 0) % 60;
        const isExpanded = expandedId === item.id;
        return (
          <Card className="session-card" key={item.id}>
            <div className="session-top">
              {Icon ? <IconBadge icon={Icon} color={type?.color || "#6e5ef2"} size={28} /> : null}
              <span className="session-title">{item.title}</span>
              {item.feeling ? <FeelingMarks value={item.feeling} color={type?.color} /> : null}
            </div>
            <Body className="dim" style={{ marginTop: 6 }}>
              {item.prompt}
            </Body>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="dim"
                style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4 }}
              >
                <Globe size={12} /> via Wikipedia
              </a>
            ) : null}

            {item.feedback ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <Pill label={`${item.feedback.wpm} wpm`} />
                <Pill label={`${item.feedback.totalFillers} filler${item.feedback.totalFillers === 1 ? "" : "s"}`} />
                {item.feedback.pauses?.length ? (
                  <Pill label={`${item.feedback.pauses.length} pause${item.feedback.pauses.length === 1 ? "" : "s"}`} />
                ) : null}
                {item.feedback.articulation ? <Pill label={`${item.feedback.articulation.score}/100 articulation`} /> : null}
                {item.feeling ? <Pill label={`felt ${FEELING_WORDS[item.feeling]}`} /> : null}
                {item.transcriptSource === "whisper_local" ? <Pill label="local whisper" /> : null}
                {item.transcriptSource === "whisper_hosted" ? <Pill label="hosted whisper" /> : null}
              </div>
            ) : null}

            <div className="session-meta-row">
              <span>{item.date}</span>
              <span>·</span>
              <span>
                {mins}:{secs.toString().padStart(2, "0")}
              </span>
              {item.recordingUri ? (
                <button className="play-chip" onClick={() => togglePlay(item)}>
                  {playingId === item.id ? <Pause size={11} /> : <Play size={11} />}
                  {playingId === item.id ? "Playing" : "Play"}
                </button>
              ) : null}
            </div>

            {item.transcript ? (
              <button className="transcript-toggle" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                {isExpanded ? "Hide transcript" : "View transcript"}
                {isExpanded ? (
                  <ChevronUp size={14} style={{ display: "inline", verticalAlign: -2, marginLeft: 2 }} />
                ) : (
                  <ChevronDown size={14} style={{ display: "inline", verticalAlign: -2, marginLeft: 2 }} />
                )}
              </button>
            ) : null}
            {isExpanded && item.transcript ? (
              <div className="transcript-box">
                {tokenizeFillers(item.transcript).map((t, i) =>
                  t.isFiller ? (
                    <mark className="filler-mark" key={i}>
                      {t.text}
                    </mark>
                  ) : (
                    <span key={i}>{t.text}</span>
                  )
                )}
              </div>
            ) : null}

            {item.aiFeedback ? (
              <div className="note-box" style={{ fontStyle: "normal" }}>
                <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>AI read</strong>
                <div style={{ marginTop: 4 }}>
                  {typeof item.aiFeedback === "string" ? item.aiFeedback : item.aiFeedback.summary}
                </div>
                {typeof item.aiFeedback === "object" && item.aiFeedback.strongestLine ? (
                  <div style={{ marginTop: 6, fontSize: 12.5 }}>
                    <strong>Strongest line:</strong> "{item.aiFeedback.strongestLine}"
                  </div>
                ) : null}
              </div>
            ) : null}

            {item.note ? <div className="note-box">{item.note}</div> : null}
          </Card>
        );
      })}
    </div>
  );
}
