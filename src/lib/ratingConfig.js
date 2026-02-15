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
  { key: "ecsCapstoneSDP", label: "ECS / Capstone support" },
];

export const RATING_FIELDS = [...THEORY_FIELDS, ...LAB_FIELDS, ...ECS_FIELDS];

export const RATING_LABELS = {
  1: "Death",
  2: "Rod",
  3: "Moderate",
  4: "Loose",
  5: "God",
};

export const RATING_ORDER = [1, 2, 3, 4, 5];

export const THEORY_NOTE_OPTIONS = ["No", "Yes"];

export const LAB_NOTE_OPTIONS = [
  { value: "None", label: "None" },
  { value: "Soft", label: "Soft" },
  { value: "Hard", label: "Hard" },
  { value: "Both", label: "Both" },
];
