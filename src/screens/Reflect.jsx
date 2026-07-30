import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2, Pause, Play, Sparkles } from "lucide-react";
import { Body, Button, Card, FeelingMarks, Label, Tabs, Title } from "../components/UI";
import FlowHeader from "../components/FlowHeader";
import { analyzeTranscript, tokenizeFillers } from "../lib/analysis";
import { evaluateExercise, getExerciseFitTabLabel } from "../lib/exerciseEvaluation";
import { getAiFeedback, getExerciseFitAiFeedback } from "../lib/aiCoach";
import {
  addSession,
  computeFeedbackTrend,
  computeStats,
  didCompleteToday,
  getSessions,
  getSettings,
  newSessionId,
  uploadRecording,
} from "../lib/storage";

// The "assignment fit" tab (see exerciseEvaluation.js) is inserted right
// after Delivery only for exercise types that actually have a dedicated
// evaluator — everything else keeps the same four tabs it always had.
function buildTabs(exerciseFitLabel) {
  const tabs = [{ value: "delivery", label: "Delivery" }];
  if (exerciseFitLabel) tabs.push({ value: "assignment", label: exerciseFitLabel });
  tabs.push({ value: "words", label: "Words" }, { value: "structure", label: "Structure" }, { value: "personal", label: "Personal" });
  return tabs;
}

const FEELINGS = [
  { value: 1, label: "Rough" },
  { value: 2, label: "Okay" },
  { value: 3, label: "Good" },
  { value: 4, label: "Great" },
];

export default function Reflect({ exercise, recording, onSaved }) {
  const color = exercise.color;
  const [fbTab, setFbTab] = useState("delivery");
  const [feeling, setFeeling] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [aiState, setAiState] = useState("idle"); // idle | loading | done | error
  const [aiFeedback, setAiFeedback] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [aiFitState, setAiFitState] = useState("idle"); // idle | loading | done | error
  const [aiFitFeedback, setAiFitFeedback] = useState(null);
  const [aiFitError, setAiFitError] = useState(null);
  const [trend, setTrend] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const audioRef = useRef(null);
  const aiRequestedRef = useRef(false);
  const aiFitRequestedRef = useRef(false);

  const feedback = useMemo(
    () => analyzeTranscript(recording.transcript, recording.durationSeconds, recording.audioPauses, recording.segments),
    [recording.transcript, recording.durationSeconds, recording.audioPauses, recording.segments]
  );

  // Rule-based, exercise-specific evaluation layered on top of the generic
  // feedback above — see exerciseEvaluation.js for why this is a separate
  // module rather than another branch inside analysis.js.
  const exerciseFitLabel = useMemo(() => getExerciseFitTabLabel(exercise.id), [exercise.id]);
  const exerciseFit = useMemo(
    () =>
      feedback.hasTranscript && exerciseFitLabel
        ? evaluateExercise(exercise.id, {
            transcript: recording.transcript,
            wordCount: feedback.wordCount,
            avgSyllablesPerWord: feedback.syllables.avgPerWord,
            exercise,
          })
        : null,
    [feedback.hasTranscript, feedback.wordCount, feedback.syllables.avgPerWord, exerciseFitLabel, exercise, recording.transcript]
  );
  const tabs = useMemo(() => buildTabs(exerciseFitLabel), [exerciseFitLabel]);

  // Compare against past sessions (all of which are already saved — this
  // one hasn't been yet) so the numbers mean something instead of sitting
  // in isolation. getSessions() is a network call now (Supabase), so this
  // runs once in an effect rather than inline in a useMemo.
  useEffect(() => {
    let cancelled = false;
    getSessions().then((sessions) => {
      if (!cancelled) setTrend(computeFeedbackTrend(sessions, feedback));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transcriptTokens = useMemo(() => tokenizeFillers(recording.transcript), [recording.transcript]);

  const togglePlay = () => {
    if (!recording.uri) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(recording.uri);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const requestAiFeedback = async () => {
    setAiState("loading");
    setAiError(null);
    try {
      const { aiFeedbackModel } = await getSettings();
      const result = await getAiFeedback({
        exerciseTitle: exercise.title,
        promptText: exercise.prompt,
        transcript: recording.transcript,
        model: aiFeedbackModel,
      });
      setAiFeedback(result);
      setAiState("done");
    } catch (e) {
      setAiError(e?.message || "AI feedback failed.");
      setAiState("error");
    }
  };

  // AI coaching is a required part of the feedback now, not an opt-in
  // button — it kicks off automatically as soon as there's a transcript to
  // read. A local model can still be unavailable/slow, so this fires and
  // forgets rather than blocking the rest of the screen from rendering;
  // Save just waits for it to settle (see the disabled state below).
  useEffect(() => {
    if (aiRequestedRef.current) return;
    if (!feedback.hasTranscript) return;
    aiRequestedRef.current = true;
    requestAiFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback.hasTranscript]);

  // The exercise-fit judgment (see ollama.js's buildExerciseFitPrompt) is a
  // second, independent model call — a word-list scan can count that
  // "ephemeral" appeared twice, but only a model reading the sentence can
  // tell whether it was used with the right meaning. Runs alongside the
  // structure request above, same fire-and-forget pattern.
  const requestAiFitFeedback = async () => {
    setAiFitState("loading");
    setAiFitError(null);
    try {
      const { aiFeedbackModel } = await getSettings();
      const result = await getExerciseFitAiFeedback({
        typeId: exercise.id,
        exerciseTitle: exercise.title,
        promptText: exercise.prompt,
        transcript: recording.transcript,
        word: exercise.word,
        wordDefinition: exercise.definition,
        pair: exercise.pair,
        model: aiFeedbackModel,
      });
      setAiFitFeedback(result);
      setAiFitState("done");
    } catch (e) {
      setAiFitError(e?.message || "AI judgment failed.");
      setAiFitState("error");
    }
  };

  useEffect(() => {
    if (aiFitRequestedRef.current) return;
    if (!feedback.hasTranscript || !exerciseFitLabel) return;
    aiFitRequestedRef.current = true;
    requestAiFitFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback.hasTranscript, exerciseFitLabel]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      // Generated up front so the recording can be uploaded to Storage
      // under a known path before the session row referencing it exists —
      // see the comment on newSessionId in storage.js.
      const sessionId = newSessionId();
      const recordingUri = recording.blob ? await uploadRecording(recording.blob, sessionId) : null;

      await addSession({
        id: sessionId,
        typeId: exercise.id,
        title: exercise.title,
        prompt: exercise.prompt,
        word: exercise.word || null,
        durationSeconds: recording.durationSeconds || 0,
        feeling,
        note: note.trim(),
        recordingUri,
        sourceUrl: exercise.url || null,
        transcript: recording.transcript || "",
        transcriptSource: recording.transcriptSource || "none",
        aiFeedback: aiState === "done" ? aiFeedback : null,
        feedback:
          feedback.hasTranscript || feedback.pauses.length > 0
            ? {
                wordCount: feedback.wordCount,
                wpm: feedback.wpm,
                pace: feedback.pace,
                totalFillers: feedback.totalFillers,
                fillerRate: feedback.fillerRate,
                fillerCounts: feedback.fillerCounts,
                pauses: feedback.pauses,
                powerWords: feedback.powerWords,
                weakWords: feedback.weakWords,
                syllables: feedback.syllables,
                wpmOverTime: feedback.wpmOverTime,
                articulation: feedback.articulation,
                exerciseFit: exerciseFit
                  ? {
                      label: exerciseFit.label,
                      score: exerciseFit.score,
                      breakdown: exerciseFit.breakdown,
                      ai: aiFitState === "done" ? aiFitFeedback : null,
                    }
                  : null,
              }
            : null,
      });

      // Refetch so the streak/session-count reflect the session that was
      // just saved — computeStats needs the full list, not just this one.
      const updatedSessions = await getSessions();
      const updatedStats = computeStats(updatedSessions);
      onSaved({
        streak: updatedStats.streak,
        isFirstSession: updatedStats.totalSessions === 1,
        note:
          trend?.ready && trend.fillerRateDelta < 0
            ? "Your filler rate is down from your recent average — keep it going."
            : didCompleteToday(updatedSessions)
            ? "Same time tomorrow keeps it going."
            : null,
      });
    } catch (e) {
      setSaveError(e?.message || "Couldn't save this session — check your connection and try again.");
      setSaving(false);
    }
  };

  const minutes = Math.floor((recording.durationSeconds || 0) / 60);
  const seconds = (recording.durationSeconds || 0) % 60;
  const aiPending = feedback.hasTranscript && (aiState === "idle" || aiState === "loading");
  const aiFitPending =
    feedback.hasTranscript && Boolean(exerciseFitLabel) && (aiFitState === "idle" || aiFitState === "loading");

  const noTranscriptNote =
    "No transcript captured for this session — either speech feedback is off in Settings, your browser doesn't support live transcription, or nothing was picked up. Your recording and self-rating are unaffected.";

  return (
    <div className="center-screen">
      <div style={{ flex: 1, overflowY: "auto" }}>
        <FlowHeader step="reflect" exercise={exercise} />
        <Label style={{ marginTop: 18, color: "var(--accent)" }}>Session complete</Label>
        <Title style={{ fontSize: 26, marginTop: 4 }}>Here's how that went.</Title>
        <Body className="dim" style={{ marginTop: 4 }}>
          {exercise.title} · spoke for {minutes}:{seconds.toString().padStart(2, "0")} · saved with
          your recording
          {recording.transcriptSource === "whisper_local"
            ? " · local Whisper"
            : recording.transcriptSource === "whisper_hosted"
            ? " · hosted Whisper"
            : recording.transcriptSource === "browser"
            ? " · browser transcript"
            : ""}
        </Body>

        <button className="play-button" style={{ width: "auto" }} onClick={togglePlay}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {isPlaying ? <Pause size={11} fill="#fff" /> : <Play size={11} fill="#fff" />}
          </span>
          <span>{isPlaying ? "Playing…" : "Listen to your recording"}</span>
        </button>

        <div className="reflect-tabs">
          <Tabs tabs={tabs} value={fbTab} onChange={setFbTab} block />
        </div>

        <div className="reflect-panel sp-rise" key={fbTab}>
          {fbTab === "delivery" ? (
            feedback.hasTranscript ? (
              <>
                {feedback.articulation ? (
                  <Card>
                    <ArticulationScore articulation={feedback.articulation} color={color} />
                  </Card>
                ) : null}

                <Card style={{ marginTop: 12 }}>
                  <div className="feedback-metrics">
                    <div className="feedback-metric">
                      <div className="feedback-metric-value">{feedback.wpm}</div>
                      <div className="feedback-metric-label">words / min</div>
                    </div>
                    <div className="feedback-metric">
                      <div className="feedback-metric-value">{feedback.totalFillers}</div>
                      <div className="feedback-metric-label">
                        filler word{feedback.totalFillers === 1 ? "" : "s"}
                        {feedback.wordCount > 0 ? ` · ${feedback.fillerRate}/100 words` : ""}
                      </div>
                    </div>
                    <div className="feedback-metric">
                      <div className="feedback-metric-value">{feedback.pauses.length}</div>
                      <div className="feedback-metric-label">long pause{feedback.pauses.length === 1 ? "" : "s"}</div>
                    </div>
                  </div>

                  <Body className="dim" style={{ marginTop: 12, fontSize: 13 }}>
                    {feedback.paceLabel}
                  </Body>

                  {trend?.ready ? (
                    <div className="trend-row">
                      <TrendChip label="pace" delta={trend.wpmDelta} unit=" wpm" goodDirection="neutral" />
                      <TrendChip label="fillers" delta={trend.fillerRateDelta} unit="/100w" goodDirection="down" />
                      <span className="trend-note">vs. your last {trend.sampleSize} sessions</span>
                    </div>
                  ) : trend && !trend.ready ? (
                    <Body className="dim" style={{ marginTop: 8, fontSize: 12 }}>
                      Trend appears after {trend.needed - trend.sampleSize} more session
                      {trend.needed - trend.sampleSize === 1 ? "" : "s"} with a transcript.
                    </Body>
                  ) : null}

                  {feedback.pauses.length > 0 ? (
                    <div className="filler-chips">
                      {feedback.pauses.map((p, i) => (
                        <span className="pause-chip" key={i} title={`~${(p.pauseMs / 1000).toFixed(1)}s of silence at ${p.atLabel}`}>
                          ~{(p.pauseMs / 1000).toFixed(1)}s pause at {p.atLabel}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {feedback.wpmOverTime.length > 0 ? (
                    <div style={{ marginTop: 18 }}>
                      <div className="feedback-metric-label" style={{ fontSize: 11 }}>
                        WORDS PER MINUTE OVER TIME
                      </div>
                      <WpmChart data={feedback.wpmOverTime} color={color} />
                    </div>
                  ) : null}
                </Card>
              </>
            ) : feedback.hasPauseData ? (
              <Card>
                <Body className="dim" style={{ fontSize: 13 }}>
                  No transcript for this session — either speech feedback is off in Settings, your
                  browser doesn't support live transcription, or nothing was picked up. Pause
                  detection runs off the raw audio though, so that's still here.
                </Body>
                <div className="feedback-metrics" style={{ gridTemplateColumns: "1fr" }}>
                  <div className="feedback-metric">
                    <div className="feedback-metric-value">{feedback.pauses.length}</div>
                    <div className="feedback-metric-label">long pause{feedback.pauses.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                {feedback.pauses.length > 0 ? (
                  <div className="filler-chips">
                    {feedback.pauses.map((p, i) => (
                      <span className="pause-chip" key={i} title={`~${(p.pauseMs / 1000).toFixed(1)}s of silence at ${p.atLabel}`}>
                        ~{(p.pauseMs / 1000).toFixed(1)}s pause at {p.atLabel}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card>
                <Body className="dim" style={{ fontSize: 13 }}>
                  {noTranscriptNote}
                </Body>
              </Card>
            )
          ) : null}

          {fbTab === "assignment" ? (
            feedback.hasTranscript ? (
              exerciseFit ? (
                <Card>
                  <ExerciseFitPanel
                    fit={exerciseFit}
                    aiState={aiFitState}
                    aiFeedback={aiFitFeedback}
                    aiError={aiFitError}
                    onRetryAi={requestAiFitFeedback}
                    color={color}
                  />
                </Card>
              ) : null
            ) : (
              <Card>
                <Body className="dim" style={{ fontSize: 13 }}>
                  {noTranscriptNote}
                </Body>
              </Card>
            )
          ) : null}

          {fbTab === "words" ? (
            feedback.hasTranscript ? (
              <Card>
                {/* Power/weak words always render, even with zero hits — a
                    silent gap here used to be indistinguishable from "not
                    implemented"; an explicit empty state makes it clear the
                    detector ran and just didn't find that category this time. */}
                <div className="feedback-metric-label" style={{ fontSize: 11 }}>
                  WHAT STRENGTHENED IT
                </div>
                {feedback.powerWords.length > 0 ? (
                  <div className="filler-chips">
                    {feedback.powerWords.map((w) => (
                      <span className="power-chip" key={w.word}>
                        {w.word} × {w.count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <Body className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                    None detected this time — decisive, concrete words like "achieve", "confident", or "impact" would count.
                  </Body>
                )}

                <div className="feedback-metric-label" style={{ fontSize: 11, marginTop: 14 }}>
                  WHAT SOFTENED IT
                </div>
                {feedback.weakWords.length > 0 || feedback.fillerCounts.length > 0 ? (
                  <div className="filler-chips">
                    {feedback.weakWords.map((w) => (
                      <span className="weak-chip" key={w.word}>
                        {w.word} × {w.count}
                      </span>
                    ))}
                    {feedback.fillerCounts.map((f) => (
                      <span className="filler-chip" key={f.phrase}>
                        "{f.phrase}" × {f.count}
                      </span>
                    ))}
                  </div>
                ) : (
                  <Body className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                    None detected — no hedges or filler words this time.
                  </Body>
                )}

                {feedback.syllables.upgradeSuggestions.length > 0 ? (
                  <>
                    <div className="feedback-metric-label" style={{ fontSize: 11, marginTop: 14 }}>
                      TRY INSTEAD
                    </div>
                    <div className="upgrade-list">
                      {feedback.syllables.upgradeSuggestions.map((u) => (
                        <div className="upgrade-row" key={u.word}>
                          <span className="upgrade-word">
                            "{u.word}" × {u.count}
                          </span>
                          <span className="upgrade-arrow">→</span>
                          <span className="upgrade-suggestions">{u.suggestions.join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                <Body className="dim" style={{ marginTop: 14, fontSize: 11.5 }}>
                  Averaging {feedback.syllables.avgPerWord} syllables per word.
                </Body>

                <button className="transcript-toggle" onClick={() => setShowTranscript((s) => !s)}>
                  {showTranscript ? "Hide transcript" : "View transcript"}
                  {showTranscript ? (
                    <ChevronUp size={14} style={{ display: "inline", verticalAlign: -2, marginLeft: 2 }} />
                  ) : (
                    <ChevronDown size={14} style={{ display: "inline", verticalAlign: -2, marginLeft: 2 }} />
                  )}
                </button>
                {showTranscript ? (
                  <div className="transcript-box">
                    {transcriptTokens.map((t, i) =>
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
              </Card>
            ) : (
              <Card>
                <Body className="dim" style={{ fontSize: 13 }}>
                  {noTranscriptNote}
                </Body>
              </Card>
            )
          ) : null}

          {fbTab === "structure" ? (
            feedback.hasTranscript ? (
              <Card>
                {aiState === "idle" || aiState === "loading" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Loader2 size={16} className="icon-spin" style={{ color }} />
                    <Body className="dim" style={{ fontSize: 13 }}>
                      Reading your transcript for structure, clarity, and word choice…
                    </Body>
                  </div>
                ) : aiState === "done" && aiFeedback ? (
                  <>
                    <Body className="ai-feedback-text">{aiFeedback.summary}</Body>

                    {aiFeedback.structure ? (
                      <div style={{ marginTop: 18 }}>
                        <div className="structure-label-row">
                          <span className="feedback-metric-label" style={{ fontSize: 11 }}>
                            STRUCTURE
                          </span>
                          <span className="feedback-metric-label" style={{ fontSize: 11 }}>
                            ideal {aiFeedback.structure.idealOpeningPct}/{aiFeedback.structure.idealBodyPct}/
                            {aiFeedback.structure.idealClosingPct}
                          </span>
                        </div>
                        <div className="structure-bar">
                          <div
                            className="structure-seg structure-opening"
                            style={{ width: `${aiFeedback.structure.openingPct}%` }}
                            title={`Opening ${aiFeedback.structure.openingPct}%`}
                          />
                          <div
                            className="structure-seg structure-body"
                            style={{ width: `${aiFeedback.structure.bodyPct}%`, animationDelay: "0.1s" }}
                            title={`Body ${aiFeedback.structure.bodyPct}%`}
                          />
                          <div
                            className="structure-seg structure-closing"
                            style={{ width: `${aiFeedback.structure.closingPct}%`, animationDelay: "0.2s" }}
                            title={`Closing ${aiFeedback.structure.closingPct}%`}
                          />
                        </div>
                        <div className="structure-legend">
                          <span>
                            <i className="dot-opening" /> Opening {aiFeedback.structure.openingPct}%
                          </span>
                          <span>
                            <i className="dot-body" /> Body {aiFeedback.structure.bodyPct}%
                          </span>
                          <span>
                            <i className="dot-closing" /> Closing {aiFeedback.structure.closingPct}%
                          </span>
                        </div>
                        {aiFeedback.structure.note ? (
                          <Body className="dim" style={{ marginTop: 8, fontSize: 12.5 }}>
                            {aiFeedback.structure.note}
                          </Body>
                        ) : null}
                      </div>
                    ) : null}

                    {aiFeedback.strongestLine || aiFeedback.tighten ? (
                      <div className="line-callouts">
                        {aiFeedback.strongestLine ? (
                          <div className="line-callout line-callout-strong">
                            <span className="line-callout-label">Strongest line</span>
                            <span className="line-callout-text">"{aiFeedback.strongestLine}"</span>
                          </div>
                        ) : null}
                        {aiFeedback.tighten ? (
                          <div className="line-callout line-callout-tighten">
                            <span className="line-callout-label">Tighten this</span>
                            <span className="line-callout-text">"{aiFeedback.tighten.line}"</span>
                            {aiFeedback.tighten.suggestion ? (
                              <span className="line-callout-suggestion">{aiFeedback.tighten.suggestion}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <Body className="faint" style={{ marginTop: 16, fontSize: 11.5 }}>
                      Structure and the two line calls are a model reading your transcript.
                      Everything on the other tabs is counted, not judged.
                    </Body>
                  </>
                ) : (
                  <>
                    <Body className="ai-feedback-error">{aiError}</Body>
                    <Button title="Try again" icon={Sparkles} variant="secondary" onClick={requestAiFeedback} style={{ marginTop: 12 }} />
                  </>
                )}
              </Card>
            ) : (
              <Card>
                <Body className="dim" style={{ fontSize: 13 }}>
                  {noTranscriptNote}
                </Body>
              </Card>
            )
          ) : null}

          {fbTab === "personal" ? (
            <>
              <Card>
                <Label>How did that feel?</Label>
                <div className="feelings-row">
                  {FEELINGS.map((f) => (
                    <button
                      key={f.value}
                      className={`feeling-button ${feeling === f.value ? "selected" : ""}`}
                      style={feeling === f.value ? { borderColor: color, background: color + "22", color } : undefined}
                      onClick={() => setFeeling(f.value)}
                    >
                      <FeelingMarks value={f.value} color={feeling === f.value ? color : undefined} />
                      <span className="feeling-label">{f.label}</span>
                    </button>
                  ))}
                </div>

                <Label style={{ marginTop: 22 }}>Quick note (optional)</Label>
                <textarea
                  className="note-input"
                  placeholder="What would you say differently next time?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Card>

              {trend?.ready ? (
                <Card style={{ marginTop: 12 }}>
                  <div className="feedback-metric-label" style={{ fontSize: 11 }}>
                    COMPARED TO YOUR LAST {trend.sampleSize} SESSIONS
                  </div>
                  <div className="trend-row" style={{ marginTop: 4 }}>
                    <TrendChip label="pace" delta={trend.wpmDelta} unit=" wpm" goodDirection="neutral" />
                    <TrendChip label="fillers" delta={trend.fillerRateDelta} unit="/100w" goodDirection="down" />
                  </div>
                </Card>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {saveError ? (
        <Body className="ai-feedback-error" style={{ marginTop: 12 }}>
          {saveError}
        </Body>
      ) : null}

      <Button
        title={saving ? "Saving…" : aiPending || aiFitPending ? "Waiting on AI coaching…" : "Save & finish"}
        icon={Check}
        onClick={save}
        disabled={saving || aiPending || aiFitPending}
        style={{ background: color, marginTop: saveError ? 10 : 20 }}
      />
    </div>
  );
}

// goodDirection: "down" means a lower value than your average is the win
// (fillers), "neutral" just reports the delta without a value judgment
// (pace has a good *band*, not a good *direction* — going up isn't
// automatically better or worse).
function TrendChip({ label, delta, unit, goodDirection }) {
  if (delta === 0) {
    return <span className="trend-chip">{label} steady</span>;
  }
  const isUp = delta > 0;
  const isGood = goodDirection === "down" ? !isUp : goodDirection === "up" ? isUp : null;
  const cls = isGood === null ? "" : isGood ? "trend-good" : "trend-bad";
  return (
    <span className={`trend-chip ${cls}`}>
      {label} {isUp ? "▲" : "▼"} {isUp ? "+" : ""}
      {delta}
      {unit}
    </span>
  );
}

// Headline 0-100 number plus the transparent breakdown that produced it
// (see computeArticulationScore in analysis.js) — no bare score without the
// receipts behind it.
function ArticulationScore({ articulation, color }) {
  const { score, breakdown } = articulation;
  return (
    <div>
      <div className="articulation-score-row">
        <div className="articulation-score-value" style={{ color }}>
          {score}
        </div>
        <div className="articulation-score-label">
          <div>Articulation score</div>
          <div className="dim" style={{ fontSize: 11 }}>out of 100 · pace, fillers, pauses, vocabulary</div>
        </div>
      </div>
      <div className="articulation-bar-track">
        <div className="articulation-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="articulation-breakdown">
        {breakdown.map((b) => (
          <div key={b.label} className="articulation-breakdown-row">
            <span>{b.label}</span>
            <span className="dim">
              {b.points}/{b.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// The headline here is the model's read (see getExerciseFitAiFeedback in
// aiCoach.js) — it's the one that can actually tell whether a word was used
// with its real meaning, or whether an explanation is simple *and*
// substantively correct, not just a word-list scan. The deterministic
// counts from exerciseEvaluation.js (word/phrase hits) still render below
// as supporting evidence — cheap, offline, and recomputable by hand — but
// they no longer carry their own headline score, so there's one verdict per
// tab, not two competing numbers.
function ExerciseFitPanel({ fit, aiState, aiFeedback, aiError, onRetryAi, color }) {
  return (
    <div>
      <Body className="dim" style={{ fontSize: 12.5 }}>
        {fit.intro}
      </Body>

      <div style={{ marginTop: 16 }}>
        {aiState === "idle" || aiState === "loading" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={16} className="icon-spin" style={{ color }} />
            <Body className="dim" style={{ fontSize: 13 }}>
              Reading your transcript to judge {fit.label.toLowerCase()}…
            </Body>
          </div>
        ) : aiState === "done" && aiFeedback ? (
          <>
            {aiFeedback.score != null ? (
              <>
                <div className="articulation-score-row">
                  <div className="articulation-score-value" style={{ color }}>
                    {aiFeedback.score}
                  </div>
                  <div className="articulation-score-label">
                    <div>{aiFeedback.verdict || fit.heading}</div>
                    <div className="dim" style={{ fontSize: 11 }}>
                      AI judgment · out of 100
                    </div>
                  </div>
                </div>
                <div className="articulation-bar-track">
                  <div className="articulation-bar-fill" style={{ width: `${aiFeedback.score}%`, background: color }} />
                </div>
              </>
            ) : null}

            <Body className="ai-feedback-text" style={{ marginTop: aiFeedback.score != null ? 14 : 0 }}>
              {aiFeedback.summary}
            </Body>

            {aiFeedback.evidenceQuote ? (
              <div className="line-callouts">
                <div className="line-callout line-callout-strong">
                  <span className="line-callout-label">From your transcript</span>
                  <span className="line-callout-text">"{aiFeedback.evidenceQuote}"</span>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <Body className="ai-feedback-error">{aiError}</Body>
            <Button title="Try again" icon={Sparkles} variant="secondary" onClick={onRetryAi} style={{ marginTop: 12 }} />
          </>
        )}
      </div>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <div className="feedback-metric-label" style={{ fontSize: 11 }}>
          ALSO COUNTED AUTOMATICALLY
        </div>

        {fit.metrics?.length ? (
          <div className="feedback-metrics" style={{ marginTop: 10 }}>
            {fit.metrics.map((m) => (
              <div className="feedback-metric" key={m.label}>
                <div className="feedback-metric-value">{m.value}</div>
                <div className="feedback-metric-label">{m.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {fit.breakdown ? (
          <div className="articulation-breakdown" style={{ marginTop: fit.metrics?.length ? 10 : 6 }}>
            {fit.breakdown.map((b) => (
              <div key={b.label} className="articulation-breakdown-row">
                <span>{b.label}</span>
                <span className="dim">
                  {b.points}/{b.max}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {fit.goodChipsLabel ? (
          <>
            <div className="feedback-metric-label" style={{ fontSize: 11, marginTop: 14 }}>
              {fit.goodChipsLabel.toUpperCase()}
            </div>
            {fit.goodChips.length > 0 ? (
              <div className="filler-chips">
                {fit.goodChips.map((w) => (
                  <span className="power-chip" key={w.word}>
                    {w.word} × {w.count}
                  </span>
                ))}
              </div>
            ) : (
              <Body className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                {fit.goodEmptyNote}
              </Body>
            )}
          </>
        ) : null}

        {fit.badChipsLabel ? (
          <>
            <div className="feedback-metric-label" style={{ fontSize: 11, marginTop: 14 }}>
              {fit.badChipsLabel.toUpperCase()}
            </div>
            {fit.badChips.length > 0 ? (
              <div className="filler-chips">
                {fit.badChips.map((w) => (
                  <span className="weak-chip" key={w.word}>
                    {w.word} × {w.count}
                  </span>
                ))}
              </div>
            ) : (
              <Body className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                {fit.badEmptyNote}
              </Body>
            )}
          </>
        ) : null}

        {fit.note ? (
          <Body className="dim" style={{ marginTop: 14, fontSize: 12.5 }}>
            {fit.note}
          </Body>
        ) : null}
      </div>
    </div>
  );
}

// Smooth curve through a set of points using quadratic Bezier segments
// anchored at the midpoint between each consecutive pair — a small,
// dependency-free approximation of a spline. The curve passes through
// every real point (no point gets rounded away), it just doesn't travel
// between them in a sharp straight line.
function smoothPath(points) {
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  }
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    d += ` Q${curr.x},${curr.y} ${midX},${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x},${last.y}`;
  return d;
}

// Hand-rolled inline SVG line chart — no charting dependency, consistent
// with the rest of this app's zero-extra-deps approach. viewBox-scaled so
// it stretches to the card width via CSS without any JS measuring.
function WpmChart({ data, color }) {
  const width = 300;
  const height = 92;
  const topPad = 14;
  const bottomPad = 16;
  const sidePad = 6;
  const plotHeight = height - topPad - bottomPad;
  const plotWidth = width - sidePad * 2;

  // Auto-zoom the y-axis to the actual spread of this session's pace
  // instead of always anchoring the bottom at 0 — anchoring at 0 made any
  // dip (a bucket that happened to catch a pause) plunge almost to the
  // floor of the whole chart, visually exaggerating it into looking like a
  // near-total drop-off even when the real pace never got that low. A
  // floor of "min minus some padding" keeps the line's shape proportional
  // to how much the pace actually varied. The printed number at each point
  // is still the real value either way, so nothing here is hidden — only
  // how much vertical room a given swing takes up on the card.
  const values = data.map((d) => d.wpm);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = Math.max(rawMax - rawMin, 15);
  const pad = range * 0.3;
  const scaleMin = Math.max(0, rawMin - pad);
  const scaleMax = rawMax + pad;
  const span = Math.max(scaleMax - scaleMin, 1);

  const points = data.map((d, i) => ({
    x: data.length > 1 ? sidePad + (i / (data.length - 1)) * plotWidth : width / 2,
    y: topPad + (1 - (d.wpm - scaleMin) / span) * plotHeight,
    wpm: d.wpm,
    label: d.label,
  }));

  const linePath = smoothPath(points);
  const baselineY = height - bottomPad;
  const areaPath = `${linePath} L${points[points.length - 1].x},${baselineY} L${points[0].x},${baselineY} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="wpm-chart" preserveAspectRatio="none">
      <path d={areaPath} fill={color} opacity={0.12} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} style={{ fill: "var(--card-solid)" }} stroke={color} strokeWidth={2} />
          <text x={p.x} y={Math.max(9, p.y - 7)} textAnchor="middle" className="wpm-chart-value">
            {p.wpm}
          </text>
          <text x={p.x} y={height - 3} textAnchor="middle" className="wpm-chart-label">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
