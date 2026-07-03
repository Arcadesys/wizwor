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
  it("asks for a name, extracts preferences, and reveals once the rubric clears the qualifying bar", async () => {
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

  it("captures an incidental preference signal even when it doesn't answer the active question", async () => {
    const named = await turn(initialWizardState, "");
    const mood = await turn(named.state, "Ada");
    expect(mood.state.activeQuestionKey).toBe("mood");

    const response = await turn(mood.state, "I want to play the best board game the console ever created.");

    expect(response.accepted).toBe(true);
    expect(response.state.profile.playStyle).toBe("puzzle");
    expect(response.state.activeQuestionKey).toBe("mood");
  });

  it("skips the whole questionnaire when the first reply already states a full clear plan", async () => {
    const started = await turn(initialWizardState, "");
    expect(started.state.needsName).toBe(true);

    const response = await turn(
      started.state,
      "I'm Joanne and I want something ominous, puzzle-like, and fairly difficult, with rich story.",
    );

    expect(response.accepted).toBe(true);
    expect(response.state.profile).toMatchObject({
      name: "Joanne",
      mood: "ominous",
      playStyle: "puzzle",
      difficulty: "difficult",
      story: "rich",
    });
    expect(response.state.revealed).toBe(true);
  });

  it("does not swallow the whole naming reply when it also carries a preference signal", async () => {
    const started = await turn(initialWizardState, "");
    const response = await turn(started.state, "Marcus, I'm after a heroic side-scroller.");

    expect(response.state.profile.name).toBe("Marcus");
    expect(response.state.profile.mood).toBe("heroic");
    expect(response.state.profile.playStyle).toBe("side-scroller");
  });

  async function revealAda() {
    let response = await turn(initialWizardState, "");
    response = await turn(response.state, "Ada");
    response = await turn(response.state, "ominous");
    response = await turn(response.state, "top down");
    response = await turn(response.state, "fair");
    response = await turn(response.state, "some story");
    expect(response.state.revealed).toBe(true);
    return response;
  }

  it("keeps offering leftover questions after revealing instead of ending the conversation", async () => {
    const revealed = await revealAda();
    expect(revealed.state.activeQuestionKey).toBe("obscurity");
    expect(revealed.recommendations.length).toBeGreaterThan(0);

    const refined = await turn(revealed.state, "classic");

    expect(refined.accepted).toBe(true);
    expect(refined.state.profile.obscurity).toBe("classic");
    expect(refined.state.profile.romhack).toBeUndefined();
  });

  it("accepts a revision to an already-answered trait once everything is answered, instead of dead-ending", async () => {
    let response = await revealAda();
    response = await turn(response.state, "classic");
    response = await turn(response.state, "no hacks");
    expect(response.state.activeQuestionKey).toBeNull();
    expect(response.state.awaitingFocus).toBe(false);

    const revised = await turn(response.state, "actually, make it easier");

    expect(revised.accepted).toBe(true);
    expect(revised.state.profile.difficulty).toBe("casual");
    expect(revised.lines.join(" ")).toContain("Reshaping the reading");
  });

  it("invites further refinement instead of dead-ending when a fully-answered reply doesn't match any trait", async () => {
    let response = await revealAda();
    response = await turn(response.state, "classic");
    response = await turn(response.state, "no hacks");

    const idle = await turn(response.state, "asdkjqwoieqwoie");

    expect(idle.accepted).toBe(true);
    expect(idle.state.profile).toEqual(response.state.profile);
    expect(idle.lines.join(" ")).toContain("reshape the reading");
  });
});
