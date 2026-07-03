import { describe, expect, it } from "vitest";
import { generatedNesGames, nesCatalogSource } from "@/data/nes-catalog.generated";

describe("generated NES catalog", () => {
  it("includes the broad Wikipedia cartridge catalog with source accounting", () => {
    expect(nesCatalogSource.sources.map((source) => source.url)).toEqual(
      expect.arrayContaining([
        "https://en.wikipedia.org/wiki/List_of_Nintendo_Entertainment_System_games",
        "https://en.wikipedia.org/wiki/List_of_Famicom_Disk_System_games",
      ]),
    );
    expect(nesCatalogSource.rowCount).toBe(generatedNesGames.length);
    expect(generatedNesGames.length).toBeGreaterThan(1_900);
    expect(nesCatalogSource.sourceCounts.licensed).toBeGreaterThan(1_300);
    expect(nesCatalogSource.sourceCounts["unlicensed-nes-lifespan"]).toBeGreaterThan(100);
    expect(nesCatalogSource.sourceCounts["unlicensed-famicom"]).toBeGreaterThan(100);
    expect(nesCatalogSource.sourceCounts["famicom-disk-system"]).toBeGreaterThan(190);
  });

  it("keeps canonical NES titles discoverable with release metadata", () => {
    expect(generatedNesGames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "super-mario-bros",
          title: "Super Mario Bros.",
          year: "1985",
          sourceCategory: "licensed",
          regions: expect.arrayContaining(["JP", "NA", "PAL"]),
        }),
        expect.objectContaining({
          id: "the-legend-of-zelda",
          title: "The Legend of Zelda",
          sourceCategory: "licensed",
        }),
        expect.objectContaining({
          id: "nintendo-world-championships-1990",
          title: "Nintendo World Championships 1990",
          sourceCategory: "championship",
        }),
        expect.objectContaining({
          id: "all-night-nippon-super-mario-bros",
          title: "All Night Nippon Super Mario Bros.",
          sourceCategory: "famicom-disk-system",
          regions: expect.arrayContaining(["FDS"]),
        }),
      ]),
    );
  });

  it("generates recommender metadata for every imported title", () => {
    for (const game of generatedNesGames) {
      expect(game.id).toMatch(/^[a-z0-9-]+$/);
      expect(game.title).not.toHaveLength(0);
      expect(game.platform).toBe("nes");
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
      expect(nesCatalogSource.sources.map((source) => source.url)).toContain(game.sourceUrl);
    }
  });
});
