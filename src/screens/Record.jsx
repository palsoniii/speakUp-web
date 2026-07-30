import { useEffect, useRef, useState } from "react";
import { Loader2, MicOff, Square } from "lucide-react";
import { Body, Button, Label } from "../components/UI";
import FlowHeader from "../components/FlowHeader";
import { useRecorder } from "../lib/recorder";
import { useSpeechTranscript } from "../lib/speech";
import { getSettings } from "../lib/storage";
import { transcribeWithWhisper } from "../lib/whisper";

export default function Record({ exercise, onDone, onCancel }) {
  const color = exercise.color;
  const speakSeconds = exercise.speakSeconds;
  const [secondsLeft, setSecondsLeft] = useState(speakSeconds);
  const [finishing, setFinishing] = useState(false);
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
      } catch {
        // Neither local nor hosted transcription available — keep whatever the browser captured, if anything.
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
      audioPauses: recResult?.pauses || [],
    });
  };

  const handleCancel = () => {
    clearInterval(intervalRef.current);
    cancel();
    if (speechEnabledRef.current) speech.stop();
    onCancel();
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
