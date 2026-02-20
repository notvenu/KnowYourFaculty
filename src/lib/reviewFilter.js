/**
 * Review content filter: emoji stripping and disallowed words/phrases.
 * Uses src/data/reviewFilter.json for blocklist.
 */

import filterData from "../data/reviewFilter.json";

/** Regex to remove emoji and other symbols (Unicode). Keeps letters, numbers, basic punctuation. */
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;

/**
 * Remove emoji and similar symbols from text (no trim). Use for live input.
 * @param {string} text
 * @returns {string}
 */
export function stripEmojiChars(text) {
  if (typeof text !== "string") return "";
  return text.replace(EMOJI_REGEX, "");
}

/**
 * Remove emoji and trim. Use when submitting or validating.
 * @param {string} text
 * @returns {string}
 */
export function stripEmoji(text) {
  return stripEmojiChars(text).trim();
}

/**
 * Get filter config (words and phrases). Sync from bundled JSON.
 * @returns {{ words: string[], phrases: string[] }}
 */
export function getReviewFilter() {
  return {
    words: Array.isArray(filterData.words) ? filterData.words : [],
    phrases: Array.isArray(filterData.phrases) ? filterData.phrases : [],
  };
}

/**
 * Check if text contains any disallowed word or phrase (case-insensitive).
 * @param {string} text
 * @param {{ words: string[], phrases: string[] }} [filter] - optional, uses getReviewFilter() if not passed
 * @returns {{ blocked: boolean, matched?: string }}
 */
export function containsDisallowed(text, filter) {
  const { words, phrases } = filter || getReviewFilter();
  const lower = String(text || "").toLowerCase();

  const escapeRegex = (value) =>
    String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const hasUnicodeLetters = (value) =>
    /[^\p{ASCII}]/u.test(String(value || ""));

  const containsWord = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase();
    if (!normalized) return false;
    const escaped = escapeRegex(normalized);

    if (!hasUnicodeLetters(normalized)) {
      const boundaryRegex = new RegExp(`\\b${escaped}\\b`, "i");
      return boundaryRegex.test(lower);
    }

    const unicodeBoundaryRegex = new RegExp(
      `(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`,
      "iu",
    );
    return unicodeBoundaryRegex.test(lower);
  };

  for (const phrase of phrases) {
    const p = String(phrase || "").trim();
    if (p && lower.includes(p.toLowerCase())) {
      return { blocked: true, matched: p };
    }
  }
  for (const word of words) {
    if (containsWord(word)) {
      return { blocked: true, matched: String(word).trim() };
    }
  }
  return { blocked: false };
}

/**
 * Censor disallowed words and phrases in text (replace with ***).
 * @param {string} text
 * @param {{ words: string[], phrases: string[] }} [filter]
 * @returns {string}
 */
export function censorReviewText(text, filter) {
  let out = String(text || "");
  const { words, phrases } = filter || getReviewFilter();

  const escapeRegex = (value) =>
    String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const hasUnicodeLetters = (value) =>
    /[^\p{ASCII}]/u.test(String(value || ""));

  for (const phrase of phrases) {
    const p = String(phrase || "").trim();
    if (p) {
      const re = new RegExp(escapeRegex(p), "giu");
      out = out.replace(re, "***");
    }
  }
  for (const word of words) {
    const w = String(word || "").trim();
    if (w) {
      const escaped = escapeRegex(w);
      const re = hasUnicodeLetters(w)
        ? new RegExp(
            `(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`,
            "giu",
          )
        : new RegExp(`\\b${escaped}\\b`, "gi");
      out = hasUnicodeLetters(w)
        ? out.replace(re, "$1***")
        : out.replace(re, "***");
    }
  }
  return out;
}
