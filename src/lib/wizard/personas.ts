import type { WizardTerminalTheme } from "@/lib/wizard/types";

export const wizardPersonaIds = ["wizard", "furry"] as const;

export type WizardPersonaId = (typeof wizardPersonaIds)[number];

export type WizardPersona = {
  id: WizardPersonaId;
  agentName: string;
  firstTurnQuestion: string;
  // Lowercase substring ensureFirstTurnQuestion probes for before appending
  // firstTurnQuestion, so a persona can reword the greeting without the guard
  // double-asking.
  firstTurnProbe: string;
  // localStorage key prefix. Routes share an origin, so this is what keeps one
  // persona's MEMORY.md, profile, and theme out of another's session.
  storageNamespace: string;
  copy: {
    greeting: string;
    postConsolePrompt: string;
    soundCaution: string;
    showcasePrompt: string;
    // Transcript prefix on the persona's own lines, e.g. "WIZ>".
    speakerPrefix: string;
  };
  defaultTheme?: WizardTerminalTheme;
};

const sharedFirstTurnProbe = "what console are you questing on today";

export const wizardPersonas: Record<WizardPersonaId, WizardPersona> = {
  wizard: {
    id: "wizard",
    agentName: "Wyrmwood terminal guide",
    firstTurnQuestion: "Greetings Gamer! What console are you questing on today?",
    firstTurnProbe: sharedFirstTurnProbe,
    storageNamespace: "wyrm-terminal",
    copy: {
      greeting: "Greetings Gamer! What console are you questing on today?",
      postConsolePrompt: "What plaything can I offer you today?",
      soundCaution: "Best with sound on. Turn your speakers down first, then let WIZ speak.",
      showcasePrompt: "C:\\WIZWOR>",
      speakerPrefix: "WIZ>",
    },
  },
  furry: {
    id: "furry",
    agentName: "FurryMUCK terminal oracle",
    firstTurnQuestion: "Greetings, fellow traveler! What console are you questing on today?",
    firstTurnProbe: sharedFirstTurnProbe,
    storageNamespace: "wyrm-furry",
    copy: {
      greeting: "Greetings, fellow traveler! What console are you questing on today?",
      postConsolePrompt: "What critter cart can I dig out of the crate?",
      soundCaution: "Best with sound on. Turn your speakers down first, then let HOWLNET speak.",
      showcasePrompt: "C:\\FURRYMUCK>",
      speakerPrefix: "HOWL>",
    },
    // Every value clears WCAG AAA against the background (foreground 17.06:1,
    // accents 7.94:1 and up) — the terminal has to stay readable with central
    // vision loss. Re-check with a contrast tool before changing any of them;
    // personas.test.ts enforces the floors.
    defaultTheme: {
      background: "#0B0A14",
      foreground: "#F2ECFF",
      green: "#7CF5B0",
      amber: "#FFC24D",
      red: "#FF7D7D",
      blue: "#8FC7FF",
    },
  },
};

export const defaultPersonaId: WizardPersonaId = "wizard";

export function resolvePersona(id: WizardPersonaId | undefined): WizardPersona {
  return wizardPersonas[id ?? defaultPersonaId];
}

export function personaStorageKeys(persona: WizardPersona) {
  const namespace = persona.storageNamespace;
  return {
    profile: `${namespace}-profile`,
    memory: `${namespace}-MEMORY.md`,
    theme: `${namespace}-theme`,
    platforms: `${namespace}-platforms`,
  };
}
