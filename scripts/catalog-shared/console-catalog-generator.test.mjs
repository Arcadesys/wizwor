import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateConsoleCatalog } from "./console-catalog-generator.mjs";

// Runs the full parse → normalize → derive pipeline against a small fixture
// page instead of live Wikipedia, so the generator's machinery (cell parsing,
// region logic, id dedup, heuristic scoring, output emission) is covered
// deterministically. This is the offline substitute for a CI regen-diff,
// which live fetching makes impossible.

const FIXTURE_URL = "https://example.test/mini-console";

const config = {
  difficultSignals: ["dragon sword"],
  casualSignals: ["puzzle"],
  richStorySignals: ["ancient saga"],
  someStorySignals: ["ghost"],
  playStyleRules: [
    { playStyle: "puzzle", tags: ["puzzle"], patterns: ["puzzle", "blocks"] },
  ],
  tagRules: [
    { tag: "horror", patterns: ["ghost"] },
  ],
  moodRules: [
    { mood: "ominous", patterns: ["dragon", "ghost"] },
    { mood: "contemplative", patterns: ["puzzle"] },
  ],
  scriptName: "scripts/generate-mini-catalog.mjs",
  platform: "mini",
  platformLabel: "Mini Console",
  typePrefix: "Mini",
  sourceExportName: "miniCatalogSource",
  gamesExportName: "generatedMiniGames",
  sourceName: "Fixture mini-console tables",
  sources: [{ name: "Fixture: mini console list", url: FIXTURE_URL }],
  sourceTables: [
    {
      url: FIXTURE_URL,
      index: 0,
      category: "licensed",
      minCells: 6,
      columns: {
        title: 0,
        developer: 1,
        publisher: 2,
        date: 3,
        dates: [
          { region: "JP", index: 4 },
          { region: "NA", index: 5 },
          { region: "PAL", index: 6 },
        ],
      },
    },
    {
      url: FIXTURE_URL,
      index: 1,
      category: "homebrew",
      minCells: 3,
      fallbackRegions: ["unlicensed"],
      columns: {
        title: 0,
        publisher: 1,
        date: 2,
        regions: 3,
      },
    },
  ],
  skipTitlePatterns: [/^region header$/i],
  regionLabels: { JP: "Japan", NA: "North America", PAL: "Europe/PAL", unlicensed: "Unlicensed" },
  classicTitles: new Set(["Puzzle Palace"]),
  categoryTags: { homebrew: ["homebrew"] },
  categoryPhrases: { homebrew: "a homebrew release" },
  defaultCategoryPhrase: (entry) =>
    entry.regions.includes("JP") && !entry.regions.includes("NA") ? "a Japan-first release" : "a Mini Console release",
  strangeCategories: ["homebrew"],
  outputPath: { pathname: "unused-in-tests" },
};

const fixturePath = path.join(process.cwd(), "scripts/catalog-shared/__fixtures__/mini-console.html");

async function runFixtureCatalog({ genres = new Map() } = {}) {
  const written = [];
  const fixtureHtml = await readFile(fixturePath, "utf8");
  const result = await generateConsoleCatalog(config, {
    fetchHtml: async (url) => {
      expect(url).toBe(FIXTURE_URL);
      return fixtureHtml;
    },
    fetchGenres: async () => genres,
    writeOutput: async (path, contents) => {
      written.push({ path, contents });
    },
  });
  return { ...result, written };
}

describe("generateConsoleCatalog against the fixture page", () => {
  it("parses rows, skips headers and skip-pattern titles, and dedupes ids", async () => {
    const { entries, sourceCounts } = await runFixtureCatalog();

    expect(sourceCounts).toEqual({ licensed: 3, homebrew: 2 });
    expect(entries.map((entry) => entry.id)).toEqual([
      "dragon-sword",
      "dragon-sword-licensed-rerelease-co",
      "lost-cart",
      "midnight-ghost",
      "puzzle-palace",
    ]);
  });

  it("extracts linked titles with footnotes stripped and reads regions from date columns", async () => {
    const { entries } = await runFixtureCatalog();
    const dragonSword = entries.find((entry) => entry.id === "dragon-sword");

    expect(dragonSword.title).toBe("Dragon Sword");
    expect(dragonSword.developer).toEqual(["Testsoft"]);
    expect(dragonSword.publisher).toEqual(["Test Publishing"]);
    expect(dragonSword.regions).toEqual(["JP"]);
    expect(dragonSword.year).toBe("1990");
    // JP-only + the config's defaultCategoryPhrase → Japan-first pitch.
    expect(dragonSword.pitch).toContain("a Japan-first release");
    expect(dragonSword.difficulty).toBe("difficult");
    expect(dragonSword.moods).toContain("ominous");
  });

  it("applies fallbackRegions when the region cell is empty", async () => {
    const { entries } = await runFixtureCatalog();
    const lostCart = entries.find((entry) => entry.id === "lost-cart");
    const midnightGhost = entries.find((entry) => entry.id === "midnight-ghost");

    expect(lostCart.regions).toEqual(["unlicensed"]);
    expect(midnightGhost.regions).toEqual(["NA", "PAL"]);
    expect(midnightGhost.tags).toContain("homebrew");
    expect(midnightGhost.pitch).toContain("a homebrew release");
    expect(midnightGhost.obscurity).toBe("strange");
  });

  it("classifies classics and matches heuristic vocabulary", async () => {
    const { entries } = await runFixtureCatalog();
    const puzzlePalace = entries.find((entry) => entry.id === "puzzle-palace");

    expect(puzzlePalace.obscurity).toBe("classic");
    expect(puzzlePalace.playStyle).toBe("puzzle");
    expect(puzzlePalace.difficulty).toBe("casual");
    expect(puzzlePalace.moods).toContain("contemplative");
    expect(puzzlePalace.tags).toContain("puzzle");
  });

  it("prefers real Wikipedia genre signal over franchise-name heuristics", async () => {
    const { entries } = await runFixtureCatalog({
      genres: new Map([["Dragon Sword", "Role-playing"]]),
    });
    const dragonSword = entries.find((entry) => entry.id === "dragon-sword");

    expect(dragonSword.story).toBe("rich");
    expect(dragonSword.playStyle).toBe("action-adventure");
    expect(dragonSword.moods).toContain("heroic");
  });

  it("emits a TypeScript module with the configured export names", async () => {
    const { written } = await runFixtureCatalog();

    expect(written).toHaveLength(1);
    const { contents } = written[0];
    expect(contents).toContain("export const generatedMiniGames: MiniCatalogGame[]");
    expect(contents).toContain("export const miniCatalogSource");
    expect(contents).toContain('export type MiniCatalogSourceCategory = "licensed" | "homebrew";');
    expect(contents).not.toContain('"generatedAt"');
  });
});
