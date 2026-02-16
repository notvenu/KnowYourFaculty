import { RATING_LABELS, TIER_SYSTEM, getTierFromRating, getTierColor } from "../lib/ratingConfig.js";
import { censorReviewText } from "../lib/reviewFilter.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useState, useMemo } from "react";

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
    (n) => Number.isFinite(n) && n >= 1 && n <= 5
  );
  if (values.length === 0) return 3;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export default function FeedbackList({
  feedbackList,
  courseLookup,
  maxItems = 10,
  currentUser = null,
  onDeleteFeedback = null,
  onEditReview = null,
  deleting = false,
  onEditReviewOnly = null,
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [filterTier, setFilterTier] = useState("all");
  const [filterCourse, setFilterCourse] = useState("all");
  const [sortBy, setSortBy] = useState("recent"); // recent, rating-high, rating-low

  if (!feedbackList?.length) return null;

  // Filter to only show feedback with review text
  const feedbackWithReviews = useMemo(() => {
    let filtered = feedbackList.filter((row) => {
      const rawReview = String(row.review || "").trim();
      return rawReview.length > 0;
    });

    // Apply tier filter
    if (filterTier !== "all") {
      filtered = filtered.filter((row) => {
        const avgRating = getAverageRating(row);
        const tier = getTierFromRating(avgRating);
        return tier === filterTier;
      });
    }

    // Apply course filter
    if (filterCourse !== "all") {
      filtered = filtered.filter((row) => {
        return row.courseId === filterCourse;
      });
    }

    // Apply sorting
    if (sortBy === "rating-high") {
      filtered = [...filtered].sort((a, b) => {
        return getAverageRating(b) - getAverageRating(a);
      });
    } else if (sortBy === "rating-low") {
      filtered = [...filtered].sort((a, b) => {
        return getAverageRating(a) - getAverageRating(b);
      });
    } else {
      // recent (default)
      filtered = [...filtered].sort((a, b) => {
        const dateA = new Date(a.$createdAt || 0);
        const dateB = new Date(b.$createdAt || 0);
        return dateB - dateA;
      });
    }

    return filtered;
  }, [feedbackList, filterTier, filterCourse, sortBy]);

  if (!feedbackWithReviews.length) return null;

  const availableCourses = useMemo(() => {
    const courses = new Set();
    feedbackList.forEach((row) => {
      if (row.courseId && courseLookup[row.courseId]) {
        courses.add(row.courseId);
      }
    });
    return Array.from(courses).map((id) => courseLookup[id]).filter(Boolean);
  }, [feedbackList, courseLookup]);

  return (
    <div className="p-4 sm:p-5 md:p-6">
      <div className="mb-3 sm:mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[var(--text)] sm:text-2xl">What students say</h2>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs sm:text-sm font-medium text-[var(--text)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
        >
          <FontAwesomeIcon icon={faFilter} className="w-3 h-3" />
          <span className="hidden sm:inline">Filter</span>
          <FontAwesomeIcon 
            icon={faChevronDown} 
            className={`w-3 h-3 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-3 py-2 text-xs sm:text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="all">All Tiers</option>
            {Object.entries(TIER_SYSTEM).map(([tier, info]) => (
              <option key={tier} value={tier}>
                Tier {tier} - {info.description}
              </option>
            ))}
          </select>

          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-3 py-2 text-xs sm:text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="all">All Courses</option>
            {availableCourses.map((course) => (
              <option key={course.$id} value={course.$id}>
                {course.courseCode}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] px-3 py-2 text-xs sm:text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="recent">Most Recent</option>
            <option value="rating-high">Rating: High to Low</option>
            <option value="rating-low">Rating: Low to High</option>
          </select>
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">
        {feedbackWithReviews.slice(0, maxItems).map((row, index) => {
          const avgRating = getAverageRating(row);
          const ratingLabel = RATING_LABELS[Math.max(1, Math.min(5, avgRating))] ?? RATING_LABELS[3];
          const rawReview = String(row.review || "").trim();
          const reviewText = rawReview ? censorReviewText(rawReview) : "";
          const isOwnReview = Boolean(currentUser?.$id && row.userId === currentUser.$id);
          const when = timeAgo(row.$createdAt);
          return (
            <div
              key={row.$id}
              className="border-b border-[var(--line)] py-3 sm:py-4 last:border-b-0"
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--text)]">{isOwnReview ? "Your review" : "Anonymous"}</span>
                    {row.courseId && courseLookup[row.courseId] && (
                      <span className="rounded-lg bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
                        {courseLookup[row.courseId].courseCode}
                      </span>
                    )}
                    {when ? (
                      <span className="text-xs text-[var(--muted)]" title={row.$createdAt}>
                        {when}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    &ldquo;{reviewText.length > 200 ? reviewText.substring(0, 200) + "…" : reviewText}&rdquo;
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {isOwnReview && (onDeleteFeedback || onEditReview || onEditReviewOnly) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {onEditReviewOnly && (
                        <button
                          type="button"
                          onClick={() => onEditReviewOnly({ review: rawReview, courseId: row.courseId })}
                          className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--primary)]/50"
                          title="Edit review text only"
                        >
                          Edit Review
                        </button>
                      )}
                      {onEditReview && (
                        <button
                          type="button"
                          onClick={onEditReview}
                          className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                          title="Edit review and ratings"
                        >
                          Edit All
                        </button>
                      )}
                      {onDeleteFeedback && (
                        <button
                          type="button"
                          onClick={onDeleteFeedback}
                          disabled={deleting}
                          className="rounded-lg border border-red-400 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20 disabled:opacity-60"
                        >
                          {deleting ? "Removing…" : "Delete"}
                        </button>
                      )}
                    </div>
                  )}
                  <span
                    className="rounded-lg px-2 py-1 text-xs font-bold"
                    style={{
                      color: getTierColor(ratingLabel),
                      backgroundColor: `${getTierColor(ratingLabel)}15`,
                    }}
                    aria-hidden
                  >
                    Tier {ratingLabel}
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
