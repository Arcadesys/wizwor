export const WIZARD_RESPONSE_CHARACTER_LIMIT = 1000;
export const WIZARD_RESPONSE_TOO_LONG_ERROR = "I do not have my reading glasses on. Speak plain, stranger";

export function enforceWizardResponseLength(lines: string[]) {
  if (lines.join("\n").length > WIZARD_RESPONSE_CHARACTER_LIMIT) {
    throw new Error(WIZARD_RESPONSE_TOO_LONG_ERROR);
  }
  return lines;
}
