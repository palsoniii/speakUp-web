// Live topics for Wiki Roulette, pulled from Wikipedia's public REST API.
// Docs: https://en.wikipedia.org/api/rest_v1/#/Page%20content/get_page_random_summary
const RANDOM_SUMMARY_ENDPOINT = "https://en.wikipedia.org/api/rest_v1/page/random/summary";

async function fetchOnce(signal) {
  const res = await fetch(RANDOM_SUMMARY_ENDPOINT, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);
  return res.json();
}

// A large slice of English Wikipedia is one-line taxonomic stubs ("Cyparium
// loebli is a species of beetle in the family Histeridae.") — technically
// English, but no real speaking material and often just a Latin binomial as
// the title. The REST summary's `description` field (Wikidata-derived) is a
// reliable tell for these: it reads exactly like "species of beetle" or
// "genus of flowering plants". Screen those out, along with anything too
// short to talk about for 90+ seconds.
const STUB_DESCRIPTION_RE = /^(species|genus|subspecies|variety|family|order|cultivar|breed|hybrid)\s+of\b/i;
const MIN_EXTRACT_LENGTH = 150;

function isGoodSpeakingTopic(data) {
  if (data.type === "disambiguation") return false;
  const extract = data.extract || "";
  if (extract.length < MIN_EXTRACT_LENGTH) return false;
  const description = data.description || "";
  if (STUB_DESCRIPTION_RE.test(description.trim())) return false;
  return true;
}

// Disambiguation pages, taxonomic stubs, and near-empty extracts make bad
// speaking prompts, so retry a handful of times to land on something with
// real substance. If nothing suitable turns up, the caller falls back to
// the curated static topic list rather than showing a bad live one.
export async function fetchRandomWikiTopic({ maxAttempts = 6, signal } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await fetchOnce(signal);
    if (isGoodSpeakingTopic(data)) return toTopic(data);
  }
  throw new Error("Wikipedia API returned no suitable topic after retries.");
}

function toTopic(data) {
  return {
    title: data.title,
    extract: data.extract || "",
    url: data.content_urls?.desktop?.page || null,
    thumbnail: data.thumbnail?.source || null,
  };
}
