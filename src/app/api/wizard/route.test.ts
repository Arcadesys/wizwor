import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/wizard/route";
import { initialWizardState } from "@/lib/wizard/types";

const { runTurn } = vi.hoisted(() => ({
  runTurn: vi.fn(),
}));

vi.mock("@/lib/wizard/runtime", () => ({
  getWizardAgent: () => ({
    runTurn,
  }),
}));

describe("POST /api/wizard", () => {
  beforeEach(() => {
    runTurn.mockResolvedValue({
      adapter: "chatgpt",
      accepted: true,
      lines: ["The live agent answers."],
      recommendations: [],
      suggestions: [],
      state: {
        ...initialWizardState,
        started: true,
      },
      showcase: null,
    });
  });

  it("validates the contract", async () => {
    const response = await POST(new Request("http://localhost/api/wizard", { method: "POST", body: "{}" }));
    expect(response.status).toBe(400);
  });

  it("returns a wizard turn response", async () => {
    const response = await POST(
      new Request("http://localhost/api/wizard", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "route-test",
          command: "",
          state: initialWizardState,
          messages: [],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.adapter).toBe("chatgpt");
    expect(body.state.started).toBe(true);
    expect(body.lines.join(" ")).toContain("live agent");
  });

  it("passes showcase games through for the preview modal", async () => {
    runTurn.mockResolvedValueOnce({
      adapter: "chatgpt",
      accepted: true,
      lines: ["Castlevania III is the hardest clean signal."],
      recommendations: [],
      suggestions: [],
      state: {
        ...initialWizardState,
        started: true,
        revealed: true,
      },
      showcase: {
        games: [
          {
            game: {
              id: "castlevania-iii",
              title: "Castlevania III: Dracula's Curse",
            },
            score: 0.97,
            reasons: ["gothic pressure"],
          },
        ],
      },
    });

    const response = await POST(
      new Request("http://localhost/api/wizard", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "route-showcase-test",
          command: "yes please",
          state: initialWizardState,
          messages: [],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.showcase.games[0].game.title).toBe("Castlevania III: Dracula's Curse");
  });
});
