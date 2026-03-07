import { useEffect, useMemo, useState } from "react";
import facultyFeedbackService from "../../services/facultyFeedbackService.js";
import courseService from "../../services/courseService.js";
import ConfirmOverlay from "../overlays/ConfirmOverlay.jsx";
import { PAGINATION_LIMITS } from "../../config/pagination.js";
import clientConfig from "../../config/client.js";

const ADMIN_ENTRIES_PER_PAGE = PAGINATION_LIMITS.adminEntriesPerPage;

const RATING_FIELDS = [
  "theoryTeaching",
  "theoryAttendance",
  "theoryClass",
  "theoryCorrection",
  "labClass",
  "labCorrection",
  "labAttendance",
  "ecsCapstoneSDPReview",
  "ecsCapstoneSDPCorrection",
];

function toTimeMs(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isFinite(date?.getTime?.()) ? date.getTime() : 0;
  }
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function formatDateTime(value) {
  if (!value) return "N/A";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (!Number.isFinite(date?.getTime?.())) return "N/A";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getRowAverageRating(row) {
  let total = 0;
  let count = 0;
  for (const field of RATING_FIELDS) {
    const value = Number(row?.[field]);
    if (Number.isFinite(value) && value >= 1 && value <= 5) {
      total += value;
      count += 1;
    }
  }
  if (count === 0) return null;
  return total / count;
}

function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [entryFilter, setEntryFilter] = useState("all");
  const [entryPage, setEntryPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [courseForm, setCourseForm] = useState({ file: null });
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Feedback Entries", value: stats.totalEntries },
      { label: "Users Joined", value: stats.usersJoined },
      { label: "Reviews (Recent)", value: stats.totalReviews },
      { label: "Ratings (Recent)", value: stats.totalRatings },
    ];
  }, [stats]);

  const userJoinedSeries = useMemo(() => {
    if (!Array.isArray(feedbackEntries) || feedbackEntries.length === 0) {
      return [];
    }

    const firstSeenByUser = {};
    for (const row of feedbackEntries) {
      const userId = String(row?.userId || "").trim();
      if (!userId) continue;
      const rowTime = toTimeMs(row?.createdAt || row?.updatedAt);
      if (!rowTime) continue;
      if (!firstSeenByUser[userId] || rowTime < firstSeenByUser[userId]) {
        firstSeenByUser[userId] = rowTime;
      }
    }

    const byDate = {};
    for (const time of Object.values(firstSeenByUser)) {
      const day = new Date(time).toISOString().slice(0, 10);
      byDate[day] = (byDate[day] || 0) + 1;
    }

    return Object.entries(byDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10);
  }, [feedbackEntries]);

  const ratingDistribution = useMemo(() => {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of feedbackEntries || []) {
      const avg = getRowAverageRating(row);
      if (!Number.isFinite(avg)) continue;
      const bucket = Math.min(5, Math.max(1, Math.round(avg)));
      dist[bucket] += 1;
    }
    return dist;
  }, [feedbackEntries]);

  const filteredEntries = useMemo(() => {
    const rows = feedbackEntries || [];
    if (entryFilter === "all") return rows;
    if (entryFilter === "reviews") {
      return rows.filter((row) => String(row?.review || "").trim().length > 0);
    }
    if (entryFilter === "ratings") {
      return rows.filter((row) => Number.isFinite(getRowAverageRating(row)));
    }
    return rows;
  }, [feedbackEntries, entryFilter]);

  const totalEntryPages = Math.max(
    1,
    Math.ceil(filteredEntries.length / ADMIN_ENTRIES_PER_PAGE),
  );
  const paginatedEntries = useMemo(() => {
    const start = (entryPage - 1) * ADMIN_ENTRIES_PER_PAGE;
    return filteredEntries.slice(start, start + ADMIN_ENTRIES_PER_PAGE);
  }, [filteredEntries, entryPage]);

  useEffect(() => {
    setEntryPage(1);
  }, [entryFilter]);

  useEffect(() => {
    if (entryPage > totalEntryPages) {
      setEntryPage(totalEntryPages);
    }
  }, [entryPage, totalEntryPages]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [recentRows, totalEntries] = await Promise.all([
        facultyFeedbackService.getRecentFeedbackEntries(200),
        facultyFeedbackService.getFeedbackTotalCount(),
      ]);
      const rows = recentRows || [];

      const users = new Set();
      let reviewsCount = 0;
      let ratingsCount = 0;
      for (const row of rows) {
        const userId = String(row?.userId || "").trim();
        if (userId) users.add(userId);
        if (String(row?.review || "").trim()) reviewsCount += 1;
        if (Number.isFinite(getRowAverageRating(row))) ratingsCount += 1;
      }

      setStats({
        totalEntries: Number(totalEntries || 0),
        usersJoined: users.size,
        totalReviews: reviewsCount,
        totalRatings: ratingsCount,
      });
      setFeedbackEntries(rows);
    } catch (loadError) {
      setError(loadError?.message || "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleSubmitCourse = async (event) => {
    event.preventDefault();
    if (!courseForm.file) {
      setUploadMessage("Please choose a PDF file.");
      return;
    }
    setShowUploadConfirm(true);
  };

  const confirmUploadCourse = async () => {
    try {
      setShowUploadConfirm(false);
      setUploading(true);
      setUploadMessage(null);

      const { extractCoursesFromPdf } = await import("../../lib/parsers/coursePdfParser.js");
      const parsed = await extractCoursesFromPdf(courseForm.file);
      const result = await courseService.upsertCoursesFromPdf({
        courses: parsed.courses,
      });

      setUploadMessage(
        `Processed ${parsed.linesScanned} lines. Extracted ${result.parsedCount}, merged to ${result.mergedCount}, created ${result.created}, updated ${result.updated}.`,
      );
      setCourseForm({ file: null });
      await loadAdminData();
    } catch (submitError) {
      const msg = String(submitError?.message || "");
      const isPermissionError =
        msg.toLowerCase().includes("insufficient permissions") ||
        msg.toLowerCase().includes("permission") ||
        String(submitError?.code || "").toLowerCase().includes("permission-denied");
      if (isPermissionError) {
        const adminsConfigured = (clientConfig.adminEmails || []).length > 0;
        setUploadMessage(
          adminsConfigured
            ? `${msg} If this account should be admin, add it to VITE_ADMIN_EMAILS and redeploy, then deploy Firestore rules.`
            : `${msg} Configure VITE_ADMIN_EMAILS with your admin email and deploy Firestore rules.`,
        );
      } else {
        setUploadMessage(msg || "Unable to save course.");
      }
    } finally {
      setUploading(false);
    }
  };

  const requestDeleteEntry = (entry) => {
    setEntryToDelete(entry);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteEntry = async () => {
    if (!entryToDelete?.$id) return;
    try {
      setDeletingEntry(true);
      await facultyFeedbackService.deleteFeedbackById(entryToDelete.$id);
      setShowDeleteConfirm(false);
      setEntryToDelete(null);
      await loadAdminData();
    } catch (deleteError) {
      setError(deleteError?.message || "Failed to delete feedback entry.");
    } finally {
      setDeletingEntry(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-(--text)">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-(--muted)">
          Manage course uploads, monitor user joins, and moderate reviews and ratings.
        </p>
      </div>

      {loading ? (
        <p className="text-sm font-medium text-(--muted)">Loading...</p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-300 bg-red-500/10 p-4 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-(--line) bg-(--bg-elev) p-5 shadow-(--shadow)"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-(--muted)">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-(--text)">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-(--line) bg-(--bg-elev) p-6 shadow-(--shadow)">
          <h2 className="mb-4 text-lg font-bold text-(--text)">Upload course PDF</h2>
          <form onSubmit={handleSubmitCourse} className="space-y-4">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) =>
                setCourseForm((prev) => ({
                  ...prev,
                  file: e.target.files?.[0] || null,
                }))
              }
              className="w-full rounded-xl border border-(--line) bg-(--panel) px-4 py-2.5 text-sm text-(--text) file:mr-3 file:rounded-lg file:border-0 file:bg-(--primary) file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              required
            />
            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white shadow-(--shadow) disabled:opacity-60"
            >
              {uploading ? "Parsing..." : "Parse PDF and save courses"}
            </button>
            {uploadMessage ? <p className="text-sm text-(--muted)">{uploadMessage}</p> : null}
          </form>
        </div>

        <div className="rounded-lg border border-(--line) bg-(--bg-elev) p-6 shadow-(--shadow)">
          <h2 className="mb-4 text-lg font-bold text-(--text)">Users Joined (Activity Based)</h2>
          {userJoinedSeries.length === 0 ? (
            <p className="text-sm text-(--muted)">No user activity data yet.</p>
          ) : (
            <div className="space-y-3">
              {userJoinedSeries.map((item) => {
                const maxCount = Math.max(...userJoinedSeries.map((x) => x.count), 1);
                const width = Math.max(8, Math.round((item.count / maxCount) * 100));
                return (
                  <div key={item.date} className="rounded-xl border border-(--line) bg-(--panel) px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-(--muted)">{item.date}</span>
                      <span className="text-sm font-bold text-(--primary)">{item.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-(--bg)">
                      <div className="h-2 rounded-full bg-(--primary)" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-(--line) bg-(--bg-elev) p-6 shadow-(--shadow)">
        <h2 className="mb-4 text-lg font-bold text-(--text)">Ratings Distribution</h2>
        {feedbackEntries.length === 0 ? (
          <p className="text-sm text-(--muted)">No ratings yet.</p>
        ) : (
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const maxCount = Math.max(...Object.values(ratingDistribution), 1);
              const count = ratingDistribution[rating] || 0;
              const width = Math.max(4, Math.round((count / maxCount) * 100));
              return (
                <div key={rating} className="rounded-xl border border-(--line) bg-(--panel) px-4 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-(--text)">{rating} Star</span>
                    <span className="text-sm font-bold text-(--primary)">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-(--bg)">
                    <div className="h-2 rounded-full bg-(--primary)" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-(--line) bg-(--bg-elev) p-6 shadow-(--shadow)">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-(--text)">Reviews and Ratings</h2>
          <div className="flex items-center gap-2">
            {["all", "reviews", "ratings"].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setEntryFilter(filter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                  entryFilter === filter
                    ? "bg-(--primary) text-white"
                    : "bg-(--panel) text-(--muted)"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <p className="text-sm text-(--muted)">No matching entries.</p>
        ) : (
          <div className="space-y-2">
            {totalEntryPages > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-3 pb-2">
                <button
                  type="button"
                  onClick={() => setEntryPage((p) => Math.max(1, p - 1))}
                  disabled={entryPage <= 1}
                  className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-xs font-medium text-(--text) disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-(--muted)">
                  Page {entryPage} of {totalEntryPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setEntryPage((p) => Math.min(totalEntryPages, p + 1))
                  }
                  disabled={entryPage >= totalEntryPages}
                  className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-xs font-medium text-(--text) disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            ) : null}
            {paginatedEntries.map((entry) => {
              const facultyId = String(entry?.facultyId || "").trim();
              const facultyName = `Faculty ${facultyId || "N/A"}`;
              const hasReview = String(entry?.review || "").trim().length > 0;
              const avgRating = getRowAverageRating(entry);

              return (
                <div
                  key={entry.$id}
                  className="flex flex-col gap-2 rounded-xl border border-(--line) bg-(--panel) px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-(--text)">{facultyName}</span>
                    <span className="text-xs text-(--muted)">
                      {formatDateTime(entry?.updatedAt || entry?.createdAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-(--bg) px-2 py-1 text-xs text-(--muted)">
                      User: {entry.userId || "N/A"}
                    </span>
                    {hasReview ? (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-600">
                        Review
                      </span>
                    ) : null}
                    {Number.isFinite(avgRating) ? (
                      <span className="rounded-md bg-blue-500/15 px-2 py-1 text-xs font-semibold text-blue-600">
                        Rating {avgRating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  {hasReview ? <p className="line-clamp-2 text-xs text-(--muted)">{entry.review}</p> : null}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => requestDeleteEntry(entry)}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                    >
                      Delete Entry
                    </button>
                  </div>
                </div>
              );
            })}
            {totalEntryPages > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEntryPage((p) => Math.max(1, p - 1))}
                  disabled={entryPage <= 1}
                  className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-xs font-medium text-(--text) disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-(--muted)">
                  Page {entryPage} of {totalEntryPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setEntryPage((p) => Math.min(totalEntryPages, p + 1))
                  }
                  disabled={entryPage >= totalEntryPages}
                  className="rounded-lg border border-(--line) bg-(--panel) px-4 py-2 text-xs font-medium text-(--text) disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <ConfirmOverlay
        open={showUploadConfirm}
        title="Upload Course PDF"
        message={`Are you sure you want to upload and parse "${courseForm.file?.name}"? This will update the course database.`}
        confirmLabel="Upload"
        cancelLabel="Cancel"
        onConfirm={confirmUploadCourse}
        onCancel={() => setShowUploadConfirm(false)}
      />

      <ConfirmOverlay
        open={showDeleteConfirm}
        title="Delete Feedback Entry"
        message="Delete this entry permanently? This removes both review and ratings for the selected row."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteEntry}
        onCancel={() => {
          if (deletingEntry) return;
          setShowDeleteConfirm(false);
          setEntryToDelete(null);
        }}
        loading={deletingEntry}
        danger
      />
    </div>
  );
}

export default AdminPanel;
