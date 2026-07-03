import { games } from "@/data/games";
import type { Game } from "@/data/games";

export function getAllGames(): Game[] {
  return games;
}
