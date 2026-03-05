/**
 * Review content filter: emoji stripping and disallowed words/phrases.
 * Uses src/data/reviewFilter.json for blocklist.
 */

import filterData from "../data/reviewFilter.json";
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

/** Regex to remove emoji and other symbols (Unicode). Keeps letters, numbers, basic punctuation. */
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;
const NON_ASCII_REGEX = /[^\x00-\x7F]/;

const obscenityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

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
  const source = String(text || "");
  const lower = source.toLowerCase();

  if (obscenityMatcher.hasMatch(source)) {
    return { blocked: true, matched: "obscenity" };
  }

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
 * Restrict review text to English/ASCII characters only.
 * @param {string} text
 * @returns {boolean}
 */
export function containsNonEnglishChars(text) {
  return NON_ASCII_REGEX.test(String(text || ""));
}

/**
 * Validate and normalize review text before persisting.
 * @param {string} text
 * @param {{ words: string[], phrases: string[] }} [filter]
 * @returns {{ valid: boolean, text: string, message?: string }}
 */
export function validateReviewText(text, filter) {
  const cleaned = stripEmoji(text);
  if (!cleaned) {
    return { valid: true, text: "" };
  }

  if (containsNonEnglishChars(cleaned)) {
    return {
      valid: false,
      text: cleaned,
      message: "Only English reviews are allowed.",
    };
  }

  const disallowed = containsDisallowed(cleaned, filter);
  if (disallowed.blocked) {
    return {
      valid: false,
      text: cleaned,
      message: "Review contains content that isn't allowed.",
    };
  }

  return { valid: true, text: cleaned };
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
