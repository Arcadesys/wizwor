import { describe, expect, it } from "vitest";
import { getAllGames } from "@/lib/game-repository";
import { games } from "@/data/games";
import { generatedNesGames } from "@/data/nes-catalog.generated";

describe("game repository", () => {
  it("filters out low-signal generated entries instead of merging the whole catalog wholesale", () => {
    const merged = getAllGames();
    expect(merged.length).toBeGreaterThan(games.length);
    expect(merged.length).toBeLessThan(games.length + generatedNesGames.length);
  });

  it("never surfaces two games with the same normalized title", () => {
    const merged = getAllGames();
    const seen = new Set<string>();
    for (const game of merged) {
      const key = game.title.trim().toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
