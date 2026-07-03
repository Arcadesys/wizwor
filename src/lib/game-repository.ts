import { games } from "@/data/games";
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

// The generated catalog lacks a curated YouTube playthrough; fall back to its
// Wikipedia source so every entry still has somewhere to send the player.
// (page.tsx labels the button "View Source" instead of "Watch Playthrough"
// when the URL isn't a youtube.com link.)
function toGame(entry: GeneratedCatalogGame): Game {
  return {
    id: entry.id,
    title: entry.title,
    platform: entry.platform,
    isRomhack: entry.isRomhack,
    year: entry.year,
    pitch: entry.pitch,
    playthroughUrl: entry.sourceUrl,
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

function normalizeTitleKey(title: string) {
  return title.trim().toLowerCase();
}

function qualityFilterGeneratedCatalog(
  entries: GeneratedCatalogGame[],
  seenTitles: Set<string>,
): Game[] {
  const kept: Game[] = [];
  for (const entry of entries) {
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

function buildCatalog(): Game[] {
  // Hand-curated titles always win over a generated duplicate (e.g. Castlevania III,
  // Zelda II, and Bubble Bobble exist in both) since their metadata is hand-tuned,
  // not heuristically inferred.
  const seenTitles = new Set(games.map((game) => normalizeTitleKey(game.title)));
  return [
    ...games,
    ...qualityFilterGeneratedCatalog(generatedNesGames, seenTitles),
    ...qualityFilterGeneratedCatalog(generatedSmsGames, seenTitles),
    ...qualityFilterGeneratedCatalog(generatedAtari7800Games, seenTitles),
    ...qualityFilterGeneratedCatalog(generatedAtari5200Games, seenTitles),
    ...qualityFilterGeneratedCatalog(generatedSnesGames, seenTitles),
    ...qualityFilterGeneratedCatalog(generatedGenesisGames, seenTitles),
    ...qualityFilterGeneratedCatalog(generatedPcEngineGames, seenTitles),
    ...qualityFilterGeneratedCatalog(generatedNeoGeoGames, seenTitles),
  ];
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
