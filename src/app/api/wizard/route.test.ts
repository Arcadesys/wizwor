import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/wizard/route";
import { runWizardTurn } from "@/lib/wizard/runtime";
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

function jsonRequest(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/wizard", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/wizard", () => {
  it("validates the contract", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });

  it("rejects cross-origin calls before invoking the agent", async () => {
    const response = await POST(jsonRequest({ sessionId: "test", command: "" }, "https://attacker.example"));

    expect(response.status).toBe(403);
    expect(runWizardTurn).not.toHaveBeenCalled();
  });

  it("accepts the public host forwarded by a deployment proxy", async () => {
    const request = jsonRequest({
      sessionId: "route-test",
      command: "",
      state: initialWizardState,
      messages: [],
    }, "https://wizwor.vercel.app");
    request.headers.set("X-Forwarded-Host", "wizwor.vercel.app");
    request.headers.set("X-Forwarded-Proto", "https");

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  it("rejects oversized requests", async () => {
    const response = await POST(jsonRequest({
      sessionId: "test",
      command: "x".repeat(70 * 1024),
    }));

    expect(response.status).toBe(413);
  });

  it("rejects prototype-pollution profile keys", async () => {
    const response = await POST(jsonRequest({
      sessionId: "test",
      command: "hello",
      state: { profile: { prototype: "polluted" } },
    }));

    expect(response.status).toBe(400);
  });

  it("returns a wizard turn response", async () => {
    const response = await POST(jsonRequest({
      sessionId: "route-test",
      command: "",
      state: initialWizardState,
      messages: [],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(body.adapter).toBe("chatgpt");
    expect(body.state.started).toBe(true);
    expect(body.lines.join(" ")).toContain("live agent");
  });

  it("does not reflect internal errors to the client", async () => {
    vi.mocked(runWizardTurn).mockRejectedValueOnce(new Error("internal sk-not-a-real-secret-value"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(jsonRequest({
      sessionId: "route-test",
      command: "hello",
      state: initialWizardState,
      messages: [],
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Wizard service is temporarily unavailable.");
    expect(JSON.stringify(body)).not.toContain("sk-not-a-real-secret-value");
    expect(consoleError).toHaveBeenCalledWith(expect.not.stringContaining("sk-not-a-real-secret-value"));
    consoleError.mockRestore();
  });
});
