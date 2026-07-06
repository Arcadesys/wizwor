// A curated or enriched playthroughUrl is a single-video watch URL; a
// generated-catalog fallback is a youtube.com/results search page, which
// can't be embedded. This is the one place that tells the two apart.
export function youTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

// Guards against a hallucinated or wrong-domain URL slipping through an LLM
// tool call's output schema before the server trusts it.
export function isYouTubeWatchUrl(url: string): boolean {
  return youTubeEmbedUrl(url) !== null;
}
