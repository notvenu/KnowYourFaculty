import Fuse from "fuse.js";

const FUSE_OPTIONS = {
  includeScore: true,
  includeMatches: true,
  shouldSort: true,
  ignoreLocation: true,
  threshold: 0.4,
  minMatchCharLength: 2,
  useExtendedSearch: false,
  keys: ["value"],
};

function toText(value) {
  return String(value ?? "").trim();
}

function buildDocuments(fields = []) {
  return (fields || [])
    .map((value) => toText(value))
    .filter(Boolean)
    .map((value) => ({ value }));
}

function scoreFromFuseResult(result) {
  if (!result) return 0;
  const normalizedScore = Number(result.score);
  if (!Number.isFinite(normalizedScore)) return 0;

  // Fuse score: 0 is perfect. Convert to "higher is better" (0-200).
  const baseScore = Math.max(0, 1 - normalizedScore) * 180;
  const matchCount = Array.isArray(result.matches) ? result.matches.length : 0;
  const matchBonus = Math.min(20, matchCount * 4);
  return baseScore + matchBonus;
}

function minMatchThreshold(query) {
  const length = toText(query).length;
  if (length <= 2) return 90;
  if (length <= 4) return 72;
  return 58;
}

export function fuzzyScoreAny(fields = [], query = "") {
  const normalizedQuery = toText(query);
  if (!normalizedQuery) return 0;

  const docs = buildDocuments(fields);
  if (docs.length === 0) return 0;

  const fuse = new Fuse(docs, FUSE_OPTIONS);
  const [best] = fuse.search(normalizedQuery, { limit: 1 });
  return scoreFromFuseResult(best);
}

export function fuzzyMatchAny(fields = [], query = "") {
  const normalizedQuery = toText(query);
  if (!normalizedQuery) return true;
  const score = fuzzyScoreAny(fields, normalizedQuery);
  return score >= minMatchThreshold(normalizedQuery);
}
