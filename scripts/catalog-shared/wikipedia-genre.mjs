// Fetches real per-game genre text from each game's own Wikipedia infobox,
// batched via the MediaWiki API (up to 50 titles per request). This is the
// only reliable source of genre signal — the console list-tables that feed
// console-catalog-generator.mjs have no genre column at all, so heuristics
// that only look at title/developer/publisher miss most non-franchise games.
const API_URL = "https://en.wikipedia.org/w/api.php";
const BATCH_SIZE = 50;
const USER_AGENT = "wizwor-catalog-generator/1.0 (local development script)";

export function extractGenreField(wikitext) {
  const match = wikitext.match(/\|\s*genre\s*=\s*([^\n]+)/i);
  if (!match) {
    return null;
  }
  return match[1]
    .replace(/\{\{efn[^}]*\}\}/gi, " ")
    .replace(/<ref[^>]*>.*?<\/ref>/gis, " ")
    .replace(/<ref[^>]*\/>/gi, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBatch(titles) {
  const url = new URL(API_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("rvprop", "content");
  url.searchParams.set("rvslots", "main");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", titles.join("|"));

  let response;
  for (let attempt = 0; ; attempt++) {
    response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.status !== 429) {
      break;
    }
    if (attempt >= 5) {
      throw new Error(`Wikipedia API rate-limited us after ${attempt} retries`);
    }
    const retryAfterSeconds = Number(response.headers.get("retry-after")) || 2 ** attempt;
    await sleep(retryAfterSeconds * 1000);
  }
  if (!response.ok) {
    throw new Error(`Wikipedia API request failed: ${response.status} ${response.statusText}`);
  }
  const body = await response.json();

  // Map normalized/redirected titles back to the original requested title so
  // callers can key off the title they already have on each catalog entry.
  const canonicalToRequested = new Map(titles.map((title) => [title, title]));
  for (const { from, to } of body.query?.normalized ?? []) {
    canonicalToRequested.set(to, canonicalToRequested.get(from) ?? from);
  }
  for (const { from, to } of body.query?.redirects ?? []) {
    canonicalToRequested.set(to, canonicalToRequested.get(from) ?? from);
  }

  const result = new Map();
  for (const page of Object.values(body.query?.pages ?? {})) {
    if (page.missing !== undefined || !page.revisions?.length) {
      continue;
    }
    const wikitext = page.revisions[0].slots?.main?.["*"] ?? "";
    const genre = extractGenreField(wikitext);
    if (genre) {
      const requestedTitle = canonicalToRequested.get(page.title) ?? page.title;
      result.set(requestedTitle, genre);
    }
  }
  return result;
}

/**
 * Looks up each title's own Wikipedia article and pulls the infobox "genre"
 * field. Titles with no article, no infobox, or no genre field are simply
 * absent from the returned map — callers fall back to weaker heuristics.
 */
export async function fetchGenreMap(titles, { onProgress } = {}) {
  const uniqueTitles = [...new Set(titles)];
  const genreByTitle = new Map();

  for (let index = 0; index < uniqueTitles.length; index += BATCH_SIZE) {
    const batch = uniqueTitles.slice(index, index + BATCH_SIZE);
    const batchResult = await fetchBatch(batch);
    for (const [title, genre] of batchResult) {
      genreByTitle.set(title, genre);
    }
    onProgress?.(Math.min(index + BATCH_SIZE, uniqueTitles.length), uniqueTitles.length);
    // Be a polite API citizen — a short pause between batches avoids tripping
    // Wikipedia's rate limiter across back-to-back per-console generator runs.
    await sleep(500);
  }

  return genreByTitle;
}
