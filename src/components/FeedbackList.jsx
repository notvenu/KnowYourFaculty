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
}) {
  if (!feedbackList?.length) return null;

  // Filter to only show feedback with review text
  const feedbackWithReviews = feedbackList.filter((row) => {
    const rawReview = String(row.review || "").trim();
    return rawReview.length > 0;
  });

  if (!feedbackWithReviews.length) return null;

  return (
    <div className="p-4 sm:p-5 md:p-6">
      <h2 className="mb-3 sm:mb-4 text-xl font-bold text-[var(--text)] sm:text-2xl">What students say</h2>
      <div className="space-y-3 sm:space-y-4">
        {feedbackWithReviews.slice(0, maxItems).map((row) => {
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
                  {isOwnReview && (onDeleteFeedback || onEditReview) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {onEditReview && (
                        <button
                          type="button"
                          onClick={onEditReview}
                          className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--primary)]/50"
                        >
                          Edit
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
                    className="rounded-lg bg-[var(--primary-soft)] px-2 py-1 text-xs font-semibold text-[var(--primary)]"
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
