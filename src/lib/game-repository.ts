import { games } from "@/data/games";
import type { Game } from "@/data/games";
import { generatedNesGames } from "@/data/nes-catalog.generated";

// The generated catalog lacks a curated YouTube playthrough; fall back to its
// Wikipedia source so every entry still has somewhere to send the player.
function toGame(entry: (typeof generatedNesGames)[number]): Game {
  return {
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    year: entry.year,
    pitch: entry.pitch,
    playthroughUrl: entry.sourceUrl,
    moods: entry.moods,
    difficulty: entry.difficulty,
    story: entry.story,
    playStyle: entry.playStyle,
    obscurity: entry.obscurity,
    romhack: entry.romhack,
    tags: entry.tags,
  };
}

const curatedIds = new Set(games.map((game) => game.id));
const allGames: Game[] = [
  ...games,
  ...generatedNesGames.filter((entry) => !curatedIds.has(entry.id)).map(toGame),
];

export function getAllGames(): Game[] {
  return allGames;
}
