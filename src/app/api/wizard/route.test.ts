import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/wizard/route";
import { initialWizardState } from "@/lib/wizard/types";

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
    expect(body.adapter).toBe("mock");
    expect(body.state.needsName).toBe(true);
    expect(body.lines.join(" ")).toContain("Tell me the name");
  });
});
