import { runLiveWizardTurn } from "@/lib/wizard/agents-sdk-workflow";
import type { WizardTurnRequest, WizardTurnResponse } from "@/lib/wizard/types";

export function wizardAgentReadiness() {
  return {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  };
}

export async function runWizardTurn(request: WizardTurnRequest): Promise<WizardTurnResponse> {
  if (!wizardAgentReadiness().hasApiKey) {
    throw new Error("OPENAI_API_KEY is required to run the wizard agent.");
  }
  return runLiveWizardTurn(request);
}
