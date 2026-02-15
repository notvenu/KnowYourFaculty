/**
 * Review content filter: emoji stripping and disallowed words/phrases.
 * Uses src/data/reviewFilter.json for blocklist.
 */

import filterData from "../data/reviewFilter.json";

/** Regex to remove emoji and other symbols (Unicode). Keeps letters, numbers, basic punctuation. */
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu;

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

  for (const phrase of phrases) {
    const p = String(phrase || "").trim();
    if (p && lower.includes(p.toLowerCase())) {
      return { blocked: true, matched: p };
    }
  }
  const wordBoundary = (w) => {
    const s = String(w || "").trim().toLowerCase();
    if (!s) return false;
    const re = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return re.test(lower);
  };
  for (const word of words) {
    if (wordBoundary(word)) {
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

  for (const phrase of phrases) {
    const p = String(phrase || "").trim();
    if (p) {
      const re = new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      out = out.replace(re, "***");
    }
  }
  for (const word of words) {
    const w = String(word || "").trim();
    if (w) {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      out = out.replace(re, "***");
    }
  }
  return out;
}
