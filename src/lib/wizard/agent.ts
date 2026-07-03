import type { WizardTurnRequest, WizardTurnResponse } from "@/lib/wizard/types";

export type WizardAgent = {
  runTurn(request: WizardTurnRequest): Promise<WizardTurnResponse>;
};
