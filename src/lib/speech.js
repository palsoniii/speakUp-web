import { useCallback, useRef, useState } from "react";

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getRecognitionCtor());
}

// Wraps the browser's SpeechRecognition API to build a running transcript
// while a recording is in progress. Also tracks the timestamp of each
// finalized chunk so analysis.js can estimate pause gaps between them.
//
// Transcript accumulation lives in a ref (not just state) so stop() can
// read the authoritative up-to-date value without relying on React's
// render/commit timing — SpeechRecognition delivers its last "final"
// result asynchronously right around when stop() is called, so we also
// give it a short grace window to land before resolving.
export function useSpeechTranscript() {
  const supported = isSpeechRecognitionSupported();
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const segmentsRef = useRef([]); // { text, atMs } for finalized chunks
  const startedAtRef = useRef(null);
  const intentionalStopRef = useRef(false);

  const start = useCallback(() => {
    if (!supported) return;
    const Ctor = getRecognitionCtor();
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    startedAtRef.current = Date.now();
    segmentsRef.current = [];
    transcriptRef.current = "";
    intentionalStopRef.current = false;
    setInterimTranscript("");

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) {
          const clean = text.trim();
          if (clean) {
            segmentsRef.current.push({ text: clean, atMs: Date.now() - startedAtRef.current });
            transcriptRef.current = transcriptRef.current ? `${transcriptRef.current} ${clean}` : clean;
          }
        } else {
          interim += text;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = () => {
      // Non-fatal: mic hiccups / no-speech timeouts happen often. The
      // recording itself (MediaRecorder) is unaffected, so we just let
      // whatever transcript we've captured so far stand.
    };

    // Some browsers auto-stop recognition after a period of silence even in
    // continuous mode. Restart it transparently unless we intentionally
    // called stop().
    recognition.onend = () => {
      if (!intentionalStopRef.current) {
        try {
          recognition.start();
        } catch {
          // already running / not restartable, ignore
        }
      }
    };

    try {
      recognition.start();
    } catch {
      // ignore — start() can throw if called twice in a row
    }
    recognitionRef.current = recognition;
  }, [supported]);

  // Returns a Promise<{ transcript, segments }> so callers can wait for any
  // trailing "final" result to land before reading the transcript.
  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recognition = recognitionRef.current;
      intentionalStopRef.current = true;
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
      // Grace window for the final onresult event to arrive.
      setTimeout(() => {
        resolve({
          transcript: transcriptRef.current.trim(),
          segments: segmentsRef.current,
        });
      }, 400);
    });
  }, []);

  return { supported, start, stop, interimTranscript };
}
