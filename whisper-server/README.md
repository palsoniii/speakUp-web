# SpeakUp local Whisper server

**Optional.** The deployed app works without this — `src/lib/whisper.js` falls back to a hosted Groq-backed transcription Edge Function (see `supabase/functions/transcribe/`) when this server isn't running. Run this locally if you want transcription to stay fully on-device during development, or want to avoid using your Groq free-tier quota while iterating.

Transcribes practice recordings locally via [faster-whisper](https://github.com/SYSTRAN/faster-whisper), so filler words like "um"/"uh" survive the transcript. The browser's built-in speech recognition (used for live captions while recording) sends audio to a cloud dictation service that tends to strip those out before they ever reach the app — this runs entirely on your machine instead, so nothing leaves the device and disfluencies aren't cleaned away.

## Run it

```
./start.sh
```

First run creates a Python venv and installs dependencies (already done if you're reading this after setup). The very first request also downloads the `medium.en` model from Hugging Face (about 1.5GB) — after that it's cached locally and starts instantly.

The server listens on `http://localhost:8765`. Leave it running alongside `npm run dev` while you use the app — SpeakUp checks for it automatically and falls back to the hosted Groq transcription Edge Function (or, failing that, the browser's built-in transcription) if it isn't running.

## Requirements

- `ffmpeg` (`brew install ffmpeg`)
- Python 3.9+

## Changing the model

Default is `medium.en` — accuracy-favoring, since a misheard word shows up everywhere downstream (filler counts, power/weak words, and the AI coaching's verbatim "strongest line"/"tighten this" quotes). If transcription feels slow on your machine, override without editing code:

```
WHISPER_MODEL_SIZE=small.en ./start.sh
```

`base.en` is fastest/roughest, `small.en` is a faster/rougher middle ground, `medium.en` (default) is the most accurate for short (<2 min) English clips on CPU. If you change models, restart the server — the new one downloads on first use.

## Why it should already recognize your words better

SpeakUp sends the exercise's prompt (and, for Word of the Day, the exact target word) along with the audio as Whisper's `initial_prompt` — this primes the model toward the vocabulary it's likely to hear instead of guessing at the nearest sound-alike, which is the usual cause of "I said X, it transcribed Y". Decoding also uses a wider beam search (`beam_size=8`, `patience=1.5`) than faster-whisper's defaults, trading a bit of speed for fewer misheard words on these short clips.
