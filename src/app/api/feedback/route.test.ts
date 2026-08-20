import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/feedback/route";

function jsonRequest(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

describe("POST /api/feedback", () => {
  it("hashes the session id and drops the player name from logs", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await POST(jsonRequest({
      sessionId: "session-private-value",
      rating: "nailed",
      profile: { name: "Ada", mood: "ominous" },
      recommendations: [],
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    const logged = String(consoleLog.mock.calls[0]?.[0]);
    expect(logged).toContain("sessionHash");
    expect(logged).toContain("ominous");
    expect(logged).not.toContain("session-private-value");
    expect(logged).not.toContain("Ada");
    consoleLog.mockRestore();
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(jsonRequest(
      { sessionId: "session", rating: "nailed" },
      "https://attacker.example",
    ));
    expect(response.status).toBe(403);
  });
});
