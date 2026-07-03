import type { UserProfile } from "@/lib/recommender";

export type FeedbackRating = "nailed" | "sort_of" | "not_even_haunted";

const ratings: FeedbackRating[] = ["nailed", "sort_of", "not_even_haunted"];

export type FeedbackRecommendation = {
  id: string;
  title: string;
  score: number;
};

export type FeedbackPayload = {
  sessionId: string;
  rating: FeedbackRating;
  profile: UserProfile;
  recommendations: FeedbackRecommendation[];
  note?: string;
};

export function isFeedbackRating(value: unknown): value is FeedbackRating {
  return typeof value === "string" && ratings.includes(value as FeedbackRating);
}

/**
 * Logged as a single JSON line so it can be grepped out of Vercel function logs
 * and turned into eval cases later; there's no durable store behind this yet.
 */
export function logFeedback(payload: FeedbackPayload) {
  console.log(
    JSON.stringify({
      type: "wizwor.feedback",
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  );
}
