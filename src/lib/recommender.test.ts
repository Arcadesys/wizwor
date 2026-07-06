import { describe, expect, it } from "vitest";
import {
  bestGuessRecommendations,
  exactTitleRecommendations,
  getRecommendations,
  maxQualifyingRecommendations,
  qualifyingRecommendations,
  recommendationGate,
  recommendationThreshold,
  scoreGame,
  shouldRevealRecommendations,
} from "@/lib/recommender";
import { getAllGames } from "@/lib/game-repository";
import { catalogPlatforms, type Game } from "@/data/games";
import { blankProfile } from "@/lib/wizard/types";

describe("recommendation rubric", () => {
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
      keywords: ["castlevania"],
    };
    const qualifying = qualifyingRecommendations(profile);
    expect(qualifying.length).toBeGreaterThan(0);
    expect(qualifying.length).toBeLessThanOrEqual(maxQualifyingRecommendations);
    expect(qualifying.every((rec) => rec.score >= recommendationThreshold)).toBe(true);
    expect(qualifying[0]?.game.title).toBe("Castlevania");
    expect(shouldRevealRecommendations(profile)).toBe(true);
    expect(recommendationGate(profile)).toMatchObject({
      threshold: recommendationThreshold,
      maxQualifying: maxQualifyingRecommendations,
      qualifyingCount: qualifying.length,
      isOpen: true,
    });
  });

  it("finds exact title recommendations for direct cartridge-name commands before compilation carts", () => {
    const recommendations = exactTitleRecommendations("Super Mario Bros.", { enabledPlatforms: ["nes"] });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.every((recommendation) => recommendation.game.title === "Super Mario Bros.")).toBe(true);
    expect(recommendations[0]).toMatchObject({
      game: { id: "super-mario-bros" },
      score: 1,
      reasons: ["exact title match"],
    });
  });

  it("finds a named cartridge even when it's phrased inside a full sentence, not just as a bare command", () => {
    // Regression: a direct ask like "I want to play Mega Man 2" was refused
    // because exactTitleRecommendations only matched when the whole message
    // equaled a catalog title verbatim.
    const recommendations = exactTitleRecommendations("I want to play Mega Man 2 please", {
      enabledPlatforms: ["nes"],
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      game: { id: "mega-man-2", title: "Mega Man 2" },
      score: 1,
      reasons: ["exact title match"],
    });
  });

  it("prefers the more specific title when a shorter title's words are a subset of a longer one", () => {
    // "Mega Man" is itself a real, different cartridge, and its words are a
    // strict subset of "Mega Man 2" — naming the sequel directly shouldn't
    // also surface the unrelated original.
    const recommendations = exactTitleRecommendations("mega man 2", { enabledPlatforms: ["nes"] });

    expect(recommendations.map((recommendation) => recommendation.game.id)).toEqual(["mega-man-2"]);
  });

  it("does not treat a generic genre ask as a direct title mention just because a common word is also a title", () => {
    // Regression: "Golf" is a real one-word NES title, but "I want a golf
    // game" is naming the genre, not the cartridge — the contained-title
    // bypass must not fire for single-word titles embedded in a sentence.
    const recommendations = exactTitleRecommendations("I want a golf game", { enabledPlatforms: ["nes"] });

    expect(recommendations).toHaveLength(0);
  });

  it("does not drop a title just because it's a raw text prefix of another matched title", () => {
    // Regression: "golden axe ii" is a raw substring of "golden axe iii"
    // (no word boundary — "ii" immediately continues into "iii"), so a naive
    // unpadded containment check incorrectly treated "Golden Axe II" as
    // subsumed by "Golden Axe III" even when both are independently named.
    const recommendations = exactTitleRecommendations("I want Golden Axe II and Golden Axe III", {
      enabledPlatforms: ["genesis"],
    });

    expect(recommendations.map((recommendation) => recommendation.game.id).sort()).toEqual([
      "golden-axe-ii",
      "golden-axe-iii",
    ]);
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

describe("keyword-rescued franchise matches", () => {
  it("surfaces a named franchise even when every generated entry scored below the quality filter", () => {
    // Regression test: every generated "Mega Man" NES entry has signalScore 1,
    // below getAllGames' quality bar, so a request naming the franchise used to
    // score against a pool containing zero Mega Man games and could recommend an
    // unrelated title (e.g. Kick Master) for "the easiest Mega Man game" instead.
    const profile = { ...blankProfile, difficulty: "casual" as const, keywords: ["mega man"] };
    const recs = getRecommendations(profile);
    const top = recs.slice(0, 5).map((recommendation) => recommendation.game.title);

    expect(top.some((title) => title.startsWith("Mega Man"))).toBe(true);
  });
});

describe("precomputed recommendations reuse", () => {
  it("returns options.recommendations verbatim instead of rescoring the catalog", () => {
    const profile = { ...blankProfile, name: "Ada", mood: "ominous" as const };
    const scored = getRecommendations(profile);

    expect(getRecommendations(profile, { recommendations: scored })).toBe(scored);
    expect(qualifyingRecommendations(profile, { recommendations: scored })).toEqual(
      qualifyingRecommendations(profile),
    );
  });
});
