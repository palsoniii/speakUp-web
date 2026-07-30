"""
Local speech-to-text server for SpeakUp, backed by faster-whisper.

Why this exists: the browser's built-in SpeechRecognition (used for the
live on-screen captions while recording) sends audio to a cloud dictation
service that aggressively cleans up disfluencies — "um"/"uh"/"er" are
frequently dropped entirely before the transcript ever reaches the app,
which made filler-word detection silently undercount. Whisper transcribes
verbatim audio-to-text with no "clean transcript" bias, so it actually
preserves filler words, and it runs 100% locally — nothing leaves this
machine, same principle as the AI coaching feedback when this server is
running (see src/lib/aiCoach.js) — though that now falls back to a hosted
model via Supabase when this server isn't available.

Run with: ./start.sh  (creates/reuses the venv, then starts this on
:8765). See README.md in this folder.
"""

import os
import tempfile

from flask import Flask, jsonify, request
from flask_cors import CORS
from faster_whisper import WhisperModel

# "medium.en" is the accuracy-favoring default — misheard words (a name
# transcribed as a different word entirely, etc.) matter more here than a
# few extra seconds of transcription time, since the transcript feeds both
# the rule-based feedback and the AI coaching's verbatim quotes. Override
# with WHISPER_MODEL_SIZE=small.en (faster/rougher) or base.en (fastest) if
# you're on slower hardware and the extra accuracy isn't worth the wait —
# see whisper-server/README.md.
MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "medium.en")

app = Flask(__name__)
CORS(app)  # allow the Vite dev origin (localhost:5173) to call this directly

print(f"Loading Whisper model '{MODEL_SIZE}' (first run downloads it — can take a minute)...")
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
print("Whisper model loaded. Listening on http://127.0.0.1:8765")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_SIZE})


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "no 'audio' file in request"}), 400

    # SpeakUp already knows what this recording is *about* (the exercise
    # prompt, and for Word of the Day, the exact target word) before it
    # ever sends the audio here. Whisper's initial_prompt biases decoding
    # toward the vocabulary it contains — this is the standard way to fix
    # "said one word, transcribed as a different one" for a specific known
    # word (a name, a topic term, the day's vocab word) that the model has
    # no other way to guess is likely. Optional so this still works with
    # older clients that don't send it.
    context = (request.form.get("context") or "").strip()[:400]

    audio_file = request.files["audio"]
    with tempfile.NamedTemporaryFile(suffix=".webm") as tmp:
        audio_file.save(tmp.name)
        segments, info = model.transcribe(
            tmp.name,
            beam_size=8,
            # Allows a more thorough beam search before settling on a best
            # hypothesis — more compute per clip, worth it for these short
            # (<2min) recordings given how much downstream feedback quotes
            # the transcript verbatim.
            patience=1.5,
            initial_prompt=context or None,
            # Deliberately off: VAD filtering trims silence/short spans, and
            # would trim exactly the kind of short disfluency-only audio
            # ("um", "uh") this server exists to capture.
            vad_filter=False,
            word_timestamps=True,
        )
        segments = list(segments)

    transcript = " ".join(s.text.strip() for s in segments).strip()
    segment_payload = [{"text": s.text.strip(), "start": s.start, "end": s.end} for s in segments]

    return jsonify({"transcript": transcript, "segments": segment_payload, "language": info.language})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765)
