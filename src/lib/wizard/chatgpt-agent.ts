import type { WizardAgent } from "@/lib/wizard/agent";
import { runLiveWizardTurn } from "@/lib/wizard/agents-sdk-workflow";
import { mockWizardAgent } from "@/lib/wizard/mock-agent";

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
      const fallback = await mockWizardAgent.runTurn(request);
      return {
        ...fallback,
        adapter: "chatgpt",
        notes: [
          ...(fallback.notes ?? []),
          "Live Agents SDK adapter is not configured. Set OPENAI_API_KEY to enable live wizard lines.",
        ],
      };
    }

    try {
      return await runLiveWizardTurn(request);
    } catch (error) {
      const fallback = await mockWizardAgent.runTurn(request);
      return {
        ...fallback,
        adapter: "chatgpt",
        notes: [
          ...(fallback.notes ?? []),
          `Live Agents SDK turn failed; used deterministic fallback. ${error instanceof Error ? error.message : "Unknown error."}`,
        ],
      };
    }
  },
};
