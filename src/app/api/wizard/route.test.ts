import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/wizard/route";
import { initialWizardState } from "@/lib/wizard/types";

vi.mock("@/lib/wizard/runtime", () => ({
  runWizardTurn: vi.fn(async () => ({
    adapter: "chatgpt",
    accepted: true,
    lines: ["The live agent answers."],
    recommendations: [],
    suggestions: [],
    state: {
      ...initialWizardState,
      started: true,
    },
  })),
}));

describe("POST /api/wizard", () => {
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
});
