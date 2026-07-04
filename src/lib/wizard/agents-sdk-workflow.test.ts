import { ModelBehaviorError } from "@openai/agents";
import { describe, expect, it } from "vitest";
import {
  buildResponse,
  buildConsumedTurnContext,
  ensureFirstTurnQuestion,
  isAgentDataSchemaError,
  resolveShowcaseIds,
  wizardAgentInstructions,
  WizardTurnOutputSchema,
} from "@/lib/wizard/agents-sdk-workflow";
import { catalogPlatforms } from "@/data/games";
import { maxQualifyingRecommendations, qualifyingRecommendations } from "@/lib/recommender";
import { blankProfile, initialWizardState, type WizardTurnRequest } from "@/lib/wizard/types";

function baseOutput(agentData: Record<string, unknown>) {
  return {
    lines: ["The circuits hum."],
    accepted: true,
    profile: {},
    revealed: false,
    recommendedGameIds: [],
    agentData,
  };
}

describe("wizard agent style instructions", () => {
  it("bans received-colon descriptor stack phrasing", () => {
    expect(wizardAgentInstructions).toContain("Never write inventory-stack sentences");
    expect(wizardAgentInstructions).toContain("Subject received: descriptor 1, descriptor 2, descriptor 3.");
    expect(wizardAgentInstructions).toContain("X received: A, B, C.");
  });

  it("binds recommendation intent to reveal ids and the showcase tool", () => {
    expect(wizardAgentInstructions).toContain("A recommendation is a mechanical contract");
    expect(wizardAgentInstructions).toContain("set revealed: true");
    expect(wizardAgentInstructions).toContain("recommendedGameIds");
    expect(wizardAgentInstructions).toContain("call open_game_showcase");
  });
});

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
          catalogGameIds: ["mule"],
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

  it("enforces the exact first-turn system question", () => {
    expect(ensureFirstTurnQuestion(["The screen warms."]).at(-1)).toBe(
      "Greetings Gamer! What console are you questing on today?",
    );
  });
});

describe("resolveShowcaseIds", () => {
  it("drops ids that don't currently clear the reveal threshold", () => {
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
    const validId = qualifying[0].game.id;

    const result = resolveShowcaseIds(profile, [validId, "not-a-real-game-id"], catalogPlatforms);

    expect(result).toEqual([validId]);
  });

  it("returns an empty array when nothing supplied clears the threshold", () => {
    const result = resolveShowcaseIds(blankProfile, ["not-a-real-game-id"], catalogPlatforms);
    expect(result).toEqual([]);
  });

  it("caps the result at maxQualifyingRecommendations even if more valid ids are supplied", () => {
    // A lone matched dimension scores 100% (relative to what's been answered),
    // so this profile alone qualifies well more than 3 games — see the matching
    // case in recommender.test.ts.
    const broad = { ...blankProfile, name: "Ada", mood: "weird" as const };
    const qualifying = qualifyingRecommendations(broad);
    expect(qualifying.length).toBeGreaterThan(maxQualifyingRecommendations);
    const ids = qualifying.map((recommendation) => recommendation.game.id);

    const result = resolveShowcaseIds(broad, ids, catalogPlatforms);

    expect(result).toEqual(ids.slice(0, maxQualifyingRecommendations));
  });
});

describe("buildResponse showcase contract", () => {
  const castlevaniaProfile = {
    ...blankProfile,
    mood: "ominous" as const,
    playStyle: "side-scroller" as const,
    difficulty: "difficult" as const,
    story: "some" as const,
    keywords: ["gothic", "branching paths"],
  };

  it("falls back to resolved recommendations when the agent skipped the showcase tool", () => {
    const response = buildResponse(
      {
        lines: ["Castlevania III is the hardest clean signal."],
        accepted: true,
        profile: {},
        revealed: true,
        recommendedGameIds: ["castlevania-iii"],
        agentData: {},
      },
      castlevaniaProfile,
      ["nes"],
      {},
      true,
      null,
    );

    expect(response.recommendations[0]?.game.title).toBe("Castlevania III: Dracula's Curse");
    expect(response.showcase?.games[0]?.game.title).toBe("Castlevania III: Dracula's Curse");
    expect(response.agentData?.generated.recommendationToolMismatch).toBe(true);
  });

  it("does not render a showcase when the recommended id is not valid", () => {
    const response = buildResponse(
      {
        lines: ["A false cartridge flickers."],
        accepted: true,
        profile: {},
        revealed: true,
        recommendedGameIds: ["not-a-real-game-id"],
        agentData: {},
      },
      castlevaniaProfile,
      ["nes"],
      {},
      true,
      null,
    );

    expect(response.recommendations).toEqual([]);
    expect(response.showcase).toBeNull();
    expect(response.agentData?.generated.recommendationToolMismatch).toBeUndefined();
  });
});
