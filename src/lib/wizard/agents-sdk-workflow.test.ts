import { ModelBehaviorError } from "@openai/agents";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  buildResponse,
  buildConsumedTurnContext,
  ensureFirstTurnQuestion,
  isAgentDataSchemaError,
  normalizeOpenGameShowcaseInput,
  resolveAutomaticShowcaseIds,
  resolveShowcaseIds,
  WizardTurnOutputSchema,
} from "@/lib/wizard/agents-sdk-workflow";
import { catalogPlatforms } from "@/data/games";
import { bestGuessRecommendations, maxQualifyingRecommendations, qualifyingRecommendations } from "@/lib/recommender";
import { enforceWizardResponseLength, WIZARD_RESPONSE_TOO_LONG_ERROR } from "@/lib/wizard/response-guard";
import { blankProfile, initialWizardState, type WizardTurnRequest } from "@/lib/wizard/types";

type WizardTurnOutputInput = z.input<typeof WizardTurnOutputSchema>;
type WizardTurnOutput = z.output<typeof WizardTurnOutputSchema>;

function baseOutput(agentData: WizardTurnOutputInput["agentData"]): WizardTurnOutput {
  return WizardTurnOutputSchema.parse({
    lines: ["The circuits hum."],
    accepted: true,
    profile: {},
    revealed: false,
    recommendedGameIds: [],
    agentData,
  });
}

const narrowProfile = {
  ...blankProfile,
  name: "Ada",
  mood: "ominous" as const,
  playStyle: "side-scroller" as const,
  difficulty: "difficult" as const,
  story: "some" as const,
  keywords: ["castlevania"],
};

describe("WizardTurnOutputSchema agentData", () => {
  it("accepts flat primitive and array values", () => {
    const result = WizardTurnOutputSchema.safeParse(
      baseOutput({ moodScore: 0.8, tags: ["gothic", "arcade"] }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts one level of nested object (e.g. inferredProfile)", () => {
    const result = WizardTurnOutputSchema.safeParse(
      baseOutput({ inferredProfile: { mood: "heroic", confidence: 0.8 } }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts a nested object one level deeper (the previously reproduced 503 case)", () => {
    const result = WizardTurnOutputSchema.safeParse(
      baseOutput({ inferredProfile: { traits: { confidence: 0.8, mood: "heroic" } } }),
    );
    expect(result.success).toBe(true);
  });
});

describe("enforceWizardResponseLength", () => {
  it("accepts responses at the 1000 character limit", () => {
    expect(enforceWizardResponseLength(["x".repeat(1000)])).toEqual(["x".repeat(1000)]);
  });

  it("throws the in-character error when responses exceed 1000 characters", () => {
    expect(() => enforceWizardResponseLength(["x".repeat(1001)])).toThrow(WIZARD_RESPONSE_TOO_LONG_ERROR);
  });
});

describe("isAgentDataSchemaError", () => {
  it("matches an output-schema failure whose first invalid path is under agentData", () => {
    const error = new ModelBehaviorError(
      'Invalid output type: final assistant output failed schema validation at "agentData.inferredProfile" (Invalid input).',
    );
    expect(isAgentDataSchemaError(error)).toBe(true);
  });

  it("matches when agentData itself is the invalid path (no sub-key)", () => {
    const error = new ModelBehaviorError(
      'Invalid output type: final assistant output failed schema validation at "agentData" (Invalid input).',
    );
    expect(isAgentDataSchemaError(error)).toBe(true);
  });

  it("does not match an output-schema failure on an unrelated field like lines", () => {
    const error = new ModelBehaviorError(
      'Invalid output type: final assistant output failed schema validation at "lines" (Invalid input).',
    );
    expect(isAgentDataSchemaError(error)).toBe(false);
  });

  it("does not match a ModelBehaviorError unrelated to output schema (e.g. bad tool input)", () => {
    const error = new ModelBehaviorError("Agent tool called with invalid input");
    expect(isAgentDataSchemaError(error)).toBe(false);
  });

  it("does not match a non-ModelBehaviorError", () => {
    expect(isAgentDataSchemaError(new Error("boom"))).toBe(false);
  });
});

describe("first-turn recommendation context", () => {
  function request(overrides: Partial<WizardTurnRequest> = {}): WizardTurnRequest {
    return {
      sessionId: "test-session",
      command: "hello",
      state: initialWizardState,
      messages: [],
      ...overrides,
    };
  }

  it("does not serialize recommendation context before the first system question is answered", () => {
    const consumed = buildConsumedTurnContext(request(), {});

    expect(consumed).not.toHaveProperty("recommendationGate");
    expect(consumed).not.toHaveProperty("gamesAboveThreshold");
    expect(consumed).not.toHaveProperty("currentBestMatches");
    expect(consumed).not.toHaveProperty("suggestedNextQuestion");
  });

  it("serializes trans game contributor history for specific cultural requests", () => {
    const consumed = buildConsumedTurnContext(
      request({
        messages: [{ speaker: "wizard", text: "Greetings Gamer! What console are you questing on today?" }],
      }),
      {},
    );

    expect(consumed.transGameContributors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Danielle Bunten Berry",
          catalogGameIds: ["m-u-l-e"],
        }),
      ]),
    );
  });

  it("serializes recommendation context after the first wizard question", () => {
    const consumed = buildConsumedTurnContext(
      request({
        messages: [{ speaker: "wizard", text: "Greetings Gamer! What console are you questing on today?" }],
      }),
      {},
    );

    expect(consumed).toHaveProperty("recommendationGate");
    expect(consumed).toHaveProperty("gamesAboveThreshold");
    expect(consumed).toHaveProperty("currentBestMatches");
    expect(consumed).toHaveProperty("suggestedNextQuestion");
  });

  it("serializes exact title matches after a direct cartridge-name command", () => {
    const consumed = buildConsumedTurnContext(
      request({
        command: "Super Mario Bros.",
        state: { ...initialWizardState, enabledPlatforms: ["nes"] },
        messages: [{ speaker: "wizard", text: "Greetings Gamer! What console are you questing on today?" }],
      }),
      {},
    );

    expect(consumed.exactTitleMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "super-mario-bros",
          title: "Super Mario Bros.",
        }),
      ]),
    );
  });

  it("enforces the exact first-turn system question", () => {
    expect(ensureFirstTurnQuestion(["The screen warms."]).at(-1)).toBe(
      "Greetings Gamer! What console are you questing on today?",
    );
  });
});

describe("resolveShowcaseIds", () => {
  it("normalizes common model argument shapes before the showcase tool resolves ids", () => {
    expect(normalizeOpenGameShowcaseInput({ gameIds: " castlevania " })).toEqual(["castlevania"]);
    expect(normalizeOpenGameShowcaseInput({ gameId: "castlevania" })).toEqual(["castlevania"]);
    expect(normalizeOpenGameShowcaseInput({ ids: ["castlevania", "metroid-mother"] })).toEqual([
      "castlevania",
      "metroid-mother",
    ]);
  });

  it("drops ids that don't currently clear the reveal threshold", () => {
    const qualifying = qualifyingRecommendations(narrowProfile);
    expect(qualifying.length).toBeGreaterThan(0);
    const validId = qualifying[0].game.id;

    const result = resolveShowcaseIds(narrowProfile, [validId, "not-a-real-game-id"], catalogPlatforms);

    expect(result).toEqual([validId]);
  });

  it("auto-selects qualifying ids when the recommendation window is open", () => {
    const qualifying = qualifyingRecommendations(narrowProfile);
    expect(qualifying.length).toBeGreaterThan(0);
    expect(qualifying.length).toBeLessThanOrEqual(maxQualifyingRecommendations);

    const result = resolveAutomaticShowcaseIds(narrowProfile, [], catalogPlatforms);

    expect(result).toEqual(qualifying.map((recommendation) => recommendation.game.id));
  });

  it("returns an empty array when nothing supplied clears the threshold", () => {
    const result = resolveShowcaseIds(blankProfile, ["not-a-real-game-id"], catalogPlatforms);
    expect(result).toEqual([]);
  });

  it("falls back to top-scored best guesses when nothing clears the threshold", () => {
    // Four answered dimensions (enough signal), but the unmatchable keyword
    // caps every score well below the gate — the stuck-at-88% shape.
    const stuck = {
      ...blankProfile,
      name: "Ada",
      mood: "ominous" as const,
      playStyle: "puzzle" as const,
      difficulty: "casual" as const,
      keywords: ["zzz-unmatchable-keyword"],
    };
    expect(qualifyingRecommendations(stuck)).toHaveLength(0);
    const guesses = bestGuessRecommendations(stuck);
    expect(guesses.length).toBeGreaterThan(0);
    const bestId = guesses[0].game.id;

    const result = resolveShowcaseIds(stuck, [bestId, "not-a-real-game-id"], catalogPlatforms);

    expect(result).toEqual([bestId]);
  });

  it("refuses best guesses when the profile lacks enough signal", () => {
    // Nothing qualifies against a blank profile either, but with zero answered
    // dimensions there is nothing to guess from — the showcase stays shut.
    const anyRealId = bestGuessRecommendations({
      ...blankProfile,
      mood: "ominous" as const,
      playStyle: "puzzle" as const,
      difficulty: "casual" as const,
      keywords: ["zzz-unmatchable-keyword"],
    })[0].game.id;

    expect(resolveShowcaseIds(blankProfile, [anyRealId], catalogPlatforms)).toEqual([]);
  });

  it("returns an empty array while too many games still qualify (pool is ambiguous)", () => {
    // A lone matched dimension scores 100% (relative to what's been answered),
    // so this profile alone qualifies well more than 3 games — the pool is too
    // ambiguous to reveal, matching resolveRecommendations, which would strip
    // these games from the response anyway.
    const broad = { ...blankProfile, name: "Ada", mood: "weird" as const };
    const qualifying = qualifyingRecommendations(broad);
    expect(qualifying.length).toBeGreaterThan(maxQualifyingRecommendations);
    const ids = qualifying.slice(0, maxQualifyingRecommendations).map((recommendation) => recommendation.game.id);

    const result = resolveShowcaseIds(broad, ids, catalogPlatforms);

    expect(result).toEqual([]);
  });
});

describe("buildResponse showcase guard", () => {
  function output(overrides: Partial<ReturnType<typeof baseOutput>> = {}) {
    return {
      ...baseOutput({}),
      ...overrides,
    };
  }

  it("opens the showcase when the agent reveals valid ids but forgets the tool call", () => {
    const qualifying = qualifyingRecommendations(narrowProfile);
    const gameIds = qualifying.map((recommendation) => recommendation.game.id);

    const response = buildResponse(
      output({ revealed: true, recommendedGameIds: gameIds }),
      narrowProfile,
      [...catalogPlatforms],
      {},
    );

    expect(response.showcase?.games.map((recommendation) => recommendation.game.id)).toEqual(gameIds);
    expect(response.state.revealed).toBe(true);
  });

  it("opens the showcase from the qualifying gate when the model forgets both ids and the tool call", () => {
    const qualifying = qualifyingRecommendations(narrowProfile);
    const gameIds = qualifying.map((recommendation) => recommendation.game.id);

    const response = buildResponse(output(), narrowProfile, [...catalogPlatforms], {});

    expect(response.showcase?.games.map((recommendation) => recommendation.game.id)).toEqual(gameIds);
    expect(response.recommendations.map((recommendation) => recommendation.game.id)).toEqual(gameIds);
    expect(response.state.revealed).toBe(true);
  });

  it("opens the showcase from an exact title command even if the model keeps chatting", () => {
    const response = buildResponse(
      output({
        lines: ["A known cartridge glows."],
        revealed: false,
        recommendedGameIds: [],
      }),
      blankProfile,
      ["nes"],
      { command: "Super Mario Bros." },
    );

    expect(response.recommendations[0]?.game.id).toBe("super-mario-bros");
    expect(response.showcase?.games[0]?.game.id).toBe("super-mario-bros");
    expect(response.state.revealed).toBe(true);
  });
});
