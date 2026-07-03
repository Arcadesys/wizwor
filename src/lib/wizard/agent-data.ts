import { maxQualifyingRecommendations, recommendationThreshold } from "@/lib/recommender";
import type { AgentData } from "@/lib/wizard/types";

export function emptyAgentData(
  consumed: Record<string, unknown> = {},
  generated: Record<string, unknown> = {},
): AgentData {
  return {
    thresholdPercent: Math.round(recommendationThreshold * 100),
    maxQualifyingMatches: maxQualifyingRecommendations,
    qualifyingMatchCount: 0,
    recommendationWindowOpen: false,
    gamesAboveThreshold: [],
    currentBestMatches: [],
    consumed,
    generated,
  };
}
