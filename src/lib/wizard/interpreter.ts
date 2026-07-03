import type { PreferenceKey, UserProfile } from "@/lib/recommender";
import type { WizardFocusQuestion, WizardOption, WizardQuestion } from "@/lib/wizard/types";

export function matchOption<T extends WizardOption>(options: T[], rawValue: string) {
  const normalized = normalize(rawValue);
  if (!normalized) {
    return null;
  }

  const boundaryText = toBoundaryText(rawValue);

  return (
    options.find((option) => normalize(option.label) === normalized || normalize(option.value) === normalized) ??
    options.find((option) => normalize(option.label).startsWith(normalized) || normalize(option.value).startsWith(normalized)) ??
    options.find((option) => normalize(option.label).includes(normalized)) ??
    // Reply names an option's own word directly ("some story" for the "Some" story
    // option) — this must win over generic hint scoring, which would otherwise let
    // an incidental word like "story" outscore the option actually being named.
    options.find((option) => {
      const valuePhrase = toBoundaryText(option.value).trim();
      const labelPhrase = toBoundaryText(option.label).trim();
      return (
        (valuePhrase && boundaryText.includes(` ${valuePhrase} `)) ||
        (labelPhrase && boundaryText.includes(` ${labelPhrase} `))
      );
    })
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

  const inferredValue = inferPreferenceValue(question.key as PreferenceKey, rawValue);
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

  const inferredValue = inferFocusValue(rawValue);
  return inferredValue ? question.options.find((option) => option.value === inferredValue) ?? null : null;
}

const preferenceHints: Record<PreferenceKey, Record<string, string[]>> = {
  mood: {
    ominous: ["ominous", "dark", "spooky", "scary", "horror", "haunted", "creepy", "gothic", "grim", "dread"],
    heroic: ["hero", "heroic", "quest", "epic", "brave", "fantasy", "save", "adventure"],
    weird: ["weird", "strange", "odd", "bizarre", "surreal", "experimental", "wild", "mutant"],
    arcade: ["arcade", "fast", "score", "action", "twitch", "quick", "bright", "simple"],
    contemplative: ["quiet", "slow", "mystery", "mysterious", "explore", "moody", "atmosphere", "thoughtful"],
  },
  playStyle: {
    "side-scroller": ["side scroller", "side scrolling", "left to right", "scrolling", "run and gun"],
    "top-down": ["top down", "overhead", "maze", "mazes", "rooms", "dungeon"],
    "action-adventure": ["adventure", "exploration", "explore", "zelda", "quest", "secrets"],
    platformer: ["platform", "platformer", "jump", "jumping", "mario", "precision"],
    puzzle: ["puzzle", "puzzles", "brain", "logic", "solve", "thinking", "board game", "tabletop"],
  },
  difficulty: {
    casual: ["casual", "easy", "easier", "chill", "relaxed", "forgiving", "simple", "cozy", "not too hard", "not brutal"],
    fair: ["fair", "medium", "balanced", "normal", "moderate", "some challenge", "challenge"],
    difficult: ["difficult", "hard", "harder", "brutal", "punishing", "tough", "nasty", "mean", "teeth", "challenge"],
  },
  story: {
    low: ["little", "none", "no story", "gameplay first", "minimal"],
    some: ["some", "a bit", "little lore", "light story", "quest", "context"],
    rich: ["rich", "story", "lore", "myth", "narrative", "world", "plot", "deep"],
  },
  obscurity: {
    classic: ["classic", "known", "famous", "popular", "essential", "canon", "mainstream"],
    "hidden-gem": ["hidden", "gem", "underrated", "overlooked", "lesser known", "deep cut"],
    strange: ["strange", "obscure", "offbeat", "off the beaten path", "odd", "rare"],
  },
  romhack: {
    no: ["original", "official", "vanilla", "nes only", "no hacks", "unmodified"],
    curious: ["curious", "maybe", "open to it", "fine with it", "if good", "possibly"],
    yes: ["romhack", "romhacks", "hack", "hacks", "mod", "mods", "altered", "forbidden"],
  },
};

const focusHints: Partial<Record<PreferenceKey, string[]>> = {
  mood: ["mood", "vibe", "feel", "feeling", "tone", "atmosphere"],
  playStyle: ["controls", "play", "plays", "style", "genre", "movement"],
  difficulty: ["difficulty", "hard", "easy", "challenge", "bite"],
  obscurity: ["discovery", "obscure", "hidden", "weird", "shelf", "unknown"],
};

/**
 * Hint words are matched on whole-word boundaries (via `toBoundaryText`), not raw
 * substring, so short common words like "no" can't false-positive inside unrelated
 * words like "know" or "snow".
 */
function toBoundaryText(value: string) {
  const words = value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return words.length ? ` ${words.join(" ")} ` : "";
}

function scoreHints(boundaryText: string, hints: Record<string, string[]>) {
  return Object.entries(hints)
    .map(([value, phrases]) => ({
      value,
      score: phrases.reduce((sum, phrase) => sum + (boundaryText.includes(` ${phrase} `) ? phrase.length : 0), 0),
    }))
    .sort((left, right) => right.score - left.score)[0];
}

export function inferPreferenceValue(key: PreferenceKey, rawValue: string) {
  const boundaryText = toBoundaryText(rawValue);
  if (
    key === "difficulty" &&
    ["not brutal", "not too brutal", "not too hard", "not hard", "not punishing", "not mean"].some((phrase) =>
      boundaryText.includes(` ${phrase} `),
    )
  ) {
    return "casual";
  }

  const best = scoreHints(boundaryText, preferenceHints[key]);
  return best && best.score > 0 ? best.value : null;
}

/**
 * Broader than `inferPreferenceValue`: used to pick up incidental signal for keys
 * the user isn't directly being asked about right now (see `extractProfileSignals`).
 * Requires a higher score so weak single-short-word hints don't hijack an unrelated
 * field from a sentence that was really answering something else.
 */
const broadSignalMinScore = 5;

export function extractProfileSignals(rawValue: string, profile: UserProfile): Partial<UserProfile> {
  const boundaryText = toBoundaryText(rawValue);
  if (!boundaryText) {
    return {};
  }

  const found: Partial<Record<PreferenceKey, string>> = {};
  for (const key of Object.keys(preferenceHints) as PreferenceKey[]) {
    if (profile[key]) {
      continue;
    }

    const best = scoreHints(boundaryText, preferenceHints[key]);
    if (best && best.score >= broadSignalMinScore) {
      found[key] = best.value;
    }
  }

  return found as Partial<UserProfile>;
}

export function inferFocusValue(rawValue: string) {
  const boundaryText = toBoundaryText(rawValue);
  const scores = Object.entries(focusHints).map(([value, words]) => ({
    value: value as PreferenceKey,
    score: (words ?? []).reduce((sum, word) => sum + (boundaryText.includes(` ${word} `) ? word.length : 0), 0),
  }));
  const best = scores.sort((left, right) => right.score - left.score)[0];
  return best && best.score > 0 ? best.value : null;
}

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function isResetCommand(value: string) {
  const normalized = normalize(value);
  if (!normalized) {
    return false;
  }

  // "new game" is deliberately excluded: in an app whose whole purpose is
  // recommending games, that phrase shows up constantly in ordinary requests
  // ("I want a new game", "any new game ideas?") and would wipe the session
  // on a ton of legitimate turns if it were treated as a reset trigger.
  return [
    "clearcontext",
    "clearyourcontext",
    "startover",
    "restart",
    "reset",
    "newsession",
  ].some((command) => normalized === command || normalized.includes(command));
}

const nameIntroPatterns: RegExp[] = [
  /\bi\s*(?:'|a)?m\s+(\p{L}[\p{L}'-]*)/iu,
  /\bcall me\s+(\p{L}[\p{L}'-]*)/iu,
  /\bmy name(?:'s| is)\s+(\p{L}[\p{L}'-]*)/iu,
  /\bthe name(?:'s| is)\s+(\p{L}[\p{L}'-]*)/iu,
];

const nameFillerWords = new Set([
  "well",
  "so",
  "ok",
  "okay",
  "hey",
  "hi",
  "hello",
  "actually",
  "honestly",
  "look",
  "listen",
  "hmm",
  "uh",
  "um",
  "yes",
  "no",
  "sure",
  "alright",
  "right",
  "after",
  "about",
  "into",
  "here",
  "just",
  "not",
  "really",
  "kind",
  "sort",
  "more",
  "also",
  "still",
  "only",
  "looking",
  "searching",
  "trying",
  "going",
  "gonna",
]);

/**
 * Pulls a name out of a full sentence ("I'm Joanne, looking for something ominous")
 * instead of treating the whole reply as the literal name. Falls back to null so the
 * caller can still use the raw command verbatim for simple one-word answers ("Ada").
 * The leading "Name, ..." form is checked first since it's unambiguous; the "I'm ..."
 * style patterns are checked after and filtered against a filler-word list because
 * they otherwise false-positive on "I'm after/looking for/just here for ...".
 */
export function extractNameFromIntro(rawValue: string): string | null {
  const commaMatch = rawValue.match(/^\s*(\p{L}[\p{L}'-]*)\s*,/iu);
  if (commaMatch && !nameFillerWords.has(commaMatch[1].toLowerCase())) {
    return commaMatch[1];
  }

  for (const pattern of nameIntroPatterns) {
    const match = rawValue.match(pattern);
    if (match?.[1] && !nameFillerWords.has(match[1].toLowerCase())) {
      return match[1];
    }
  }

  return null;
}

export function inferDirectAskProfile(rawValue: string, currentProfile: UserProfile): UserProfile | null {
  const boundaryText = toBoundaryText(rawValue);
  if (!boundaryText) {
    return null;
  }

  const asksForGame = ["play", "recommend", "find", "show", "want", "looking"].some((word) =>
    boundaryText.includes(` ${word} `),
  );
  const asksForMultiplayerBoardGame =
    boundaryText.includes(" multiplayer ") && boundaryText.includes(" board game ");

  if (!asksForGame || !asksForMultiplayerBoardGame) {
    return null;
  }

  return {
    ...currentProfile,
    name: currentProfile.name?.trim() || extractNameFromIntro(rawValue) || "PLAYER",
    mood: "weird",
    playStyle: "puzzle",
    difficulty: "fair",
    story: "low",
    obscurity: "classic",
    romhack: "no",
    focus: "playStyle",
  };
}
