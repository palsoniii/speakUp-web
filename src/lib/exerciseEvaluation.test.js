import { describe, expect, it } from "vitest";
import { evaluateExercise, getExerciseFitTabLabel } from "./exerciseEvaluation";

describe("getExerciseFitTabLabel", () => {
  it("returns a short label for each covered exercise type", () => {
    expect(getExerciseFitTabLabel("explain_simply")).toBe("Simplicity");
    expect(getExerciseFitTabLabel("snap_opinion")).toBe("Persuasion");
    expect(getExerciseFitTabLabel("wiki_roulette")).toBe("Reflection");
    expect(getExerciseFitTabLabel("word_of_day")).toBe("Vocabulary");
    expect(getExerciseFitTabLabel("word_ladder")).toBe("Connection");
  });

  it("returns null for an unrecognized exercise type", () => {
    expect(getExerciseFitTabLabel("something_else")).toBeNull();
  });
});

describe("evaluateExercise: unknown type", () => {
  it("returns null instead of throwing", () => {
    expect(evaluateExercise("nope", { transcript: "hello", wordCount: 1, exercise: {} })).toBeNull();
  });
});

describe("evaluateExercise: explain_simply", () => {
  const exercise = { id: "explain_simply", word: null, pair: null };

  it("scores plain, analogy-heavy language highly and flags nothing as jargon", () => {
    const transcript =
      "Okay so imagine your phone is like a tiny mailman. It's kind of like a friend who runs really fast.";
    const result = evaluateExercise("explain_simply", {
      transcript,
      wordCount: transcript.split(/\s+/).length,
      avgSyllablesPerWord: 1.2,
      exercise,
    });
    expect(result.label).toBe("Simplicity");
    expect(result.goodChips.length).toBeGreaterThan(0);
    expect(result.badChips).toHaveLength(0);
    expect(result.score).toBeGreaterThan(70);
  });

  it("dings jargon-heavy, high-syllable language", () => {
    const transcript =
      "This mechanism necessitates a comprehensive methodology to facilitate the theoretical framework.";
    const result = evaluateExercise("explain_simply", {
      transcript,
      wordCount: transcript.split(/\s+/).length,
      avgSyllablesPerWord: 2.4,
      exercise,
    });
    expect(result.badChips.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(40);
  });
});

describe("evaluateExercise: snap_opinion", () => {
  const exercise = { id: "snap_opinion" };

  it("rewards an early clear stance with reasoning", () => {
    const transcript =
      "I think remote work is better because it saves commute time, and for example people are happier.";
    const result = evaluateExercise("snap_opinion", {
      transcript,
      wordCount: transcript.split(/\s+/).length,
      exercise,
    });
    expect(result.label).toBe("Persuasion");
    expect(result.score).toBeGreaterThan(60);
  });

  it("penalizes hedging with no clear stance", () => {
    const transcript = "Maybe it's kind of good, I guess, not sure, sort of depends I think maybe.";
    const result = evaluateExercise("snap_opinion", {
      transcript,
      wordCount: transcript.split(/\s+/).length,
      exercise,
    });
    expect(result.badChips.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(40);
  });
});

describe("evaluateExercise: wiki_roulette (Reflection Roulette)", () => {
  const exercise = { id: "wiki_roulette" };

  it("rewards first-person, emotionally grounded language", () => {
    const transcript =
      "I remember how I felt that day — my heart was warm and I still miss it, it makes me feel grateful.";
    const result = evaluateExercise("wiki_roulette", {
      transcript,
      wordCount: transcript.split(/\s+/).length,
      exercise,
    });
    expect(result.label).toBe("Reflection");
    expect(result.score).toBeGreaterThan(60);
  });

  it("scores low for detached, third-person, unemotional language", () => {
    const transcript = "People generally consider this topic to be relevant across many contexts and situations.";
    const result = evaluateExercise("wiki_roulette", {
      transcript,
      wordCount: transcript.split(/\s+/).length,
      exercise,
    });
    expect(result.score).toBeLessThan(30);
  });
});

describe("evaluateExercise: word_of_day", () => {
  const exercise = { id: "word_of_day", word: "Ephemeral" };

  it("scores 100 when the target word is used at least twice", () => {
    const transcript = "Fashion trends are ephemeral, and honestly most trends feel ephemeral to me.";
    const result = evaluateExercise("word_of_day", { transcript, wordCount: 12, exercise });
    expect(result.score).toBe(100);
  });

  it("scores partial credit for a single use", () => {
    const transcript = "That moment felt ephemeral, like it wouldn't last.";
    const result = evaluateExercise("word_of_day", { transcript, wordCount: 9, exercise });
    expect(result.score).toBe(55);
  });

  it("scores 0 when the word never appears", () => {
    const transcript = "That moment felt fleeting, like it wouldn't last.";
    const result = evaluateExercise("word_of_day", { transcript, wordCount: 9, exercise });
    expect(result.score).toBe(0);
  });
});

describe("evaluateExercise: word_ladder", () => {
  const exercise = { id: "word_ladder", pair: ["umbrella", "volcano"] };

  it("scores 100 when both target words are used", () => {
    const transcript = "I grabbed my umbrella and ran, thinking about how a volcano might erupt in the rain.";
    const result = evaluateExercise("word_ladder", { transcript, wordCount: 16, exercise });
    expect(result.score).toBe(100);
  });

  it("scores 50 when only one target word is used", () => {
    const transcript = "I grabbed my umbrella and ran through the rain.";
    const result = evaluateExercise("word_ladder", { transcript, wordCount: 9, exercise });
    expect(result.score).toBe(50);
  });

  it("scores 0 when neither target word is used", () => {
    const transcript = "I grabbed my jacket and ran through the rain.";
    const result = evaluateExercise("word_ladder", { transcript, wordCount: 9, exercise });
    expect(result.score).toBe(0);
  });
});
