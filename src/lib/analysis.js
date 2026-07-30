// Transparent, rule-based feedback from a transcript — no opaque "AI score".
// Every number here is something the user could recompute by hand from the
// transcript, which is the point: it's a signal to look at, not a grade.

// Longer phrases first so e.g. "you know" is matched as one hit rather than
// leaving "you"/"know" to be scanned separately (they aren't fillers alone).
const FILLER_PATTERNS = [
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "um",
  "umm",
  "uh",
  "uhh",
  "er",
  "erm",
  "like",
  "basically",
  "literally",
  "actually",
];

// Word-choice signal, same spirit as filler detection: transparent word
// lists, not a model's opinion. Not exhaustive. The original list here was
// skewed toward formal business vocabulary ("strategic", "unlock") that
// rarely shows up in casual practice speech, which made this section look
// broken (weak words firing, power words never firing) even when it was
// working correctly — just finding nothing to flag. Broadened with more
// everyday decisive/vivid words so it actually has recall on normal speech.
const POWER_WORDS = [
  "achieve",
  "accomplish",
  "amazing",
  "authentic",
  "believe",
  "bold",
  "breakthrough",
  "build",
  "capable",
  "certain",
  "clarity",
  "clear",
  "commit",
  "committed",
  "confident",
  "connect",
  "control",
  "courageous",
  "create",
  "critical",
  "decisive",
  "dedicated",
  "deliver",
  "determined",
  "direct",
  "discover",
  "drive",
  "effective",
  "efficient",
  "empower",
  "engage",
  "essential",
  "excel",
  "exceptional",
  "explore",
  "extraordinary",
  "focus",
  "genuine",
  "grow",
  "growth",
  "guide",
  "impact",
  "important",
  "improve",
  "incredible",
  "innovate",
  "inspire",
  "key",
  "launch",
  "lead",
  "master",
  "matter",
  "meaningful",
  "motivate",
  "opportunity",
  "outstanding",
  "overcome",
  "passionate",
  "powerful",
  "precise",
  "proud",
  "proven",
  "remarkable",
  "resilient",
  "results",
  "significant",
  "skilled",
  "strategic",
  "strong",
  "succeed",
  "talented",
  "thrive",
  "transform",
  "trust",
  "unique",
  "unlock",
  "valuable",
  "vision",
  "win",
];

const WEAK_WORDS = [
  "maybe",
  "perhaps",
  "possibly",
  "probably",
  "hopefully",
  "somewhat",
  "stuff",
  "thing",
  "things",
  "nice",
  "okay",
  "whatever",
  "try",
  "very",
  "really",
  "just",
];

// word -> a couple of stronger, more specific alternatives. Deliberately
// small and common-word-focused (the words most likely to actually show up
// and be worth swapping), not a thesaurus dump.
const UPGRADE_SUGGESTIONS = {
  good: ["compelling", "solid", "excellent"],
  bad: ["flawed", "problematic", "weak"],
  big: ["substantial", "considerable", "significant"],
  nice: ["compelling", "admirable"],
  thing: ["factor", "element", "aspect"],
  stuff: ["material", "substance", "content"],
  very: ["remarkably", "genuinely", "notably"],
  really: ["genuinely", "truly"],
  get: ["obtain", "achieve", "secure"],
  got: ["obtained", "achieved", "secured"],
  said: ["explained", "argued", "noted"],
  "a lot": ["substantially", "considerably"],
};

export function countOccurrences(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

// Scans lowercase text against a curated word/phrase list, same mechanics
// as filler detection — used for both power words and weak words.
export function scanWordList(lowerText, wordList) {
  const found = [];
  let total = 0;
  for (const phrase of wordList) {
    const count = countOccurrences(lowerText, phrase);
    if (count > 0) {
      found.push({ word: phrase, count });
      total += count;
    }
  }
  found.sort((a, b) => b.count - a.count);
  return { words: found, total };
}

function findUpgradeSuggestions(lowerText) {
  const results = [];
  for (const [word, suggestions] of Object.entries(UPGRADE_SUGGESTIONS)) {
    const count = countOccurrences(lowerText, word);
    if (count > 0) results.push({ word, count, suggestions });
  }
  results.sort((a, b) => b.count - a.count);
  return results;
}

// Approximate syllable counter (vowel-group heuristic — the standard
// lightweight approach; not phoneme-accurate, but transparent and
// consistent, in keeping with this file's "recomputable by hand" spirit).
export function countSyllables(word) {
  const w = (word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]e|ed|es)$/, "").replace(/^y/, "");
  const matches = stripped.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(matches.length, 1) : 1;
}

// Splits a transcript into { text, isFiller } tokens so callers can render
// each filler word highlighted in place, rather than just a count. Longest
// phrases first in the alternation so "you know" wins over any accidental
// single-word match inside it (mirrors the consumption order used above).
export function tokenizeFillers(transcript) {
  const text = transcript || "";
  if (!text) return [];
  const sorted = [...FILLER_PATTERNS].sort((a, b) => b.length - a.length);
  const alternation = sorted.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`\\b(${alternation})\\b`, "gi");
  const tokens = [];
  let lastIndex = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) tokens.push({ text: text.slice(lastIndex, match.index), isFiller: false });
    tokens.push({ text: match[0], isFiller: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex), isFiller: false });
  return tokens;
}

// formatMs -> "m:ss" for labeling where in the recording a pause happened.
function formatAtMs(atMs) {
  const totalSeconds = Math.round(atMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Pauses come from recorder.js's real-time Web Audio silence detection
// (actual mic amplitude, sampled during recording) rather than being
// estimated from transcript timing — this is a measurement, not a guess,
// and it works whether or not live transcription is even on.
export function summarizePauses(audioPauses) {
  if (!Array.isArray(audioPauses)) return [];
  return audioPauses.map((p) => ({
    atMs: p.atMs,
    pauseMs: p.durationMs,
    atLabel: formatAtMs(p.atMs),
  }));
}

// Segments arrive in two shapes depending on transcript source (see
// whisper.js and speech.js): Whisper gives { text, start, end } in seconds
// with real ranges; the browser's live SpeechRecognition only gives a
// single finalize timestamp { text, atMs }, so its "start" is reconstructed
// as the previous chunk's end. Normalized to { text, startMs, endMs } either
// way so computeWpmOverTime doesn't need to know which source it got.
function normalizeSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  if (segments[0].start !== undefined) {
    return segments.map((s) => ({ text: s.text || "", startMs: s.start * 1000, endMs: s.end * 1000 }));
  }
  let prevEnd = 0;
  return segments.map((s) => {
    const startMs = prevEnd;
    const endMs = Math.max(s.atMs, startMs + 1);
    prevEnd = endMs;
    return { text: s.text || "", startMs, endMs };
  });
}

// Buckets the recording into a handful of equal time windows and computes
// wpm within each, so pacing over the course of a session can be charted
// rather than collapsed into one number. A segment that straddles a bucket
// boundary has its words split proportionally by time overlap rather than
// dumped entirely into one bucket.
export function computeWpmOverTime(segments, durationSeconds) {
  const normalized = normalizeSegments(segments);
  if (normalized.length === 0 || !durationSeconds || durationSeconds <= 0) return [];

  const totalMs = durationSeconds * 1000;
  const bucketCount = Math.min(8, Math.max(3, Math.round(durationSeconds / 20)));
  const bucketMs = totalMs / bucketCount;
  const buckets = new Array(bucketCount).fill(0);

  for (const seg of normalized) {
    const wordsInSeg = seg.text.trim().split(/\s+/).filter(Boolean).length;
    if (!wordsInSeg) continue;
    const segStart = Math.max(0, Math.min(seg.startMs, totalMs));
    const segEnd = Math.max(segStart + 1, Math.min(seg.endMs, totalMs));
    const segDuration = segEnd - segStart;

    const firstBucket = Math.max(0, Math.floor(segStart / bucketMs));
    const lastBucket = Math.min(bucketCount - 1, Math.floor((segEnd - 1) / bucketMs));
    for (let b = firstBucket; b <= lastBucket; b++) {
      const bucketStart = b * bucketMs;
      const bucketEnd = bucketStart + bucketMs;
      const overlapMs = Math.max(0, Math.min(segEnd, bucketEnd) - Math.max(segStart, bucketStart));
      buckets[b] += wordsInSeg * (overlapMs / segDuration);
    }
  }

  return buckets.map((wordsInBucket, i) => {
    const wpm = Math.round(wordsInBucket / (bucketMs / 60000));
    return { label: formatAtMs(i * bucketMs), wpm: Number.isFinite(wpm) ? wpm : 0 };
  });
}

// A transparent 0-100 composite from signals already measured elsewhere in
// this file — no opaque model judgment, just a weighted rollup so there's
// one headline number alongside the breakdown that produced it. Weights:
// pace 30, fillers 30, pauses 20, vocabulary variety 20.
export function computeArticulationScore({ pace, fillerRate, pauses, durationSeconds, avgSyllablesPerWord, uniqueWordRatio }) {
  const breakdown = [];

  const PACE_POINTS = { good: 30, slow: 20, brisk: 20, fast: 12, no_data: 0 };
  const paceScore = PACE_POINTS[pace] ?? 0;
  breakdown.push({ label: "Pace", points: paceScore, max: 30 });

  const fillerScore = Math.max(0, Math.round(30 * (1 - Math.min(fillerRate, 15) / 15)));
  breakdown.push({ label: "Filler words", points: fillerScore, max: 30 });

  const minutes = Math.max(durationSeconds, 1) / 60;
  const pausesPerMin = pauses.length / minutes;
  const avgPauseSec = pauses.length ? pauses.reduce((sum, p) => sum + p.pauseMs, 0) / pauses.length / 1000 : 0;
  let pauseScore = 20;
  if (pausesPerMin > 4) pauseScore -= 8;
  else if (pausesPerMin > 2) pauseScore -= 4;
  if (avgPauseSec > 3) pauseScore -= 6;
  else if (avgPauseSec > 2) pauseScore -= 3;
  pauseScore = Math.max(0, pauseScore);
  breakdown.push({ label: "Pauses", points: pauseScore, max: 20 });

  const syllableScore = avgSyllablesPerWord >= 1.3 && avgSyllablesPerWord <= 1.9 ? 10 : 6;
  const varietyScore = Math.round(Math.min(uniqueWordRatio, 1) * 10);
  breakdown.push({ label: "Vocabulary variety", points: syllableScore + varietyScore, max: 20 });

  const score = breakdown.reduce((sum, b) => sum + b.points, 0);
  return { score, breakdown };
}

export function analyzeTranscript(transcript, durationSeconds, audioPauses, segments) {
  const clean = (transcript || "").trim();
  const words = clean.length ? clean.split(/\s+/) : [];
  const wordCount = words.length;
  const minutes = Math.max(durationSeconds, 1) / 60;
  const wpm = wordCount > 0 ? Math.round(wordCount / minutes) : 0;

  // Match filler phrases against a lowercase copy, then remove matched spans
  // so overlapping shorter fillers inside a longer phrase aren't double-
  // counted (e.g. "kind of" already consumed shouldn't also flag nothing
  // extra here since none of our single words are substrings of others,
  // but this keeps the approach correct if the list grows).
  let scratch = clean.toLowerCase();
  const fillerCounts = [];
  let totalFillers = 0;
  for (const phrase of FILLER_PATTERNS) {
    const count = countOccurrences(scratch, phrase);
    if (count > 0) {
      fillerCounts.push({ phrase, count });
      totalFillers += count;
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      scratch = scratch.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
    }
  }
  fillerCounts.sort((a, b) => b.count - a.count);

  const fillerRate = wordCount > 0 ? Math.round((totalFillers / wordCount) * 1000) / 10 : 0;

  let pace = "no_data";
  if (wordCount > 0) {
    if (wpm < 90) pace = "slow";
    else if (wpm <= 160) pace = "good";
    else if (wpm <= 190) pace = "brisk";
    else pace = "fast";
  }

  const PACE_LABELS = {
    slow: "On the slower side — there's room to pick up the pace.",
    good: "Solid conversational pace.",
    brisk: "A little brisk — could slow down for emphasis.",
    fast: "Quite fast — worth consciously slowing down.",
    no_data: "Not enough transcript to estimate pace.",
  };

  // Independent of transcript/wordCount — audio pause detection runs
  // regardless of whether live transcription was on for this session.
  const pauses = summarizePauses(audioPauses);

  // Word choice: scanned on a fresh lowercase copy (not the filler-stripped
  // `scratch`) since none of these overlap the filler list.
  const lowerClean = clean.toLowerCase();
  const powerScan = scanWordList(lowerClean, POWER_WORDS);
  const weakScan = scanWordList(lowerClean, WEAK_WORDS);
  const upgradeSuggestions = findUpgradeSuggestions(lowerClean);

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSyllablesPerWord = wordCount > 0 ? Math.round((totalSyllables / wordCount) * 100) / 100 : 0;
  const uniqueWordRatio =
    wordCount > 0
      ? new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""))).size / wordCount
      : 0;

  const wpmOverTime = computeWpmOverTime(segments, durationSeconds);

  const articulation =
    wordCount > 0
      ? computeArticulationScore({ pace, fillerRate, pauses, durationSeconds, avgSyllablesPerWord, uniqueWordRatio })
      : null;

  return {
    hasTranscript: wordCount > 0,
    wordCount,
    wpm,
    pace,
    paceLabel: PACE_LABELS[pace],
    totalFillers,
    fillerRate, // fillers per 100 words
    fillerCounts, // [{ phrase, count }], sorted by count desc
    pauses, // [{ atMs, pauseMs, atLabel }], real silences from mic audio
    hasPauseData: Array.isArray(audioPauses),
    powerWords: powerScan.words, // [{ word, count }]
    weakWords: weakScan.words, // [{ word, count }]
    syllables: {
      avgPerWord: avgSyllablesPerWord,
      totalSyllables,
      upgradeSuggestions, // [{ word, count, suggestions: [...] }]
    },
    wpmOverTime, // [{ label, wpm }], empty if no segment timing available
    articulation, // { score, breakdown: [{ label, points, max }] } | null
  };
}
