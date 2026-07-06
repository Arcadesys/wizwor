import { NextResponse } from "next/server";
import { enrichGame } from "@/lib/wizard/game-enrichment";

export const runtime = "nodejs";
// The video lookup alone can take ~20s (multi-step web search on an obscure
// title); give the function real headroom beyond Vercel's default.
export const maxDuration = 30;

type EnrichGameRequest = {
  title?: unknown;
  platform?: unknown;
  year?: unknown;
};

export async function POST(request: Request) {
  let payload: EnrichGameRequest;

  try {
    payload = (await request.json()) as EnrichGameRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof payload.title !== "string" || !payload.title.trim()) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  if (typeof payload.platform !== "string" || !payload.platform.trim()) {
    return NextResponse.json({ error: "platform is required." }, { status: 400 });
  }

  if (typeof payload.year !== "string" || !payload.year.trim()) {
    return NextResponse.json({ error: "year is required." }, { status: 400 });
  }

  try {
    const result = await enrichGame({
      title: payload.title,
      platform: payload.platform,
      year: payload.year,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Game enrichment failed.",
      },
      { status: 503 },
    );
  }
}
