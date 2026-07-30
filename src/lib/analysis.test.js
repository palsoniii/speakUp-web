import { describe, expect, it } from "vitest";
import { analyzeTranscript, summarizePauses, tokenizeFillers } from "./analysis";

describe("analyzeTranscript", () => {
  it("returns hasTranscript: false and zeroed fields for an empty transcript", () => {
    const result = analyzeTranscript("", 60, []);
    expect(result.hasTranscript).toBe(false);
    expect(result.wordCount).toBe(0);
    expect(result.wpm).toBe(0);
    expect(result.pace).toBe("no_data");
    expect(result.totalFillers).toBe(0);
  });

  it("computes words-per-minute from word count and duration", () => {
    // 30 words in 15 seconds -> 30 / 0.25 minutes = 120 wpm
    const transcript = new Array(30).fill("word").join(" ");
    const result = analyzeTranscript(transcript, 15, []);
    expect(result.wordCount).toBe(30);
    expect(result.wpm).toBe(120);
    expect(result.pace).toBe("good"); // 90-160 band
  });

  it("buckets pace correctly at the boundaries", () => {
    const wordsForWpm = (wpm, seconds) => new Array(Math.round((wpm * seconds) / 60)).fill("x").join(" ");
    expect(analyzeTranscript(wordsForWpm(89, 60), 60, []).pace).toBe("slow");
    expect(analyzeTranscript(wordsForWpm(90, 60), 60, []).pace).toBe("good");
    expect(analyzeTranscript(wordsForWpm(160, 60), 60, []).pace).toBe("good");
    expect(analyzeTranscript(wordsForWpm(161, 60), 60, []).pace).toBe("brisk");
    expect(analyzeTranscript(wordsForWpm(190, 60), 60, []).pace).toBe("brisk");
    expect(analyzeTranscript(wordsForWpm(191, 60), 60, []).pace).toBe("fast");
  });

  it("counts filler words, case-insensitively, without double-counting phrases inside words", () => {
    const transcript = "So, um, I think, you know, this is like, basically fine. Actually UM it's great.";
    const result = analyzeTranscript(transcript, 60, []);
    const byPhrase = Object.fromEntries(result.fillerCounts.map((f) => [f.phrase, f.count]));
    expect(byPhrase["um"]).toBe(2); // "um" and "UM"
    expect(byPhrase["you know"]).toBe(1);
    expect(byPhrase["like"]).toBe(1);
    expect(byPhrase["basically"]).toBe(1);
    expect(byPhrase["actually"]).toBe(1);
    expect(result.totalFillers).toBe(byPhrase["um"] + byPhrase["you know"] + byPhrase["like"] + byPhrase["basically"] + byPhrase["actually"]);
  });

  it("does not count 'like' or 'know' fragments inside unrelated words", () => {
    // "Alike" and "knowledge" contain the substrings but aren't the filler words.
    const result = analyzeTranscript("Everyone here is alike, and knowledge matters.", 60, []);
    expect(result.totalFillers).toBe(0);
  });

  it("treats 'you know' as a single filler hit, not also flagging a bare word inside it", () => {
    const result = analyzeTranscript("You know, that matters.", 60, []);
    const byPhrase = Object.fromEntries(result.fillerCounts.map((f) => [f.phrase, f.count]));
    expect(byPhrase["you know"]).toBe(1);
    expect(result.totalFillers).toBe(1);
  });

  it("computes fillerRate as fillers per 100 words, rounded to 1 decimal", () => {
    // 10 words, 1 filler ("um") -> 10 per 100 words
    const result = analyzeTranscript("um one two three four five six seven eight nine", 60, []);
    expect(result.wordCount).toBe(10);
    expect(result.totalFillers).toBe(1);
    expect(result.fillerRate).toBe(10);
  });

  it("always computes pauses from audioPauses regardless of transcript presence", () => {
    const audioPauses = [{ atMs: 5000, durationMs: 2000 }];
    const withoutTranscript = analyzeTranscript("", 60, audioPauses);
    expect(withoutTranscript.hasTranscript).toBe(false);
    expect(withoutTranscript.hasPauseData).toBe(true);
    expect(withoutTranscript.pauses).toHaveLength(1);
  });

  it("reports hasPauseData: false when no audio pause data was passed", () => {
    const result = analyzeTranscript("hello world", 60, undefined);
    expect(result.hasPauseData).toBe(false);
    expect(result.pauses).toEqual([]);
  });
});

describe("summarizePauses", () => {
  it("maps durationMs -> pauseMs and formats atMs as m:ss", () => {
    const result = summarizePauses([
      { atMs: 0, durationMs: 1500 },
      { atMs: 65000, durationMs: 3200 }, // 1:05
    ]);
    expect(result[0]).toEqual({ atMs: 0, pauseMs: 1500, atLabel: "0:00" });
    expect(result[1]).toEqual({ atMs: 65000, pauseMs: 3200, atLabel: "1:05" });
  });

  it("returns an empty array for non-array input", () => {
    expect(summarizePauses(null)).toEqual([]);
    expect(summarizePauses(undefined)).toEqual([]);
  });
});

describe("tokenizeFillers", () => {
  it("splits a transcript into filler/non-filler tokens covering the whole string", () => {
    const tokens = tokenizeFillers("I think, um, this works.");
    const rejoined = tokens.map((t) => t.text).join("");
    expect(rejoined).toBe("I think, um, this works.");
    const fillerTexts = tokens.filter((t) => t.isFiller).map((t) => t.text.toLowerCase());
    expect(fillerTexts).toEqual(["um"]);
  });

  it("returns an empty array for an empty transcript", () => {
    expect(tokenizeFillers("")).toEqual([]);
    expect(tokenizeFillers(null)).toEqual([]);
  });

  it("prefers the longer phrase match over a shorter contained word", () => {
    const tokens = tokenizeFillers("you know what I mean");
    const fillerTexts = tokens.filter((t) => t.isFiller).map((t) => t.text.toLowerCase());
    expect(fillerTexts).toContain("you know");
    // "i mean" should also be caught as its own phrase
    expect(fillerTexts).toContain("i mean");
  });
});
