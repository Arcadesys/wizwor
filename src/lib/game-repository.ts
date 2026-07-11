import { platformLabels } from "@/data/games";
import type { Game, Platform } from "@/data/games";
import { generatedAtari5200Games } from "@/data/atari-5200-catalog.generated";
import { generatedAtari7800Games } from "@/data/atari-7800-catalog.generated";
import { generatedGenesisGames } from "@/data/genesis-catalog.generated";
import { generatedNeoGeoGames } from "@/data/neo-geo-catalog.generated";
import { generatedNesGames } from "@/data/nes-catalog.generated";
import { generatedPcEngineGames } from "@/data/pc-engine-catalog.generated";
import { generatedSmsGames } from "@/data/sms-catalog.generated";
import { generatedSnesGames } from "@/data/snes-catalog.generated";

type GeneratedCatalogGame =
  | (typeof generatedNesGames)[number]
  | (typeof generatedSmsGames)[number]
  | (typeof generatedAtari7800Games)[number]
  | (typeof generatedAtari5200Games)[number]
  | (typeof generatedSnesGames)[number]
  | (typeof generatedGenesisGames)[number]
  | (typeof generatedPcEngineGames)[number]
  | (typeof generatedNeoGeoGames)[number];

export type GameRepositoryOptions = {
  enabledPlatforms?: readonly Platform[];
};

// The generated catalog lacks a curated YouTube playthrough; fall back to a
// YouTube search for the title instead of sending the player to a generic
// Wikipedia list page. youTubeEmbedUrl (page.tsx) can't embed a search
// results page, so these render as a "View Source" link rather than an
// inline player — same as before, just pointed at YouTube.
function youTubeSearchUrl(title: string, platform: Platform): string {
  const query = `${title} ${platformLabels[platform]} gameplay`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function toGame(entry: GeneratedCatalogGame): Game {
  return {
    id: entry.id,
    title: entry.title,
    platform: entry.platform,
    isRomhack: entry.isRomhack,
    year: entry.year,
    pitch: entry.pitch,
    playthroughUrl: youTubeSearchUrl(entry.title, entry.platform),
    moods: entry.moods,
    difficulty: entry.difficulty,
    story: entry.story,
    playStyle: entry.playStyle,
    obscurity: entry.obscurity,
    tags: entry.tags,
  };
}

// Generated catalogs carry a signalScore: how many of the 4 subjective scoring
// dimensions (mood, playStyle, difficulty, story) came from a genuine keyword
// match rather than a silent heuristic default. Below this bar, too many
// entries share the same default values (e.g. "fair" difficulty, "side-scroller"
// playStyle) and flood the recommender's 1-3-match reveal gate with
// lookalikes instead of real signal. See src/lib/recommender.test.ts.
const minGeneratedSignalScore = 3;
const excludedGeneratedSourceCategories = new Set<string>(["homebrew"]);

function normalizeTitleKey(title: string) {
  return title.trim().toLowerCase();
}

// Canonical loose title key: also used by the recommender's keyword ranking,
// so a user-typed keyword and a catalog title normalize identically.
export function normalizeLooseTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function qualityFilterGeneratedCatalog(
  entries: GeneratedCatalogGame[],
  seenTitles: Set<string>,
): Game[] {
  const kept: Game[] = [];
  for (const entry of entries) {
    if (excludedGeneratedSourceCategories.has(entry.sourceCategory)) {
      continue;
    }
    if (entry.signalScore < minGeneratedSignalScore) {
      continue;
    }
    const titleKey = normalizeTitleKey(entry.title);
    if (seenTitles.has(titleKey)) {
      continue;
    }
    seenTitles.add(titleKey);
    kept.push(toGame(entry));
  }
  return kept;
}

let cachedCatalog: Game[] | null = null;
let cachedExactTitleCatalog: Game[] | null = null;

const generatedCatalogs = [
  generatedNesGames,
  generatedSmsGames,
  generatedAtari7800Games,
  generatedAtari5200Games,
  generatedSnesGames,
  generatedGenesisGames,
  generatedPcEngineGames,
  generatedNeoGeoGames,
] as const;

function buildCatalog(): Game[] {
  const seenTitles = new Set<string>();
  return generatedCatalogs.flatMap((catalog) => qualityFilterGeneratedCatalog(catalog, seenTitles));
}

function buildExactTitleCatalog(): Game[] {
  const seenIds = new Set<string>();
  const entries: Game[] = [];

  for (const catalog of generatedCatalogs) {
    for (const entry of catalog) {
      if (excludedGeneratedSourceCategories.has(entry.sourceCategory) || seenIds.has(entry.id)) {
        continue;
      }
      seenIds.add(entry.id);
      entries.push(toGame(entry));
    }
  }

  return entries;
}

export function getAllGames(options: GameRepositoryOptions = {}): Game[] {
  if (!cachedCatalog) {
    cachedCatalog = buildCatalog();
  }
  if (!options.enabledPlatforms) {
    return cachedCatalog;
  }
  const enabled = new Set(options.enabledPlatforms);
  if (enabled.size === 0) {
    return [];
  }
  return cachedCatalog.filter((game) => enabled.has(game.platform));
}

export function getGamesByExactTitle(title: string, options: GameRepositoryOptions = {}): Game[] {
  const titleKey = normalizeLooseTitle(title);
  if (!titleKey) {
    return [];
  }
  if (!cachedExactTitleCatalog) {
    cachedExactTitleCatalog = buildExactTitleCatalog();
  }

  const enabled = options.enabledPlatforms ? new Set(options.enabledPlatforms) : null;
  return cachedExactTitleCatalog.filter(
    (game) => (!enabled || enabled.has(game.platform)) && normalizeLooseTitle(game.title) === titleKey,
  );
}

// The quality filter (minGeneratedSignalScore) keeps getAllGames() from flooding
// with heuristic-default lookalikes, but it also hides every entry of a named
// franchise whose generated tags happened to score low signal (e.g. every Mega
// Man NES title scores signalScore 1) — so "the easiest Mega Man game" scores
// against a pool that contains zero Mega Man games and recommends an unrelated
// title instead. When the player names a real title/franchise, this rescues
// matching games back into consideration regardless of signalScore, without
// loosening the quality bar for open-ended browsing.
export function getGamesByTitleKeyword(keyword: string, options: GameRepositoryOptions = {}): Game[] {
  const normalizedKeyword = normalizeLooseTitle(keyword);
  if (!normalizedKeyword) {
    return [];
  }
  if (!cachedExactTitleCatalog) {
    cachedExactTitleCatalog = buildExactTitleCatalog();
  }

  const enabled = options.enabledPlatforms ? new Set(options.enabledPlatforms) : null;
  return cachedExactTitleCatalog.filter(
    (game) =>
      (!enabled || enabled.has(game.platform)) &&
      normalizeLooseTitle(game.title).includes(normalizedKeyword),
  );
}

// getGamesByExactTitle requires the whole message to equal a title, so a
// direct, unambiguous ask phrased as a sentence ("I want to play Mega Man 2")
// never matches even though the player named a real cartridge — the reveal
// gate then falls back to score-based gating and can refuse a title the
// player asked for by name. This finds catalog titles that appear as a whole
// word/phrase inside the message, the reverse direction of
// getGamesByTitleKeyword's substring search.
export function getGamesByTitleContainedIn(message: string, options: GameRepositoryOptions = {}): Game[] {
  const normalizedMessage = normalizeLooseTitle(message);
  if (!normalizedMessage) {
    return [];
  }
  if (!cachedExactTitleCatalog) {
    cachedExactTitleCatalog = buildExactTitleCatalog();
  }

  const paddedMessage = ` ${normalizedMessage} `;
  const enabled = options.enabledPlatforms ? new Set(options.enabledPlatforms) : null;
  return cachedExactTitleCatalog.filter((game) => {
    if (enabled && !enabled.has(game.platform)) {
      return false;
    }
    const titleKey = normalizeLooseTitle(game.title);
    return titleKey.length > 0 && paddedMessage.includes(` ${titleKey} `);
  });
}
