import { describe, expect, it } from "vitest";
import { WizardTurnOutputSchema } from "@/lib/wizard/agents-sdk-workflow";

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
