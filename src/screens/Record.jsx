import { useEffect, useRef, useState } from "react";
import { Loader2, MicOff, Square } from "lucide-react";
import { Body, Button, Label } from "../components/UI";
import FlowHeader from "../components/FlowHeader";
import { useRecorder } from "../lib/recorder";
import { useSpeechTranscript } from "../lib/speech";
import { getSettings } from "../lib/storage";
import { transcribeWithWhisper } from "../lib/whisper";
import { reportError } from "../lib/errorMonitoring";

// Below this, we treat the recording as "nothing was actually said" rather
// than trust whatever transcript came back — Whisper (and occasionally the
// browser's own live transcription) can hallucinate plausible-looking text
// on near-silent audio, especially primed with the exercise prompt as
// context, which otherwise shows up as a real (if meaningless) Delivery
// score for a session with no real speech in it. Deliberately low (well
// under a second of actual voiced audio) so a quiet-but-real answer never
// trips it — this is only meant to catch true silence.
const MIN_VOICED_MS = 800;

export default function Record({ exercise, onDone, onCancel }) {
  const color = exercise.color;
  const speakSeconds = exercise.speakSeconds;
  const [secondsLeft, setSecondsLeft] = useState(speakSeconds);
  const [finishing, setFinishing] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const { state, error, start, stop, cancel } = useRecorder();
  const speech = useSpeechTranscript();
  // getSettings() is now a Supabase network call (async), so this can't be
  // resolved synchronously in useState the way it used to be against
  // localStorage. A ref (not state) is enough here — nothing in the JSX
  // below reads speechEnabled, so there's no need to re-render when it
  // resolves; the mount effect below awaits it before deciding whether to
  // start speech recognition at all.
  const speechEnabledRef = useRef(false);
  const intervalRef = useRef(null);
  const elapsedRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // Requesting the mic (getUserMedia) and starting SpeechRecognition at
    // the same time fires two concurrent microphone permission requests
    // for the same origin. Chrome can stall negotiating both at once,
    // which surfaces as the MediaRecorder's getUserMedia call hanging
    // indefinitely (the "Microphone request timed out" error) even when
    // the OS-level mic permission is already granted. Waiting for the
    // recorder's stream to be live before starting speech recognition
    // serializes the two requests instead of racing them.
    (async () => {
      const settings = await getSettings();
      if (cancelled) return;
      speechEnabledRef.current = settings.speechFeedbackEnabled && speech.supported;
      const ok = await start();
      if (!cancelled && ok && speechEnabledRef.current) speech.start();
    })();
    // React StrictMode (dev only) mounts this effect twice to catch exactly
    // this kind of bug: without a real cleanup, the second mount would open
    // a second mic stream + a second speech-recognition instance on top of
    // the first, and they'd fight over the microphone. Actually releasing
    // both here makes the effect safe to run twice.
    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
      cancel();
      if (speechEnabledRef.current) speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state === "recording" && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            finish();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const finish = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    const [recResult, speechResult] = await Promise.all([
      stop(),
      speechEnabledRef.current ? speech.stop() : Promise.resolve(null),
    ]);
    const duration = elapsedRef.current || speakSeconds;

    // Measured mic amplitude, not transcription, decides this — see
    // MIN_VOICED_MS above. Only acts on it when the monitor actually ran
    // (recResult.monitorActive), so a browser without Web Audio support
    // just skips this check entirely instead of flagging every recording.
    if (recResult?.monitorActive && (recResult.voicedMs || 0) < MIN_VOICED_MS) {
      finishedRef.current = false;
      setNoVoice(true);
      return;
    }

    // The browser's live SpeechRecognition transcript (if any) is the
    // fallback; a Whisper transcription — which preserves filler words the
    // cloud dictation service strips out — is preferred whenever it's
    // available. transcribeWithWhisper tries the local whisper-server first
    // (fully local, nothing sent anywhere) and falls back to the hosted
    // Groq-backed Edge Function when that's not running, which is what
    // makes this work for anyone using the deployed site — see whisper.js.
    let transcript = speechResult?.transcript || "";
    let segments = speechResult?.segments || [];
    let transcriptSource = transcript ? "browser" : "none";
    // Every transcribeWithWhisper failure now surfaces something on
    // Reflect.jsx instead of vanishing into a silent catch — a session
    // still saves fine either way (the recording + self-rating aren't
    // affected), but "why didn't I get pace/filler feedback" or "why does
    // this look less accurate than usual" are real questions worth a real,
    // specific answer instead of a quietly thinner transcript with no
    // explanation. Rate-limit hits get their own specific wording (see
    // check_rate_limit() in supabase/schema.sql); everything else (network
    // hiccup, Groq briefly down, local whisper-server not running) still
    // gets a message built from the actual error, so a genuinely new
    // failure mode shows up as real, reportable text instead of nothing.
    let transcriptionIssueNote = null;
    if (recResult?.blob) {
      setFinishing(true);
      try {
        // Word first (the single term most likely to get misheard if
        // Whisper has no idea it's coming), then the fuller prompt for
        // broader context — see the comment in whisper.js.
        const whisperContext = [exercise.word, exercise.prompt].filter(Boolean).join(". ");
        const whisperResult = await transcribeWithWhisper(recResult.blob, whisperContext);
        if (whisperResult.transcript) {
          transcript = whisperResult.transcript;
          // Whisper's segments carry real { start, end } timestamps (unlike
          // the browser's single finalize-point segments) — keep them, they
          // feed the words-per-minute-over-time chart in Reflect.jsx.
          segments = whisperResult.segments || [];
          // "whisper_local" (whisper-server on this machine) or
          // "whisper_hosted" (Groq via the transcribe Edge Function) — see
          // Progress.jsx/Reflect.jsx for how each is labeled.
          transcriptSource = whisperResult.source || "whisper_hosted";
        }
      } catch (e) {
        // Reported regardless of which branch below fires — including rate
        // limit hits, since knowing how often those actually trigger in
        // practice is exactly the signal needed to tell whether the caps in
        // supabase/schema.sql are sized right.
        reportError(e, "Record.transcribeWithWhisper");
        const usedFallback = Boolean(transcript); // browser live captions, already assigned above
        if (e?.code === "rate_limited" && e.scope === "day") {
          transcriptionIssueNote =
            "You've reached today's transcription limit for your account — it resets at midnight UTC, so come back tomorrow for full feedback. This recording and your self-rating are still saved.";
        } else if (e?.code === "rate_limited" && e.scope === "minute") {
          transcriptionIssueNote =
            "Transcription hit a brief per-account limit — this recording and your self-rating are still saved, just without Whisper's transcript.";
        } else {
          const reason = e?.message || "unknown error";
          transcriptionIssueNote = usedFallback
            ? `Whisper transcription wasn't available for this session (${reason}), so this uses your browser's live captions instead — usually less accurate, especially for filler words. Your recording and self-rating are still saved.`
            : `No transcript could be captured for this session (${reason}). Your recording and self-rating are still saved.`;
        }
      }
    }

    onDone({
      uri: recResult?.dataUrl || null,
      // Raw Blob, alongside the dataUrl above — Reflect.jsx uploads this to
      // Supabase Storage on save instead of persisting the base64 uri
      // (which would blow through the free database size budget fast).
      blob: recResult?.blob || null,
      durationSeconds: duration,
      transcript,
      transcriptSource,
      segments,
      transcriptionIssueNote,
      audioPauses: recResult?.pauses || [],
    });
  };

  const handleCancel = () => {
    clearInterval(intervalRef.current);
    cancel();
    if (speechEnabledRef.current) speech.stop();
    onCancel();
  };

  // Re-arms the same screen for another attempt rather than bouncing back
  // out to Pick/Roulette — the prompt and prep are already done, all that
  // failed was the recording itself.
  const retryRecording = async () => {
    setNoVoice(false);
    elapsedRef.current = 0;
    setSecondsLeft(speakSeconds);
    // clearInterval stops the timer but leaves intervalRef.current holding
    // the now-dead interval id — the countdown effect only arms a new one
    // when this ref is falsy, so without resetting it here the clock would
    // redraw at the full time but never actually tick down again.
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    const ok = await start();
    if (ok && speechEnabledRef.current) speech.start();
  };

  const progress = 1 - secondsLeft / speakSeconds;

  if (state === "error") {
    return (
      <div className="center-screen">
        <div>
          <Label>Microphone needed</Label>
          <div className="mic-error" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <MicOff size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error || "SpeakUp needs microphone access to record your practice sessions."}</span>
          </div>
        </div>
        <Button title="Back" variant="ghost" onClick={onCancel} />
      </div>
    );
  }

  if (noVoice) {
    return (
      <div className="center-screen">
        <div>
          <Label>No speech detected</Label>
          <div className="mic-error" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <MicOff size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              We didn't pick up any speech in that recording — check your microphone isn't muted
              and try again.
            </span>
          </div>
        </div>
        <Button title="Try again" onClick={retryRecording} style={{ background: color }} />
        <Button title="Back" variant="ghost" onClick={onCancel} style={{ marginTop: 10 }} />
      </div>
    );
  }

  if (finishing) {
    return (
      <div className="center-screen">
        <div className="timer-wrap">
          <Loader2 size={32} className="icon-spin" style={{ color }} />
          <Body className="dim" style={{ marginTop: 16 }}>
            Transcribing locally…
          </Body>
        </div>
      </div>
    );
  }

  const clockMinutes = Math.floor(secondsLeft / 60);
  const clockSeconds = secondsLeft % 60;
  const clock = `${clockMinutes}:${String(clockSeconds).padStart(2, "0")}`;

  return (
    <div className="center-screen">
      <div>
        <FlowHeader step="record" exercise={exercise} onClose={handleCancel} />
        {state === "recording" ? (
          <div className="rec-row" style={{ marginTop: 18 }}>
            <span className="rec-dot" /> Recording
          </div>
        ) : (
          <Label>Get ready</Label>
        )}
        <p className="prompt-serif" style={{ marginTop: 8 }}>
          {exercise.prompt}
        </p>
      </div>

      <div className="timer-wrap">
        <div className="record-clock">{clock}</div>

        {state === "recording" ? (
          <div className="waveform waveform-lg" style={{ marginTop: 22 }}>
            {[...Array(26)].map((_, i) => (
              <span
                key={i}
                className="waveform-bar"
                style={{ background: color, animationDelay: `${(i * 62) % 780}ms` }}
              />
            ))}
          </div>
        ) : (
          <Body className="dim" style={{ marginTop: 16 }}>
            Starting microphone…
          </Body>
        )}

        {state === "recording" && speech.interimTranscript ? (
          <Body className="dim" style={{ marginTop: 12, fontSize: 12, fontStyle: "italic", textAlign: "center", maxWidth: 320 }}>
            "{speech.interimTranscript.trim()}"
          </Body>
        ) : null}
      </div>

      <div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(progress, 1) * 100}%`, background: color }}
          />
        </div>
        <Button
          title="Stop & get feedback"
          icon={Square}
          onClick={finish}
          disabled={state !== "recording"}
          style={{ background: color, marginTop: 20 }}
        />
      </div>
    </div>
  );
}
