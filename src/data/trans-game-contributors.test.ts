import { describe, expect, it } from "vitest";
import { transGameContributors, transGameContributorsForAgent } from "@/data/trans-game-contributors";

describe("trans game contributors", () => {
  it("keeps the contributor ids unique and source-backed", () => {
    const seen = new Set<string>();

    for (const contributor of transGameContributors) {
      expect(seen.has(contributor.id)).toBe(false);
      seen.add(contributor.id);
      expect(contributor.sourceUrl).toMatch(/^https:\/\//);
      expect(contributor.notableWorks.length).toBeGreaterThan(0);
      expect(contributor.roles.length).toBeGreaterThan(0);
    }
  });

  it("links M.U.L.E. to Danielle Bunten Berry as a direct catalog match", () => {
    expect(transGameContributors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "danielle-bunten-berry",
          catalogGameIds: ["m-u-l-e"],
        }),
      ]),
    );
  });

  it("keeps caution flags available in the agent-facing index", () => {
    expect(transGameContributorsForAgent()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Christine Love",
          confidence: "needs-verification",
        }),
        expect.objectContaining({
          name: "Mia / Max Schwartz",
          confidence: "needs-verification",
        }),
      ]),
    );
  });
});
