import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { addToast } from "../store/uiSlice.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPoll,
  faChartBar,
  faToggleOn,
  faToggleOff,
  faEdit,
  faTrash,
  faClock,
  faVoteYea,
} from "@fortawesome/free-solid-svg-icons";
import facultyFeedbackService from "../services/facultyFeedbackService.js";
import publicFacultyService from "../services/publicFacultyService.js";
import courseService from "../services/courseService.js";
import pollService from "../services/pollService.js";
import accountDeletionService, {
  DELETION_DELAY_MS,
} from "../services/accountDeletionService.js";
import authService from "../lib/appwrite/auth.js";
import ConfirmOverlay from "../components/overlays/ConfirmOverlay.jsx";
import CreatePollOverlay from "../components/overlays/CreatePollOverlay.jsx";

const RATING_EDIT_FIELDS = [
  ["theoryTeaching", "Theory teaching"],
  ["theoryAttendance", "Theory attendance"],
  ["theoryClass", "Theory class"],
  ["theoryCorrection", "Theory correction"],
  ["labClass", "Lab class"],
  ["labCorrection", "Lab correction"],
  ["labAttendance", "Lab attendance"],
  ["ecsCapstoneSDPReview", "ECS/Capstone review"],
  ["ecsCapstoneSDPCorrection", "ECS/Capstone correction"],
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
  const dispatch = useDispatch();
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
  const [showInstantDeleteConfirm, setShowInstantDeleteConfirm] =
    useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [expandedFaculty, setExpandedFaculty] = useState(new Set());

  // Polls state
  const [userPolls, setUserPolls] = useState([]);
  const [pollResults, setPollResults] = useState({});
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [pollFilter, setPollFilter] = useState("all"); // all, active, ended
  const [showCreatePollOverlay, setShowCreatePollOverlay] = useState(false);
  const [showEditPollOverlay, setShowEditPollOverlay] = useState(false);
  const [editingPoll, setEditingPoll] = useState(null);
  const [showDeletePollConfirm, setShowDeletePollConfirm] = useState(false);
  const [deletingPoll, setDeletingPoll] = useState(null);

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
        await refreshEntries();
        if (!active) return;
        setDeletionSchedule(
          accountDeletionService.getScheduledDeletion(userId),
        );

        // Load user polls
        await loadUserPolls();
      } catch (loadError) {
        if (active) {
          dispatch(
            addToast({
              message: loadError?.message || "Failed to load dashboard data.",
              type: "error",
            }),
          );
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

  const loadUserPolls = async () => {
    if (!userId) return;
    try {
      setLoadingPolls(true);
      const polls = await pollService.getUserPolls(userId);

      // Auto-deactivate ended polls
      const now = new Date();
      for (const poll of polls) {
        if (poll.isActive) {
          const endTime = new Date(poll.pollEndTime);
          if (now >= endTime) {
            try {
              await pollService.updatePollStatus(poll.$id, false);
              poll.isActive = false;
            } catch (err) {
              console.error("Error auto-deactivating poll:", err);
            }
          }
        }
      }

      setUserPolls(polls);

      // Load results for each poll
      const resultsPromises = polls.map((poll) =>
        pollService.getPollResults(poll.$id),
      );
      const results = await Promise.all(resultsPromises);

      const resultsMap = {};
      polls.forEach((poll, index) => {
        resultsMap[poll.$id] = results[index];
      });
      setPollResults(resultsMap);
    } catch (err) {
      console.error("Error loading user polls:", err);
    } finally {
      setLoadingPolls(false);
    }
  };

  const handleTogglePollStatus = async (pollId, currentStatus, poll) => {
    try {
      // Check if poll has ended
      const now = new Date();
      const endTime = new Date(poll.pollEndTime);

      // Prevent activating an ended poll
      if (!currentStatus && now >= endTime) {
        dispatch(
          addToast({
            message:
              "Cannot activate a poll that has already ended. Please edit the end time first.",
            type: "warning",
            duration: 5000,
          }),
        );
        return;
      }

      await pollService.updatePollStatus(pollId, !currentStatus);
      dispatch(
        addToast({
          message: !currentStatus ? "Poll activated" : "Poll deactivated",
          type: "success",
        }),
      );
      await loadUserPolls();
    } catch (err) {
      console.error("Error toggling poll status:", err);
      dispatch(
        addToast({
          message: err.message || "Failed to toggle poll status",
          type: "error",
        }),
      );
    }
  };

  const handleEditPoll = (poll) => {
    setEditingPoll(poll);
    setShowEditPollOverlay(true);
  };

  const handleDeletePoll = async () => {
    if (!deletingPoll) return;
    try {
      await pollService.deletePoll(deletingPoll.$id);
      setShowDeletePollConfirm(false);
      setDeletingPoll(null);
      dispatch(
        addToast({ message: "Poll deleted successfully", type: "success" }),
      );
      await loadUserPolls();
    } catch (err) {
      console.error("Error deleting poll:", err);
      dispatch(
        addToast({
          message: err.message || "Failed to delete poll",
          type: "error",
        }),
      );
    }
  };

  const handleConfirmDeletePoll = (poll) => {
    setDeletingPoll(poll);
    setShowDeletePollConfirm(true);
  };

  const handlePollCreatedOrUpdated = async () => {
    dispatch(addToast({ message: "Poll saved successfully", type: "success" }));
    await loadUserPolls();
  };

  const isPollActive = (poll) => {
    if (poll.isActive === false) return false;
    const now = new Date();
    const endTime = new Date(poll.pollEndTime);
    const startTime = poll.pollStartTime ? new Date(poll.pollStartTime) : null;
    if (startTime && now < startTime) return false;
    return now < endTime;
  };

  const formatPollDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    // Use user's local timezone automatically
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

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

  const confirmInstantDeletion = async () => {
    try {
      setSaving(true);
      await accountDeletionService.performDeletion({
        userId,
        authService,
        feedbackService: facultyFeedbackService,
      });
      setShowInstantDeleteConfirm(false);
      dispatch(
        addToast({
          message: "Account deleted successfully.",
          type: "success",
        }),
      );
      await onLogout?.();
    } catch (deleteError) {
      dispatch(
        addToast({
          message: deleteError?.message || "Failed to delete account.",
          type: "error",
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const initiateDeleteFeedback = (entry) => {
    setPendingDeleteFeedback(entry);
    setShowDeleteFeedbackConfirm(true);
  };

  const confirmDeleteFeedback = async () => {
    if (!pendingDeleteFeedback) return;
    try {
      setSaving(true);
      await facultyFeedbackService.deleteUserFacultyFeedback(
        userId,
        pendingDeleteFeedback.facultyId,
      );
      await refreshEntries();
      dispatch(
        addToast({ message: "Feedback deleted successfully", type: "success" }),
      );
    } catch (deleteError) {
      dispatch(
        addToast({
          message: deleteError?.message || "Failed to delete feedback.",
          type: "error",
        }),
      );
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
      await facultyFeedbackService.submitFeedback({
        ...pendingDeleteReview,
        userId,
        facultyId: pendingDeleteReview.facultyId,
        review: "",
      });
      await refreshEntries();
      dispatch(
        addToast({ message: "Review deleted successfully", type: "success" }),
      );
    } catch (deleteError) {
      dispatch(
        addToast({
          message: deleteError?.message || "Failed to delete review.",
          type: "error",
        }),
      );
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
      dispatch(
        addToast({ message: "Feedback saved successfully", type: "success" }),
      );
    } catch (saveError) {
      dispatch(
        addToast({
          message: saveError?.message || "Failed to save feedback.",
          type: "error",
        }),
      );
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleScheduleDeletion}
                  className="rounded-xl border border-(--danger) bg-(--danger-light) px-4 py-2 text-sm font-semibold text-(--danger) hover:bg-(--danger-lighter)"
                  disabled={saving}
                >
                  Request account deletion
                </button>
                <button
                  type="button"
                  onClick={() => setShowInstantDeleteConfirm(true)}
                  className="rounded-xl border border-(--danger) bg-(--danger) px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  disabled={saving}
                >
                  Delete account now
                </button>
              </div>
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
                                    className="rounded-lg border border-(--danger) bg-(--danger-light) px-3 py-1.5 text-xs font-medium text-(--danger) hover:bg-(--danger-lighter)"
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
                                        className="text-xs text-(--muted) hover:text-(--danger)"
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

      {/* My Polls Section */}
      <section className="rounded-xl border border-(--line) bg-(--bg-elev) p-5 shadow-(--shadow-card)">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-(--text)">My Polls</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-(--muted)">
              {userPolls.length} {userPolls.length === 1 ? "poll" : "polls"}
            </span>
            <button
              onClick={() => setShowCreatePollOverlay(true)}
              className="rounded-lg bg-(--primary) px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Create Poll
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 border-b border-(--border)">
          <button
            onClick={() => setPollFilter("all")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              pollFilter === "all"
                ? "border-(--primary) text-(--primary)"
                : "border-transparent text-(--muted) hover:text-(--text)"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setPollFilter("active")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              pollFilter === "active"
                ? "border-(--primary) text-(--primary)"
                : "border-transparent text-(--muted) hover:text-(--text)"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setPollFilter("ended")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              pollFilter === "ended"
                ? "border-(--primary) text-(--primary)"
                : "border-transparent text-(--muted) hover:text-(--text)"
            }`}
          >
            Ended
          </button>
        </div>

        {loadingPolls ? (
          <p className="text-sm text-(--muted)">Loading your polls...</p>
        ) : userPolls.length === 0 ? (
          <p className="rounded-lg border border-(--line) bg-(--panel) px-3 py-3 text-sm text-(--muted)">
            You haven't created any polls yet.
          </p>
        ) : (
          (() => {
            const filteredPolls = userPolls.filter((poll) => {
              if (pollFilter === "all") return true;
              const isActive = isPollActive(poll);
              if (pollFilter === "active") return isActive;
              if (pollFilter === "ended") return !isActive;
              return true;
            });

            if (filteredPolls.length === 0) {
              return (
                <p className="rounded-lg border border-(--line) bg-(--panel) px-3 py-3 text-sm text-(--muted)">
                  No {pollFilter} polls found.
                </p>
              );
            }

            return (
              <div className="space-y-3">
                {filteredPolls.map((poll) => {
                  const results = pollResults[poll.$id];
                  const isActive = isPollActive(poll);

                  return (
                    <div
                      key={poll.$id}
                      className="rounded-lg border border-(--line) bg-(--panel) p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FontAwesomeIcon
                              icon={faPoll}
                              className="text-(--primary) text-sm"
                            />
                            <h3 className="text-sm font-semibold text-(--text)">
                              Poll for Faculty/Course
                            </h3>
                          </div>
                          <p className="text-xs text-(--muted)">
                            {poll.pollType === 3 ? "3 Options" : "5 Options"}{" "}
                            poll
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isActive ? (
                            <span className="px-2 py-1 rounded-full bg-(--success-light) text-(--success) text-xs font-medium flex items-center gap-1">
                              <FontAwesomeIcon icon={faVoteYea} />
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-(--secondary) text-(--text) text-xs font-medium flex items-center gap-1">
                              <FontAwesomeIcon icon={faClock} />
                              Ended
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mb-3 text-xs text-(--muted) space-y-1">
                        <div>
                          Started:{" "}
                          {poll.pollStartTime
                            ? formatPollDate(poll.pollStartTime)
                            : "Immediately"}
                        </div>
                        <div>Ends: {formatPollDate(poll.pollEndTime)}</div>
                      </div>

                      {results && (
                        <div className="mb-3 flex items-center gap-2 text-xs text-(--muted)">
                          <FontAwesomeIcon icon={faChartBar} />
                          <span>Total votes: {results.totalVotes || 0}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-(--line)">
                        <button
                          onClick={() =>
                            handleTogglePollStatus(
                              poll.$id,
                              poll.isActive,
                              poll,
                            )
                          }
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2 ${
                            poll.isActive
                              ? "bg-(--success-light) text-(--success) hover:bg-(--success-lighter)"
                              : "bg-(--secondary) text-(--text) hover:opacity-80"
                          }`}
                          title={
                            poll.isActive ? "Deactivate poll" : "Activate poll"
                          }
                        >
                          <FontAwesomeIcon
                            icon={poll.isActive ? faToggleOn : faToggleOff}
                          />
                          {poll.isActive ? "Active" : "Inactive"}
                        </button>

                        <button
                          onClick={() => handleEditPoll(poll)}
                          className="px-3 py-1.5 rounded text-xs font-medium transition-colors bg-(--info-light) text-(--info) hover:bg-(--info-lighter) flex items-center gap-2"
                          title="Edit poll"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                          Edit
                        </button>

                        <button
                          onClick={() => handleConfirmDeletePoll(poll)}
                          className="px-3 py-1.5 rounded text-xs font-medium transition-colors bg-(--danger-light) text-(--danger) hover:bg-(--danger-lighter) flex items-center gap-2"
                          title="Delete poll"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
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
        open={showInstantDeleteConfirm}
        title="Delete Account Now"
        message="This will immediately delete your account and all associated data. This action cannot be undone."
        confirmLabel="Delete Now"
        cancelLabel="Cancel"
        onConfirm={confirmInstantDeletion}
        onCancel={() => setShowInstantDeleteConfirm(false)}
        loading={saving}
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

      {/* Poll Management Overlays */}
      <CreatePollOverlay
        open={showCreatePollOverlay}
        onClose={() => setShowCreatePollOverlay(false)}
        currentUser={currentUser}
        onPollCreated={handlePollCreatedOrUpdated}
      />

      <CreatePollOverlay
        open={showEditPollOverlay}
        onClose={() => {
          setShowEditPollOverlay(false);
          setEditingPoll(null);
        }}
        currentUser={currentUser}
        onPollCreated={handlePollCreatedOrUpdated}
        editMode={true}
        existingPoll={editingPoll}
      />

      <ConfirmOverlay
        open={showDeletePollConfirm}
        title="Delete Poll"
        message="Are you sure you want to delete this poll? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeletePoll}
        onCancel={() => {
          setShowDeletePollConfirm(false);
          setDeletingPoll(null);
        }}
      />
    </div>
  );
}
