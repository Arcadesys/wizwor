import { describe, expect, it } from "vitest";
import { generatedAtari5200Games, atari5200CatalogSource } from "@/data/atari-5200-catalog.generated";
import { generatedAtari7800Games, atari7800CatalogSource } from "@/data/atari-7800-catalog.generated";
import { generatedGenesisGames, genesisCatalogSource } from "@/data/genesis-catalog.generated";
import { generatedNeoGeoGames, neoGeoCatalogSource } from "@/data/neo-geo-catalog.generated";
import { generatedPcEngineGames, pcEngineCatalogSource } from "@/data/pc-engine-catalog.generated";
import { generatedSmsGames, smsCatalogSource } from "@/data/sms-catalog.generated";
import type { Game, Platform } from "@/data/games";

type GeneratedGame = Omit<Game, "playthroughUrl"> & {
  sourceCategory: string;
  regions: string[];
  sourceUrl: string;
  signalScore: number;
};

const catalogCases: Array<{
  name: string;
  platform: Platform;
  games: GeneratedGame[];
  source: {
    rowCount: number;
    sourceCounts: Readonly<Record<string, number>>;
    sources: readonly { url: string }[];
  };
  rowFloor: number;
  sourceFloors: Record<string, number>;
  knownGames: Array<Partial<GeneratedGame>>;
}> = [
  {
    name: "Sega Master System",
    platform: "sms",
    games: generatedSmsGames,
    source: smsCatalogSource,
    rowFloor: 300,
    sourceFloors: { licensed: 300, compilation: 5 },
    knownGames: [
      { id: "alex-kidd-in-miracle-world", title: "Alex Kidd in Miracle World", year: "1986" },
      { id: "phantasy-star", title: "Phantasy Star", sourceCategory: "licensed" },
      { id: "sonic-the-hedgehog", title: "Sonic the Hedgehog", sourceCategory: "licensed" },
    ],
  },
  {
    name: "Atari 7800",
    platform: "atari-7800",
    games: generatedAtari7800Games,
    source: atari7800CatalogSource,
    rowFloor: 175,
    sourceFloors: { licensed: 50, homebrew: 20, modern: 20, prototype: 30 },
    knownGames: [
      { id: "asteroids", title: "Asteroids", year: "1986" },
      { id: "food-fight", title: "Food Fight", sourceCategory: "licensed" },
      { id: "ninja-golf", title: "Ninja Golf", sourceCategory: "licensed" },
    ],
  },
  {
    name: "Atari 5200",
    platform: "atari-5200",
    games: generatedAtari5200Games,
    source: atari5200CatalogSource,
    rowFloor: 95,
    sourceFloors: { licensed: 60, unreleased: 25 },
    knownGames: [
      { id: "pac-man", title: "Pac-Man", year: "1982" },
      { id: "star-raiders", title: "Star Raiders", sourceCategory: "licensed" },
      { id: "missile-command", title: "Missile Command", sourceCategory: "licensed" },
    ],
  },
  {
    name: "Sega Genesis/Mega Drive",
    platform: "genesis",
    games: generatedGenesisGames,
    source: genesisCatalogSource,
    rowFloor: 930,
    sourceFloors: { licensed: 850, compilation: 10, unlicensed: 45 },
    knownGames: [
      { id: "sonic-the-hedgehog", title: "Sonic the Hedgehog", year: "1991" },
      { id: "gunstar-heroes", title: "Gunstar Heroes", sourceCategory: "licensed" },
      { id: "phantasy-star-iv-the-end-of-the-millennium", title: "Phantasy Star IV: The End of the Millennium" },
    ],
  },
  {
    name: "PC Engine/TurboGrafx-16",
    platform: "pc-engine",
    games: generatedPcEngineGames,
    source: pcEngineCatalogSource,
    rowFloor: 730,
    sourceFloors: { licensed: 650, promotional: 8, unlicensed: 20, homebrew: 30 },
    knownGames: [
      { id: "bonk-s-adventure", title: "Bonk's Adventure", year: "1989" },
      { id: "bomberman-93", title: "Bomberman '93", sourceCategory: "licensed" },
      { id: "r-type", title: "R-Type", sourceCategory: "licensed" },
    ],
  },
  {
    name: "Neo Geo AES",
    platform: "neo-geo",
    games: generatedNeoGeoGames,
    source: neoGeoCatalogSource,
    rowFloor: 150,
    sourceFloors: { "aes-mvs": 150 },
    knownGames: [
      { id: "3-count-bout", title: "3 Count Bout", year: "1993" },
      { id: "metal-slug", title: "Metal Slug", sourceCategory: "aes-mvs" },
      { id: "the-king-of-fighters-94", title: "The King of Fighters '94", sourceCategory: "aes-mvs" },
    ],
  },
];

describe("generated 8-bit and 16-bit home console catalogs", () => {
  for (const catalog of catalogCases) {
    describe(catalog.name, () => {
      it("includes the expected Wikipedia catalog scale with source accounting", () => {
        expect(catalog.source.rowCount).toBe(catalog.games.length);
        expect(catalog.games.length).toBeGreaterThan(catalog.rowFloor);
        for (const [category, floor] of Object.entries(catalog.sourceFloors)) {
          expect(catalog.source.sourceCounts[category]).toBeGreaterThan(floor);
        }
      });

      it("keeps canonical titles discoverable with release metadata", () => {
        expect(catalog.games).toEqual(
          expect.arrayContaining(catalog.knownGames.map((game) => expect.objectContaining(game))),
        );
      });

      it("generates recommender metadata for every imported title", () => {
        for (const game of catalog.games) {
          expect(game.id).toMatch(/^[a-z0-9-]+$/);
          expect(game.title).not.toHaveLength(0);
          expect(game.platform).toBe(catalog.platform);
          expect(game.isRomhack).toBe(false);
          expect(game.signalScore).toBeGreaterThanOrEqual(0);
          expect(game.signalScore).toBeLessThanOrEqual(4);
          expect(game.pitch).toContain(game.title);
          expect(game.moods.length).toBeGreaterThan(0);
          expect(["casual", "fair", "difficult"]).toContain(game.difficulty);
          expect(["low", "some", "rich"]).toContain(game.story);
          expect(["side-scroller", "top-down", "action-adventure", "platformer", "puzzle"]).toContain(game.playStyle);
          expect(["classic", "hidden-gem", "strange"]).toContain(game.obscurity);
          expect(game.tags.length).toBeGreaterThan(0);
          expect(catalog.source.sources.map((source) => source.url)).toContain(game.sourceUrl);
        }
      });
    });
  }
});
