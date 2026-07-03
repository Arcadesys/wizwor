import { NextResponse } from "next/server";
import { getWizardAgent } from "@/lib/wizard/runtime";
import type { WizardTurnRequest } from "@/lib/wizard/types";
import { initialWizardState } from "@/lib/wizard/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: Partial<WizardTurnRequest>;

  try {
    payload = (await request.json()) as Partial<WizardTurnRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.sessionId || typeof payload.sessionId !== "string") {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  if (typeof payload.command !== "string") {
    return NextResponse.json({ error: "command must be a string." }, { status: 400 });
  }

  const agent = getWizardAgent();
  const response = await agent.runTurn({
    sessionId: payload.sessionId,
    command: payload.command,
    messages: Array.isArray(payload.messages) ? payload.messages : [],
    state: {
      ...initialWizardState,
      ...payload.state,
      profile: {
        ...initialWizardState.profile,
        ...payload.state?.profile,
      },
    },
  });

  return NextResponse.json(response);
}
