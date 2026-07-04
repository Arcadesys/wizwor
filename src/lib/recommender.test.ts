import { describe, expect, it } from "vitest";
import {
  bestGuessRecommendations,
  getRecommendations,
  maxQualifyingRecommendations,
  qualifyingRecommendations,
  recommendationGate,
  recommendationThreshold,
  scoreGame,
  shouldRevealRecommendations,
} from "@/lib/recommender";
import { getAllGames } from "@/lib/game-repository";
import { catalogPlatforms, games as curatedGames, type Game } from "@/data/games";
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

  it("scores a non-NES, non-romhack game correctly on the romhack dimension", () => {
    // Regression test: scoring used to branch on game.kind === "nes"/"romhack", which
    // silently zeroed out this dimension for any platform value other than those two.
    const syntheticGame: Game = {
      id: "synthetic-future-platform-game",
      title: "Synthetic Future Platform Game",
      platform: "nes",
      isRomhack: false,
      year: "2024",
      pitch: "A test fixture.",
      playthroughUrl: "https://example.com/game",
      moods: ["contemplative"],
      difficulty: "fair",
      story: "low",
      playStyle: "puzzle",
      obscurity: "hidden-gem",
      tags: ["test"],
    };

    const saysNo = scoreGame(syntheticGame, { ...blankProfile, name: "Ada", romhack: "no" });
    expect(saysNo.score).toBe(1);

    const saysYes = scoreGame(syntheticGame, { ...blankProfile, name: "Ada", romhack: "yes" });
    expect(saysYes.score).toBe(0);
  });

  it("does not reveal on a single answer even if it happens to score perfectly", () => {
    // A lone matched dimension scores 100% (score is relative to what's been answered),
    // so the "enough signal" floor is what actually stops a one-answer instant reveal.
    const profile = { ...blankProfile, name: "Ada", mood: "weird" as const };
    expect(qualifyingRecommendations(profile).length).toBeGreaterThan(maxQualifyingRecommendations);
    expect(shouldRevealRecommendations(profile)).toBe(false);
  });

  it("keeps the coarse categorical fields alone too broad for some profiles against the full generated catalog", () => {
    // Mood/playStyle/difficulty/story are coarse buckets, and even after filtering
    // the generated catalog down to signal-backed entries (see game-repository.ts),
    // some combinations still tie more than maxQualifyingRecommendations deep.
    const profile = {
      ...blankProfile,
      name: "Ada",
      mood: "ominous" as const,
      playStyle: "action-adventure" as const,
      difficulty: "fair" as const,
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

  it("never includes disabled platforms in qualifying recommendations", () => {
    const profile = {
      ...blankProfile,
      name: "Ada",
      mood: "heroic" as const,
      playStyle: "platformer" as const,
      difficulty: "fair" as const,
      story: "low" as const,
    };

    for (const platform of catalogPlatforms) {
      const platformOnly = qualifyingRecommendations(profile, { enabledPlatforms: [platform], threshold: 0 });
      expect(platformOnly.every((recommendation) => recommendation.game.platform === platform)).toBe(true);
    }

    const withoutSnes = qualifyingRecommendations(profile, {
      enabledPlatforms: ["nes", "romhack"],
      threshold: 0,
    });
    expect(withoutSnes.some((recommendation) => recommendation.game.platform === "snes")).toBe(false);
  });

  it("handles an empty enabled-platform set as an empty recommendation pool", () => {
    const profile = {
      ...blankProfile,
      name: "Ada",
      mood: "heroic" as const,
      playStyle: "platformer" as const,
      difficulty: "fair" as const,
      story: "low" as const,
    };

    expect(qualifyingRecommendations(profile, { enabledPlatforms: [] })).toEqual([]);
    expect(recommendationGate(profile, { enabledPlatforms: [] })).toMatchObject({
      qualifyingCount: 0,
      isOpen: false,
      recommendations: [],
    });
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

describe("bestGuessRecommendations", () => {
  // Enough answered dimensions to guess from, but the unmatchable keyword
  // keeps every score below the gate.
  const stuck = {
    ...blankProfile,
    name: "Ada",
    mood: "ominous" as const,
    playStyle: "puzzle" as const,
    difficulty: "casual" as const,
    keywords: ["zzz-unmatchable-keyword"],
  };

  it("returns the top-scored games when nothing clears the gate", () => {
    expect(qualifyingRecommendations(stuck)).toHaveLength(0);

    const guesses = bestGuessRecommendations(stuck);

    expect(guesses.length).toBeGreaterThan(0);
    expect(guesses.length).toBeLessThanOrEqual(maxQualifyingRecommendations);
    expect(guesses.map((guess) => guess.game.id)).toEqual(
      getRecommendations(stuck)
        .slice(0, maxQualifyingRecommendations)
        .map((recommendation) => recommendation.game.id),
    );
  });

  it("returns nothing until the profile has enough signal", () => {
    expect(bestGuessRecommendations(blankProfile)).toHaveLength(0);
    expect(bestGuessRecommendations({ ...blankProfile, mood: "ominous" })).toHaveLength(0);
  });
});
