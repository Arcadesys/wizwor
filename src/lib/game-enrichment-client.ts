import type { GameEnrichmentResult } from "@/lib/wizard/game-enrichment";

const cacheStorageKey = "wyrm-terminal-game-enrichment";
// The video + rating lookups run in parallel server-side but each does its
// own multi-step web search; testing showed the video lookup alone can take
// ~20s for an obscure title, so this needs real headroom, not a snappy UI
// timeout.
const fetchTimeoutMs = 28000;

type CachedEnrichment = GameEnrichmentResult & {
  fetchedAt: number;
};

function getStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function readCache(): Record<string, CachedEnrichment> {
  try {
    const raw = getStorage()?.getItem(cacheStorageKey);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, CachedEnrichment>) : {};
  } catch {
    return {};
  }
}

export function getCachedEnrichment(id: string): CachedEnrichment | null {
  return readCache()[id] ?? null;
}

export function setCachedEnrichment(id: string, result: GameEnrichmentResult): void {
  try {
    const cache = readCache();
    cache[id] = { ...result, fetchedAt: Date.now() };
    getStorage()?.setItem(cacheStorageKey, JSON.stringify(cache));
  } catch (error) {
    console.warn("Failed to persist game enrichment cache:", error);
  }
}

// Never throws — a slow/hung search or a network error resolves to "nothing
// found" so the caller can fall back to the existing search-link UI instead
// of hanging on a spinner forever.
export async function fetchEnrichment(input: { title: string; platform: string; year: string }): Promise<GameEnrichmentResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    const response = await fetch("/api/enrich-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { youtubeUrl: null, rating: null, ratingSource: null };
    }

    const result = (await response.json()) as Partial<GameEnrichmentResult>;
    return {
      youtubeUrl: typeof result.youtubeUrl === "string" ? result.youtubeUrl : null,
      rating: typeof result.rating === "number" ? result.rating : null,
      ratingSource: typeof result.ratingSource === "string" ? result.ratingSource : null,
    };
  } catch {
    return { youtubeUrl: null, rating: null, ratingSource: null };
  } finally {
    window.clearTimeout(timeout);
  }
}
