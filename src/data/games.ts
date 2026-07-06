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
  return catalogPlatforms.filter((platform) => value.includes(platform) && allowed.has(platform));
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
