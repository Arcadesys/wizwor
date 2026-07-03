import type {
  Difficulty,
  Game,
  Mood,
  Obscurity,
  PlayStyle,
  RomhackInterest,
  StoryPreference,
} from "@/data/games";
import { games } from "@/data/games";

export type UserProfile = {
  name: string;
  mood?: Mood;
  difficulty?: Difficulty;
  story?: StoryPreference;
  playStyle?: PlayStyle;
  obscurity?: Obscurity;
  romhack?: RomhackInterest;
  focus?: PreferenceKey;
};

export type PreferenceKey = "mood" | "difficulty" | "story" | "playStyle" | "obscurity" | "romhack";

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
];

const questionCountRequired = 4;
export const recommendationThreshold = 0.9;

export function answeredPreferenceCount(profile: UserProfile) {
  return rubric.filter((dimension) => profile[dimension.key]).length;
}

export function hasEnoughSignal(profile: UserProfile) {
  return Boolean(profile.name.trim()) && answeredPreferenceCount(profile) >= questionCountRequired;
}

export function getRecommendations(profile: UserProfile): Recommendation[] {
  return games
    .map((game) => scoreGame(game, profile))
    .sort((left, right) => right.score - left.score || left.game.title.localeCompare(right.game.title));
}

export function shouldRevealRecommendations(profile: UserProfile) {
  if (!hasEnoughSignal(profile)) {
    return false;
  }

  const [top] = getRecommendations(profile);
  return Boolean(top && top.score >= recommendationThreshold);
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
        reasons.push(labelReason(dimension.key, preference));
      }
      continue;
    }

    if (dimension.key === "story") {
      const story = preference as StoryPreference;
      const match = orderedMatch(["low", "some", "rich"], game.story, story);
      earned += dimension.weight * match;
      if (match === 1) {
        reasons.push(labelReason(dimension.key, preference));
      }
      continue;
    }

    if (dimension.key === "obscurity") {
      const obscurity = preference as Obscurity;
      const match = orderedMatch(["classic", "hidden-gem", "strange"], game.obscurity, obscurity);
      earned += dimension.weight * match;
      if (match === 1) {
        reasons.push(labelReason(dimension.key, preference));
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
      reasons.push(labelReason(dimension.key, preference));
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
