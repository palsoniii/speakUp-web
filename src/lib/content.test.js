import { describe, expect, it } from "vitest";
import {
  EXERCISE_TYPES,
  getDailyExercise,
  getDailyPromptPair,
  getDailyTopicPair,
  getExerciseType,
  getPromptFor,
} from "./content";

describe("EXERCISE_TYPES", () => {
  it("has a unique id, title, and positive timers for every category", () => {
    const ids = EXERCISE_TYPES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const ex of EXERCISE_TYPES) {
      expect(ex.title).toBeTruthy();
      expect(ex.prepSeconds).toBeGreaterThan(0);
      expect(ex.speakSeconds).toBeGreaterThan(0);
    }
  });
});

describe("getExerciseType", () => {
  it("finds a type by id", () => {
    expect(getExerciseType("word_of_day")?.title).toBe("Word of the Day");
  });

  it("returns undefined for an unknown id", () => {
    expect(getExerciseType("not_a_real_type")).toBeUndefined();
  });
});

describe("getDailyExercise", () => {
  it("is deterministic for the same date", () => {
    const date = new Date(2026, 0, 15);
    expect(getDailyExercise(date).id).toBe(getDailyExercise(date).id);
  });

  it("cycles through all exercise types over consecutive days", () => {
    const seen = new Set();
    for (let i = 0; i < EXERCISE_TYPES.length; i++) {
      const date = new Date(2026, 0, 1 + i);
      seen.add(getDailyExercise(date).id);
    }
    expect(seen.size).toBe(EXERCISE_TYPES.length);
  });
});

describe("getPromptFor", () => {
  it("returns a non-empty prompt for every known exercise type", () => {
    for (const ex of EXERCISE_TYPES) {
      const payload = getPromptFor(ex.id, 42);
      expect(typeof payload.prompt).toBe("string");
      expect(payload.prompt.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic for the same typeId + seed", () => {
    expect(getPromptFor("wiki_roulette", 7)).toEqual(getPromptFor("wiki_roulette", 7));
  });

  it("word_ladder includes both words from the pair in the prompt text", () => {
    const { prompt, pair } = getPromptFor("word_ladder", 3);
    expect(prompt).toContain(pair[0]);
    expect(prompt).toContain(pair[1]);
  });

  it("word_of_day includes the word and its definition", () => {
    const payload = getPromptFor("word_of_day", 5);
    expect(payload.word).toBeTruthy();
    expect(payload.definition).toBeTruthy();
  });

  it("returns an empty prompt for an unknown type rather than throwing", () => {
    expect(getPromptFor("not_a_real_type", 0)).toEqual({ prompt: "" });
  });
});

describe("getDailyPromptPair", () => {
  it("returns exactly two options", () => {
    const pair = getDailyPromptPair("wiki_roulette", new Date(2026, 3, 10));
    expect(pair).toHaveLength(2);
  });

  it("the two options are different prompts", () => {
    for (const ex of EXERCISE_TYPES) {
      const [a, b] = getDailyPromptPair(ex.id, new Date(2026, 5, 1));
      expect(a.prompt).not.toBe(b.prompt);
    }
  });

  it("is deterministic for the same day (stable across reopen)", () => {
    const date = new Date(2026, 2, 22);
    expect(getDailyPromptPair("snap_opinion", date)).toEqual(getDailyPromptPair("snap_opinion", date));
  });
});

describe("getDailyTopicPair", () => {
  it("resolves to two prompts for every category (async wrapper around getDailyPromptPair)", async () => {
    for (const ex of EXERCISE_TYPES) {
      const pair = await getDailyTopicPair(ex.id, new Date(2026, 6, 4));
      expect(pair).toHaveLength(2);
      expect(pair[0].prompt).not.toBe(pair[1].prompt);
    }
  });
});
