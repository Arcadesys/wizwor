import type { WizardAgent } from "@/lib/wizard/agent";
import { chatGptAgentAdapter } from "@/lib/wizard/chatgpt-agent";

export function getWizardAgent(): WizardAgent {
  return chatGptAgentAdapter;
}
