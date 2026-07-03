import type { WizardAgent } from "@/lib/wizard/agent";
import { chatGptAgentAdapter } from "@/lib/wizard/chatgpt-agent";
import { mockWizardAgent } from "@/lib/wizard/mock-agent";

export function getWizardAgent(): WizardAgent {
  if (process.env.WIZARD_AGENT_MODE === "chatgpt") {
    return chatGptAgentAdapter;
  }

  return mockWizardAgent;
}
