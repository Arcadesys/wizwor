// Maps a Wikipedia infobox "genre" string (e.g. "Role-playing, action-adventure")
// onto the recommender's mood/playStyle/story/difficulty vocabulary. This is real
// per-game signal, unlike the franchise-name keyword matching in
// console-catalog-generator.mjs, which only recognizes titles it already has a
// pattern for.
const playStyleRules = [
  { playStyle: "puzzle", patterns: ["puzzle", "tile-matching", "trivia"] },
  {
    playStyle: "action-adventure",
    patterns: ["role-playing", "rpg", "adventure", "metroidvania", "visual novel", "interactive fiction"],
  },
  {
    playStyle: "top-down",
    patterns: ["sports", "racing", "strategy", "simulation", "sim", "tactical", "board game", "card game"],
  },
  { playStyle: "platformer", patterns: ["platform"] },
];

const moodRules = [
  { mood: "ominous", patterns: ["horror", "survival horror", "thriller"] },
  { mood: "heroic", patterns: ["role-playing", "rpg", "adventure", "action-adventure", "beat 'em up", "hack and slash"] },
  { mood: "weird", patterns: ["party", "comedy", "surreal"] },
  { mood: "arcade", patterns: ["sports", "racing", "fighting", "shoot 'em up", "shooter", "platform"] },
  { mood: "contemplative", patterns: ["puzzle", "simulation", "sim", "strategy", "trivia", "board game"] },
];

const richStoryPatterns = ["role-playing", "rpg", "visual novel", "interactive fiction"];
const someStoryPatterns = ["adventure", "action-adventure", "metroidvania"];

const difficultPatterns = ["shoot 'em up", "bullet hell", "roguelike", "beat 'em up", "hack and slash"];
const casualPatterns = ["party", "puzzle", "trivia", "board game", "card game", "educational"];

function matchesAny(haystack, patterns) {
  return patterns.some((pattern) => haystack.includes(pattern));
}

/**
 * Returns null if the genre text doesn't match anything we recognize, so
 * callers can fall back to the weaker title/publisher heuristics untouched.
 */
export function deriveSignalsFromGenre(genreText) {
  if (!genreText) {
    return null;
  }
  const haystack = genreText.toLowerCase();

  const playStyleRule = playStyleRules.find((rule) => matchesAny(haystack, rule.patterns));
  const matchedMoodRules = moodRules.filter((rule) => matchesAny(haystack, rule.patterns));
  const richStory = matchesAny(haystack, richStoryPatterns);
  const someStory = matchesAny(haystack, someStoryPatterns);
  const difficult = matchesAny(haystack, difficultPatterns);
  const casual = matchesAny(haystack, casualPatterns);

  const hasAnySignal = Boolean(playStyleRule) || matchedMoodRules.length > 0 || richStory || someStory || difficult || casual;
  if (!hasAnySignal) {
    return null;
  }

  return {
    playStyle: playStyleRule?.playStyle ?? null,
    moods: matchedMoodRules.map((rule) => rule.mood),
    story: richStory ? "rich" : someStory ? "some" : null,
    difficulty: difficult ? "difficult" : casual ? "casual" : null,
  };
}
