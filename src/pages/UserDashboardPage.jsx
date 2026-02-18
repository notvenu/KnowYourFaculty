import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import publicFacultyService from "../services/publicFacultyService.js";
import accountDeletionService, {
  DELETION_DELAY_MS,
} from "../services/accountDeletionService.js";

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
  return date.toLocaleString();
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
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [deletionSchedule, setDeletionSchedule] = useState(null);

  const userId = String(currentUser?.$id || "").trim();

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

  if (!currentUser) {
    return <Navigate to="/faculty" replace />;
  }

  const handleScheduleDeletion = () => {
    const schedule = accountDeletionService.scheduleDeletion(
      userId,
      DELETION_DELAY_MS,
    );
    setDeletionSchedule(schedule);
  };

  const handleCancelDeletion = () => {
    accountDeletionService.cancelDeletion(userId);
    setDeletionSchedule(null);
  };

  const handleDeleteFeedback = async (entry) => {
    if (!window.confirm("Delete this full feedback entry?")) return;
    try {
      setSaving(true);
      setError(null);
      await facultyFeedbackService.deleteUserFacultyFeedback(
        userId,
        entry.facultyId,
      );
      await refreshEntries();
    } catch (deleteError) {
      setError(deleteError?.message || "Failed to delete feedback.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReview = async (entry) => {
    if (!window.confirm("Delete only review text and keep ratings?")) return;
    try {
      setSaving(true);
      setError(null);
      await facultyFeedbackService.submitFeedback({
        ...entry,
        userId,
        facultyId: entry.facultyId,
        review: "",
      });
      await refreshEntries();
    } catch (deleteError) {
      setError(deleteError?.message || "Failed to delete review.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRatings = async (entry) => {
    if (!window.confirm("Delete ratings and keep only review (if any)?"))
      return;
    try {
      setSaving(true);
      setError(null);
      await facultyFeedbackService.deleteUserFacultyFeedback(
        userId,
        entry.facultyId,
      );

      const reviewText = String(entry.review || "").trim();
      if (reviewText) {
        await facultyFeedbackService.submitFeedback({
          userId,
          facultyId: entry.facultyId,
          courseId: entry.courseId || "",
          review: reviewText,
        });
      }

      await refreshEntries();
    } catch (deleteError) {
      setError(deleteError?.message || "Failed to delete ratings.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry.$id);
    setEditForm(toEditForm(entry));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async (entry) => {
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
      cancelEdit();
      await refreshEntries();
    } catch (saveError) {
      setError(saveError?.message || "Failed to save feedback.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-5 shadow-(--shadow-card)">
        <h1 className="text-2xl font-bold text-(--text)">My Dashboard</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Manage your account, ratings, and reviews.
        </p>
      </section>

      <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-5 shadow-(--shadow-card)">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-(--text)">
              Account Deletion
            </h2>
            <p className="text-xs text-(--muted)">
              Deletion executes after 3 days. You can cancel before timeout.
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
          <div className="space-y-4">
            {entries.map((entry) => {
              const facultyId = String(entry.facultyId || "").trim();
              const facultyRecord = facultyLookup[facultyId];
              const isEditing = editingId === entry.$id;
              return (
                <article
                  key={entry.$id}
                  className="rounded-xl border border-(--line) bg-(--panel) p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-(--text)">
                        {facultyRecord?.name || `Faculty ${facultyId || "-"}`}
                      </p>
                      <p className="text-xs text-(--muted)">
                        Updated: {formatDate(entry.$updatedAt)}
                      </p>
                      <p className="text-xs text-(--muted)">
                        Course: {entry.courseId || "-"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/faculty/${facultyId}`}
                        className="rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-1.5 text-xs font-medium text-(--text) hover:border-(--primary)/50"
                      >
                        Open Faculty
                      </Link>
                      <button
                        type="button"
                        onClick={() => startEdit(entry)}
                        className="rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-1.5 text-xs font-medium text-(--text) hover:border-(--primary)/50"
                        disabled={saving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(entry)}
                        className="rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-1.5 text-xs font-medium text-(--text) hover:border-(--primary)/50"
                        disabled={saving}
                      >
                        Delete Review
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRatings(entry)}
                        className="rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-1.5 text-xs font-medium text-(--text) hover:border-(--primary)/50"
                        disabled={saving}
                      >
                        Delete Ratings
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

                  {!isEditing ? (
                    <>
                      <p className="mt-3 text-sm text-(--muted)">
                        {String(entry.review || "").trim() || "No review"}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {RATING_EDIT_FIELDS.map(([key, label]) => {
                          const value = Number(entry[key]);
                          const shown =
                            Number.isFinite(value) && value >= 1 && value <= 5;
                          return (
                            <div
                              key={key}
                              className="rounded-lg border border-(--line) bg-(--bg-elev) px-2 py-1.5"
                            >
                              <p className="text-[11px] text-(--muted)">
                                {label}
                              </p>
                              <p className="text-sm font-semibold text-(--text)">
                                {shown ? value.toFixed(1) : "-"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <textarea
                        rows={3}
                        value={editForm.review}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            review: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2 text-sm outline-none"
                        placeholder="Write your review"
                      />

                      <input
                        type="text"
                        value={editForm.courseId}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            courseId: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-2 text-sm outline-none"
                        placeholder="Course ID (optional)"
                      />

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
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  [key]:
                                    e.target.value === ""
                                      ? ""
                                      : Number(e.target.value),
                                }))
                              }
                              className="w-full rounded border border-(--line) bg-(--panel) px-2 py-1 text-xs outline-none"
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

                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-lg border border-(--line) bg-(--bg-elev) px-3 py-1.5 text-xs font-medium text-(--text)"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(entry)}
                          className="rounded-lg bg-(--primary) px-3 py-1.5 text-xs font-semibold text-white"
                          disabled={saving}
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onLogout}
          className="rounded-xl border border-(--line) bg-(--panel) px-4 py-2 text-sm font-semibold text-(--text) hover:bg-(--bg-elev)"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
