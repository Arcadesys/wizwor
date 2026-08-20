import { z } from "zod";
import {
  apiJson,
  boundedProfileSchema,
  readJsonBody,
  rejectCrossOriginRequest,
  sessionIdSchema,
} from "@/lib/api-security";
import { logFeedback } from "@/lib/feedback";

export const runtime = "nodejs";

const maxNoteLength = 500;
const maxFeedbackBodyBytes = 16 * 1024;
const FeedbackPayloadSchema = z.object({
  sessionId: sessionIdSchema,
  rating: z.enum(["nailed", "sort_of", "not_even_haunted"]),
  profile: boundedProfileSchema.default({}),
  recommendations: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(180),
        title: z.string().trim().min(1).max(240),
        score: z.number().finite().min(0).max(1),
      }),
    )
    .max(3)
    .default([]),
  note: z.string().trim().min(1).max(maxNoteLength).optional(),
});

export async function POST(request: Request) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) {
    return originRejection;
  }

  const body = await readJsonBody(request, maxFeedbackBodyBytes);
  if (!body.ok) {
    return body.response;
  }

  const parsed = FeedbackPayloadSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiJson({ error: "Invalid request body." }, { status: 400 });
  }

  logFeedback(parsed.data);

  return apiJson({ ok: true });
}
