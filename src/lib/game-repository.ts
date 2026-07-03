import { games } from "@/data/games";
import type { Game } from "@/data/games";
import { generatedNesGames } from "@/data/nes-catalog.generated";

// The generated catalog lacks a curated YouTube playthrough; fall back to its
// Wikipedia source so every entry still has somewhere to send the player.
// (page.tsx labels the button "View Source" instead of "Watch Playthrough"
// when the URL isn't a youtube.com link.)
function toGame(entry: (typeof generatedNesGames)[number]): Game {
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
  entries: (typeof generatedNesGames)[number][],
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

export function getAllGames(): Game[] {
  if (!cachedCatalog) {
    // Hand-curated titles always win over a generated duplicate (e.g. Castlevania III,
    // Zelda II, and Bubble Bobble exist in both) since their metadata is hand-tuned,
    // not heuristically inferred.
    const seenTitles = new Set(games.map((game) => normalizeTitleKey(game.title)));
    cachedCatalog = [...games, ...qualityFilterGeneratedCatalog(generatedNesGames, seenTitles)];
  }
  return cachedCatalog;
}
