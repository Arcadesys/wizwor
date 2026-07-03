import type { WizardAgent } from "@/lib/wizard/agent";
import { runLiveWizardTurn } from "@/lib/wizard/agents-sdk-workflow";

export function getChatGptAgentReadiness() {
  return {
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
    hasAgentsSdk: true,
  };
}

export const chatGptAgentAdapter: WizardAgent = {
  async runTurn(request) {
    const readiness = getChatGptAgentReadiness();

    if (!readiness.hasApiKey) {
      throw new Error("OPENAI_API_KEY is required to run the wizard agent.");
    }

    return runLiveWizardTurn(request);
  },
};
