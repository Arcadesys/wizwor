import { describe, expect, it } from "vitest";
import { personaCharacterLines } from "@/lib/wizard/persona-instructions";
import { wizardPersonaIds, wizardPersonas } from "@/lib/wizard/personas";
import {
  composePersonaInstructions,
  firstTurnInstruction,
  sharedMechanicsLines,
} from "@/lib/wizard/shared-instructions";

function instructionsFor(id: (typeof wizardPersonaIds)[number]) {
  return composePersonaInstructions(wizardPersonas[id], personaCharacterLines[id]);
}

// Splitting one instruction array into persona voice + shared mechanics is the
// only part of the persona work that can silently change what the original
// wizard is told. Every fragment below comes from a line that existed before
// the split; losing one means a rule was dropped in the move.
const originalWizardFragments = [
  "Keeper Beneath the Screen",
  "Do not use Wizard of Wor branding",
  "arcade-synthetic",
  "There is no fixed question order",
  "The player profile is flexible.",
  "mood=ominous|heroic|weird|arcade|contemplative",
  "Also return profile.keywords",
  "Do not require the player's name for anything.",
  "You maintain the player's durable MEMORY.md.",
  "If the player asks to change terminal colors",
  "recommendationGate.recommendationWindowOpen is true",
  "never stonewall the player behind the threshold",
  "Never invent, describe, or score a game yourself.",
  "If exactTitleMatches is non-empty",
  "call search_catalog with that name first",
  "it's bookkeeping",
  "suggestedNextQuestion",
  "Commit when it's time — do not stall.",
  "a designer, a historical or cultural detail",
  "trans creators or trans influence",
  "Use agentData for any extra data",
  "set accepted to false",
  "readable on a tiny CRT",
  "don't ask about platform/system yourself on turn one",
];

describe("instruction composition", () => {
  it("still tells the wizard everything it was told before the persona split", () => {
    const instructions = instructionsFor("wizard");
    for (const fragment of originalWizardFragments) {
      expect(instructions, `missing instruction fragment: ${fragment}`).toContain(fragment);
    }
  });

  it("gives every persona the same mechanical rules", () => {
    const mechanics = sharedMechanicsLines();
    for (const id of wizardPersonaIds) {
      const instructions = instructionsFor(id);
      for (const line of mechanics) {
        expect(instructions).toContain(line);
      }
    }
  });

  it("leads with persona voice and ends with the persona's own greeting", () => {
    for (const id of wizardPersonaIds) {
      const persona = wizardPersonas[id];
      const instructions = instructionsFor(id);
      expect(instructions.startsWith(personaCharacterLines[id][0])).toBe(true);
      expect(instructions.endsWith(firstTurnInstruction(persona))).toBe(true);
      expect(instructions).toContain(persona.firstTurnQuestion);
    }
  });

  it("keeps the reveal guard in every persona, including the off-catalog-friendly furry one", () => {
    for (const id of wizardPersonaIds) {
      expect(instructionsFor(id)).toContain("Never invent, describe, or score a game yourself.");
    }
  });

  it("does not leak one persona's voice into another", () => {
    expect(instructionsFor("furry")).not.toContain("Keeper Beneath the Screen");
    expect(instructionsFor("wizard")).not.toContain("HOWLNET");
  });
});
