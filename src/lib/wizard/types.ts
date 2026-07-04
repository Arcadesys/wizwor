import type { Recommendation, UserProfile } from "@/lib/recommender";
import { catalogPlatforms, type Platform } from "@/data/games";

export type WizardSpeaker = "system" | "wizard" | "user";

export type WizardMessage = {
  id?: string;
  speaker: WizardSpeaker;
  text: string;
};

export type WizardOption = {
  value: string;
  label: string;
  detail: string;
};

export type WizardQuestion = {
  key: string;
  prompt: string;
  options: WizardOption[];
};

export type WizardFocusQuestion = {
  key: "focus";
  prompt: string;
  options: WizardOption[];
};

export type AgentData = {
  thresholdPercent: number;
  maxQualifyingMatches: number;
  qualifyingMatchCount: number;
  recommendationWindowOpen: boolean;
  bestGuessAvailable: boolean;
  gamesAboveThreshold: Array<{
    id: string;
    title: string;
    matchPercent: number;
    reasons: string[];
    pitch: string;
    tags: string[];
  }>;
  currentBestMatches: Array<{
    id: string;
    title: string;
    matchPercent: number;
    clearsThreshold: boolean;
    reasons: string[];
    pitch: string;
    tags: string[];
  }>;
  consumed: Record<string, unknown>;
  generated: Record<string, unknown>;
};

export type WizardState = {
  started: boolean;
  needsName: boolean;
  activeQuestionKey: string | null;
  awaitingFocus: boolean;
  revealed: boolean;
  profile: UserProfile;
  enabledPlatforms?: Platform[];
  memoryMarkdown: string;
  terminalTheme?: WizardTerminalTheme;
  soundtrack?: WizardSoundtrack;
};

// A chiptune loop for the terminal's Tone.js engine, built from five musical
// roles stepped on eighth notes: bassline (foundation), chords (the harmonic
// progression), harmony (when the chord strikes), lead (the melody), and
// rhythm (the beat). bassline's length sets the loop: 8/16/24/32 steps, whole
// measures. chords has one entry per HALF-MEASURE (bassline.length / 4): ""
// carries the previous chord forward, otherwise a space-separated note stack
// (e.g. "A2 C3 E3"). harmony/lead/rhythm each have one entry per step: harmony
// is "" (silent) or "x" (strike the currently active chord); lead is "" or a
// melody note; rhythm is "" or space-separated drum tokens from kick/snare/hat
// (e.g. "kick hat").
export type WizardSoundtrack = {
  title: string;
  bpm: number;
  loopEnd: string;
  bassline: string[];
  chords: string[];
  harmony: string[];
  lead: string[];
  rhythm: string[];
};

export type WizardTerminalTheme = {
  background?: string;
  foreground?: string;
  green?: string;
  amber?: string;
  red?: string;
  blue?: string;
};

export type WizardTurnRequest = {
  sessionId: string;
  command: string;
  state: WizardState;
  messages: WizardMessage[];
};

export type Showcase = {
  games: Recommendation[];
};

export type WizardTurnResponse = {
  lines: string[];
  state: WizardState;
  suggestions: WizardOption[];
  recommendations: Recommendation[];
  accepted: boolean;
  adapter: "chatgpt";
  agentData?: AgentData;
  notes?: string[];
  showcase?: Showcase | null;
  soundtrack?: WizardSoundtrack | null;
};

export const blankProfile: UserProfile = {};

export const defaultMemoryMarkdown = `# MEMORY.md

## Player
- Name: Unknown

## Preferences
- Console colors: default

## Games Previously Played
- None recorded

## Notes
- No durable notes yet
`;

export const initialWizardState: WizardState = {
  started: false,
  needsName: false,
  activeQuestionKey: null,
  awaitingFocus: false,
  revealed: false,
  profile: blankProfile,
  enabledPlatforms: [...catalogPlatforms],
  memoryMarkdown: defaultMemoryMarkdown,
};
