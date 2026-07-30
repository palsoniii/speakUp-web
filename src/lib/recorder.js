import { useCallback, useRef, useState } from "react";

// Real silences below this RMS amplitude count as "quiet". It's a fixed
// heuristic (mic gain and background noise vary by device), not a
// calibrated-per-user threshold — but it's still a measurement of the
// actual audio, which is more trustworthy than estimating pauses from
// transcript timing (the old approach).
const SILENCE_RMS_THRESHOLD = 0.015;
const MIN_PAUSE_MS = 1500;
const SAMPLE_INTERVAL_MS = 100;

// Wraps the browser MediaRecorder API. Produces a base64 data URL on stop so
// the clip can be saved straight into localStorage alongside the session.
// Also runs a lightweight Web Audio silence detector alongside the
// recording to find real pauses — independent of speech recognition, so it
// still works even if live transcription is off or unsupported.
export function useRecorder() {
  const [state, setState] = useState("idle"); // idle | starting | recording | stopping | error
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const monitorIntervalRef = useRef(null);
  const sampleBufferRef = useRef(null);
  const pausesRef = useRef([]);
  const silenceStartMsRef = useRef(null);

  const elapsedMs = () => {
    const ctx = audioContextRef.current;
    return ctx ? ctx.currentTime * 1000 : 0;
  };

  const startSilenceMonitor = (stream) => {
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return; // no Web Audio support — pause detection just won't run
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      // Deliberately not connected to audioContext.destination — this is
      // silent monitoring, not playback.
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sampleBufferRef.current = new Float32Array(analyser.fftSize);
      pausesRef.current = [];
      silenceStartMsRef.current = null;

      monitorIntervalRef.current = setInterval(() => {
        const buf = sampleBufferRef.current;
        analyser.getFloatTimeDomainData(buf);
        let sumSquares = 0;
        for (let i = 0; i < buf.length; i++) sumSquares += buf[i] * buf[i];
        const rms = Math.sqrt(sumSquares / buf.length);
        const now = elapsedMs();

        if (rms < SILENCE_RMS_THRESHOLD) {
          if (silenceStartMsRef.current === null) silenceStartMsRef.current = now;
        } else if (silenceStartMsRef.current !== null) {
          const durationMs = now - silenceStartMsRef.current;
          if (durationMs >= MIN_PAUSE_MS) {
            pausesRef.current.push({ atMs: Math.round(silenceStartMsRef.current), durationMs: Math.round(durationMs) });
          }
          silenceStartMsRef.current = null;
        }
      }, SAMPLE_INTERVAL_MS);
    } catch {
      // Web Audio setup failing shouldn't block recording — just no pause data this session.
    }
  };

  const stopSilenceMonitor = () => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
    // Finalize a silence run still in progress when we stop.
    if (silenceStartMsRef.current !== null) {
      const now = elapsedMs();
      const durationMs = now - silenceStartMsRef.current;
      if (durationMs >= MIN_PAUSE_MS) {
        pausesRef.current.push({ atMs: Math.round(silenceStartMsRef.current), durationMs: Math.round(durationMs) });
      }
      silenceStartMsRef.current = null;
    }
    const pauses = pausesRef.current;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    return pauses;
  };

  const start = useCallback(async () => {
    setState("starting");
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "This browser doesn't support microphone recording (no navigator.mediaDevices.getUserMedia)."
        );
      }
      // getUserMedia can hang indefinitely with no error if the OS itself is
      // blocking mic access for this browser (common on macOS if it isn't
      // enabled in System Settings -> Privacy & Security -> Microphone) — a
      // timeout turns that silent hang into a visible, actionable message.
      const timeout = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Microphone request timed out. Check that your browser has mic access in your OS privacy settings, then reload."
              )
            ),
          10000
        )
      );
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        timeout,
      ]);
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      startSilenceMonitor(stream);
      setState("recording");
      return true;
    } catch (e) {
      setError(e?.message || "Microphone access failed.");
      setState("error");
      return false;
    }
  }, []);

  // Resolves { dataUrl, pauses } — pauses is [{ atMs, durationMs }], real
  // silences detected from the mic audio, always available regardless of
  // whether speech-to-text transcription is on.
  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      const pauses = stopSilenceMonitor();
      if (!recorder || recorder.state === "inactive") {
        resolve({ dataUrl: null, blob: null, pauses });
        return;
      }
      setState("stopping");
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setState("idle");
        const dataUrl = await blobToDataUrl(blob);
        resolve({ dataUrl, blob, pauses });
      };
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    stopSilenceMonitor();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setState("idle");
  }, []);

  return { state, error, start, stop, cancel };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
