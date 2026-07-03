import { describe, expect, it } from "vitest";
import { generatedSnesGames, snesCatalogSource } from "@/data/snes-catalog.generated";

describe("generated SNES catalog", () => {
  it("includes the broad Wikipedia SNES catalog with source accounting", () => {
    expect(snesCatalogSource.sources.map((source) => source.url)).toEqual([
      "https://en.wikipedia.org/wiki/List_of_Super_Nintendo_Entertainment_System_games",
    ]);
    expect(snesCatalogSource.rowCount).toBe(generatedSnesGames.length);
    expect(generatedSnesGames.length).toBeGreaterThan(1_750);
    expect(snesCatalogSource.sourceCounts.licensed).toBeGreaterThan(1_700);
    expect(snesCatalogSource.sourceCounts.homebrew).toBeGreaterThan(40);
  });

  it("keeps canonical SNES titles discoverable with release metadata", () => {
    expect(generatedSnesGames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "super-mario-world",
          title: "Super Mario World",
          year: "1990",
          sourceCategory: "licensed",
          regions: expect.arrayContaining(["JP", "NA", "PAL"]),
        }),
        expect.objectContaining({
          id: "the-legend-of-zelda-a-link-to-the-past",
          title: "The Legend of Zelda: A Link to the Past",
          sourceCategory: "licensed",
        }),
        expect.objectContaining({
          id: "chrono-trigger",
          title: "Chrono Trigger",
          sourceCategory: "licensed",
        }),
        expect.objectContaining({
          id: "donkey-kong-country-blockbuster-world-video-game-championship-ii",
          title: "Donkey Kong Country: Blockbuster World Video Game Championship II",
          sourceCategory: "competition",
        }),
      ]),
    );
  });

  it("generates recommender metadata for every imported title", () => {
    for (const game of generatedSnesGames) {
      expect(game.id).toMatch(/^[a-z0-9-]+$/);
      expect(game.title).not.toHaveLength(0);
      expect(game.platform).toBe("snes");
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
      expect(snesCatalogSource.sources.map((source) => source.url)).toContain(game.sourceUrl);
    }
  });
});
