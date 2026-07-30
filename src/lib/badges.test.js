import { describe, expect, it } from "vitest";
import { BADGE_DEFS, computeBadges } from "./badges";

describe("BADGE_DEFS", () => {
  it("has a unique id and non-empty label/description for every badge", () => {
    const ids = BADGE_DEFS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BADGE_DEFS) {
      expect(b.label).toBeTruthy();
      expect(b.description).toBeTruthy();
      expect(typeof b.check).toBe("function");
    }
  });
});

describe("computeBadges", () => {
  it("returns every badge, earned and locked, when there's no history", () => {
    const stats = { totalSessions: 0, totalMinutes: 0, streak: 0 };
    const badges = computeBadges([], stats);
    expect(badges).toHaveLength(BADGE_DEFS.length);
    expect(badges.every((b) => b.earned === false)).toBe(true);
  });

  it("marks first_session earned after one session", () => {
    const stats = { totalSessions: 1, totalMinutes: 2, streak: 1 };
    const badges = computeBadges([{ typeId: "word_of_day" }], stats);
    expect(badges.find((b) => b.id === "first_session").earned).toBe(true);
    expect(badges.find((b) => b.id === "sessions_10").earned).toBe(false);
  });

  it("marks explorer earned only once all 5 exercise types are represented", () => {
    const stats = { totalSessions: 4, totalMinutes: 10, streak: 1 };
    const fourTypes = ["wiki_roulette", "explain_simply", "snap_opinion", "word_of_day"].map((typeId) => ({
      typeId,
    }));
    expect(computeBadges(fourTypes, stats).find((b) => b.id === "explorer").earned).toBe(false);

    const fiveTypes = [...fourTypes, { typeId: "word_ladder" }];
    expect(computeBadges(fiveTypes, { ...stats, totalSessions: 5 }).find((b) => b.id === "explorer").earned).toBe(
      true
    );
  });

  it("marks clean_speaker earned only when a session has words but zero fillers", () => {
    const stats = { totalSessions: 1, totalMinutes: 1, streak: 1 };
    const noisy = [{ feedback: { wordCount: 40, totalFillers: 3 } }];
    expect(computeBadges(noisy, stats).find((b) => b.id === "clean_speaker").earned).toBe(false);

    const clean = [{ feedback: { wordCount: 40, totalFillers: 0 } }];
    expect(computeBadges(clean, stats).find((b) => b.id === "clean_speaker").earned).toBe(true);

    const empty = [{ feedback: { wordCount: 0, totalFillers: 0 } }];
    expect(computeBadges(empty, stats).find((b) => b.id === "clean_speaker").earned).toBe(false);
  });

  it("streak and minute badges track their thresholds", () => {
    const badges = computeBadges([], { totalSessions: 0, totalMinutes: 65, streak: 7 });
    expect(badges.find((b) => b.id === "streak_3").earned).toBe(true);
    expect(badges.find((b) => b.id === "streak_7").earned).toBe(true);
    expect(badges.find((b) => b.id === "streak_30").earned).toBe(false);
    expect(badges.find((b) => b.id === "minutes_60").earned).toBe(true);
    expect(badges.find((b) => b.id === "minutes_300").earned).toBe(false);
  });
});
