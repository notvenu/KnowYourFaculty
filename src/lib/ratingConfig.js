/**
 * Shared rating field and label config (must match facultyFeedbackService SECTION_FIELDS).
 */

export const THEORY_FIELDS = [
  { key: "theoryTeaching", label: "Teaching experience" },
  { key: "theoryAttendance", label: "Attendance strictness" },
  { key: "theoryClass", label: "Class quality" },
  { key: "theoryCorrection", label: "Correction fairness" },
];

export const LAB_FIELDS = [
  { key: "labClass", label: "Lab class support" },
  { key: "labCorrection", label: "Lab correction" },
  { key: "labAttendance", label: "Lab attendance" },
];

export const ECS_FIELDS = [
  { key: "ecsCapstoneSDPReview", label: "ECS / Capstone review" },
  { key: "ecsCapstoneSDPCorrection", label: "ECS / Capstone correction" },
];

export const RATING_FIELDS = [...THEORY_FIELDS, ...LAB_FIELDS, ...ECS_FIELDS];

// Tier-based rating system: S, A, B, C, D
export const TIER_SYSTEM = {
  S: { value: 5, label: "S", color: "#16a34a", description: "Exceptional" },
  A: { value: 4, label: "A", color: "#65a30d", description: "Excellent" },
  B: { value: 3, label: "B", color: "#ca8a04", description: "Good" },
  C: { value: 2, label: "C", color: "#ea580c", description: "Average" },
  D: { value: 1, label: "D", color: "#dc2626", description: "Poor" },
};

// Legacy support - map numeric ratings to tiers
export const RATING_LABELS = {
  1: "D",
  2: "C",
  3: "B",
  4: "A",
  5: "S",
};

export const RATING_ORDER = [1, 2, 3, 4, 5];

// Convert numeric rating to tier
export function getTierFromRating(rating) {
  const num = Math.round(Number(rating));
  if (num >= 4.5) return "S";
  if (num >= 3.5) return "A";
  if (num >= 2.5) return "B";
  if (num >= 1.5) return "C";
  return "D";
}

// Convert tier to numeric rating
export function getRatingFromTier(tier) {
  return TIER_SYSTEM[tier]?.value || 3;
}

// Get tier color
export function getTierColor(tier) {
  return TIER_SYSTEM[tier]?.color || TIER_SYSTEM.B.color;
}

export const THEORY_NOTE_OPTIONS = ["No", "Yes"];

export const LAB_NOTE_OPTIONS = [
  { value: "None", label: "None" },
  { value: "Soft", label: "Soft" },
  { value: "Hard", label: "Hard" },
  { value: "Both", label: "Both" },
];
