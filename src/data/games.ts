export type Difficulty = "casual" | "fair" | "difficult";
export type StoryPreference = "low" | "some" | "rich";
export type PlayStyle =
  | "side-scroller"
  | "top-down"
  | "action-adventure"
  | "platformer"
  | "puzzle";
export type Obscurity = "classic" | "hidden-gem" | "strange";
export type RomhackInterest = "no" | "curious" | "yes";
export type Mood =
  | "ominous"
  | "heroic"
  | "weird"
  | "arcade"
  | "contemplative";

export type Game = {
  id: string;
  title: string;
  kind: "nes" | "romhack";
  year: string;
  pitch: string;
  moods: Mood[];
  difficulty: Difficulty;
  story: StoryPreference;
  playStyle: PlayStyle;
  obscurity: Obscurity;
  romhack: RomhackInterest;
  tags: string[];
};

export const games: Game[] = [
  {
    id: "castlevania-iii",
    title: "Castlevania III: Dracula's Curse",
    kind: "nes",
    year: "1989",
    pitch:
      "A grim side-scrolling pilgrimage with branching routes, gothic pressure, and just enough cruelty to feel cursed.",
    moods: ["ominous", "heroic"],
    difficulty: "difficult",
    story: "some",
    playStyle: "side-scroller",
    obscurity: "classic",
    romhack: "no",
    tags: ["gothic", "branching paths", "bosses"],
  },
  {
    id: "zelda-ii",
    title: "Zelda II: The Adventure of Link",
    kind: "nes",
    year: "1987",
    pitch:
      "A strange, demanding quest that folds overworld wandering into tense side-view duels.",
    moods: ["heroic", "weird"],
    difficulty: "difficult",
    story: "some",
    playStyle: "action-adventure",
    obscurity: "hidden-gem",
    romhack: "no",
    tags: ["quest", "RPG touches", "dueling"],
  },
  {
    id: "crystalis",
    title: "Crystalis",
    kind: "nes",
    year: "1990",
    pitch:
      "A bright action RPG about waking into a ruined future, with real momentum and a mythic little heart.",
    moods: ["heroic", "contemplative"],
    difficulty: "fair",
    story: "rich",
    playStyle: "action-adventure",
    obscurity: "hidden-gem",
    romhack: "no",
    tags: ["action RPG", "future ruins", "magic"],
  },
  {
    id: "guardian-legend",
    title: "The Guardian Legend",
    kind: "nes",
    year: "1988",
    pitch:
      "Part corridor mystery, part vertical shooter, all glowing alien machinery under the floorboards.",
    moods: ["ominous", "weird"],
    difficulty: "fair",
    story: "some",
    playStyle: "top-down",
    obscurity: "hidden-gem",
    romhack: "no",
    tags: ["hybrid", "maze", "shooter"],
  },
  {
    id: "solstice",
    title: "Solstice",
    kind: "nes",
    year: "1990",
    pitch:
      "An isometric puzzle dungeon full of eerie rooms, trap logic, and quiet menace.",
    moods: ["ominous", "contemplative"],
    difficulty: "difficult",
    story: "low",
    playStyle: "puzzle",
    obscurity: "strange",
    romhack: "no",
    tags: ["isometric", "puzzles", "dungeon"],
  },
  {
    id: "kick-master",
    title: "Kick Master",
    kind: "nes",
    year: "1992",
    pitch:
      "A late-era side-scroller where martial arts, spell pickups, and oddball fantasy collide.",
    moods: ["heroic", "weird"],
    difficulty: "fair",
    story: "low",
    playStyle: "side-scroller",
    obscurity: "hidden-gem",
    romhack: "no",
    tags: ["martial arts", "fantasy", "late NES"],
  },
  {
    id: "monster-party",
    title: "Monster Party",
    kind: "nes",
    year: "1989",
    pitch:
      "A deeply strange horror-comedy platformer where every screen seems to be lying to you.",
    moods: ["weird", "ominous"],
    difficulty: "fair",
    story: "low",
    playStyle: "platformer",
    obscurity: "strange",
    romhack: "no",
    tags: ["surreal", "horror comedy", "boss rush"],
  },
  {
    id: "mighty-final-fight",
    title: "Mighty Final Fight",
    kind: "nes",
    year: "1993",
    pitch:
      "A compact, charming brawler with arcade snap and enough personality to carry an evening.",
    moods: ["arcade", "heroic"],
    difficulty: "casual",
    story: "low",
    playStyle: "side-scroller",
    obscurity: "hidden-gem",
    romhack: "no",
    tags: ["brawler", "short", "arcade"],
  },
  {
    id: "bubble-bobble",
    title: "Bubble Bobble",
    kind: "nes",
    year: "1988",
    pitch:
      "A playful arcade maze of bubbles, patterns, secrets, and deceptively sharp survival.",
    moods: ["arcade", "contemplative"],
    difficulty: "casual",
    story: "low",
    playStyle: "puzzle",
    obscurity: "classic",
    romhack: "no",
    tags: ["single-screen", "secrets", "cozy"],
  },
  {
    id: "mule",
    title: "M.U.L.E.",
    kind: "nes",
    year: "1990",
    pitch:
      "Danielle Bunten Berry's resource-trading classic, remembered as a multiplayer design landmark and an important part of trans game-history memory.",
    moods: ["arcade", "weird"],
    difficulty: "fair",
    story: "low",
    playStyle: "puzzle",
    obscurity: "classic",
    romhack: "no",
    tags: ["multiplayer", "board game", "economy", "trading", "Danielle Bunten Berry"],
  },
  {
    id: "metroid-mother",
    title: "Metroid: Mother",
    kind: "romhack",
    year: "romhack",
    pitch:
      "A friendlier, map-aware restoration of Metroid that keeps the lonely alien dread intact.",
    moods: ["ominous", "contemplative"],
    difficulty: "fair",
    story: "some",
    playStyle: "side-scroller",
    obscurity: "hidden-gem",
    romhack: "yes",
    tags: ["exploration", "quality of life", "lonely"],
  },
  {
    id: "zelda-outlands",
    title: "The Legend of Zelda: Outlands",
    kind: "romhack",
    year: "romhack",
    pitch:
      "A large alternate Zelda quest that feels like finding a forbidden cartridge in the woods.",
    moods: ["heroic", "weird"],
    difficulty: "difficult",
    story: "some",
    playStyle: "action-adventure",
    obscurity: "strange",
    romhack: "yes",
    tags: ["alternate quest", "secrets", "hard"],
  },
  {
    id: "mario-adventure",
    title: "Super Mario Bros. 3: Mario Adventure",
    kind: "romhack",
    year: "romhack",
    pitch:
      "A legendary SMB3 remix with new systems, high challenge, and the feeling of a familiar dream turning sideways.",
    moods: ["arcade", "weird"],
    difficulty: "difficult",
    story: "low",
    playStyle: "platformer",
    obscurity: "strange",
    romhack: "yes",
    tags: ["SMB3", "challenge", "remix"],
  },
  {
    id: "kirbys-halloween",
    title: "Kirby's Halloween Adventure",
    kind: "romhack",
    year: "romhack",
    pitch:
      "A breezy seasonal platformer hack for when you want spooky flavor without punishment.",
    moods: ["arcade", "weird"],
    difficulty: "casual",
    story: "low",
    playStyle: "platformer",
    obscurity: "strange",
    romhack: "yes",
    tags: ["seasonal", "easygoing", "cute strange"],
  },
];
