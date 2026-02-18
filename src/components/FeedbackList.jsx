import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter } from "@fortawesome/free-solid-svg-icons";
import { RATING_LABELS } from "../lib/ratingConfig.js";
import { censorReviewText } from "../lib/reviewFilter.js";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sec = Math.floor((now - date) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? "1 minute ago" : `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return day === 1 ? "1 day ago" : `${day} days ago`;
  const week = Math.floor(day / 7);
  if (week < 4) return week === 1 ? "1 week ago" : `${week} weeks ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return month === 1 ? "1 month ago" : `${month} months ago`;
  const year = Math.floor(day / 365);
  return year === 1 ? "1 year ago" : `${year} years ago`;
}

const RATING_KEYS = [
  "theoryTeaching",
  "theoryAttendance",
  "theoryClass",
  "theoryCorrection",
  "labClass",
  "labCorrection",
  "labAttendance",
  "ecsCapstoneSDP",
];

function getAverageRating(row) {
  const values = RATING_KEYS.map((k) => Number(row[k])).filter(
    (n) => Number.isFinite(n) && n >= 1 && n <= 5,
  );
  if (values.length === 0) return 3;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export default function FeedbackList({
  feedbackList,
  courseLookup,
  maxItems = 10,
  currentUser = null,
  courseFilter = "",
  setCourseFilter = null,
  timeFilter = "all",
  setTimeFilter = null,
  ratingFilter = "all",
  setRatingFilter = null,
  onDeleteReview = null,
  onEditReview = null,
  deleting = false,
}) {
  if (!feedbackList?.length) return null;
  const [showFiltersOverlay, setShowFiltersOverlay] = useState(false);
  const activeFiltersCount =
    (courseFilter ? 1 : 0) +
    (timeFilter !== "all" ? 1 : 0) +
    (ratingFilter !== "all" ? 1 : 0);
  const clearFilters = () => {
    if (setCourseFilter) setCourseFilter("");
    if (setTimeFilter) setTimeFilter("all");
    if (setRatingFilter) setRatingFilter("all");
  };

  const uniqueCourses = [
    ...new Set(
      feedbackList.filter((row) => row.courseId).map((row) => row.courseId),
    ),
  ];

  // Filter to only show feedback with review text
  let feedbackWithReviews = feedbackList.filter((row) => {
    const rawReview = String(row.review || "").trim();
    return rawReview.length > 0;
  });

  // Apply course filter
  if (courseFilter && courseFilter !== "") {
    feedbackWithReviews = feedbackWithReviews.filter(
      (row) => row.courseId === courseFilter,
    );
  }

  // Apply time filter
  if (timeFilter !== "all") {
    const now = new Date();
    const cutoffTime = new Date();

    if (timeFilter === "1week") {
      cutoffTime.setDate(now.getDate() - 7);
    } else if (timeFilter === "1month") {
      cutoffTime.setMonth(now.getMonth() - 1);
    }

    feedbackWithReviews = feedbackWithReviews.filter((row) => {
      const createdDate = row.$createdAt ? new Date(row.$createdAt) : null;
      return createdDate && createdDate >= cutoffTime;
    });
  }

  // Apply rating filter
  if (ratingFilter && ratingFilter !== "all") {
    feedbackWithReviews = feedbackWithReviews.filter((row) => {
      const avgRating = getAverageRating(row);
      const ratingLabel =
        RATING_LABELS[Math.max(1, Math.min(5, avgRating))] ?? RATING_LABELS[3];
      return ratingLabel === ratingFilter;
    });
  }

  if (
    !feedbackWithReviews.length &&
    !courseFilter &&
    timeFilter === "all" &&
    ratingFilter === "all"
  ) {
    return null;
  }

  return (
    <div className="rounded-xl border border-(--line) bg-(--panel-dark) p-4 shadow-lg sm:p-5 md:p-6">
      {showFiltersOverlay &&
        (setCourseFilter || setTimeFilter || setRatingFilter) && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setShowFiltersOverlay(false)}
            />
            <div className="fixed left-1/2 top-1/2 z-50 w-11/12 max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-(--line) bg-(--bg-elev) p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-(--text)">
                  Review Filters
                </h3>
                <button
                  type="button"
                  onClick={() => setShowFiltersOverlay(false)}
                  className="text-xl text-(--muted) hover:text-(--text)"
                  aria-label="Close review filters"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {setCourseFilter && (
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-(--muted)">
                      Review Course
                    </label>
                    <select
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                      className="w-full rounded-lg border border-(--line) bg-(--panel) px-3 py-2.5 text-sm text-(--text) outline-none"
                    >
                      <option value="">All Courses</option>
                      {uniqueCourses.map((courseId) => {
                        const course = courseLookup[courseId];
                        return (
                          <option key={courseId} value={courseId}>
                            {course ? `${course.courseCode}` : courseId}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {setTimeFilter && (
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-(--muted)">
                      Review Time
                    </label>
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                      className="w-full rounded-lg border border-(--line) bg-(--panel) px-3 py-2.5 text-sm text-(--text) outline-none"
                    >
                      <option value="all">All Time</option>
                      <option value="1week">Last Week</option>
                      <option value="1month">Last Month</option>
                    </select>
                  </div>
                )}

                {setRatingFilter && (
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-(--muted)">
                      Rating Band
                    </label>
                    <select
                      value={ratingFilter}
                      onChange={(e) => setRatingFilter(e.target.value)}
                      className="w-full rounded-lg border border-(--line) bg-(--panel) px-3 py-2.5 text-sm text-(--text) outline-none"
                    >
                      <option value="all">All Ratings</option>
                      <option value="S">S - Exceptional</option>
                      <option value="A">A - Excellent</option>
                      <option value="B">B - Good</option>
                      <option value="C">C - Average</option>
                      <option value="D">D - Poor</option>
                    </select>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowFiltersOverlay(false)}
                className="mt-5 w-full rounded-lg bg-(--primary) px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                Apply Filters
              </button>
            </div>
          </>
        )}

      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h2 className="text-xl font-bold text-(--text) sm:text-2xl">
          What students say
        </h2>
        {(setCourseFilter || setTimeFilter || setRatingFilter) && (
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="hidden sm:inline-flex items-center rounded-lg border border-(--line) bg-(--panel) px-3 py-2 text-xs font-semibold text-(--muted) hover:text-(--text) hover:bg-(--bg-elev)"
                aria-label="Clear review filters"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowFiltersOverlay(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-(--line) bg-(--panel) px-3 py-2 text-xs font-semibold text-(--text) hover:bg-(--bg-elev)"
            >
              <FontAwesomeIcon icon={faFilter} className="h-3 w-3" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 ? (
                <span className="rounded-full bg-(--primary-soft) px-2 py-0.5 text-[10px] font-bold text-(--primary)">
                  {activeFiltersCount}
                </span>
              ) : null}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {feedbackWithReviews.length === 0 ? (
          <p className="rounded-lg border border-(--line) bg-(--panel) px-3 py-3 text-sm text-(--muted)">
            No reviews match these filters.
          </p>
        ) : null}
        {feedbackWithReviews.slice(0, maxItems).map((row) => {
          const avgRating = getAverageRating(row);
          const ratingLabel =
            RATING_LABELS[Math.max(1, Math.min(5, avgRating))] ??
            RATING_LABELS[3];
          const rawReview = String(row.review || "").trim();
          const reviewText = rawReview ? censorReviewText(rawReview) : "";
          const isOwnReview = Boolean(
            currentUser?.$id && row.userId === currentUser.$id,
          );

          // Determine if review was edited and which timestamp to show
          const createdTime = row.$createdAt ? new Date(row.$createdAt) : null;
          const updatedTime = row.$updatedAt ? new Date(row.$updatedAt) : null;
          const wasEdited =
            createdTime &&
            updatedTime &&
            Math.abs(updatedTime.getTime() - createdTime.getTime()) > 1000; // More than 1 second difference

          const displayTime =
            wasEdited && updatedTime ? row.$updatedAt : row.$createdAt;
          const timePrefix = wasEdited ? "(Edited)" : null;
          const when = timeAgo(displayTime);

          return (
            <div
              key={row.$id}
              className="border-b border-(--line) py-3 sm:py-4 last:border-b-0"
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-(--text)">
                      {isOwnReview ? "Your review" : "Anonymous"}
                    </span>
                    {row.courseId && courseLookup[row.courseId] && (
                      <span className="rounded-lg bg-(--primary-soft) px-2 py-0.5 text-xs font-medium text-(--primary)">
                        {courseLookup[row.courseId].courseCode}
                      </span>
                    )}
                    {when ? (
                      <span
                        className="text-xs text-(--muted)"
                        title={displayTime}
                      >
                        {when} {timePrefix}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-(--muted)">
                    &ldquo;
                    {reviewText.length > 200
                      ? reviewText.substring(0, 200) + "…"
                      : reviewText}
                    &rdquo;
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {isOwnReview && (onDeleteReview || onEditReview) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {onEditReview && (
                        <button
                          type="button"
                          onClick={() => onEditReview(row.$id)}
                          className="rounded-lg border border-(--line) bg-(--panel) px-3 py-1.5 text-xs font-medium text-(--text) hover:border-(--primary)/50"
                        >
                          Edit
                        </button>
                      )}
                      {onDeleteReview && (
                        <button
                          type="button"
                          onClick={() => onDeleteReview(row.$id)}
                          disabled={deleting}
                          className="rounded-lg border border-red-400 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20 disabled:opacity-60"
                        >
                          {deleting ? "Removing…" : "Delete"}
                        </button>
                      )}
                    </div>
                  )}
                  <span
                    className="rounded-lg bg-(--primary-soft) px-2 py-1 text-xs font-semibold text-(--primary)"
                    aria-hidden
                  >
                    {ratingLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
