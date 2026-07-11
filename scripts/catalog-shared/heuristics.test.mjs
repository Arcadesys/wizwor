import { describe, expect, it } from "vitest";
import { collectMatchingTags, matchesAny, matchingRules, slugify, stableStringify, unique } from "./heuristics.mjs";
import { deriveSignalsFromGenre } from "./genre-taxonomy.mjs";
import { extractGenreField } from "./wikipedia-genre.mjs";

describe("matchesAny", () => {
  it("matches stem patterns as plain substrings", () => {
    expect(matchesAny("gunstar heroes treasure sega", ["gun"])).toBe(true);
    expect(matchesAny("trouble shooter vic tokai", ["shoot"])).toBe(true);
    expect(matchesAny("columns sega", ["gun", "shoot"])).toBe(false);
  });

  it("matches ys only as a whole word", () => {
    // "ys" is in EXACT_WORD_PATTERNS: it must catch the Ys franchise without
    // false-positiving on every string containing s-y-s (system, Arc System
    // Works, famicom-disk-system).
    expect(matchesAny("ys iii wanderers from ys", ["ys"])).toBe(true);
    expect(matchesAny("ys: book i & ii", ["ys"])).toBe(true);
    expect(matchesAny("arc system works", ["ys"])).toBe(false);
    expect(matchesAny("famicom-disk-system", ["ys"])).toBe(false);
    expect(matchesAny("crystalis", ["ys"])).toBe(false);
  });

  it("does not match when no pattern hits", () => {
    expect(matchesAny("sonic the hedgehog", ["ys", "dragon"])).toBe(false);
  });
});

describe("matchingRules / collectMatchingTags", () => {
  const rules = [
    { tag: "rpg", mood: "heroic", patterns: ["dragon", "ys"] },
    { tag: "shooter", mood: "arcade", patterns: ["shoot", "gun"] },
  ];

  it("returns every rule whose patterns match", () => {
    expect(matchingRules("dragon warrior gunfight", rules)).toHaveLength(2);
    expect(matchingRules("tetris", rules)).toHaveLength(0);
  });

  it("collects tags for matching rules only", () => {
    expect(collectMatchingTags("ys iii falcom", rules)).toEqual(["rpg"]);
    expect(collectMatchingTags("arc system works", rules)).toEqual([]);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Castlevania III: Dracula's Curse")).toBe("castlevania-iii-dracula-s-curse");
  });

  it("expands ampersands and strips accents", () => {
    expect(slugify("Ys: Book I & II")).toBe("ys-book-i-and-ii");
    expect(slugify("Pokémon")).toBe("pokemon");
  });

  it("trims leading/trailing separators and caps length", () => {
    expect(slugify("---Hello---")).toBe("hello");
    expect(slugify("x".repeat(120))).toHaveLength(80);
  });
});

describe("unique", () => {
  it("dedupes preserving first-seen order", () => {
    expect(unique(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });
});

describe("stableStringify", () => {
  it("sorts object keys recursively so output is order-independent", () => {
    const left = stableStringify({ b: 1, a: { d: 2, c: 3 } });
    const right = stableStringify({ a: { c: 3, d: 2 }, b: 1 });
    expect(left).toBe(right);
    expect(left.indexOf('"a"')).toBeLessThan(left.indexOf('"b"'));
  });

  it("preserves array order", () => {
    expect(stableStringify(["b", "a"])).toBe(JSON.stringify(["b", "a"], null, 2));
  });
});

describe("deriveSignalsFromGenre", () => {
  it("returns null for missing or unrecognized genre text", () => {
    expect(deriveSignalsFromGenre(null)).toBeNull();
    expect(deriveSignalsFromGenre("")).toBeNull();
    expect(deriveSignalsFromGenre("unrecognized nonsense")).toBeNull();
  });

  it("maps role-playing genres to rich story and action-adventure", () => {
    expect(deriveSignalsFromGenre("Role-playing")).toEqual({
      playStyle: "action-adventure",
      moods: ["heroic"],
      story: "rich",
      difficulty: null,
    });
  });

  it("maps platformers to arcade mood without story signal", () => {
    expect(deriveSignalsFromGenre("Platform game")).toEqual({
      playStyle: "platformer",
      moods: ["arcade"],
      story: null,
      difficulty: null,
    });
  });

  it("maps shoot 'em ups to difficult", () => {
    expect(deriveSignalsFromGenre("Shoot 'em up")).toMatchObject({ difficulty: "difficult" });
  });

  it("maps puzzle genres to casual and contemplative", () => {
    expect(deriveSignalsFromGenre("Puzzle")).toEqual({
      playStyle: "puzzle",
      moods: ["contemplative"],
      story: null,
      difficulty: "casual",
    });
  });
});

describe("extractGenreField", () => {
  it("returns null when the infobox has no genre field", () => {
    expect(extractGenreField("{{Infobox video game\n| developer = Sega\n}}")).toBeNull();
  });

  it("extracts a plain genre value", () => {
    expect(extractGenreField("| genre = Platform game\n")).toBe("Platform game");
  });

  it("unwraps wikilinks, refs, and templates", () => {
    const wikitext = "| genre = [[Action role-playing game|Action RPG]]<ref>cite</ref>{{efn|note}}\n";
    expect(extractGenreField(wikitext)).toBe("Action RPG");
  });

  it("unwraps bare wikilinks and collapses whitespace", () => {
    expect(extractGenreField("| genre = [[Shoot 'em up]],   [[Run and gun]]\n")).toBe("Shoot 'em up, Run and gun");
  });
});
