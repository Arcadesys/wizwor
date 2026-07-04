import { describe, expect, it } from "vitest";
import { getAllGames } from "@/lib/game-repository";
import { catalogPlatforms, games } from "@/data/games";
import { generatedAtari5200Games } from "@/data/atari-5200-catalog.generated";
import { generatedAtari7800Games } from "@/data/atari-7800-catalog.generated";
import { generatedGenesisGames } from "@/data/genesis-catalog.generated";
import { generatedNeoGeoGames } from "@/data/neo-geo-catalog.generated";
import { generatedNesGames } from "@/data/nes-catalog.generated";
import { generatedPcEngineGames } from "@/data/pc-engine-catalog.generated";
import { generatedSmsGames } from "@/data/sms-catalog.generated";
import { generatedSnesGames } from "@/data/snes-catalog.generated";

const generatedCatalogs = [
  generatedNesGames,
  generatedSmsGames,
  generatedAtari7800Games,
  generatedAtari5200Games,
  generatedSnesGames,
  generatedGenesisGames,
  generatedPcEngineGames,
  generatedNeoGeoGames,
];

describe("game repository", () => {
  it("filters out low-signal generated entries instead of merging the whole catalog wholesale", () => {
    const merged = getAllGames();
    expect(merged.length).toBeGreaterThan(games.length);
    expect(merged.length).toBeLessThan(
      games.length + generatedCatalogs.reduce((sum, catalog) => sum + catalog.length, 0),
    );
  });

  it("excludes generated homebrew entries from the live recommendation catalog", () => {
    const homebrewIds = new Set(
      generatedCatalogs.flat().filter((game) => game.sourceCategory === "homebrew").map((game) => game.id),
    );
    expect(homebrewIds.size).toBeGreaterThan(0);
    expect(getAllGames().some((game) => homebrewIds.has(game.id))).toBe(false);
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

  it("filters the scored catalog to enabled platforms before callers rank games", () => {
    for (const platform of catalogPlatforms) {
      const platformGames = getAllGames({ enabledPlatforms: [platform] });
      if (platform !== "romhack") {
        expect(platformGames.length).toBeGreaterThan(0);
      }
      expect(platformGames.every((game) => game.platform === platform)).toBe(true);
    }
    expect(getAllGames({ enabledPlatforms: ["nes", "romhack"] }).some((game) => game.platform === "snes")).toBe(false);
    expect(getAllGames({ enabledPlatforms: [] })).toEqual([]);
  });
});
