import { describe, expect, it } from "vitest";
import {
  maxQualifyingRecommendations,
  qualifyingRecommendations,
  recommendationGate,
  recommendationThreshold,
  shouldRevealRecommendations,
} from "@/lib/recommender";
import { getAllGames } from "@/lib/game-repository";
import { games as curatedGames } from "@/data/games";
import { blankProfile } from "@/lib/wizard/types";

describe("recommendation rubric", () => {
  it("keeps every hand-curated recommendation wired to a YouTube playthrough", () => {
    for (const game of curatedGames) {
      expect(game.playthroughUrl).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]+$/);
    }
  });

  it("gives every game in the full catalog somewhere to learn more", () => {
    for (const game of getAllGames()) {
      expect(game.playthroughUrl).toMatch(/^https:\/\//);
    }
  });

  it("does not reveal on a single answer even if it happens to score perfectly", () => {
    // A lone matched dimension scores 100% (score is relative to what's been answered),
    // so the "enough signal" floor is what actually stops a one-answer instant reveal.
    const profile = { ...blankProfile, name: "Ada", mood: "weird" as const };
    expect(qualifyingRecommendations(profile).length).toBeGreaterThan(maxQualifyingRecommendations);
    expect(shouldRevealRecommendations(profile)).toBe(false);
  });

  it("keeps the coarse categorical fields alone too broad against the full generated catalog", () => {
    // Mood/playStyle/difficulty/story are coarse buckets shared by many of the
    // ~2000 generated catalog titles, so these four alone tie dozens deep.
    const profile = {
      ...blankProfile,
      name: "Ada",
      mood: "ominous" as const,
      playStyle: "side-scroller" as const,
      difficulty: "difficult" as const,
      story: "some" as const,
    };
    const qualifying = qualifyingRecommendations(profile);
    expect(qualifying.length).toBeGreaterThan(maxQualifyingRecommendations);
    expect(shouldRevealRecommendations(profile)).toBe(false);
  });

  it("opens the recommendation gate once keywords break the tie down to three or fewer", () => {
    const profile = {
      ...blankProfile,
      name: "Ada",
      mood: "ominous" as const,
      playStyle: "side-scroller" as const,
      difficulty: "difficult" as const,
      story: "some" as const,
      keywords: ["gothic", "branching paths"],
    };
    const qualifying = qualifyingRecommendations(profile);
    expect(qualifying.length).toBeGreaterThan(0);
    expect(qualifying.length).toBeLessThanOrEqual(maxQualifyingRecommendations);
    expect(qualifying.every((rec) => rec.score >= recommendationThreshold)).toBe(true);
    expect(qualifying[0]?.game.title).toBe("Castlevania III: Dracula's Curse");
    expect(shouldRevealRecommendations(profile)).toBe(true);
    expect(recommendationGate(profile)).toMatchObject({
      threshold: recommendationThreshold,
      maxQualifying: maxQualifyingRecommendations,
      qualifyingCount: qualifying.length,
      isOpen: true,
    });
  });

  it("stays closed while the high-confidence set is still too broad", () => {
    const broad = {
      ...blankProfile,
      name: "Ada",
      mood: "weird" as const,
      playStyle: "platformer" as const,
      difficulty: "fair" as const,
      story: "low" as const,
    };
    const gate = recommendationGate(broad, { threshold: 0.75, maxQualifying: 3 });
    expect(gate.qualifyingCount).toBeGreaterThan(gate.maxQualifying);
    expect(gate.isOpen).toBe(false);
  });

  it("closes when no match clears the threshold", () => {
    const narrowed = {
      ...blankProfile,
      name: "Ada",
      mood: "contemplative" as const,
      playStyle: "puzzle" as const,
      difficulty: "difficult" as const,
      story: "rich" as const,
      obscurity: "strange" as const,
      romhack: "yes" as const,
    };
    expect(shouldRevealRecommendations(narrowed)).toBe(false);
  });
});
