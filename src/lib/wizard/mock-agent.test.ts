import { describe, expect, it } from "vitest";
import { mockWizardAgent } from "@/lib/wizard/mock-agent";
import { initialWizardState, type WizardState } from "@/lib/wizard/types";

async function turn(state: WizardState, command: string) {
  const response = await mockWizardAgent.runTurn({
    sessionId: "test-session",
    command,
    state,
    messages: [],
  });
  return response;
}

describe("mockWizardAgent", () => {
  it("asks for a name, extracts preferences, and reveals once the rubric clears 90%", async () => {
    let response = await turn(initialWizardState, "");
    expect(response.state.needsName).toBe(true);
    expect(response.lines.join(" ")).toContain("Tell me the name");

    response = await turn(response.state, "Ada");
    expect(response.state.profile.name).toBe("Ada");
    expect(response.state.activeQuestionKey).toBe("mood");

    response = await turn(response.state, "ominous");
    expect(response.state.profile.mood).toBe("ominous");

    response = await turn(response.state, "top down");
    expect(response.state.profile.playStyle).toBe("top-down");

    response = await turn(response.state, "fair");
    expect(response.state.profile.difficulty).toBe("fair");

    response = await turn(response.state, "some story");
    expect(response.state.revealed).toBe(true);
    expect(response.recommendations).toHaveLength(3);
    expect(response.recommendations[0].score).toBeGreaterThanOrEqual(0.9);
  });

  it("rejects invalid preference answers without changing the active question", async () => {
    const named = await turn(initialWizardState, "");
    const mood = await turn(named.state, "Ada");
    const rejected = await turn(mood.state, "make it taste like static");

    expect(rejected.accepted).toBe(false);
    expect(rejected.state.activeQuestionKey).toBe("mood");
  });
});
