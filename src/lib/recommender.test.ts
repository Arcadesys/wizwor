import { describe, expect, it } from "vitest";
import {
  minQualifyingRecommendations,
  qualifyingRecommendations,
  recommendationThreshold,
  shouldRevealRecommendations,
} from "@/lib/recommender";
import { blankProfile } from "@/lib/wizard/types";

describe("recommendation rubric", () => {
  it("does not reveal on a single answer even if it happens to score perfectly", () => {
    // A lone matched dimension scores 100% (score is relative to what's been answered),
    // so the "enough signal" floor is what actually stops a one-answer instant reveal.
    const profile = { ...blankProfile, name: "Ada", mood: "weird" as const };
    expect(qualifyingRecommendations(profile).length).toBeGreaterThanOrEqual(minQualifyingRecommendations);
    expect(shouldRevealRecommendations(profile)).toBe(false);
  });

  it("reveals once enough signal is present and the rubric clears the threshold", () => {
    const profile = {
      ...blankProfile,
      name: "Ada",
      mood: "ominous" as const,
      playStyle: "top-down" as const,
      difficulty: "fair" as const,
      story: "some" as const,
    };
    const qualifying = qualifyingRecommendations(profile);
    expect(qualifying.length).toBeGreaterThanOrEqual(minQualifyingRecommendations);
    expect(qualifying.every((rec) => rec.score >= recommendationThreshold)).toBe(true);
    expect(shouldRevealRecommendations(profile)).toBe(true);
  });

  it("stops revealing if a refinement narrows the matches back down", () => {
    const broad = {
      ...blankProfile,
      name: "Ada",
      mood: "ominous" as const,
      playStyle: "top-down" as const,
      difficulty: "fair" as const,
      story: "some" as const,
    };
    expect(shouldRevealRecommendations(broad)).toBe(true);

    const narrowed = {
      ...broad,
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
