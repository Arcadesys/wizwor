import type {
  Difficulty,
  Game,
  Mood,
  Obscurity,
  PlayStyle,
  RomhackInterest,
  StoryPreference,
} from "@/data/games";
import { getAllGames } from "@/lib/game-repository";

export type UserProfile = {
  name?: string;
  mood?: string;
  difficulty?: string;
  story?: string;
  playStyle?: string;
  obscurity?: string;
  romhack?: string;
  // Free-text descriptor words (genres, designers, specific details) pulled from
  // conversation. Scored against each game's tags/pitch — a finer-grained tiebreaker
  // than the coarse categorical fields above, which the full generated catalog
  // (~2000 titles) can otherwise tie dozens-deep on.
  keywords?: string[];
  focus?: PreferenceKey;
  [key: string]: unknown;
};

export type PreferenceKey =
  | "mood"
  | "difficulty"
  | "story"
  | "playStyle"
  | "obscurity"
  | "romhack"
  | "keywords";

export type Recommendation = {
  game: Game;
  score: number;
  reasons: string[];
};

type RubricDimension = {
  key: PreferenceKey;
  weight: number;
};

const rubric: RubricDimension[] = [
  { key: "mood", weight: 28 },
  { key: "playStyle", weight: 22 },
  { key: "difficulty", weight: 16 },
  { key: "story", weight: 12 },
  { key: "obscurity", weight: 12 },
  { key: "romhack", weight: 10 },
  { key: "keywords", weight: 20 },
];

const questionCountRequired = 4;

export const recommendationThreshold = 0.96;
export const maxQualifyingRecommendations = 3;

type RecommendationGateOptions = {
  threshold?: number;
  maxQualifying?: number;
};

function normalizeKeywords(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .map((entry) => String(entry).toLowerCase().trim())
    .filter((entry) => entry.length > 0);
}

export function answeredPreferenceCount(profile: UserProfile) {
  return rubric.filter((dimension) => {
    if (dimension.key === "keywords") {
      return normalizeKeywords(profile.keywords).length > 0;
    }
    return Boolean(profile[dimension.key]);
  }).length;
}

export function hasEnoughSignal(profile: UserProfile) {
  return answeredPreferenceCount(profile) >= questionCountRequired;
}

export function getRecommendations(profile: UserProfile): Recommendation[] {
  return getAllGames()
    .map((game) => scoreGame(game, profile))
    .sort((left, right) => right.score - left.score || left.game.title.localeCompare(right.game.title));
}

export function qualifyingRecommendations(profile: UserProfile, options: RecommendationGateOptions = {}) {
  const threshold = options.threshold ?? recommendationThreshold;
  return getRecommendations(profile).filter((recommendation) => recommendation.score >= threshold);
}

/**
 * This is a guardrail for the live agent, not a deterministic trigger. The agent
 * still decides when to reveal; the UI should only receive recommendations once
 * the catalog has narrowed to a small, high-confidence set.
 */
export function shouldRevealRecommendations(profile: UserProfile) {
  if (!hasEnoughSignal(profile)) {
    return false;
  }

  const qualifyingCount = qualifyingRecommendations(profile).length;
  return qualifyingCount > 0 && qualifyingCount <= maxQualifyingRecommendations;
}

export function recommendationGate(profile: UserProfile, options: RecommendationGateOptions = {}) {
  const threshold = options.threshold ?? recommendationThreshold;
  const maxQualifying = options.maxQualifying ?? maxQualifyingRecommendations;
  const qualifying = qualifyingRecommendations(profile, { threshold });

  return {
    threshold,
    maxQualifying,
    qualifyingCount: qualifying.length,
    isOpen: qualifying.length > 0 && qualifying.length <= maxQualifying,
    recommendations: qualifying,
  };
}

function scoreGame(game: Game, profile: UserProfile): Recommendation {
  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];

  for (const dimension of rubric) {
    const preference = profile[dimension.key];
    if (!preference) {
      continue;
    }

    if (dimension.key === "keywords") {
      const keywords = normalizeKeywords(preference);
      if (keywords.length === 0) {
        continue;
      }
      possible += dimension.weight;
      const haystack = `${(game.tags ?? []).join(" ")} ${game.pitch ?? ""}`.toLowerCase();
      const hits = keywords.filter((keyword) => haystack.includes(keyword));
      const match = hits.length / keywords.length;
      earned += dimension.weight * match;
      if (hits.length > 0) {
        reasons.push(`echoes ${hits.slice(0, 2).join(", ")}`);
      }
      continue;
    }

    possible += dimension.weight;

    if (dimension.key === "mood") {
      const mood = preference as Mood;
      if (game.moods.includes(mood)) {
        earned += dimension.weight;
        reasons.push(`answers the ${labelMood(mood)} mood`);
      }
      continue;
    }

    if (dimension.key === "difficulty") {
      const difficulty = preference as Difficulty;
      if (game.difficulty === difficulty) {
        earned += dimension.weight;
        reasons.push(`${labelDifficulty(difficulty)} difficulty`);
      } else if (isAdjacentDifficulty(game.difficulty, difficulty)) {
        earned += dimension.weight * 0.75;
      } else {
        earned += dimension.weight * 0.45;
      }
      continue;
    }

    if (dimension.key === "playStyle") {
      const playStyle = preference as PlayStyle;
      const match = playStyleMatch(game.playStyle, playStyle);
      earned += dimension.weight * match;
      if (match === 1) {
        reasons.push(labelReason(dimension.key, preference as string));
      }
      continue;
    }

    if (dimension.key === "story") {
      const story = preference as StoryPreference;
      const match = orderedMatch(["low", "some", "rich"], game.story, story);
      earned += dimension.weight * match;
      if (match === 1) {
        reasons.push(labelReason(dimension.key, preference as string));
      }
      continue;
    }

    if (dimension.key === "obscurity") {
      const obscurity = preference as Obscurity;
      const match = orderedMatch(["classic", "hidden-gem", "strange"], game.obscurity, obscurity);
      earned += dimension.weight * match;
      if (match === 1) {
        reasons.push(labelReason(dimension.key, preference as string));
      }
      continue;
    }

    if (dimension.key === "romhack") {
      const romhack = preference as RomhackInterest;
      const match = romhack === "yes" ? game.kind === "romhack" : romhack === "no" ? game.kind === "nes" : true;
      if (match) {
        earned += dimension.weight;
        reasons.push(romhack === "yes" ? "leans into romhack territory" : "fits your cartridge appetite");
      }
      continue;
    }

    if (game[dimension.key] === preference) {
      earned += dimension.weight;
      reasons.push(labelReason(dimension.key, preference as string));
    }
  }

  let score = possible === 0 ? 0 : earned / possible;
  if (profile.focus && profile[profile.focus] && dimensionMatchesFocus(game, profile.focus, profile[profile.focus])) {
    score += (1 - score) * 0.7;
    reasons.unshift("obeys your ruling omen");
  }

  return {
    game,
    score: Math.min(1, score),
    reasons: reasons.slice(0, 3),
  };
}

function isAdjacentDifficulty(gameDifficulty: Difficulty, preferred: Difficulty) {
  const order: Difficulty[] = ["casual", "fair", "difficult"];
  return Math.abs(order.indexOf(gameDifficulty) - order.indexOf(preferred)) === 1;
}

function orderedMatch<T extends string>(order: T[], gameValue: T, preferred: T) {
  const distance = Math.abs(order.indexOf(gameValue) - order.indexOf(preferred));
  if (distance === 0) {
    return 1;
  }
  if (distance === 1) {
    return 0.75;
  }
  return 0.5;
}

function playStyleMatch(gameStyle: PlayStyle, preferred: PlayStyle) {
  if (gameStyle === preferred) {
    return 1;
  }

  const closePairs = new Set([
    "side-scroller:platformer",
    "platformer:side-scroller",
    "top-down:action-adventure",
    "action-adventure:top-down",
    "top-down:puzzle",
    "puzzle:top-down",
  ]);

  if (closePairs.has(`${gameStyle}:${preferred}`)) {
    return 0.75;
  }

  return 0.35;
}

function dimensionMatchesFocus(game: Game, focus: PreferenceKey, value: UserProfile[PreferenceKey]) {
  if (!value) {
    return false;
  }

  if (focus === "mood") {
    return game.moods.includes(value as Mood);
  }

  if (focus === "romhack") {
    const romhack = value as RomhackInterest;
    return romhack === "curious" || (romhack === "yes" ? game.kind === "romhack" : game.kind === "nes");
  }

  if (focus === "keywords") {
    const keywords = normalizeKeywords(value);
    if (keywords.length === 0) {
      return false;
    }
    const haystack = `${(game.tags ?? []).join(" ")} ${game.pitch ?? ""}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  }

  return game[focus] === value;
}

function labelMood(mood: Mood) {
  const labels: Record<Mood, string> = {
    ominous: "ominous",
    heroic: "heroic",
    weird: "strange",
    arcade: "arcade-bright",
    contemplative: "quiet and mysterious",
  };
  return labels[mood];
}

function labelDifficulty(difficulty: Difficulty) {
  const labels: Record<Difficulty, string> = {
    casual: "forgiving",
    fair: "fair",
    difficult: "teeth-baring",
  };
  return labels[difficulty];
}

function labelReason(key: RubricDimension["key"], value: string) {
  const labels: Record<string, string> = {
    "playStyle:side-scroller": "keeps to the side-scrolling path",
    "playStyle:top-down": "moves through maze-like top-down space",
    "playStyle:action-adventure": "answers the action-adventure call",
    "playStyle:platformer": "honors platform timing",
    "playStyle:puzzle": "makes the puzzle brain glow",
    "story:low": "keeps story light",
    "story:some": "carries a little myth",
    "story:rich": "has real quest flavor",
    "obscurity:classic": "belongs to the known shelf",
    "obscurity:hidden-gem": "waits off the main road",
    "obscurity:strange": "opens the odd door",
  };

  return labels[`${key}:${value}`] ?? "matches your answer";
}
