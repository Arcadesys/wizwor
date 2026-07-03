import type { PreferenceKey, Recommendation, UserProfile } from "@/lib/recommender";

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
  key: PreferenceKey;
  prompt: string;
  options: WizardOption[];
};

export type WizardFocusQuestion = {
  key: "focus";
  prompt: string;
  options: Array<WizardOption & { value: PreferenceKey }>;
};

export type WizardState = {
  started: boolean;
  needsName: boolean;
  activeQuestionKey: PreferenceKey | null;
  awaitingFocus: boolean;
  revealed: boolean;
  profile: UserProfile;
};

export type WizardTurnRequest = {
  sessionId: string;
  command: string;
  state: WizardState;
  messages: WizardMessage[];
};

export type WizardTurnResponse = {
  lines: string[];
  state: WizardState;
  suggestions: WizardOption[];
  recommendations: Recommendation[];
  accepted: boolean;
  adapter: "mock" | "chatgpt";
  notes?: string[];
};

export const blankProfile: UserProfile = {
  name: "",
};

export const initialWizardState: WizardState = {
  started: false,
  needsName: false,
  activeQuestionKey: null,
  awaitingFocus: false,
  revealed: false,
  profile: blankProfile,
};
