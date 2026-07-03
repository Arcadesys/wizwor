import { NextResponse } from "next/server";
import { catalogPlatforms, type Platform } from "@/data/games";
import { getWizardAgent } from "@/lib/wizard/runtime";
import type { WizardTurnRequest } from "@/lib/wizard/types";
import { defaultMemoryMarkdown, initialWizardState } from "@/lib/wizard/types";

export const runtime = "nodejs";

function sanitizeEnabledPlatforms(value: unknown): Platform[] {
  if (!Array.isArray(value)) {
    return [...catalogPlatforms];
  }
  const allowed = new Set<Platform>(catalogPlatforms);
  const enabled = value.filter((platform): platform is Platform => allowed.has(platform as Platform));
  return [...new Set(enabled)];
}

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
  try {
    const response = await agent.runTurn({
      sessionId: payload.sessionId,
      command: payload.command,
      messages: Array.isArray(payload.messages) ? payload.messages : [],
      state: {
        ...initialWizardState,
        ...payload.state,
        memoryMarkdown:
          typeof payload.state?.memoryMarkdown === "string" && payload.state.memoryMarkdown.trim()
            ? payload.state.memoryMarkdown
            : defaultMemoryMarkdown,
        profile: {
          ...initialWizardState.profile,
          ...payload.state?.profile,
        },
        enabledPlatforms: sanitizeEnabledPlatforms(payload.state?.enabledPlatforms),
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Wizard agent failed.",
      },
      { status: 503 },
    );
  }
}
