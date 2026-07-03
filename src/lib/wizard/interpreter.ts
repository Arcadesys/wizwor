import type { PreferenceKey } from "@/lib/recommender";
import type { WizardFocusQuestion, WizardOption, WizardQuestion } from "@/lib/wizard/types";

export function matchOption<T extends WizardOption>(options: T[], rawValue: string) {
  const normalized = normalize(rawValue);
  if (!normalized) {
    return null;
  }

  return (
    options.find((option) => normalize(option.label) === normalized || normalize(option.value) === normalized) ??
    options.find((option) => normalize(option.label).startsWith(normalized) || normalize(option.value).startsWith(normalized)) ??
    options.find((option) => normalize(option.label).includes(normalized))
  );
}

export function interpretQuestionAnswer(question: WizardQuestion, rawValue: string) {
  const matched = matchOption(question.options, rawValue);
  if (matched) {
    return matched;
  }

  const normalized = normalize(rawValue);
  if (!normalized) {
    return null;
  }

  const inferredValue = inferPreferenceValue(question.key, normalized);
  return inferredValue ? question.options.find((option) => option.value === inferredValue) ?? null : null;
}

export function interpretFocusAnswer(question: WizardFocusQuestion, rawValue: string) {
  const matched = matchOption(question.options, rawValue);
  if (matched) {
    return matched;
  }

  const normalized = normalize(rawValue);
  if (!normalized) {
    return null;
  }

  const inferredValue = inferFocusValue(normalized);
  return inferredValue ? question.options.find((option) => option.value === inferredValue) ?? null : null;
}

export function inferPreferenceValue(key: PreferenceKey, normalized: string) {
  if (
    key === "difficulty" &&
    ["notbrutal", "nottoobrutal", "nottoohard", "nothard", "notpunishing", "notmean"].some((phrase) =>
      normalized.includes(phrase),
    )
  ) {
    return "casual";
  }

  const hints: Record<PreferenceKey, Record<string, string[]>> = {
    mood: {
      ominous: ["ominous", "dark", "spooky", "scary", "horror", "haunted", "creepy", "gothic", "grim", "dread"],
      heroic: ["hero", "heroic", "quest", "epic", "brave", "fantasy", "save", "adventure"],
      weird: ["weird", "strange", "odd", "bizarre", "surreal", "experimental", "wild", "mutant"],
      arcade: ["arcade", "fast", "score", "action", "twitch", "quick", "bright", "simple"],
      contemplative: ["quiet", "slow", "mystery", "mysterious", "explore", "moody", "atmosphere", "thoughtful"],
    },
    playStyle: {
      "side-scroller": ["sidescroller", "sidescrolling", "lefttoright", "scrolling", "runandgun"],
      "top-down": ["topdown", "overhead", "maze", "mazes", "rooms", "dungeon"],
      "action-adventure": ["adventure", "exploration", "explore", "zelda", "quest", "secrets"],
      platformer: ["platform", "platformer", "jump", "jumping", "mario", "precision"],
      puzzle: ["puzzle", "puzzles", "brain", "logic", "solve", "thinking"],
    },
    difficulty: {
      casual: ["casual", "easy", "chill", "relaxed", "forgiving", "simple", "cozy", "nottoohard", "notbrutal"],
      fair: ["fair", "medium", "balanced", "normal", "moderate", "somechallenge", "challenge"],
      difficult: ["difficult", "hard", "brutal", "punishing", "tough", "nasty", "mean", "teeth", "challenge"],
    },
    story: {
      low: ["low", "little", "none", "nostory", "gameplay", "arcade", "minimal"],
      some: ["some", "bit", "littlelore", "lightstory", "quest", "context"],
      rich: ["rich", "story", "lore", "myth", "narrative", "world", "plot", "deep"],
    },
    obscurity: {
      classic: ["classic", "known", "famous", "popular", "essential", "canon", "mainstream"],
      "hidden-gem": ["hidden", "gem", "underrated", "overlooked", "lesserknown", "deepcut"],
      strange: ["strange", "obscure", "weird", "offbeat", "offthebeatenpath", "odd", "rare"],
    },
    romhack: {
      no: ["no", "original", "official", "vanilla", "nesonly", "nothacks", "unmodified"],
      curious: ["curious", "maybe", "open", "fine", "ifgood", "possibly"],
      yes: ["yes", "romhack", "romhacks", "hack", "hacks", "mod", "mods", "altered", "forbidden"],
    },
  };

  const scores = Object.entries(hints[key]).map(([value, words]) => ({
    value,
    score: words.reduce((sum, word) => sum + (normalized.includes(word) ? word.length : 0), 0),
  }));
  const best = scores.sort((left, right) => right.score - left.score)[0];
  return best && best.score > 0 ? best.value : null;
}

export function inferFocusValue(normalized: string) {
  const focusHints: Partial<Record<PreferenceKey, string[]>> = {
    mood: ["mood", "vibe", "feel", "feeling", "tone", "atmosphere"],
    playStyle: ["controls", "play", "plays", "style", "genre", "movement"],
    difficulty: ["difficulty", "hard", "easy", "challenge", "bite"],
    obscurity: ["discovery", "obscure", "hidden", "weird", "shelf", "unknown"],
  };
  const scores = Object.entries(focusHints).map(([value, words]) => ({
    value: value as PreferenceKey,
    score: (words ?? []).reduce((sum, word) => sum + (normalized.includes(word) ? word.length : 0), 0),
  }));
  const best = scores.sort((left, right) => right.score - left.score)[0];
  return best && best.score > 0 ? best.value : null;
}

export function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isResetCommand(value: string) {
  const normalized = normalize(value);
  if (!normalized) {
    return false;
  }

  return [
    "clearcontext",
    "clearyourcontext",
    "startover",
    "restart",
    "reset",
    "newsession",
    "newgame",
  ].some((command) => normalized === command || normalized.includes(command));
}
