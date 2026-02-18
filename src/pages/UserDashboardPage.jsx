import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import publicFacultyService from "../services/publicFacultyService.js";
import courseService from "../services/courseService.js";
import accountDeletionService, {
  DELETION_DELAY_MS,
} from "../services/accountDeletionService.js";
import ConfirmOverlay from "../components/ConfirmOverlay.jsx";

const RATING_EDIT_FIELDS = [
  ["theoryTeaching", "Theory teaching"],
  ["theoryAttendance", "Theory attendance"],
  ["theoryClass", "Theory class"],
  ["theoryCorrection", "Theory correction"],
  ["labClass", "Lab class"],
  ["labCorrection", "Lab correction"],
  ["labAttendance", "Lab attendance"],
  ["ecsCapstoneSDP", "ECS/Capstone"],
];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toEditForm(entry) {
  const form = {
    review: String(entry?.review || ""),
    courseId: String(entry?.courseId || ""),
    theoryNotes: Boolean(entry?.theoryNotes),
    labNotes: String(entry?.labNotes || "None"),
  };
  for (const [key] of RATING_EDIT_FIELDS) {
    const value = Number(entry?.[key]);
    form[key] = Number.isFinite(value) && value >= 1 && value <= 5 ? value : "";
  }
  return form;
}

export default function UserDashboardPage({ currentUser, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]);
  const [facultyLookup, setFacultyLookup] = useState({});
  const [editForms, setEditForms] = useState({});
  const [originalForms, setOriginalForms] = useState({});
  const [changedEntries, setChangedEntries] = useState(new Set());
  const [courseQueries, setCourseQueries] = useState({});
  const [courseSuggestions, setCourseSuggestions] = useState({});
  const [courseLookup, setCourseLookup] = useState({});
  const [deletionSchedule, setDeletionSchedule] = useState(null);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(null);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] =
    useState(false);
  const [showDeleteFeedbackConfirm, setShowDeleteFeedbackConfirm] =
    useState(false);
  const [pendingDeleteFeedback, setPendingDeleteFeedback] = useState(null);
  const [showDeleteReviewConfirm, setShowDeleteReviewConfirm] = useState(false);
  const [pendingDeleteReview, setPendingDeleteReview] = useState(null);
  const [showCancelDeletionConfirm, setShowCancelDeletionConfirm] =
    useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [expandedFaculty, setExpandedFaculty] = useState(new Set());

  const userId = String(currentUser?.$id || "").trim();

  // Group entries by faculty
  const entriesByFaculty = useMemo(() => {
    const grouped = new Map();
    for (const entry of entries) {
      const facultyId = String(entry.facultyId || "").trim();
      if (!grouped.has(facultyId)) {
        grouped.set(facultyId, []);
      }
      grouped.get(facultyId).push(entry);
    }
    return grouped;
  }, [entries]);

  const toggleFaculty = (facultyId) => {
    setExpandedFaculty((prev) => {
      const next = new Set(prev);
      if (next.has(facultyId)) {
        next.delete(facultyId);
      } else {
        next.add(facultyId);
      }
      return next;
    });
  };

  const deletionCountdown = useMemo(() => {
    if (!deletionSchedule?.executeAt) return null;
    const executeAt = new Date(deletionSchedule.executeAt).getTime();
    if (!Number.isFinite(executeAt)) return null;
    const remainingMs = Math.max(0, executeAt - Date.now());
    const hours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return hours;
  }, [deletionSchedule]);

  const refreshEntries = async () => {
    if (!userId) return;
    const rows = await facultyFeedbackService.getUserFeedbackEntries(
      userId,
      500,
    );
    setEntries(rows);

    // Initialize edit forms and course queries for all entries
    const forms = {};
    const queries = {};
    for (const row of rows) {
      forms[row.$id] = toEditForm(row);
      queries[row.$id] = "";
    }
    setEditForms(forms);
    setOriginalForms(JSON.parse(JSON.stringify(forms))); // Deep copy
    setChangedEntries(new Set());
    setCourseQueries(queries);

    // Load course lookup for existing courseIds
    const courseIds = [
      ...new Set(
        rows.map((row) => String(row.courseId || "").trim()).filter(Boolean),
      ),
    ];
    if (courseIds.length > 0) {
      const courseEntries = await Promise.all(
        courseIds.map(async (courseId) => {
          const course = await courseService.getCourseById(courseId);
          return [courseId, course];
        }),
      );
      const courseMap = {};
      for (const [courseId, course] of courseEntries) {
        if (course) courseMap[courseId] = course;
      }
      setCourseLookup(courseMap);
    }

    const facultyIds = [
      ...new Set(
        rows.map((row) => String(row.facultyId || "").trim()).filter(Boolean),
      ),
    ];
    if (!facultyIds.length) {
      setFacultyLookup({});
      return;
    }

    const loaded = await Promise.all(
      facultyIds.map(async (facultyId) => {
        const record = await publicFacultyService.getFacultyById(facultyId);
        return [facultyId, record];
      }),
    );

    const map = {};
    for (const [facultyId, record] of loaded) {
      if (record) map[facultyId] = record;
    }
    setFacultyLookup(map);
  };

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await refreshEntries();
        if (!active) return;
        setDeletionSchedule(
          accountDeletionService.getScheduledDeletion(userId),
        );
      } catch (loadError) {
        if (active) {
          setError(loadError?.message || "Failed to load dashboard data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [userId]);

  // Course search effect
  useEffect(() => {
    const activeSearches = Object.entries(courseQueries).filter(
      ([_, query]) => query && query.trim(),
    );

    if (activeSearches.length === 0) return;

    const timers = activeSearches.map(([entryId, query]) => {
      return setTimeout(async () => {
        try {
          const courses = await courseService.searchCourses(query.trim(), 8);
          setCourseSuggestions((prev) => ({
            ...prev,
            [entryId]: courses,
          }));
        } catch {
          setCourseSuggestions((prev) => ({
            ...prev,
            [entryId]: [],
          }));
        }
      }, 250);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [courseQueries]);

  if (!currentUser) {
    return <Navigate to="/faculty" replace />;
  }

  const handleScheduleDeletion = () => {
    setShowDeleteAccountConfirm(true);
  };

  const confirmScheduleDeletion = () => {
    const schedule = accountDeletionService.scheduleDeletion(
      userId,
      DELETION_DELAY_MS,
    );
    setDeletionSchedule(schedule);
    setShowDeleteAccountConfirm(false);
  };

  const handleCancelDeletion = () => {
    setShowCancelDeletionConfirm(true);
  };

  const confirmCancelDeletion = () => {
    accountDeletionService.cancelDeletion(userId);
    setDeletionSchedule(null);
    setShowCancelDeletionConfirm(false);
  };

  const initiateDeleteFeedback = (entry) => {
    setPendingDeleteFeedback(entry);
    setShowDeleteFeedbackConfirm(true);
  };

  const confirmDeleteFeedback = async () => {
    if (!pendingDeleteFeedback) return;
    try {
      setSaving(true);
      setError(null);
      await facultyFeedbackService.deleteUserFacultyFeedback(
        userId,
        pendingDeleteFeedback.facultyId,
      );
      await refreshEntries();
    } catch (deleteError) {
      setError(deleteError?.message || "Failed to delete feedback.");
    } finally {
      setSaving(false);
      setShowDeleteFeedbackConfirm(false);
      setPendingDeleteFeedback(null);
    }
  };

  const handleDeleteFeedback = async (entry) => {
    initiateDeleteFeedback(entry);
  };

  const initiateDeleteReview = (entry) => {
    setPendingDeleteReview(entry);
    setShowDeleteReviewConfirm(true);
  };

  const confirmDeleteReview = async () => {
    if (!pendingDeleteReview) return;
    try {
      setSaving(true);
      setError(null);
      await facultyFeedbackService.submitFeedback({
        ...pendingDeleteReview,
        userId,
        facultyId: pendingDeleteReview.facultyId,
        review: "",
      });
      await refreshEntries();
    } catch (deleteError) {
      setError(deleteError?.message || "Failed to delete review.");
    } finally {
      setSaving(false);
      setShowDeleteReviewConfirm(false);
      setPendingDeleteReview(null);
    }
  };

  const handleDeleteReview = async (entry) => {
    initiateDeleteReview(entry);
  };

  const updateEditForm = (entryId, updates) => {
    setEditForms((prev) => {
      const updated = { ...prev, [entryId]: { ...prev[entryId], ...updates } };
      // Check if changed
      const hasChanges =
        JSON.stringify(updated[entryId]) !==
        JSON.stringify(originalForms[entryId]);
      setChangedEntries((prevChanged) => {
        const newChanged = new Set(prevChanged);
        if (hasChanges) {
          newChanged.add(entryId);
        } else {
          newChanged.delete(entryId);
        }
        return newChanged;
      });
      return updated;
    });
  };

  const selectCourse = (entryId, course) => {
    updateEditForm(entryId, { courseId: course.$id });
    setCourseQueries((prev) => ({ ...prev, [entryId]: "" }));
    setCourseSuggestions((prev) => ({ ...prev, [entryId]: [] }));
    setCourseLookup((prev) => ({ ...prev, [course.$id]: course }));
  };

  const clearCourse = (entryId) => {
    updateEditForm(entryId, { courseId: "" });
    setCourseQueries((prev) => ({ ...prev, [entryId]: "" }));
    setCourseSuggestions((prev) => ({ ...prev, [entryId]: [] }));
  };

  const initiateUpdate = (entry) => {
    setPendingUpdate(entry);
    setShowUpdateConfirm(true);
  };

  const confirmUpdate = async () => {
    if (!pendingUpdate) return;
    await saveEdit(pendingUpdate);
    setShowUpdateConfirm(false);
    setPendingUpdate(null);
  };

  const initiateCancelChanges = (entryId) => {
    setPendingCancel(entryId);
    setShowCancelConfirm(true);
  };

  const confirmCancelChanges = () => {
    if (!pendingCancel) return;
    cancelChanges(pendingCancel);
    setShowCancelConfirm(false);
    setPendingCancel(null);
  };

  const cancelChanges = (entryId) => {
    const original = originalForms[entryId];
    if (!original) return;

    // Restore original values
    setEditForms((prev) => ({
      ...prev,
      [entryId]: { ...original },
    }));

    // Clear from changed entries
    setChangedEntries((prev) => {
      const newChanged = new Set(prev);
      newChanged.delete(entryId);
      return newChanged;
    });

    // Clear course search state
    setCourseQueries((prev) => ({ ...prev, [entryId]: "" }));
    setCourseSuggestions((prev) => ({ ...prev, [entryId]: [] }));
  };

  const saveEdit = async (entry) => {
    const editForm = editForms[entry.$id];
    if (!editForm) return;
    try {
      setSaving(true);
      setError(null);
      const payload = {
        userId,
        facultyId: entry.facultyId,
        courseId: String(editForm.courseId || "").trim(),
        review: String(editForm.review || "").trim(),
        theoryNotes: Boolean(editForm.theoryNotes),
        labNotes: String(editForm.labNotes || "None"),
      };

      for (const [key] of RATING_EDIT_FIELDS) {
        const value = Number(editForm[key]);
        if (Number.isFinite(value) && value >= 1 && value <= 5) {
          payload[key] = value;
        }
      }

      await facultyFeedbackService.submitFeedback(payload);
      await refreshEntries();
    } catch (saveError) {
      setError(saveError?.message || "Failed to save feedback.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="p-4 shadow-(--shadow-card)">
        <h1 className="text-5xl font-bold text-(--text)">My Dashboard</h1>
        <p className="mt-3 text-sm text-(--muted)">
          Manage your account, ratings, and reviews.
        </p>
      </section>

      {/* User Details Section */}
      <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-5 shadow-(--shadow-card)">
        <h2 className="mb-4 text-lg font-semibold text-(--text)">
          Account Details
        </h2>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-medium text-(--muted) w-24">
              Email:
            </span>
            <span className="text-sm text-(--text)">
              {currentUser?.email || "N/A"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-medium text-(--muted) w-24">
              Name:
            </span>
            <span className="text-sm text-(--text)">
              {currentUser?.name || "N/A"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-medium text-(--muted) w-24">
              User ID:
            </span>
            <span className="text-xs font-mono text-(--muted)">
              {userId || "N/A"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-medium text-(--muted) w-24">
              Joined:
            </span>
            <span className="text-sm text-(--text)">
              {currentUser ? formatDate(currentUser.$createdAt) : "N/A"}
            </span>
          </div>
        </div>

        {/* Account Deletion */}
        <div className="mt-6 pt-6 border-t border-(--line)">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-(--text)">
                Account Deletion
              </h3>
              <p className="text-xs text-(--muted)">
                Deletion executes after 1 day. You can cancel before timeout.
              </p>
            </div>
            {!deletionSchedule ? (
              <button
                type="button"
                onClick={handleScheduleDeletion}
                className="rounded-xl border border-red-400 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/20"
                disabled={saving}
              >
                Request account deletion
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelDeletion}
                className="rounded-xl border border-(--line) bg-(--panel) px-4 py-2 text-sm font-semibold text-(--text) hover:bg-(--bg-elev)"
              >
                Cancel deletion request
              </button>
            )}
          </div>

          {deletionSchedule ? (
            <p className="mt-3 rounded-lg border border-(--line) bg-(--panel) px-3 py-2 text-sm text-(--muted)">
              Scheduled for: {formatDate(deletionSchedule.executeAt)}
              {deletionCountdown != null
                ? ` (about ${deletionCountdown}h left)`
                : ""}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-5 shadow-(--shadow-card)">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-(--text)">My Feedback</h2>
          <span className="text-xs text-(--muted)">
            {entries.length} entries
          </span>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-(--muted)">Loading your feedback...</p>
        ) : entries.length === 0 ? (
          <p className="rounded-lg border border-(--line) bg-(--panel) px-3 py-3 text-sm text-(--muted)">
            You have not posted any ratings/reviews yet.
          </p>
        ) : (
          <div className="space-y-3">
            {Array.from(entriesByFaculty.entries()).map(
              ([facultyId, facultyEntries]) => {
                const facultyRecord = facultyLookup[facultyId];
                const isExpanded = expandedFaculty.has(facultyId);

                return (
                  <div
                    key={facultyId}
                    className="rounded-xl border border-(--line) bg-(--panel) overflow-hidden"
                  >
                    {/* Faculty Header - Clickable */}
                    <button
                      type="button"
                      onClick={() => toggleFaculty(facultyId)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-(--bg-elev) transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className={`w-4 h-4 text-(--muted) transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-(--text)">
                            {facultyRecord?.name ||
                              `Faculty ${facultyId || "-"}`}
                          </p>
                          <p className="text-xs text-(--muted)">
                            {facultyEntries.length}{" "}
                            {facultyEntries.length === 1 ? "entry" : "entries"}
                          </p>
                        </div>
                      </div>
                      <Link
                        to={`/faculty/${facultyId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-1.5 text-xs font-medium text-(--text) hover:border-(--primary)/50"
                      >
                        View Faculty
                      </Link>
                    </button>

                    {/* Faculty Entries - Collapsible */}
                    {isExpanded && (
                      <div className="border-t border-(--line) space-y-3 p-3">
                        {facultyEntries.map((entry) => {
                          const editForm =
                            editForms[entry.$id] || toEditForm(entry);
                          return (
                            <article
                              key={entry.$id}
                              className="rounded-lg border border-(--line) bg-(--bg-elev) p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs text-(--muted)">
                                    Updated: {formatDate(entry.$updatedAt)}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReview(entry)}
                                    className="rounded-lg border border-(--line) bg-(--panel) px-3 py-1.5 text-xs font-medium text-(--text) hover:border-(--primary)/50"
                                    disabled={saving}
                                  >
                                    Delete Review
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFeedback(entry)}
                                    className="rounded-lg border border-red-400 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20"
                                    disabled={saving}
                                  >
                                    Delete Feedback
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 space-y-3">
                                <div className="relative">
                                  <label className="mb-1 block text-xs font-medium text-(--muted)">
                                    Course (Optional)
                                  </label>
                                  {editForm.courseId &&
                                  courseLookup[editForm.courseId] ? (
                                    <div className="flex items-center gap-2 rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2">
                                      <span className="flex-1 text-sm text-(--text)">
                                        {
                                          courseLookup[editForm.courseId]
                                            .courseCode
                                        }{" "}
                                        -{" "}
                                        {
                                          courseLookup[editForm.courseId]
                                            .courseName
                                        }
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => clearCourse(entry.$id)}
                                        className="text-xs text-(--muted) hover:text-red-600"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <input
                                        type="text"
                                        value={
                                          courseQueries[entry.$id] ||
                                          editForm.courseId ||
                                          ""
                                        }
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          setCourseQueries((prev) => ({
                                            ...prev,
                                            [entry.$id]: value,
                                          }));
                                          // Also update courseId directly
                                          updateEditForm(entry.$id, {
                                            courseId: value,
                                          });
                                        }}
                                        placeholder="Type course code/name to search or enter directly..."
                                        className="w-full rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2 text-sm outline-none focus:border-(--primary)"
                                      />
                                      {courseSuggestions[entry.$id]?.length >
                                        0 && (
                                        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-(--line) bg-(--bg) shadow-lg">
                                          {courseSuggestions[entry.$id].map(
                                            (course) => (
                                              <button
                                                key={course.$id}
                                                type="button"
                                                onClick={() =>
                                                  selectCourse(
                                                    entry.$id,
                                                    course,
                                                  )
                                                }
                                                className="block w-full border-b border-(--line) px-3 py-2 text-left text-xs hover:bg-(--panel) last:border-b-0"
                                              >
                                                {course.courseCode} -{" "}
                                                {course.courseName}
                                              </button>
                                            ),
                                          )}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-(--muted)">
                                    Review
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={editForm.review}
                                    onChange={(e) =>
                                      updateEditForm(entry.$id, {
                                        review: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2 text-sm outline-none focus:border-(--primary)"
                                    placeholder="Write your review"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-xs font-medium text-(--muted)">
                                    Ratings
                                  </label>
                                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {RATING_EDIT_FIELDS.map(([key, label]) => (
                                      <label
                                        key={key}
                                        className="rounded-lg border border-(--line) bg-(--bg-elev) px-2 py-2"
                                      >
                                        <span className="mb-1 block text-[11px] text-(--muted)">
                                          {label}
                                        </span>
                                        <select
                                          value={editForm[key]}
                                          onChange={(e) => {
                                            updateEditForm(entry.$id, {
                                              [key]:
                                                e.target.value === ""
                                                  ? ""
                                                  : Number(e.target.value),
                                            });
                                          }}
                                          className="w-full rounded border border-(--line) bg-(--panel) px-2 py-1 text-xs outline-none focus:border-(--primary)"
                                        >
                                          <option value="">-</option>
                                          {[1, 2, 3, 4, 5].map((value) => (
                                            <option key={value} value={value}>
                                              {value}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {changedEntries.has(entry.$id) && (
                                  <div className="flex justify-end gap-2 border-t border-(--line) pt-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        initiateCancelChanges(entry.$id)
                                      }
                                      disabled={saving}
                                      className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-xs font-semibold text-(--text) hover:bg-(--bg-elev) disabled:opacity-60"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => initiateUpdate(entry)}
                                      disabled={saving}
                                      className="rounded-lg bg-(--primary) px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                    >
                                      {saving ? "Updating..." : "Update"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}
      </section>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowLogoutConfirm(true)}
          className="rounded-xl border border-(--line) bg-(--panel) px-4 py-2 text-sm font-semibold text-(--text) hover:bg-(--bg-elev)"
        >
          Logout
        </button>
      </div>

      <ConfirmOverlay
        open={showUpdateConfirm}
        title="Update Feedback"
        message="Are you sure you want to update this feedback entry?"
        confirmLabel="Update"
        cancelLabel="Cancel"
        onConfirm={confirmUpdate}
        onCancel={() => {
          setShowUpdateConfirm(false);
          setPendingUpdate(null);
        }}
        loading={saving}
      />

      <ConfirmOverlay
        open={showCancelConfirm}
        title="Discard Changes"
        message="Are you sure you want to discard all unsaved changes?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        onConfirm={confirmCancelChanges}
        onCancel={() => {
          setShowCancelConfirm(false);
          setPendingCancel(null);
        }}
      />

      <ConfirmOverlay
        open={showDeleteAccountConfirm}
        title="Delete Account"
        message="Are you sure you want to schedule your account for deletion? This action will delete your account and all associated data after 1 day. You can cancel this request before the deletion executes."
        confirmLabel="Yes, Delete My Account"
        cancelLabel="Cancel"
        onConfirm={confirmScheduleDeletion}
        onCancel={() => setShowDeleteAccountConfirm(false)}
      />

      <ConfirmOverlay
        open={showDeleteFeedbackConfirm}
        title="Delete Feedback"
        message="Are you sure you want to delete this entire feedback entry? This will remove all ratings and reviews for this faculty member."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteFeedback}
        onCancel={() => {
          setShowDeleteFeedbackConfirm(false);
          setPendingDeleteFeedback(null);
        }}
        loading={saving}
      />

      <ConfirmOverlay
        open={showDeleteReviewConfirm}
        title="Delete Review"
        message="Are you sure you want to delete only the review text? Your ratings will be kept."
        confirmLabel="Delete Review"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteReview}
        onCancel={() => {
          setShowDeleteReviewConfirm(false);
          setPendingDeleteReview(null);
        }}
        loading={saving}
      />

      <ConfirmOverlay
        open={showCancelDeletionConfirm}
        title="Cancel Deletion"
        message="Are you sure you want to cancel your account deletion request? Your account will not be deleted."
        confirmLabel="Cancel Deletion"
        cancelLabel="Keep Request"
        onConfirm={confirmCancelDeletion}
        onCancel={() => setShowCancelDeletionConfirm(false)}
      />

      <ConfirmOverlay
        open={showLogoutConfirm}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmLabel="Logout"
        cancelLabel="Stay"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
