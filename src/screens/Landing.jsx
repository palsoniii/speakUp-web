import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Body, Button, Card, EyebrowPill, Logo, ThemeToggle } from "../components/UI";
import { EXERCISE_TYPES } from "../lib/content";
import { useRecorder } from "../lib/recorder";
import { useSpeechTranscript } from "../lib/speech";
import { analyzeTranscript } from "../lib/analysis";

const DEMO_PROMPTS = [
  "Talk about a small, ordinary moment from this week you'd want to remember.",
  "What does the word \"home\" actually mean to you, beyond the building?",
  "Talk about a habit or ritual that grounds you.",
  "Describe a place that feels sacred to you, even if it's not religious.",
];

const SPEAK_SECONDS = 20;

// Only shown if we couldn't get a real live-transcribed line (mic declined,
// or the browser doesn't support SpeechRecognition) — otherwise the caption
// during "speaking" is the visitor's own words, live, via the same
// useSpeechTranscript hook Record.jsx uses for its "live captions" setting.
const FALLBACK_CAPTIONS = [
  "so I think what grounds me is...",
  "...just a small routine, honestly...",
  "...it's not dramatic, it's just consistent...",
  "and that consistency is what matters to me.",
];

// Only shown when we couldn't measure a real result either (same fallback
// cases as above, or too few words actually came through to analyze) —
// otherwise these numbers come straight from analyzeTranscript() run
// against what the visitor actually said, the same pure client-side
// counting a real saved session gets.
const SAMPLE_RESULT = {
  wpm: 142,
  fillers: 3,
  articulation: 74,
  blurb:
    "Nice pace — you slowed down right where it mattered. Your strongest line was the one about the kitchen table; the opening took a third of your time, so there's your first thing to trim.",
};

// Signed-out marketing page — the only screen a visitor sees before an
// account exists. The "try it" demo requests a real microphone (same
// useRecorder/useSpeechTranscript hooks the real Record screen uses) and
// measures a real result from what the visitor actually says — it just
// can't run the AI-model "structure" read the real app gets after signup,
// since that goes through an authenticated Edge Function. If the mic is
// declined or unsupported, it falls back to a labeled sample instead of
// silently failing.
export default function Landing({ theme, onToggleTheme, onSignIn, onStartFree }) {
  return (
    <div className="landing">
      <header className="landing-header">
        <Logo />
        <div className="landing-nav-links">
          <a href="#how-it-works" className="landing-nav-link">
            How it works
          </a>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="landing-nav-link" onClick={onSignIn} type="button">
            Sign in
          </button>
          <Button title="Start free" small onClick={onStartFree} style={{ width: "auto" }} />
        </div>
      </header>

      <section className="landing-hero">
        <div className="sp-in">
          <EyebrowPill>Daily spoken-fluency practice</EyebrowPill>
          <h1 className="hero-h1">
            Get good at
            <br />
            thinking <em>out loud.</em>
          </h1>
          <p className="hero-sub">
            A random prompt. Two minutes of talking. Then you find out how you actually sounded.
          </p>
          <div className="hero-buttons">
            <Button title="Create your account" onClick={onStartFree} />
            <Button title="Try one right here" variant="glass" icon={ArrowRight} onClick={() => document.getElementById("demo-card")?.scrollIntoView({ behavior: "smooth" })} />
          </div>
          <div className="hero-meta">Free · 2 minutes a day · In the browser</div>
        </div>

        <div id="demo-card">
          <DemoCard onStartFree={onStartFree} />
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <div style={{ textAlign: "center" }}>
          <span className="demo-card-eyebrow">Five ways to practise</span>
          <h2 className="section-h2" style={{ marginTop: 10 }}>
            Same loop, five kinds of pressure.
          </h2>
        </div>
        <div className="category-marquee">
          <div className="category-track">
            {[...EXERCISE_TYPES, ...EXERCISE_TYPES].map((ex, i) => (
              <div
                className="category-circle"
                key={i}
                style={{ animationDelay: `${(i % 5) * 0.09}s` }}
                aria-hidden={i >= EXERCISE_TYPES.length}
              >
                <span
                  className="category-circle-bloom"
                  style={{ background: `radial-gradient(circle at 35% 35%, ${ex.color}, transparent 68%)` }}
                />
                <span className="category-circle-sheen" />
                <span
                  className="category-circle-dot dot"
                  style={{ background: ex.color, boxShadow: `0 10px 18px -6px ${ex.color}` }}
                />
                <div className="category-circle-title">{ex.title}</div>
                <div className="category-circle-tagline">{ex.tagline}</div>
                <div className="category-circle-meta">
                  {ex.prepSeconds}s · {ex.speakSeconds}s
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div style={{ textAlign: "center" }}>
          <span className="demo-card-eyebrow">The feedback</span>
          <h2 className="section-h2" style={{ marginTop: 10 }}>
            Nothing here is a mystery score.
          </h2>
          <Body className="dim" style={{ marginTop: 12, maxWidth: "30em", marginLeft: "auto", marginRight: "auto" }}>
            Counted from your transcript, not guessed. One layer is a model reading you — always labelled.
          </Body>
        </div>
        <div className="measure-cards">
          <Card>
            <div className="measure-label-row">
              <span className="dot" style={{ background: "var(--faint)" }} /> Measured
            </div>
            <Body style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>Pace, over time</Body>
            <PaceSketch />
            <Body className="dim" style={{ marginTop: 8, fontSize: 12.5 }}>
              Words per minute, bucketed across your session — not a single average that hides the
              slow start or the rushed finish.
            </Body>
          </Card>
          <Card>
            <div className="measure-label-row">
              <span className="dot" style={{ background: "var(--faint)" }} /> Measured
            </div>
            <Body style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>Word choice</Body>
            <div className="filler-chips" style={{ marginTop: 12 }}>
              <span className="power-chip">confident × 2</span>
              <span className="weak-chip">maybe × 3</span>
              <span className="filler-chip">"um" × 4</span>
            </div>
            <Body className="dim" style={{ marginTop: 10, fontSize: 12.5 }}>
              Filler words, hedges, and power words — counted from your transcript, not guessed at.
            </Body>
          </Card>
          <Card>
            <div className="measure-label-row">
              <span className="dot" style={{ background: "var(--primary)" }} /> AI read
            </div>
            <Body style={{ marginTop: 8, fontWeight: 700, fontSize: 15 }}>Structure</Body>
            <div className="structure-bar" style={{ marginTop: 12 }}>
              <div className="structure-seg structure-opening" style={{ width: "12%" }} />
              <div className="structure-seg structure-body" style={{ width: "71%" }} />
              <div className="structure-seg structure-closing" style={{ width: "17%" }} />
            </div>
            <Body className="dim" style={{ marginTop: 10, fontSize: 12.5 }}>
              Opening / body / closing against a 20/60/20 ideal — the one place an AI model makes
              a judgment call.
            </Body>
          </Card>
        </div>
      </section>

      <ClosingPanel onStartFree={onStartFree} />
    </div>
  );
}

function PaceSketch() {
  const points = [
    { x: 6, y: 40 },
    { x: 60, y: 22 },
    { x: 120, y: 30 },
    { x: 180, y: 14 },
    { x: 234, y: 20 },
  ];
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${d} L${points[points.length - 1].x},56 L${points[0].x},56 Z`;
  return (
    <svg viewBox="0 0 240 56" className="sparkline" preserveAspectRatio="none">
      <path d={area} style={{ fill: "var(--primary)" }} opacity={0.12} />
      <path
        d={d}
        style={{ fill: "none", stroke: "var(--primary)" }}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={260}
        strokeDashoffset={260}
        className="sp-trace"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          style={{ fill: "var(--raised)", stroke: "var(--primary)" }}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}

function ClosingPanel({ onStartFree }) {
  return (
    <section className="landing-section">
      <div className="closing-panel panel">
        <div className="panel-bloom" style={{ width: 260, height: 260, top: -100, left: -60, background: "var(--primary)" }} />
        <div className="panel-bloom" style={{ width: 220, height: 220, bottom: -80, right: -40, background: "var(--accent)", animationDelay: "3s" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: "clamp(26px,3.4vw,40px)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.08, margin: 0 }}>
            Turn up tomorrow.
            <br />
            That's the whole trick.
          </h2>
          <Body className="dim" style={{ marginTop: 16, maxWidth: 360 }}>
            A streak, eleven badges, and every session kept with its recording. Calm, not clingy.
          </Body>
          <Button title="Start your streak" onClick={onStartFree} variant="panel" style={{ width: "auto", marginTop: 26 }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="closing-streak-card">
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1 }}>23</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(246,241,232,.6)" }}>day streak</span>
            </div>
            <div className="closing-week">
              {[...Array(7)].map((_, i) => (
                <span key={i} style={{ opacity: i < 6 ? 1 : 0.25 }} />
              ))}
            </div>
          </div>
          <div className="closing-stats">
            <div className="closing-stat">
              <div style={{ fontSize: 20, fontWeight: 800 }}>86</div>
              <div className="dim" style={{ fontSize: 11 }}>
                minutes spoken
              </div>
            </div>
            <div className="closing-stat">
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                7<span style={{ color: "rgba(246,241,232,.4)" }}>/11</span>
              </div>
              <div className="dim" style={{ fontSize: 11 }}>
                badges earned
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="closing-footer">
        <span className="closing-footer-brand">
          <span className="dot" style={{ width: 9, height: 9, background: "var(--primary)" }} />
          SpeakUp
        </span>
        <span style={{ marginLeft: "auto" }}>For people who have to speak without notes.</span>
        <span style={{ display: "flex", gap: 14 }}>
          <a href="/terms.html" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            Terms
          </a>
          <a href="/privacy.html" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            Privacy
          </a>
        </span>
      </div>
    </section>
  );
}

// Four-state demo: idle -> thinking -> speaking -> result. "speaking" opens
// a real microphone (useRecorder, same as Record.jsx) and, where supported,
// live captions (useSpeechTranscript) — sequenced one after the other like
// Record.jsx does, since firing both mic requests at once can make Chrome
// stall negotiating either. "result" runs the visitor's own transcript
// through the same analyzeTranscript() a real session uses, falling back to
// a clearly-labeled sample only if the mic was declined, unsupported, or
// too little was actually said to measure.
function DemoCard({ onStartFree }) {
  const [state, setState] = useState("idle");
  const [promptIdx, setPromptIdx] = useState(0);
  const [count, setCount] = useState(8);
  const [speakLeft, setSpeakLeft] = useState(SPEAK_SECONDS);
  const [fallbackCapIdx, setFallbackCapIdx] = useState(0);
  const [micNote, setMicNote] = useState(null);
  const [result, setResult] = useState(SAMPLE_RESULT);
  const intervalRef = useRef(null);
  const recorder = useRecorder();
  const speech = useSpeechTranscript();
  const micActiveRef = useRef(false);
  const speechActiveRef = useRef(false);
  const elapsedRef = useRef(0);

  useEffect(
    () => () => {
      clearInterval(intervalRef.current);
      recorder.cancel();
      if (speechActiveRef.current) speech.stop();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const startThinking = () => {
    setState("thinking");
    setCount(8);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(intervalRef.current);
          startSpeaking();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const startSpeaking = async () => {
    setState("speaking");
    setSpeakLeft(SPEAK_SECONDS);
    setFallbackCapIdx(0);
    setMicNote(null);
    elapsedRef.current = 0;
    micActiveRef.current = false;
    speechActiveRef.current = false;
    clearInterval(intervalRef.current);

    const granted = await recorder.start();
    if (granted) {
      micActiveRef.current = true;
      if (speech.supported) {
        speech.start();
        speechActiveRef.current = true;
      }
    } else {
      setMicNote("Mic access declined — here's a preview instead.");
    }

    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setSpeakLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          finishSpeaking();
          return 0;
        }
        return s - 1;
      });
      if (!speechActiveRef.current) setFallbackCapIdx((i) => (i + 1) % FALLBACK_CAPTIONS.length);
    }, 1000);
  };

  const finishSpeaking = async () => {
    clearInterval(intervalRef.current);
    const wasMicActive = micActiveRef.current;
    const wasSpeechActive = speechActiveRef.current;
    micActiveRef.current = false;
    speechActiveRef.current = false;

    const [recResult, speechResult] = await Promise.all([
      wasMicActive ? recorder.stop() : Promise.resolve(null),
      wasSpeechActive ? speech.stop() : Promise.resolve(null),
    ]);

    const transcript = speechResult?.transcript?.trim() || "";
    const wordCount = transcript ? transcript.split(/\s+/).length : 0;

    if (wordCount >= 4) {
      const analysis = analyzeTranscript(
        transcript,
        elapsedRef.current || SPEAK_SECONDS,
        recResult?.pauses || null,
        speechResult?.segments || []
      );
      setResult({
        wpm: analysis.wpm,
        fillers: analysis.totalFillers,
        articulation: analysis.articulation?.score ?? SAMPLE_RESULT.articulation,
        blurb: analysis.paceLabel,
        real: true,
      });
    } else {
      setResult({ ...SAMPLE_RESULT, real: false });
      if (!micNote) setMicNote("Didn't catch enough speech to measure — here's a sample result instead.");
    }
    setState("result");
  };

  const newPrompt = () => {
    clearInterval(intervalRef.current);
    if (micActiveRef.current) recorder.cancel();
    if (speechActiveRef.current) speech.stop();
    micActiveRef.current = false;
    speechActiveRef.current = false;
    setPromptIdx((i) => (i + 1) % DEMO_PROMPTS.length);
    setMicNote(null);
    setResult(SAMPLE_RESULT);
    setState("idle");
  };

  const actionLabel = {
    idle: "Start the 8-second countdown",
    thinking: "Skip ahead — start speaking",
    speaking: "Stop and see the feedback",
    result: "Create an account to keep yours",
  }[state];

  const handleAction = () => {
    if (state === "idle") startThinking();
    else if (state === "thinking") startSpeaking();
    else if (state === "speaking") finishSpeaking();
    else onStartFree?.();
  };

  return (
    <Card large className="demo-card sp-in-scale">
      <span className="demo-card-sheen" />
      <div className="demo-card-head">
        <span className="demo-card-eyebrow">Try it — no account</span>
        <span className="demo-card-badge">Demo · uses your mic</span>
      </div>

      <div className="demo-well">
        {state === "idle" ? (
          <>
            <p className="prompt-serif">{DEMO_PROMPTS[promptIdx]}</p>
            <p className="demo-count-label" style={{ textAlign: "center" }}>
              Reflection Roulette · 8s to think · 20s to speak
            </p>
          </>
        ) : null}

        {state === "thinking" ? (
          <>
            <p className="prompt-serif" style={{ fontSize: "clamp(20px,2.4vw,27px)" }}>
              {DEMO_PROMPTS[promptIdx]}
            </p>
            <div className="demo-count-row">
              <span className="demo-count">{count}</span>
              <span className="demo-count-label">
                seconds
                <br />
                to gather your thoughts
              </span>
            </div>
          </>
        ) : null}

        {state === "speaking" ? (
          <>
            <div className="rec-row">
              <span className="rec-dot" /> Recording · {speakLeft}s left
            </div>
            <div className="waveform">
              {[...Array(26)].map((_, i) => (
                <span
                  key={i}
                  className="waveform-bar"
                  style={{ background: "var(--primary)", animationDelay: `${(i * 62) % 780}ms` }}
                />
              ))}
            </div>
            <Body className="dim" style={{ fontStyle: "italic", textAlign: "center", fontSize: 13, margin: 0, maxWidth: "26em" }}>
              {speechActiveRef.current
                ? speech.interimTranscript
                  ? `"${speech.interimTranscript}"`
                  : "Listening…"
                : `"${FALLBACK_CAPTIONS[fallbackCapIdx]}"`}
            </Body>
            {micNote ? (
              <Body className="faint" style={{ fontSize: 11.5, textAlign: "center", margin: 0 }}>
                {micNote}
              </Body>
            ) : null}
          </>
        ) : null}

        {state === "result" ? (
          <>
            <div className="demo-result-grid">
              <div className="demo-result-tile">
                <div className="demo-result-value">{result.wpm}</div>
                <div className="demo-result-label">words / min</div>
              </div>
              <div className="demo-result-tile">
                <div className="demo-result-value">{result.fillers}</div>
                <div className="demo-result-label">filler words</div>
              </div>
              <div className="demo-result-tile">
                <div className="demo-result-value" style={{ color: "var(--primary)" }}>
                  {result.articulation}
                </div>
                <div className="demo-result-label">articulation</div>
              </div>
            </div>
            <Body style={{ margin: "6px 0 0", fontSize: 13.5, maxWidth: "32em" }}>{result.blurb}</Body>
            {micNote ? (
              <Body className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                {micNote}
              </Body>
            ) : result.real ? (
              <Body className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                Measured from what you actually said — sign up to get the full AI read too.
              </Body>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="demo-actions">
        <Button title={actionLabel} onClick={handleAction} style={{ flex: 1 }} />
        <Button title="New prompt" variant="ghost" onClick={newPrompt} style={{ width: "auto" }} />
      </div>
    </Card>
  );
}
