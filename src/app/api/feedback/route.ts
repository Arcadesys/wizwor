import { NextResponse } from "next/server";
import type { FeedbackPayload, FeedbackRecommendation } from "@/lib/feedback";
import { isFeedbackRating, logFeedback } from "@/lib/feedback";
import { blankProfile } from "@/lib/wizard/types";

export const runtime = "nodejs";

const maxNoteLength = 500;

export async function POST(request: Request) {
  let payload: Partial<FeedbackPayload>;

  try {
    payload = (await request.json()) as Partial<FeedbackPayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.sessionId || typeof payload.sessionId !== "string") {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  }

  if (!isFeedbackRating(payload.rating)) {
    return NextResponse.json({ error: "rating must be nailed, sort_of, or not_even_haunted." }, { status: 400 });
  }

  logFeedback({
    sessionId: payload.sessionId,
    rating: payload.rating,
    profile: { ...blankProfile, ...payload.profile },
    recommendations: Array.isArray(payload.recommendations)
      ? (payload.recommendations.filter(isFeedbackRecommendation) as FeedbackRecommendation[])
      : [],
    note: typeof payload.note === "string" ? payload.note.trim().slice(0, maxNoteLength) || undefined : undefined,
  });

  return NextResponse.json({ ok: true });
}

function isFeedbackRecommendation(value: unknown): value is FeedbackRecommendation {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as FeedbackRecommendation).id === "string" &&
    typeof (value as FeedbackRecommendation).title === "string" &&
    typeof (value as FeedbackRecommendation).score === "number"
  );
}
