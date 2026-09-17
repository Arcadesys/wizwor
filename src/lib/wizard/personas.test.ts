import { describe, expect, it } from "vitest";
import { personaCharacterLines } from "@/lib/wizard/persona-instructions";
import {
  defaultPersonaId,
  personaStorageKeys,
  resolvePersona,
  wizardPersonaIds,
  wizardPersonas,
} from "@/lib/wizard/personas";

function relativeLuminance(hex: string) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrastRatio(a: string, b: string) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("wizard persona registry", () => {
  it("has a registry entry and character lines for every id", () => {
    for (const id of wizardPersonaIds) {
      expect(wizardPersonas[id]?.id).toBe(id);
      expect(personaCharacterLines[id].length).toBeGreaterThan(0);
    }
  });

  it("keeps the wizard storage namespace so existing saved sessions survive", () => {
    expect(wizardPersonas.wizard.storageNamespace).toBe("wyrm-terminal");
    expect(personaStorageKeys(wizardPersonas.wizard)).toEqual({
      profile: "wyrm-terminal-profile",
      memory: "wyrm-terminal-MEMORY.md",
      theme: "wyrm-terminal-theme",
      platforms: "wyrm-terminal-platforms",
    });
  });

  it("gives each persona a distinct storage namespace", () => {
    const namespaces = wizardPersonaIds.map((id) => wizardPersonas[id].storageNamespace);
    expect(new Set(namespaces).size).toBe(namespaces.length);
  });

  it("falls back to the default persona when none is supplied", () => {
    expect(resolvePersona(undefined)).toBe(wizardPersonas[defaultPersonaId]);
    expect(resolvePersona("furry")).toBe(wizardPersonas.furry);
  });

  it("keeps the wizard greeting and showcase prompt unchanged", () => {
    expect(wizardPersonas.wizard.copy.greeting).toBe(
      "Greetings Gamer! What console are you questing on today?",
    );
    expect(wizardPersonas.wizard.copy.showcasePrompt).toBe("C:\\WIZWOR>");
    expect(wizardPersonas.wizard.defaultTheme).toBeUndefined();
  });
});

// The primary user has central vision loss, so a persona theme that dips below
// these floors is a real accessibility regression, not a style nit.
describe("persona default themes", () => {
  it("uses six-digit hex, which is all sanitizeTheme accepts", () => {
    for (const id of wizardPersonaIds) {
      const theme = wizardPersonas[id].defaultTheme;
      if (!theme) {
        continue;
      }
      for (const value of Object.values(theme)) {
        expect(value).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("clears WCAG AAA for body text and AA for every accent", () => {
    for (const id of wizardPersonaIds) {
      const theme = wizardPersonas[id].defaultTheme;
      if (!theme?.background) {
        continue;
      }
      const { background, foreground, ...accents } = theme;

      expect(foreground).toBeDefined();
      expect(contrastRatio(background, foreground!)).toBeGreaterThanOrEqual(7);

      for (const [name, value] of Object.entries(accents)) {
        expect(
          contrastRatio(background, value),
          `${id} theme accent "${name}" (${value}) against ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
