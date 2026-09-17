import { z } from "zod";
import { sanitizeEnabledPlatforms } from "@/data/games";
import {
  apiJson,
  boundedProfileSchema,
  logServerError,
  readJsonBody,
  rejectCrossOriginRequest,
  sessionIdSchema,
} from "@/lib/api-security";
import { defaultPersonaId, wizardPersonaIds } from "@/lib/wizard/personas";
import { runWizardTurn } from "@/lib/wizard/runtime";
import { WIZARD_RESPONSE_TOO_LONG_ERROR } from "@/lib/wizard/response-guard";
import { defaultMemoryMarkdown, initialWizardState } from "@/lib/wizard/types";

export const runtime = "nodejs";

const maxWizardBodyBytes = 64 * 1024;
const WizardRequestSchema = z.object({
  sessionId: sessionIdSchema,
  command: z.string().max(1200),
  // Closed enum indexing a server-side registry — the client picks a persona,
  // never supplies prompt text.
  persona: z.enum(wizardPersonaIds).default(defaultPersonaId),
  messages: z
    .array(
      z.object({
        speaker: z.enum(["system", "wizard", "user"]),
        text: z.string().max(1200),
      }),
    )
    .max(100)
    .default([]),
  state: z
    .object({
      started: z.boolean().optional(),
      revealed: z.boolean().optional(),
      profile: boundedProfileSchema.optional(),
      enabledPlatforms: z.array(z.string().max(32)).max(16).optional(),
      memoryMarkdown: z.string().max(8000).optional(),
      terminalTheme: z
        .object({
          background: z.string().max(32).optional(),
          foreground: z.string().max(32).optional(),
          green: z.string().max(32).optional(),
          amber: z.string().max(32).optional(),
          red: z.string().max(32).optional(),
          blue: z.string().max(32).optional(),
        })
        .optional(),
    })
    .default({}),
});

export async function POST(request: Request) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) {
    return originRejection;
  }

  const body = await readJsonBody(request, maxWizardBodyBytes);
  if (!body.ok) {
    return body.response;
  }

  const parsed = WizardRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiJson({ error: "Invalid request body." }, { status: 400 });
  }
  const payload = parsed.data;

  try {
    const response = await runWizardTurn({
      sessionId: payload.sessionId,
      command: payload.command,
      persona: payload.persona,
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

    return apiJson(response);
  } catch (error) {
    logServerError("wizard", error);
    const message =
      error instanceof Error && error.message === WIZARD_RESPONSE_TOO_LONG_ERROR
        ? WIZARD_RESPONSE_TOO_LONG_ERROR
        : "Wizard service is temporarily unavailable.";
    return apiJson({ error: message }, { status: 503 });
  }
}
