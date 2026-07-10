import { writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { collectMatchingTags, matchingRules, matchesAny, slugify, stableStringify, unique } from "./catalog-shared/heuristics.mjs";
import { fetchGenreMap } from "./catalog-shared/wikipedia-genre.mjs";
import { deriveSignalsFromGenre } from "./catalog-shared/genre-taxonomy.mjs";

const sourceUrl = "https://en.wikipedia.org/wiki/List_of_Super_Nintendo_Entertainment_System_games";
const outputPath = new URL("../src/data/snes-catalog.generated.ts", import.meta.url);

const sourceTables = [
  { url: sourceUrl, index: 0, category: "licensed", format: "regional-dates" },
  { url: sourceUrl, index: 1, category: "promotional", format: "developer-promoter-date" },
  { url: sourceUrl, index: 2, category: "competition", format: "developer-date" },
  { url: sourceUrl, index: 5, category: "homebrew", format: "publisher-date-regions" },
  { url: sourceUrl, index: 6, category: "unlicensed", format: "publisher-jp-date" },
];

const classicTitles = new Set([
  "Chrono Trigger",
  "Contra III: The Alien Wars",
  "Donkey Kong Country",
  "Donkey Kong Country 2: Diddy's Kong Quest",
  "EarthBound",
  "F-Zero",
  "Final Fantasy II",
  "Final Fantasy III",
  "Kirby Super Star",
  "Mega Man X",
  "Secret of Mana",
  "Star Fox",
  "Street Fighter II",
  "Super Castlevania IV",
  "Super Mario All-Stars",
  "Super Mario Kart",
  "Super Mario RPG",
  "Super Mario World",
  "Super Metroid",
  "The Legend of Zelda: A Link to the Past",
  "Yoshi's Island",
]);

const difficultSignals = [
  "actraiser",
  "battletoads",
  "castlevania",
  "contra",
  "demon's crest",
  "ghouls",
  "gradius",
  "hagane",
  "mega man",
  "ninja gaiden",
  "r-type",
  "super star wars",
  "un squadron",
];

const casualSignals = [
  "barbie",
  "casino",
  "chess",
  "fishing",
  "golf",
  "jeopardy",
  "kirby",
  "mahjong",
  "monopoly",
  "pachi",
  "pinball",
  "simcity",
  "solitaire",
  "tetris",
  "wheel of fortune",
  "yoshi",
];

const richStorySignals = [
  "breath of fire",
  "chrono",
  "dragon quest",
  "earthbound",
  "final fantasy",
  "fire emblem",
  "lufia",
  "ogre battle",
  "romancing saga",
  "secret of evermore",
  "secret of mana",
  "shin megami tensei",
  "star ocean",
  "tales of phantasia",
  "ultima",
];

const someStorySignals = [
  "adventure",
  "batman",
  "castlevania",
  "demon",
  "donkey kong country",
  "dragon ball",
  "gaiden",
  "godzilla",
  "gundam",
  "indiana jones",
  "jurassic park",
  "legend",
  "metroid",
  "ninja",
  "quest",
  "robocop",
  "shadowrun",
  "star wars",
  "zelda",
];

const playStyleRules = [
  {
    playStyle: "puzzle",
    tags: ["puzzle"],
    patterns: ["arkanoid", "bust-a-move", "chess", "lolo", "mahjong", "othello", "picross", "puyo", "puzzle", "shogi", "sokoban", "sudoku", "tetris"],
  },
  {
    playStyle: "action-adventure",
    tags: ["adventure"],
    patterns: ["actraiser", "adventure", "breath of fire", "chrono", "dragon quest", "earthbound", "final fantasy", "illusion of gaia", "mana", "metroid", "quest", "rpg", "secret of evermore", "shadowrun", "ultima", "zelda"],
  },
  {
    playStyle: "top-down",
    tags: ["overhead"],
    patterns: ["baseball", "basketball", "bomberman", "football", "golf", "hockey", "ogre battle", "soccer", "strategy", "tennis", "volleyball", "war"],
  },
  {
    playStyle: "platformer",
    tags: ["platformer"],
    patterns: ["bonk", "bubsy", "castlevania", "donkey kong country", "earthworm jim", "kirby", "mega man", "mickey", "mario", "pac-in-time", "pitfall", "sonic", "sparkster", "wario", "yoshi"],
  },
];

const tagRules = [
  { tag: "sports", patterns: ["baseball", "basketball", "boxing", "football", "golf", "hockey", "olympic", "soccer", "tennis", "volleyball", "wrestl"] },
  { tag: "racing", patterns: ["f-zero", "formula", "grand prix", "kart", "racer", "racing", "speedway"] },
  { tag: "shooter", patterns: ["aero fighters", "contra", "gradius", "gun", "r-type", "shoot", "star fox", "strike gunner", "super scope", "u.n. squadron"] },
  { tag: "licensed character", patterns: ["addams", "batman", "bugs bunny", "captain america", "disney", "dragon ball", "flintstones", "godzilla", "mickey", "ninja turtles", "robocop", "simpsons", "star wars", "superman", "x-men"] },
  { tag: "board and card", patterns: ["blackjack", "casino", "chess", "mahjong", "monopoly", "poker", "shogi", "solitaire"] },
  { tag: "rpg", patterns: richStorySignals },
  { tag: "horror", patterns: ["castlevania", "demon", "dracula", "ghost", "ghoul", "horror", "monster", "nightmare", "zombie"] },
  { tag: "strategy", patterns: ["a-train", "civilization", "nobunaga", "ogre battle", "romance of the three kingdoms", "simcity", "strategy"] },
  { tag: "arcade port", patterns: ["arkanoid", "bubble bobble", "final fight", "gradius", "mortal kombat", "pac-man", "street fighter", "turtles in time"] },
];

const moodRules = [
  { mood: "ominous", patterns: ["alien", "castle", "castlevania", "dark", "dead", "demon", "devil", "doom", "dragon", "ghost", "ghoul", "horror", "monster", "nightmare", "shadow", "zombie"] },
  { mood: "heroic", patterns: ["actraiser", "adventure", "batman", "captain", "chrono", "final fantasy", "gaiden", "hero", "legend", "mana", "ninja", "quest", "star wars", "warrior", "zelda"] },
  { mood: "weird", patterns: ["bubsy", "clayfighter", "earthbound", "earthworm", "fantasy", "kirby", "magic", "mutant", "parodius", "ren and stimpy", "sparkster", "super bonk", "toe jam"] },
  { mood: "arcade", patterns: ["arcade", "baseball", "battle", "bomberman", "contra", "donkey kong", "f-zero", "final fight", "kart", "pac-man", "pinball", "racing", "sports", "street fighter", "tetris"] },
  { mood: "contemplative", patterns: ["a-train", "chess", "civilization", "mahjong", "mystery", "ogre battle", "othello", "picross", "puzzle", "shadowrun", "shogi", "simcity", "solitaire"] },
];

const regionLabels = {
  JP: "Japan",
  NA: "North America",
  PAL: "Europe/PAL",
  homebrew: "Homebrew",
  unlicensed: "Unlicensed",
  promotional: "Promotional",
};

async function main() {
  const generatedAt = new Date().toISOString();
  const html = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "wizwor-catalog-generator/1.0 (local development script)",
    },
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch source ${sourceUrl}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  });
  const document = new JSDOM(html).window.document;
  const tables = [...document.querySelectorAll("table.wikitable")];
  const parsedById = new Map();

  for (const tableSource of sourceTables) {
    const table = tables[tableSource.index];
    if (!table) {
      throw new Error(`Expected source table ${tableSource.index} for ${tableSource.category}`);
    }
    for (const row of [...table.querySelectorAll("tr")].slice(1)) {
      const entry = parseRow(row, tableSource);
      if (!entry) {
        continue;
      }
      let id = slugify(entry.title);
      if (parsedById.has(id)) {
        const baseId = slugify(`${entry.title}-${entry.sourceCategory}-${entry.publisher.join("-") || entry.year}`);
        id = baseId;
        let counter = 2;
        while (parsedById.has(id)) {
          id = `${baseId}-${counter}`;
          counter++;
        }
      }
      parsedById.set(id, { id, entry });
    }
  }

  // A game's own Wikipedia article carries real genre signal that the console
  // list-tables don't (they only have title/developer/publisher/date columns),
  // so fetch it once for every title before scoring, rather than guessing
  // mood/playStyle/story from franchise names alone.
  console.log(`Fetching genre data for ${parsedById.size} SNES titles...`);
  const genreByTitle = await fetchGenreMap(
    [...parsedById.values()].map(({ entry }) => entry.title),
    {
      onProgress: (done, total) => {
        if (done % 200 === 0 || done === total) {
          console.log(`  ${done}/${total} genres fetched`);
        }
      },
    },
  );

  const byId = new Map();
  for (const [id, { entry }] of parsedById) {
    const genre = genreByTitle.get(entry.title) ?? null;
    byId.set(id, { id, ...deriveGameFields(entry, genre), ...entry });
  }

  const entries = [...byId.values()].sort((left, right) => left.title.localeCompare(right.title));
  const sourceCounts = Object.fromEntries(
    sourceTables.map(({ category }) => [category, entries.filter((entry) => entry.sourceCategory === category).length]),
  );

  const output = `// Generated by scripts/generate-snes-catalog.mjs. Do not edit by hand.
// Sources:
// - ${sourceUrl}
// Retrieved: ${generatedAt}

import type { Game } from "./games";

type GeneratedGameMetadata = Omit<Game, "playthroughUrl">;

export type SnesCatalogRegion = keyof typeof regionLabels;
export type SnesCatalogSourceCategory = "licensed" | "promotional" | "competition" | "homebrew" | "unlicensed";

export type SnesCatalogGame = GeneratedGameMetadata & {
  sourceCategory: SnesCatalogSourceCategory;
  developer: string[];
  publisher: string[];
  regions: string[];
  firstReleased: string;
  sourceUrl: string;
  signalScore: number;
};

export const regionLabels = ${stableStringify(regionLabels)} as const;

export const snesCatalogSource = ${stableStringify({
    name: "Wikipedia SNES/Super Famicom catalog tables",
    retrievedAt: generatedAt,
    rowCount: entries.length,
    sources: [{ name: "Wikipedia: List of Super Nintendo Entertainment System games", url: sourceUrl }],
    sourceCounts,
  })} as const;

export const generatedSnesGames: SnesCatalogGame[] = ${stableStringify(entries)};
`;

  await writeFile(outputPath, output);
  console.log(`Generated ${entries.length} SNES catalog entries at ${outputPath.pathname}`);
  console.log(sourceCounts);
}

function parseRow(row, tableSource) {
  const cells = [...row.children].filter((cell) => cell.tagName === "TD");
  if (!cells.length) {
    return null;
  }

  if (tableSource.format === "regional-dates") {
    if (cells.length < 6) {
      return null;
    }
    const jpDate = cleanCell(cells[3]);
    const naDate = cleanCell(cells[4]);
    const palDate = cleanCell(cells[5]);
    return normalizeEntry({
      title: extractTitle(cells[0]),
      developer: extractNames(cells[1]),
      publisher: extractNames(cells[2]),
      firstReleased: firstKnownDate([jpDate, naDate, palDate]),
      year: extractYear(firstKnownDate([jpDate, naDate, palDate])),
      regions: releaseRegions({ JP: jpDate, NA: naDate, PAL: palDate }),
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "developer-promoter-date") {
    if (cells.length < 4) {
      return null;
    }
    const date = cleanCell(cells[3]);
    return normalizeEntry({
      title: extractTitle(cells[0]),
      developer: extractNames(cells[1]),
      publisher: extractNames(cells[2]),
      firstReleased: date,
      year: extractYear(date),
      regions: ["promotional"],
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "developer-date") {
    if (cells.length < 3) {
      return null;
    }
    const date = cleanCell(cells[2]);
    return normalizeEntry({
      title: extractTitle(cells[0]),
      developer: extractNames(cells[1]),
      publisher: [],
      firstReleased: date,
      year: extractYear(date),
      regions: ["promotional"],
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "publisher-date-regions") {
    if (cells.length < 5) {
      return null;
    }
    const date = cleanCell(cells[3]);
    return normalizeEntry({
      title: extractTitle(cells[0]),
      developer: extractNames(cells[1]),
      publisher: extractNames(cells[2]),
      firstReleased: date,
      year: extractYear(date),
      regions: cleanCell(cells[4]).split(/\s*,\s*/).filter(Boolean),
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "publisher-jp-date") {
    if (cells.length < 4) {
      return null;
    }
    const date = cleanCell(cells[3]);
    return normalizeEntry({
      title: extractTitle(cells[0]),
      developer: extractNames(cells[1]),
      publisher: extractNames(cells[2]),
      firstReleased: date,
      year: extractYear(date),
      regions: ["JP", "unlicensed"],
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  return null;
}

function normalizeEntry(entry) {
  const title = cleanTitle(entry.title);
  if (!title || /^title/i.test(title) || /^japan$/i.test(title) || /^north america$/i.test(title)) {
    return null;
  }
  return {
    ...entry,
    title,
    developer: unique(entry.developer.map(cleanTitle).filter(Boolean)),
    publisher: unique(entry.publisher.map(cleanTitle).filter(Boolean)),
    year: entry.year || "Unknown",
    firstReleased: entry.firstReleased || entry.year || "Unknown",
    regions: unique(entry.regions.filter(Boolean)),
    platform: "snes",
    sourceUrl: entry.sourceUrl,
  };
}

function deriveGameFields(entry, genreText) {
  const haystack = [entry.title, ...entry.publisher, ...entry.developer, entry.sourceCategory].join(" ").toLowerCase();
  const tags = new Set(collectMatchingTags(haystack, tagRules));

  if (entry.sourceCategory === "homebrew") {
    tags.add("homebrew");
  }
  if (entry.sourceCategory === "unlicensed") {
    tags.add("unlicensed");
  }
  if (entry.sourceCategory === "competition") {
    tags.add("competition cartridge");
  }
  if (entry.sourceCategory === "promotional") {
    tags.add("promotional");
  }
  if (entry.regions.length === 1) {
    tags.add(`${entry.regions[0]} exclusive`);
  }

  // Genre text pulled from the game's own Wikipedia infobox is real per-game
  // signal, unlike the franchise-name matching below (which only recognizes
  // titles it already has a pattern for). Prefer it when present, and only
  // fall back to the weaker title/publisher/developer heuristics otherwise.
  const genreSignals = deriveSignalsFromGenre(genreText);

  const playStyleRule = playStyleRules.find((rule) => matchesAny(haystack, rule.patterns));
  const playStyle = genreSignals?.playStyle ?? playStyleRule?.playStyle ?? "side-scroller";
  const playStyleSignal = Boolean(genreSignals?.playStyle) || Boolean(playStyleRule);
  for (const tag of playStyleRule?.tags ?? ["action"]) {
    tags.add(tag);
  }

  const matchedMoodRules = matchingRules(haystack, moodRules);
  const moods = unique([...(genreSignals?.moods ?? []), ...matchedMoodRules.map((rule) => rule.mood)]);
  const moodSignal = moods.length > 0;
  if (!moods.length) {
    moods.push(playStyle === "puzzle" ? "contemplative" : playStyle === "action-adventure" ? "heroic" : "arcade");
  }
  if (moods.length === 1) {
    moods.push(moods[0] === "arcade" ? "heroic" : "arcade");
  }

  const difficultSignal = genreSignals?.difficulty === "difficult" || matchesAny(haystack, difficultSignals);
  const casualSignal = genreSignals?.difficulty === "casual" || matchesAny(haystack, casualSignals);
  const difficulty = difficultSignal ? "difficult" : casualSignal ? "casual" : "fair";
  const difficultySignal = difficultSignal || casualSignal;

  const richStorySignal = genreSignals?.story === "rich" || matchesAny(haystack, richStorySignals);
  const someStorySignal = genreSignals?.story === "some" || matchesAny(haystack, someStorySignals);
  const story = richStorySignal ? "rich" : someStorySignal || playStyle === "action-adventure" ? "some" : "low";
  const storySignal = richStorySignal || someStorySignal;

  const obscurity = classicTitles.has(entry.title)
    ? "classic"
    : entry.sourceCategory === "homebrew" || entry.sourceCategory === "unlicensed" || entry.sourceCategory === "promotional" || entry.regions.length === 1
      ? "strange"
      : "hidden-gem";

  const signalScore = [moodSignal, playStyleSignal, difficultySignal, storySignal].filter(Boolean).length;

  return {
    pitch: buildPitch(entry, playStyle, difficulty, story),
    moods: unique(moods).slice(0, 2),
    difficulty,
    story,
    playStyle,
    obscurity,
    isRomhack: false,
    signalScore,
    tags: [...tags].sort(),
  };
}

function buildPitch(entry, playStyle, difficulty, story) {
  const category =
    entry.sourceCategory === "homebrew"
      ? "a homebrew SNES-era release"
      : entry.sourceCategory === "unlicensed"
        ? "an unlicensed Super Famicom release"
        : entry.sourceCategory === "competition"
          ? "a competition cartridge"
          : entry.sourceCategory === "promotional"
            ? "a promotional SNES release"
            : entry.regions.includes("JP") && !entry.regions.includes("NA")
              ? "a Super Famicom release"
              : "an SNES release";
  const feel = difficulty === "difficult" ? "demanding" : difficulty === "casual" ? "approachable" : "balanced";
  const narrative = story === "rich" ? "story-forward" : story === "some" ? "lightly narrative" : "play-first";
  return `${entry.title} is ${category} from ${entry.year}, tagged as ${feel}, ${narrative}, and ${playStyle.replace("-", " ")}-leaning for the recommender.`;
}

function releaseRegions(dates) {
  return Object.entries(dates)
    .filter(([, date]) => date && !/unreleased/i.test(date))
    .map(([region]) => region);
}

function firstKnownDate(dates) {
  return dates.find((date) => date && !/unreleased/i.test(date)) ?? "Unknown";
}

function extractTitle(cell) {
  const firstLink = [...cell.querySelectorAll("a")].find((link) => cleanCell(link));
  return cleanCell(firstLink ?? cell).split(/\n/)[0];
}

function extractNames(cell) {
  const links = [...cell.querySelectorAll("a")].map((link) => cleanCell(link)).filter(Boolean);
  if (links.length) {
    return links;
  }
  return cleanCell(cell)
    .split(/\s{2,}|\/|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function cleanCell(cell) {
  const clone = cell.cloneNode(true);
  for (const sup of clone.querySelectorAll("sup")) {
    sup.remove();
  }
  return clone.textContent.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function cleanTitle(value) {
  return value
    .replace(/\[[^\]]+\]/g, "")
    .replace(/•.+$/g, "")
    .replace(/\b(JP|NA|PAL)$/g, "")
    .replace(/\s*\([^)]+version\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYear(value) {
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? "Unknown";
}

await main();
