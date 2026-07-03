import { writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const cartridgeSourceUrl = "https://en.wikipedia.org/wiki/List_of_Nintendo_Entertainment_System_games";
const fdsSourceUrl = "https://en.wikipedia.org/wiki/List_of_Famicom_Disk_System_games";
const outputPath = new URL("../src/data/nes-catalog.generated.ts", import.meta.url);

const sourceTables = [
  { url: cartridgeSourceUrl, index: 1, category: "licensed", format: "regional-dates" },
  { url: cartridgeSourceUrl, index: 2, category: "compilation", format: "regional-dates" },
  { url: cartridgeSourceUrl, index: 3, category: "championship", format: "single-date" },
  { url: cartridgeSourceUrl, index: 4, category: "konami-qta-adaptor", format: "jp-date" },
  { url: cartridgeSourceUrl, index: 5, category: "bandai-datach", format: "jp-date" },
  { url: cartridgeSourceUrl, index: 7, category: "unlicensed-nes-lifespan", format: "publisher-year" },
  { url: cartridgeSourceUrl, index: 8, category: "unlicensed-famicom", format: "year-publisher-country" },
  { url: cartridgeSourceUrl, index: 9, category: "unlicensed-after-lifespan", format: "publisher-year" },
  { url: fdsSourceUrl, index: 0, category: "famicom-disk-system", format: "fds-date" },
  { url: fdsSourceUrl, index: 1, category: "famicom-disk-system-unlicensed", format: "fds-unlicensed-date" },
];

const classicTitles = new Set([
  "Balloon Fight",
  "Bubble Bobble",
  "Castlevania",
  "Castlevania II: Simon's Quest",
  "Castlevania III: Dracula's Curse",
  "Contra",
  "Donkey Kong",
  "Donkey Kong Jr.",
  "Dr. Mario",
  "Dragon Quest",
  "Dragon Warrior",
  "Duck Hunt",
  "DuckTales",
  "Excitebike",
  "Final Fantasy",
  "Galaga",
  "Ghosts 'n Goblins",
  "Gradius",
  "Ice Climber",
  "Kirby's Adventure",
  "Mega Man",
  "Mega Man 2",
  "Mega Man 3",
  "Mega Man 4",
  "Mega Man 5",
  "Mega Man 6",
  "Metroid",
  "Mike Tyson's Punch-Out!!",
  "Ninja Gaiden",
  "Pac-Man",
  "Punch-Out!!",
  "Super Mario Bros.",
  "Super Mario Bros. 2",
  "Super Mario Bros. 3",
  "Tecmo Bowl",
  "Tetris",
  "The Legend of Zelda",
  "Zelda II: The Adventure of Link",
]);

const difficultSignals = [
  "battletoads",
  "castlevania",
  "contra",
  "ghosts 'n goblins",
  "ninja gaiden",
  "silver surfer",
  "adventure of bayou billy",
  "teenage mutant ninja turtles",
  "solstice",
  "ikar",
  "gradius",
  "rtype",
  "r-type",
  "bionic commando",
  "dr. jekyll",
  "hydlide",
  "athena",
];

const casualSignals = [
  "barbie",
  "bubble",
  "casino",
  "chess",
  "duck hunt",
  "fisher",
  "game show",
  "golf",
  "jeopardy",
  "mahjong",
  "monopoly",
  "pachi",
  "pinball",
  "sesame",
  "solitaire",
  "tennis",
  "wheel of fortune",
  "yoshi",
];

const richStorySignals = [
  "ad&d",
  "advanced dungeons",
  "dragon quest",
  "dragon warrior",
  "final fantasy",
  "famicom tantei",
  "faria",
  "fire emblem",
  "mother",
  "ultima",
  "wizardry",
  "ys",
];

const someStorySignals = [
  "adventure",
  "batman",
  "castlevania",
  "crystalis",
  "destiny",
  "double dragon",
  "dragon ball",
  "faxanadu",
  "gaiden",
  "godzilla",
  "gundam",
  "indiana jones",
  "metroid",
  "ninja",
  "robocop",
  "shadowgate",
  "star wars",
  "zelda",
];

const playStyleRules = [
  {
    playStyle: "puzzle",
    tags: ["puzzle"],
    patterns: [
      "arkanoid",
      "block",
      "boulder dash",
      "chess",
      "dr. mario",
      "hatris",
      "lolo",
      "mahjong",
      "minesweeper",
      "othello",
      "puzzle",
      "shogi",
      "sudoku",
      "tetris",
      "yoshi",
    ],
  },
  {
    playStyle: "action-adventure",
    tags: ["adventure"],
    patterns: [
      "ad&d",
      "adventure",
      "crystalis",
      "dragon quest",
      "dragon warrior",
      "faxanadu",
      "final fantasy",
      "hydlide",
      "metroid",
      "quest",
      "rpg",
      "shadowgate",
      "ultima",
      "wizardry",
      "ys",
      "zelda",
    ],
  },
  {
    playStyle: "top-down",
    tags: ["overhead"],
    patterns: [
      "baseball",
      "basketball",
      "bomberman",
      "commando",
      "football",
      "golf",
      "gun.smoke",
      "hockey",
      "ikari",
      "soccer",
      "strategy",
      "tennis",
      "volleyball",
      "war",
    ],
  },
  {
    playStyle: "platformer",
    tags: ["platformer"],
    patterns: [
      "adventure island",
      "bonk",
      "bubble bobble",
      "chip 'n dale",
      "donkey kong",
      "duck tales",
      "kirby",
      "little nemo",
      "mario",
      "mega man",
      "monster",
      "sonic",
      "super pitfall",
      "wario",
    ],
  },
];

const tagRules = [
  { tag: "sports", patterns: ["baseball", "basketball", "boxing", "football", "golf", "hockey", "olympic", "soccer", "tennis", "volleyball", "wrestl"] },
  { tag: "racing", patterns: ["f-1", "formula", "grand prix", "racer", "racing", "speedway"] },
  { tag: "shooter", patterns: ["1942", "1943", "after burner", "gradius", "gun", "ikari", "mission", "shoot", "star force", "zanac"] },
  { tag: "light gun", patterns: ["duck hunt", "hogans alley", "wild gunman", "gotcha"] },
  { tag: "licensed character", patterns: ["addams", "batman", "bugs bunny", "captain america", "disney", "dragon ball", "flintstones", "godzilla", "mickey", "ninja turtles", "robocop", "simpsons", "star wars", "superman"] },
  { tag: "board and card", patterns: ["blackjack", "casino", "chess", "mahjong", "monopoly", "poker", "shogi", "solitaire"] },
  { tag: "rpg", patterns: richStorySignals },
  { tag: "horror", patterns: ["castlevania", "chiller", "friday the 13th", "ghost", "ghoul", "horror", "monster", "nightmare", "zombie"] },
  { tag: "education", patterns: ["abc", "academy", "math", "school", "sesame", "study"] },
  { tag: "arcade port", patterns: ["1942", "1943", "arkanoid", "burger", "dig dug", "donkey kong", "galaga", "pac-man", "popeye", "q*bert"] },
];

const moodRules = [
  { mood: "ominous", patterns: ["alien", "castle", "castlevania", "chiller", "dark", "dead", "demon", "devil", "dragon", "ghost", "ghoul", "horror", "monster", "nightmare", "shadow", "zombie"] },
  { mood: "heroic", patterns: ["adventure", "batman", "captain", "dragon quest", "dragon warrior", "final fantasy", "gaiden", "hero", "legend", "ninja", "quest", "warrior", "zelda"] },
  { mood: "weird", patterns: ["baby", "banana", "bubble", "circus", "dizzy", "egg", "fantasy", "magic", "monster party", "mutant", "panic", "parodius", "penguin", "weird", "yume"] },
  { mood: "arcade", patterns: ["1942", "arcade", "arkanoid", "balloon", "baseball", "battle", "bubble", "donkey kong", "galaga", "golf", "pac-man", "pinball", "racing", "sports", "tennis", "tetris"] },
  { mood: "contemplative", patterns: ["chess", "detective", "mahjong", "mystery", "othello", "puzzle", "shadowgate", "shogi", "solitaire", "tantei"] },
];

const regionLabels = {
  JP: "Japan",
  NA: "North America",
  PAL: "Europe/PAL",
  AU: "Australia",
  EU: "Europe",
  TW: "Taiwan",
  KR: "South Korea",
  CN: "China",
  HK: "Hong Kong",
  FDS: "Famicom Disk System",
  homebrew: "Homebrew",
  unlicensed: "Unlicensed",
};

async function main() {
  const generatedAt = new Date().toISOString();
  const documents = new Map();
  const byId = new Map();

  for (const tableSource of sourceTables) {
    if (!documents.has(tableSource.url)) {
      const html = await fetch(tableSource.url, {
        headers: {
          "User-Agent": "wizwor-catalog-generator/1.0 (local development script)",
        },
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch source ${tableSource.url}: ${response.status} ${response.statusText}`);
        }
        return response.text();
      });
      documents.set(tableSource.url, new JSDOM(html).window.document);
    }

    const document = documents.get(tableSource.url);
    const tables = [...document.querySelectorAll("table.wikitable")];
    const table = tables[tableSource.index];
    if (!table) {
      throw new Error(`Expected source table ${tableSource.index} for ${tableSource.category}`);
    }

    const rows = [...table.querySelectorAll("tr")].slice(1);
    for (const row of rows) {
      const entry = parseRow(row, tableSource);
      if (!entry) {
        continue;
      }

      let id = slugify(entry.title);
      if (byId.has(id)) {
        const baseId = slugify(`${entry.title}-${entry.sourceCategory}-${entry.publisher.join("-") || entry.year}`);
        id = baseId;
        let counter = 2;
        while (byId.has(id)) {
          id = `${baseId}-${counter}`;
          counter++;
        }
      }
      byId.set(id, { id, ...deriveGameFields(entry), ...entry, generatedAt });
    }
  }

  const entries = [...byId.values()].sort((left, right) => left.title.localeCompare(right.title));
  const sourceCounts = Object.fromEntries(
    sourceTables.map(({ category }) => [category, entries.filter((entry) => entry.sourceCategory === category).length]),
  );

  const output = `// Generated by scripts/generate-nes-catalog.mjs. Do not edit by hand.
// Sources:
// - ${cartridgeSourceUrl}
// - ${fdsSourceUrl}
// Retrieved: ${generatedAt}

import type { Game } from "./games";

type GeneratedGameMetadata = Omit<Game, "playthroughUrl">;

export type NesCatalogRegion = keyof typeof regionLabels;
export type NesCatalogSourceCategory =
  | "licensed"
  | "compilation"
  | "championship"
  | "famicom-disk-system"
  | "famicom-disk-system-unlicensed"
  | "konami-qta-adaptor"
  | "bandai-datach"
  | "unlicensed-nes-lifespan"
  | "unlicensed-famicom"
  | "unlicensed-after-lifespan";

export type NesCatalogGame = GeneratedGameMetadata & {
  sourceCategory: NesCatalogSourceCategory;
  developer: string[];
  publisher: string[];
  regions: string[];
  firstReleased: string;
  sourceUrl: string;
  generatedAt: string;
};

export const regionLabels = ${stableStringify(regionLabels)} as const;

export const nesCatalogSource = ${stableStringify({
  name: "Wikipedia NES/Famicom catalog tables",
  retrievedAt: generatedAt,
  rowCount: entries.length,
  sources: [
    { name: "Wikipedia: List of Nintendo Entertainment System games", url: cartridgeSourceUrl },
    { name: "Wikipedia: List of Famicom Disk System games", url: fdsSourceUrl },
  ],
  sourceCounts,
})} as const;

export const generatedNesGames: NesCatalogGame[] = ${stableStringify(entries)};
`;

  await writeFile(outputPath, output);
  console.log(`Generated ${entries.length} NES catalog entries at ${outputPath.pathname}`);
  console.log(sourceCounts);
}

function parseRow(row, tableSource) {
  const cells = [...row.children].filter((cell) => cell.tagName === "TD");
  if (!cells.length) {
    return null;
  }

  if (tableSource.format === "regional-dates") {
    if (cells.length < 7) {
      return null;
    }
    const title = extractTitle(cells[0]);
    const jpDate = cleanCell(cells[4]);
    const naDate = cleanCell(cells[5]);
    const palDate = cleanCell(cells[6]);
    return normalizeEntry({
      title,
      developer: extractNames(cells[1]),
      publisher: extractNames(cells[2]),
      firstReleased: cleanCell(cells[3]),
      year: extractYear(cleanCell(cells[3])),
      regions: releaseRegions({ JP: jpDate, NA: naDate, PAL: palDate }),
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "single-date") {
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
      regions: ["NA"],
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "jp-date") {
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
      regions: ["JP"],
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "publisher-year") {
    if (cells.length < 3) {
      return null;
    }
    const year = cleanCell(cells[2]);
    return normalizeEntry({
      title: extractTitle(cells[0]),
      developer: [],
      publisher: extractNames(cells[1]),
      firstReleased: year,
      year: extractYear(year),
      regions: tableSource.category === "unlicensed-after-lifespan" ? ["homebrew"] : ["unlicensed"],
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "year-publisher-country") {
    if (cells.length < 4) {
      return null;
    }
    const country = cleanCell(cells[3]);
    const year = cleanCell(cells[1]);
    return normalizeEntry({
      title: extractTitle(cells[0]),
      developer: [],
      publisher: extractNames(cells[2]),
      firstReleased: year,
      year: extractYear(year),
      regions: country ? [country] : ["unlicensed"],
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "fds-date") {
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
      regions: ["JP", "FDS"],
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  if (tableSource.format === "fds-unlicensed-date") {
    if (cells.length < 3) {
      return null;
    }
    const date = cleanCell(cells[2]);
    return normalizeEntry({
      title: extractTitle(cells[0]),
      developer: [],
      publisher: extractNames(cells[1]),
      firstReleased: date,
      year: extractYear(date),
      regions: ["JP", "FDS", "unlicensed"],
      sourceCategory: tableSource.category,
      sourceUrl: tableSource.url,
    });
  }

  return null;
}

function normalizeEntry(entry) {
  const title = cleanTitle(entry.title);
  if (!title || /^title/i.test(title)) {
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
    kind: "nes",
    sourceUrl: entry.sourceUrl,
  };
}

function deriveGameFields(entry) {
  const haystack = [entry.title, ...entry.publisher, ...entry.developer, entry.sourceCategory].join(" ").toLowerCase();
  const tags = new Set();

  for (const rule of tagRules) {
    if (rule.patterns.some((pattern) => haystack.includes(pattern))) {
      tags.add(rule.tag);
    }
  }

  if (entry.sourceCategory.startsWith("unlicensed") || entry.sourceCategory === "famicom-disk-system-unlicensed") {
    tags.add("unlicensed");
  }
  if (entry.sourceCategory.startsWith("famicom-disk-system")) {
    tags.add("Famicom Disk System");
  }
  if (entry.sourceCategory === "compilation") {
    tags.add("compilation");
  }
  if (entry.sourceCategory === "championship") {
    tags.add("competition cartridge");
  }
  if (entry.sourceCategory.includes("datach") || entry.sourceCategory.includes("qta")) {
    tags.add("peripheral");
  }
  if (entry.regions.length === 1) {
    tags.add(`${entry.regions[0]} exclusive`);
  }

  const playStyleRule = playStyleRules.find((rule) => rule.patterns.some((pattern) => haystack.includes(pattern)));
  const playStyle = playStyleRule?.playStyle ?? "side-scroller";
  for (const tag of playStyleRule?.tags ?? ["action"]) {
    tags.add(tag);
  }

  const moods = moodRules
    .filter((rule) => rule.patterns.some((pattern) => haystack.includes(pattern)))
    .map((rule) => rule.mood);
  if (!moods.length) {
    moods.push(playStyle === "puzzle" ? "contemplative" : playStyle === "action-adventure" ? "heroic" : "arcade");
  }
  if (moods.length === 1) {
    moods.push(moods[0] === "arcade" ? "heroic" : "arcade");
  }

  const difficulty = difficultSignals.some((signal) => haystack.includes(signal))
    ? "difficult"
    : casualSignals.some((signal) => haystack.includes(signal))
      ? "casual"
      : "fair";

  const story = richStorySignals.some((signal) => haystack.includes(signal))
    ? "rich"
    : someStorySignals.some((signal) => haystack.includes(signal)) || playStyle === "action-adventure"
      ? "some"
      : "low";

  const obscurity = classicTitles.has(entry.title)
    ? "classic"
    : entry.sourceCategory.startsWith("unlicensed") ||
        entry.sourceCategory.startsWith("famicom-disk-system") ||
        entry.sourceCategory === "konami-qta-adaptor" ||
        entry.sourceCategory === "bandai-datach" ||
        entry.regions.length === 1
      ? "strange"
      : "hidden-gem";

  return {
    pitch: buildPitch(entry, playStyle, difficulty, story),
    moods: unique(moods).slice(0, 2),
    difficulty,
    story,
    playStyle,
    obscurity,
    romhack: "no",
    tags: [...tags].sort(),
  };
}

function buildPitch(entry, playStyle, difficulty, story) {
  const category = entry.sourceCategory.startsWith("unlicensed")
    ? "an unlicensed NES-era release"
    : entry.sourceCategory === "famicom-disk-system-unlicensed"
      ? "an unlicensed Famicom Disk System release"
      : entry.sourceCategory === "famicom-disk-system"
        ? "a Famicom Disk System release"
    : entry.sourceCategory === "compilation"
      ? "a compilation cartridge"
      : entry.sourceCategory === "championship"
        ? "a competition cartridge"
        : entry.regions.includes("JP") && !entry.regions.includes("NA")
          ? "a Famicom release"
          : "an NES release";
  const feel = difficulty === "difficult" ? "demanding" : difficulty === "casual" ? "approachable" : "balanced";
  const narrative = story === "rich" ? "story-forward" : story === "some" ? "lightly narrative" : "play-first";
  return `${entry.title} is ${category} from ${entry.year}, tagged as ${feel}, ${narrative}, and ${playStyle.replace("-", " ")}-leaning for the recommender.`;
}

function releaseRegions(dates) {
  return Object.entries(dates)
    .filter(([, date]) => date && !/unreleased/i.test(date))
    .map(([region]) => region);
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
    .replace(/\s*\([^)]+version\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractYear(value) {
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? "Unknown";
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function unique(values) {
  return [...new Set(values)];
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value), null, 2);
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, inner]) => [key, sortValue(inner)]));
  }
  return value;
}

await main();
