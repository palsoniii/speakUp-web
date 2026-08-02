// Exercise-specific evaluation — a second, narrower lens layered on top of
// the general delivery/word metrics in analysis.js. Delivery, Words, and
// Structure measure the same things no matter which exercise you just did.
// This file asks a different question per exercise: did you do the thing
// THIS exercise is actually testing? A "power word" like "significant" is a
// plus on the Words tab and a *minus* here on Explain It Simply, because
// explaining something to a five-year-old is the opposite skill from
// sounding impressive — that's the whole reason this file exists as its own
// thing rather than folding into analysis.js.
//
// This used to also produce a composite 0-100 "grade" (plainScore,
// jargonScore, stanceScore, etc.) built purely from summing hits against the
// word/phrase lists below — that's exactly the blind spot this app is
// trying to get away from: phrase it differently than the list anticipated
// and it doesn't register, so two equally good answers could score
// differently by luck of vocabulary. That composite number was never even
// the headline in the UI (aiCoach.js's model-driven getExerciseFitAiFeedback
// score already was — see Reflect.jsx's ExerciseFitPanel), so removing it
// isn't taking away something users relied on, just a second, quieter,
// list-gated number that implied more rigor than it had. What's left here is
// unscored: the same curated word/phrase lists, still scanned for and still
// shown, but as evidence chips for a human (or the model) to read — not a
// grade of their own. word_of_day/word_ladder are the one place a literal
// list-membership check IS the right tool (the exercise itself defines a
// single target word/pair), so those two keep their exact-match scoring.

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

// Snap Opinion: reasoning/support and hedge markers, scanned as evidence
// chips (see the evaluateSnapOpinion comment above — the actual "did they
// take a clear stance early" judgment now comes from the model, which can
// read a stance phrased any way, not just via a fixed list of stance
// phrases like "i think"/"in my opinion").
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
  const { lowerClean } = ctx;
  const jargon = scanWordList(lowerClean, JARGON_WORDS);
  const simplifiers = scanWordList(lowerClean, SIMPLIFIER_MARKERS);

  return {
    label: "Simplicity",
    heading: "Simplicity check",
    intro:
      "Specific to Explain It Simply: the AI judgment above is the real read on whether this actually explains the thing plainly and correctly. These are just the formal/academic words and analogy-style phrases a quick scan happened to catch — evidence, not a grade of their own, since plenty of jargon-free or analogy-rich answers won't use exactly these words.",
    badChipsLabel: "Formal/academic words a quick scan caught",
    badChips: jargon.words,
    badEmptyNote: "No jargon-list words detected.",
    goodChipsLabel: "Simplifying language a quick scan caught",
    goodChips: simplifiers.words,
    goodEmptyNote: 'No listed analogy phrase like "it\'s like…" or "imagine…" detected — that doesn\'t mean you didn\'t simplify it, just that this scan is narrow.',
  };
}

function evaluateSnapOpinion(ctx) {
  const { lowerClean } = ctx;
  const reasoning = scanWordList(lowerClean, REASONING_MARKERS);
  const concession = scanWordList(lowerClean, CONCESSION_MARKERS);
  const hedge = scanWordList(lowerClean, HEDGE_MARKERS);

  return {
    label: "Persuasion",
    heading: "Persuasion check",
    intro:
      "Specific to Snap Opinion: the AI judgment above is the real read on whether you actually took a side and whether the reasoning holds up. These are just the hedging and reasoning/support phrases a quick scan happened to catch — a stance phrased without any of these exact words won't show up here even if it's a perfectly clear stance.",
    badChipsLabel: "Hedging a quick scan caught",
    badChips: hedge.words,
    badEmptyNote: "No listed hedge phrases detected.",
    goodChipsLabel: "Reasoning & nuance markers a quick scan caught",
    goodChips: [...reasoning.words, ...concession.words],
    goodEmptyNote: 'No listed "because" / "for example"-style phrase detected — that doesn\'t mean there\'s no reasoning, just that this scan is narrow.',
  };
}

function evaluatePersonalDepth(ctx) {
  const { lowerClean, wordCount } = ctx;
  const tokens = tokenize(lowerClean);
  const pronounHits = countTokenMatches(tokens, PERSONAL_PRONOUNS);
  const pronounTotal = sumCounts(pronounHits);
  const sensory = scanWordList(lowerClean, EMOTION_SENSORY_WORDS);
  const pronounRate = wordCount > 0 ? (pronounTotal / wordCount) * 100 : 0;

  return {
    label: "Reflection",
    heading: "Personal depth check",
    intro:
      "Specific to Reflection Roulette: the AI judgment above is the real read on whether this is genuinely personal and specific, not generic. Personal-pronoun rate is an honest objective count (below); the sensory/emotional words are just what a quick scan happened to catch — plenty of genuinely personal, vivid answers won't use exactly these words.",
    // `value` renders large and bold (see Reflect.jsx's ExerciseFitPanel) —
    // it used to be a combined "9 · 9.8/100 words" string, which at that
    // size and weight reads like a misplaced-decimal number ("9.9.8")
    // rather than "9 uses, a rate of 9.8". Keeping value a single plain
    // number (matching how every other exercise's metrics render — see
    // evaluateWordLadder/evaluateWordOfDay below) and folding the rate into
    // the label instead removes the ambiguity.
    metrics: [
      {
        label: `Personal pronouns (I / me / my) — ${Math.round(pronounRate * 10) / 10} per 100 words`,
        value: pronounTotal,
      },
    ],
    badChipsLabel: null,
    badChips: [],
    goodChipsLabel: "Sensory & emotional language a quick scan caught",
    goodChips: sensory.words,
    goodEmptyNote: 'None detected — that\'s a narrow list (words like "felt", "remember"), not a verdict on how personal this was.',
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
