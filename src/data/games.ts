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

export type Platform =
  | "nes"
  | "romhack"
  | "sms"
  | "atari-7800"
  | "atari-5200"
  | "snes"
  | "genesis"
  | "pc-engine"
  | "neo-geo";

export const catalogPlatforms = [
  "nes",
  "romhack",
  "sms",
  "atari-7800",
  "atari-5200",
  "snes",
  "genesis",
  "pc-engine",
  "neo-geo",
] as const satisfies readonly Platform[];

export const platformLabels: Record<Platform, string> = {
  nes: "NES",
  romhack: "Romhacks",
  sms: "Sega Master System",
  "atari-7800": "Atari 7800",
  "atari-5200": "Atari 5200",
  snes: "SNES",
  genesis: "Genesis / Mega Drive",
  "pc-engine": "PC Engine / TurboGrafx-16",
  "neo-geo": "Neo Geo AES",
};

export function sanitizeEnabledPlatforms(value: unknown): Platform[] {
  if (!Array.isArray(value)) {
    return [...catalogPlatforms];
  }

  const allowed = new Set<Platform>(catalogPlatforms);
  const enabled = catalogPlatforms.filter((platform) => value.includes(platform) && allowed.has(platform));
  return enabled.length > 0 ? enabled : [...catalogPlatforms];
}

export type Game = {
  id: string;
  title: string;
  platform: Platform;
  isRomhack: boolean;
  year: string;
  pitch: string;
  playthroughUrl: string;
  moods: Mood[];
  difficulty: Difficulty;
  story: StoryPreference;
  playStyle: PlayStyle;
  obscurity: Obscurity;
  tags: string[];
};

export const games: Game[] = [
  {
    id: "castlevania-iii",
    title: "Castlevania III: Dracula's Curse",
    platform: "nes",
    isRomhack: false,
    year: "1989",
    pitch:
      "A grim side-scrolling pilgrimage with branching routes, gothic pressure, and just enough cruelty to feel cursed.",
    playthroughUrl: "https://www.youtube.com/watch?v=hFFKAl2A898",
    moods: ["ominous", "heroic"],
    difficulty: "difficult",
    story: "some",
    playStyle: "side-scroller",
    obscurity: "classic",
    tags: ["gothic", "branching paths", "bosses"],
  },
  {
    id: "zelda-ii",
    title: "Zelda II: The Adventure of Link",
    platform: "nes",
    isRomhack: false,
    year: "1987",
    pitch:
      "A strange, demanding quest that folds overworld wandering into tense side-view duels.",
    playthroughUrl: "https://www.youtube.com/watch?v=gmMjS_OwAHM",
    moods: ["heroic", "weird"],
    difficulty: "difficult",
    story: "some",
    playStyle: "action-adventure",
    obscurity: "hidden-gem",
    tags: ["quest", "RPG touches", "dueling"],
  },
  {
    id: "crystalis",
    title: "Crystalis",
    platform: "nes",
    isRomhack: false,
    year: "1990",
    pitch:
      "A bright action RPG about waking into a ruined future, with real momentum and a mythic little heart.",
    playthroughUrl: "https://www.youtube.com/watch?v=LF9HeIsELLs",
    moods: ["heroic", "contemplative"],
    difficulty: "fair",
    story: "rich",
    playStyle: "action-adventure",
    obscurity: "hidden-gem",
    tags: ["action RPG", "future ruins", "magic"],
  },
  {
    id: "guardian-legend",
    title: "The Guardian Legend",
    platform: "nes",
    isRomhack: false,
    year: "1988",
    pitch:
      "Part corridor mystery, part vertical shooter, all glowing alien machinery under the floorboards.",
    playthroughUrl: "https://www.youtube.com/watch?v=ImwZBSo8Rvo",
    moods: ["ominous", "weird"],
    difficulty: "fair",
    story: "some",
    playStyle: "top-down",
    obscurity: "hidden-gem",
    tags: ["hybrid", "maze", "shooter"],
  },
  {
    id: "solstice",
    title: "Solstice",
    platform: "nes",
    isRomhack: false,
    year: "1990",
    pitch:
      "An isometric puzzle dungeon full of eerie rooms, trap logic, and quiet menace.",
    playthroughUrl: "https://www.youtube.com/watch?v=3bKoCo08pxU",
    moods: ["ominous", "contemplative"],
    difficulty: "difficult",
    story: "low",
    playStyle: "puzzle",
    obscurity: "strange",
    tags: ["isometric", "puzzles", "dungeon"],
  },
  {
    id: "kick-master",
    title: "Kick Master",
    platform: "nes",
    isRomhack: false,
    year: "1992",
    pitch:
      "A late-era side-scroller where martial arts, spell pickups, and oddball fantasy collide.",
    playthroughUrl: "https://www.youtube.com/watch?v=-Ihf-9FrRyU",
    moods: ["heroic", "weird"],
    difficulty: "fair",
    story: "low",
    playStyle: "side-scroller",
    obscurity: "hidden-gem",
    tags: ["martial arts", "fantasy", "late NES"],
  },
  {
    id: "monster-party",
    title: "Monster Party",
    platform: "nes",
    isRomhack: false,
    year: "1989",
    pitch:
      "A deeply strange horror-comedy platformer where every screen seems to be lying to you.",
    playthroughUrl: "https://www.youtube.com/watch?v=DliXp-haso4",
    moods: ["weird", "ominous"],
    difficulty: "fair",
    story: "low",
    playStyle: "platformer",
    obscurity: "strange",
    tags: ["surreal", "horror comedy", "boss rush"],
  },
  {
    id: "mighty-final-fight",
    title: "Mighty Final Fight",
    platform: "nes",
    isRomhack: false,
    year: "1993",
    pitch:
      "A compact, charming brawler with arcade snap and enough personality to carry an evening.",
    playthroughUrl: "https://www.youtube.com/watch?v=hoUPvwCcUo8",
    moods: ["arcade", "heroic"],
    difficulty: "casual",
    story: "low",
    playStyle: "side-scroller",
    obscurity: "hidden-gem",
    tags: ["brawler", "short", "arcade"],
  },
  {
    id: "bubble-bobble",
    title: "Bubble Bobble",
    platform: "nes",
    isRomhack: false,
    year: "1988",
    pitch:
      "A playful arcade maze of bubbles, patterns, secrets, and deceptively sharp survival.",
    playthroughUrl: "https://www.youtube.com/watch?v=ij3f4_APEow",
    moods: ["arcade", "contemplative"],
    difficulty: "casual",
    story: "low",
    playStyle: "puzzle",
    obscurity: "classic",
    tags: ["single-screen", "secrets", "cozy"],
  },
  {
    id: "mule",
    title: "M.U.L.E.",
    platform: "nes",
    isRomhack: false,
    year: "1990",
    pitch:
      "Danielle Bunten Berry's resource-trading classic, remembered as a multiplayer design landmark and an important part of trans game-history memory.",
    playthroughUrl: "https://www.youtube.com/watch?v=O7TDXJmS0hE",
    moods: ["arcade", "weird"],
    difficulty: "fair",
    story: "low",
    playStyle: "puzzle",
    obscurity: "classic",
    tags: ["multiplayer", "board game", "economy", "trading", "Danielle Bunten Berry"],
  },
  {
    id: "metroid-mother",
    title: "Metroid: Mother",
    platform: "romhack",
    isRomhack: true,
    year: "romhack",
    pitch:
      "A friendlier, map-aware restoration of Metroid that keeps the lonely alien dread intact.",
    playthroughUrl: "https://www.youtube.com/watch?v=S7fwbZjLpXE",
    moods: ["ominous", "contemplative"],
    difficulty: "fair",
    story: "some",
    playStyle: "side-scroller",
    obscurity: "hidden-gem",
    tags: ["exploration", "quality of life", "lonely"],
  },
  {
    id: "zelda-outlands",
    title: "The Legend of Zelda: Outlands",
    platform: "romhack",
    isRomhack: true,
    year: "romhack",
    pitch:
      "A large alternate Zelda quest that feels like finding a forbidden cartridge in the woods.",
    playthroughUrl: "https://www.youtube.com/watch?v=38V9UXcTqHs",
    moods: ["heroic", "weird"],
    difficulty: "difficult",
    story: "some",
    playStyle: "action-adventure",
    obscurity: "strange",
    tags: ["alternate quest", "secrets", "hard"],
  },
  {
    id: "mario-adventure",
    title: "Super Mario Bros. 3: Mario Adventure",
    platform: "romhack",
    isRomhack: true,
    year: "romhack",
    pitch:
      "A legendary SMB3 remix with new systems, high challenge, and the feeling of a familiar dream turning sideways.",
    playthroughUrl: "https://www.youtube.com/watch?v=Qck3gJ2EDUU",
    moods: ["arcade", "weird"],
    difficulty: "difficult",
    story: "low",
    playStyle: "platformer",
    obscurity: "strange",
    tags: ["SMB3", "challenge", "remix"],
  },
  {
    id: "kirbys-halloween",
    title: "Kirby's Halloween Adventure",
    platform: "romhack",
    isRomhack: true,
    year: "romhack",
    pitch:
      "A breezy seasonal platformer hack for when you want spooky flavor without punishment.",
    playthroughUrl: "https://www.youtube.com/watch?v=zwpVlfh-Vfk",
    moods: ["arcade", "weird"],
    difficulty: "casual",
    story: "low",
    playStyle: "platformer",
    obscurity: "strange",
    tags: ["seasonal", "easygoing", "cute strange"],
  },
];
