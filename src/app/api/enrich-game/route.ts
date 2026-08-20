import { z } from "zod";
import { platformLabels } from "@/data/games";
import { apiJson, logServerError, readJsonBody, rejectCrossOriginRequest } from "@/lib/api-security";
import { getGameById } from "@/lib/game-repository";
import { enrichGame } from "@/lib/wizard/game-enrichment";

export const runtime = "nodejs";
// The video lookup alone can take ~20s (multi-step web search on an obscure
// title); give the function real headroom beyond Vercel's default.
export const maxDuration = 30;

const maxEnrichmentBodyBytes = 2048;
const EnrichGameRequestSchema = z.object({
  id: z.string().trim().min(1).max(180),
});

export async function POST(request: Request) {
  const originRejection = rejectCrossOriginRequest(request);
  if (originRejection) {
    return originRejection;
  }

  const body = await readJsonBody(request, maxEnrichmentBodyBytes);
  if (!body.ok) {
    return body.response;
  }

  const parsed = EnrichGameRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiJson({ error: "Invalid request body." }, { status: 400 });
  }

  const game = getGameById(parsed.data.id);
  if (!game) {
    return apiJson({ error: "Catalog game not found." }, { status: 404 });
  }

  try {
    const result = await enrichGame({
      title: game.title,
      platform: platformLabels[game.platform],
      year: game.year,
    });

    return apiJson(result);
  } catch (error) {
    logServerError("enrich-game", error);
    return apiJson({ error: "Game enrichment is temporarily unavailable." }, { status: 503 });
  }
}
