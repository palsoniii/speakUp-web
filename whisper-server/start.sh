#!/bin/bash
# Starts the local Whisper transcription server SpeakUp uses for filler-word
# detection. Creates the venv on first run, reuses it after that.
set -e

VENV_DIR="$HOME/.speakup-whisper-venv"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating venv at $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --upgrade pip
  "$VENV_DIR/bin/pip" install -r "$SCRIPT_DIR/requirements.txt"
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found — install it first: brew install ffmpeg"
  exit 1
fi

exec "$VENV_DIR/bin/python" "$SCRIPT_DIR/server.py"
