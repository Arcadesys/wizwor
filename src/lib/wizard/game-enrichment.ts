import { Agent, run, webSearchTool } from "@openai/agents";
import { z } from "zod";
import { isYouTubeWatchUrl } from "@/lib/youtube";
import { enrichmentRatingModel, enrichmentVideoModel } from "@/lib/wizard/models";

export type GameEnrichmentInput = {
  title: string;
  platform: string;
  year: string;
};

export type GameEnrichmentResult = {
  youtubeUrl: string | null;
  rating: number | null;
  ratingSource: string | null;
};

const VideoLookupSchema = z.object({
  youtubeUrl: z.string().nullable(),
});

const RatingLookupSchema = z.object({
  rating: z.number().min(0).max(10).nullable(),
  ratingSource: z.string().nullable(),
});

// Split into two single-purpose agents rather than one that does both:
// testing found gpt-5-nano finds real ratings reliably but is too
// conservative to assert a specific YouTube URL from search snippets, even
// for extremely well-known games. The video lookup needs the stronger model;
// the rating lookup is cheap and works fine on nano. Both run in parallel.
const videoLookupAgent = new Agent({
  name: "Game video lookup",
  instructions:
    "Given a retro console game's title, platform, and release year (the year disambiguates re-releases and same-named games on other platforms), search for a real YouTube longplay or full-playthrough video of this exact game. Return its actual watch URL (a youtube.com/watch?v=... or youtu.be/... link to one specific video) — never a search-results page, a playlist, or a channel link. Never fabricate a URL; return null if you can't confirm a real one after a reasonable search effort.",
  model: enrichmentVideoModel,
  modelSettings: {
    reasoning: {
      effort: "low",
    },
  },
  tools: [webSearchTool()],
  outputType: VideoLookupSchema,
});

const ratingLookupAgent = new Agent({
  name: "Game rating lookup",
  instructions:
    "Given a retro console game's title, platform, and release year, search for a real, publicly published critic or aggregate review score for this exact game (e.g. Metacritic, GameRankings, MobyGames, a well-known single outlet review). Convert it to a 0-10 scale and name the source briefly. Never fabricate a number; return null for both fields if no real score can be confirmed.",
  model: enrichmentRatingModel,
  modelSettings: {
    reasoning: {
      effort: "low",
    },
  },
  tools: [webSearchTool()],
  outputType: RatingLookupSchema,
});

export async function enrichGame(input: GameEnrichmentInput): Promise<GameEnrichmentResult> {
  const prompt = `Game: "${input.title}"\nPlatform: ${input.platform}\nYear: ${input.year}`;

  const [videoResult, ratingResult] = await Promise.all([
    run(videoLookupAgent, prompt, { maxTurns: 10 }),
    run(ratingLookupAgent, prompt, { maxTurns: 5 }),
  ]);

  const video = videoResult.finalOutput as z.infer<typeof VideoLookupSchema> | undefined;
  const rating = ratingResult.finalOutput as z.infer<typeof RatingLookupSchema> | undefined;

  // Defense against a hallucinated or wrong-domain URL slipping through the
  // output schema — the schema only checks it's a string.
  const youtubeUrl = video?.youtubeUrl && isYouTubeWatchUrl(video.youtubeUrl) ? video.youtubeUrl : null;

  return {
    youtubeUrl,
    rating: rating?.rating ?? null,
    ratingSource: rating?.rating ? (rating.ratingSource ?? null) : null,
  };
}
