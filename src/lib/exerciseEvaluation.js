// Exercise-specific evaluation — a second, narrower lens layered on top of
// the general delivery/word metrics in analysis.js. Delivery, Words, and
// Structure measure the same things no matter which exercise you just did.
// This file asks a different question per exercise: did you do the thing
// THIS exercise is actually testing? A "power word" like "significant" is a
// plus on the Words tab and a *minus* here on Explain It Simply, because
// explaining something to a five-year-old is the opposite skill from
// sounding impressive — that's the whole reason this file exists as its own
// thing rather than folding into analysis.js. Same rule-based,
// recomputable-by-hand philosophy: curated word lists and counts, no
// opaque model judgment.

import { countOccurrences, scanWordList } from "./analysis";

// --- Word banks, one per exercise's actual point --------------------------

// Explain It Simply: formal/academic connective tissue that signals
// "textbook voice" rather than "explaining to a five-year-old". Deliberately
// doesn't include topic nouns (DNA, gravity, vaccine, etc.) — those are the
// subject itself, not the problem; the problem is explaining them plainly.
const JARGON_WORDS = [
  "utilize", "utilization", "facilitate", "methodology", "framework",
  "paradigm", "furthermore", "moreover", "subsequently", "consequently",
  "notwithstanding", "fundamentally", "inherently", "empirical",
  "theoretical", "hypothesis", "phenomenon", "phenomena", "conceptual",
  "conceptualize", "optimize", "optimization", "implement", "implementation",
  "leverage", "synthesize", "synthesis", "quantify", "quantitative",
  "qualitative", "correlation", "causation", "parameter", "parameters",
  "mechanism", "mechanisms", "infrastructure", "comprehensive",
  "substantial", "considerable", "considerably", "predominantly",
  "aforementioned", "necessitate", "necessitates", "constitute",
  "constitutes", "encompass", "encompasses",
];

// Language that signals someone is actively making something relatable —
// analogies, plain restatements, direct address of the listener.
const SIMPLIFIER_MARKERS = [
  "imagine", "picture this", "picture it", "think of it like",
  "think of it as", "it's like", "it's kind of like", "kind of like",
  "similar to", "just like", "so basically", "basically", "in other words",
  "put simply", "simply put", "let's say", "say you", "you know how",
];

// Snap Opinion: does it read as an actual stance, not a survey of options.
const STANCE_MARKERS = [
  "i think", "i believe", "in my opinion", "i'd say", "i would say",
  "my take", "i'm convinced", "personally", "i'd argue", "i would argue",
  "my opinion is", "i feel that", "for me,",
];
const REASONING_MARKERS = [
  "because", "since", "the reason", "for example", "for instance",
  "which means", "that's why", "this is why", "due to", "as a result",
];
const CONCESSION_MARKERS = [
  "however", "although", "even though", "that said", "on the other hand",
  "then again", "granted", "admittedly",
];
const HEDGE_MARKERS = [
  "maybe", "perhaps", "possibly", "i guess", "i'm not sure", "not sure",
  "sort of", "kind of", "i don't know", "who knows",
];

// Reflection Roulette: personal voice + sensory/emotional grounding, since
// the prompts explicitly ask for real, lived material, not a general take.
const PERSONAL_PRONOUNS = ["i", "me", "my", "myself", "mine"];
const EMOTION_SENSORY_WORDS = [
  "felt", "feel", "feeling", "remember", "remind", "reminds", "reminded",
  "smell", "smelled", "taste", "tasted", "sound", "sounded", "touch",
  "warm", "cold", "heart", "grateful", "proud", "afraid", "scared",
  "happy", "sad", "peaceful", "nostalgic", "comforting", "calm", "anxious",
  "joy", "love", "miss", "missed", "quiet", "silence",
];

function tokenize(lowerText) {
  return lowerText.match(/[a-z']+/g) || [];
}

// Exact-token match (not substring/regex scanning) for short pronouns —
// avoids the boundary edge cases phrase-scanning has with contractions
// like "i've", and matches how uniqueWordRatio tokenizes elsewhere in
// analysis.js.
function countTokenMatches(tokens, list) {
  const set = new Set(list);
  const found = new Map();
  for (const t of tokens) {
    if (set.has(t)) found.set(t, (found.get(t) || 0) + 1);
  }
  return [...found.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

function sumCounts(scan) {
  return scan.reduce((s, w) => s + w.count, 0);
}

// --- Per-exercise evaluators ------------------------------------------

function evaluateExplainSimply(ctx) {
  const { lowerClean, avgSyllablesPerWord } = ctx;
  const jargon = scanWordList(lowerClean, JARGON_WORDS);
  const simplifiers = scanWordList(lowerClean, SIMPLIFIER_MARKERS);

  const plainScore =
    avgSyllablesPerWord <= 1.35 ? 40 : avgSyllablesPerWord <= 1.55 ? 32 : avgSyllablesPerWord <= 1.8 ? 20 : 10;
  const jargonScore = Math.max(0, 30 - jargon.total * 10);
  const relateScore = Math.min(30, simplifiers.total * 10);

  const breakdown = [
    { label: "Plain wording", points: plainScore, max: 40 },
    { label: "No jargon", points: jargonScore, max: 30 },
    { label: "Relatable comparisons", points: relateScore, max: 30 },
  ];
  const score = breakdown.reduce((s, b) => s + b.points, 0);

  return {
    label: "Simplicity",
    heading: "Simplicity check",
    intro:
      'Specific to Explain It Simply: this rewards plain wording and analogies, and marks down the kind of formal, academic words that don\'t belong in an explanation for a five-year-old — even though some of those same words count as "power words" on the Words tab.',
    score,
    scoreLabel: "out of 100 · plain wording, no jargon, relatable comparisons",
    breakdown,
    badChipsLabel: "Words too heavy for this exercise",
    badChips: jargon.words,
    badEmptyNote: "No jargon detected — nicely plain.",
    goodChipsLabel: "Simplifying language you used",
    goodChips: simplifiers.words,
    goodEmptyNote: 'No analogy or "in other words"-style language detected — try "it\'s like…" or "imagine…" next time.',
  };
}

function evaluateSnapOpinion(ctx) {
  const { lowerClean } = ctx;
  const stance = scanWordList(lowerClean, STANCE_MARKERS);
  const reasoning = scanWordList(lowerClean, REASONING_MARKERS);
  const concession = scanWordList(lowerClean, CONCESSION_MARKERS);
  const hedge = scanWordList(lowerClean, HEDGE_MARKERS);

  const firstChunk = lowerClean.split(/\s+/).slice(0, 20).join(" ");
  const stanceEarly = STANCE_MARKERS.some((m) => countOccurrences(firstChunk, m) > 0);

  const stanceScore = stanceEarly ? 35 : stance.total > 0 ? 20 : 0;
  const supportScore = Math.min(35, (reasoning.total + concession.total) * 9);
  const firmnessScore = Math.max(0, 30 - hedge.total * 8);

  const breakdown = [
    { label: "Clear stance", points: stanceScore, max: 35 },
    { label: "Reasoning & support", points: supportScore, max: 35 },
    { label: "Firmness", points: firmnessScore, max: 30 },
  ];
  const score = breakdown.reduce((s, b) => s + b.points, 0);

  return {
    label: "Persuasion",
    heading: "Persuasion check",
    intro:
      "Specific to Snap Opinion: this looks for a clear side taken early, reasons backing it up, and how much hedging softened it — not vocabulary or pacing, which are already covered on the other tabs.",
    score,
    scoreLabel: "out of 100 · stance, reasoning, firmness",
    breakdown,
    badChipsLabel: "Hedging that softened your stance",
    badChips: hedge.words,
    badEmptyNote: "No hedging detected — you committed to a side.",
    goodChipsLabel: "Reasoning & nuance markers",
    goodChips: [...reasoning.words, ...concession.words],
    goodEmptyNote: 'No "because" / "for example"-style support detected — back your stance with a reason next time.',
  };
}

function evaluatePersonalDepth(ctx) {
  const { lowerClean, wordCount } = ctx;
  const tokens = tokenize(lowerClean);
  const pronounHits = countTokenMatches(tokens, PERSONAL_PRONOUNS);
  const pronounTotal = sumCounts(pronounHits);
  const sensory = scanWordList(lowerClean, EMOTION_SENSORY_WORDS);

  const pronounRate = wordCount > 0 ? (pronounTotal / wordCount) * 100 : 0;
  const voiceScore = pronounRate >= 6 ? 50 : pronounRate >= 3 ? 38 : pronounRate >= 1 ? 22 : 8;
  const sensoryScore = Math.min(50, sensory.total * 10);

  const breakdown = [
    { label: "Personal voice", points: voiceScore, max: 50 },
    { label: "Sensory / emotional detail", points: sensoryScore, max: 50 },
  ];
  const score = breakdown.reduce((s, b) => s + b.points, 0);

  return {
    label: "Reflection",
    heading: "Personal depth check",
    intro:
      "Specific to Reflection Roulette: this rewards speaking in first person and grounding the answer in real sensory or emotional detail — the actual point of this exercise, unlike the more argumentative or informational ones.",
    score,
    scoreLabel: "out of 100 · personal voice, sensory/emotional detail",
    breakdown,
    metrics: [{ label: "Personal pronouns (I / me / my)", value: `${pronounTotal} · ${Math.round(pronounRate * 10) / 10}/100 words` }],
    badChipsLabel: null,
    badChips: [],
    goodChipsLabel: "Sensory & emotional language",
    goodChips: sensory.words,
    goodEmptyNote: 'None detected — words like "felt", "remember", or naming an emotion would count here.',
  };
}

function evaluateWordOfDay(ctx) {
  const { lowerClean, exercise } = ctx;
  const word = exercise.word || "";
  const count = word ? countOccurrences(lowerClean, word.toLowerCase()) : 0;
  const met = count >= 2;
  const score = count >= 2 ? 100 : count === 1 ? 55 : 0;

  return {
    label: "Vocabulary",
    heading: "Vocabulary usage check",
    intro: `Specific to Word of the Day: the exercise asked you to use "${word}" naturally at least twice — this just checks whether you actually did it, separate from the general word-choice metrics on the Words tab.`,
    score,
    scoreLabel: `out of 100 · uses of "${word}"`,
    breakdown: [{ label: `Used "${word}"`, points: score, max: 100 }],
    metrics: [{ label: `Times you said "${word}"`, value: `${count} (target: 2+)` }],
    badChipsLabel: null,
    badChips: [],
    goodChipsLabel: null,
    goodChips: [],
    note: met
      ? `You hit the target — "${word}" came up ${count} times.`
      : count === 1
      ? `You used "${word}" once — the exercise asks for at least twice.`
      : `"${word}" didn't come up in the transcript — the exercise asks you to use it naturally at least twice.`,
  };
}

function evaluateWordLadder(ctx) {
  const { lowerClean, exercise } = ctx;
  const [w1, w2] = exercise.pair || ["", ""];
  const c1 = w1 ? countOccurrences(lowerClean, w1.toLowerCase()) : 0;
  const c2 = w2 ? countOccurrences(lowerClean, w2.toLowerCase()) : 0;
  const s1 = c1 > 0 ? 50 : 0;
  const s2 = c2 > 0 ? 50 : 0;
  const score = s1 + s2;

  return {
    label: "Connection",
    heading: "Connection check",
    intro: `Specific to Word Ladder: the exercise is to connect "${w1}" and "${w2}" in one riff — this just checks both words actually showed up, separate from pacing or word-choice metrics elsewhere.`,
    score,
    scoreLabel: "out of 100 · both target words used",
    breakdown: [
      { label: `Used "${w1}"`, points: s1, max: 50 },
      { label: `Used "${w2}"`, points: s2, max: 50 },
    ],
    metrics: [
      { label: `"${w1}" mentions`, value: c1 },
      { label: `"${w2}" mentions`, value: c2 },
    ],
    badChipsLabel: null,
    badChips: [],
    goodChipsLabel: null,
    goodChips: [],
  };
}

// Short label for the tab pill itself — null for anything without a
// dedicated evaluator (keeps this the single source of truth for which
// exercises have one, rather than duplicating an id list in Reflect.jsx).
export function getExerciseFitTabLabel(typeId) {
  switch (typeId) {
    case "explain_simply":
      return "Simplicity";
    case "snap_opinion":
      return "Persuasion";
    case "wiki_roulette":
      return "Reflection";
    case "word_of_day":
      return "Vocabulary";
    case "word_ladder":
      return "Connection";
    default:
      return null;
  }
}

// Single entry point Reflect.jsx calls. Returns null for an unrecognized
// (or future, not-yet-covered) exercise type rather than throwing, so
// adding a new exercise type without an evaluator here just means no
// assignment-fit tab shows up for it yet — never a crash.
export function evaluateExercise(typeId, { transcript, wordCount, avgSyllablesPerWord, exercise }) {
  const clean = (transcript || "").trim();
  const lowerClean = clean.toLowerCase();
  const ctx = { transcript: clean, lowerClean, wordCount, avgSyllablesPerWord, exercise };
  switch (typeId) {
    case "explain_simply":
      return evaluateExplainSimply(ctx);
    case "snap_opinion":
      return evaluateSnapOpinion(ctx);
    case "wiki_roulette":
      return evaluatePersonalDepth(ctx);
    case "word_of_day":
      return evaluateWordOfDay(ctx);
    case "word_ladder":
      return evaluateWordLadder(ctx);
    default:
      return null;
  }
}
