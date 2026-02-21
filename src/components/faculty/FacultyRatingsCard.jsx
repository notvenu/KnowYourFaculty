import { useState } from "react";
import {
  THEORY_FIELDS,
  LAB_FIELDS,
  ECS_FIELDS,
  getTierFromRating,
  getTierLabel,
  getTierColor,
} from "../../lib/ratingConfig.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar,
  faChevronDown,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";

// Helper component to render stars with percentage-based fill
function StarRating({ rating, size = "text-lg", color = null }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillPercentage = Math.min(
          100,
          Math.max(0, (rating - (starIndex - 1)) * 100),
        );
        const starColor = color || "var(--primary)";

        return (
          <span key={starIndex} className={`relative inline-block ${size}`}>
            {/* Background star (empty/muted) */}
            <FontAwesomeIcon
              icon={faStar}
              className="text-(--muted) opacity-30"
            />
            {/* Foreground star (filled) clipped to percentage */}
            <span
              className="absolute left-0 top-0 overflow-hidden"
              style={{ width: `${fillPercentage}%`, color: starColor }}
            >
              <FontAwesomeIcon icon={faStar} />
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function FacultyRatingsCard({
  ratingSummary,
  sectionAverages,
  averages,
  notesSummary = null,
  timeFilter = "all",
  setTimeFilter,
  courseFilter = "",
  setCourseFilter,
  courseOptions = [],
  hasUser,
  alreadySubmitted,
  onShareFeedback,
  canAddReview = false,
  onAddReview,
  onEditRating,
  onDeleteRating,
  deleting = false,
}) {
  const hasRatings = ratingSummary.totalRatings > 0;
  const [showFiltersOverlay, setShowFiltersOverlay] = useState(false);
  const activeFiltersCount =
    (timeFilter !== "all" ? 1 : 0) + (courseFilter ? 1 : 0);
  const clearFilters = () => {
    if (setTimeFilter) setTimeFilter("all");
    if (setCourseFilter) setCourseFilter("");
  };
  const [expandedSections, setExpandedSections] = useState({
    theory: true,
    lab: false,
    ecs: false,
    notes: false,
  });

  return (
    <div className="rounded-xl border border-(--line) bg-(--bg-elev) p-4 shadow-lg sm:p-5 md:p-6">
      {showFiltersOverlay && (setTimeFilter || setCourseFilter) && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowFiltersOverlay(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-11/12 max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-(--line) bg-(--bg-elev) p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-(--text)">
                Rating Filters
              </h3>
              <button
                type="button"
                onClick={() => setShowFiltersOverlay(false)}
                className="text-xl text-(--muted) hover:text-(--text)"
                aria-label="Close rating filters"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {setTimeFilter && (
                <div>
                  <label className="mb-2 block text-xs font-semibold text-(--muted)">
                    Ratings Time
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

              {setCourseFilter && (
                <div>
                  <label className="mb-2 block text-xs font-semibold text-(--muted)">
                    Course
                  </label>
                  <select
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    className="w-full rounded-lg border border-(--line) bg-(--panel) px-3 py-2.5 text-sm text-(--text) outline-none"
                  >
                    <option value="">All Courses</option>
                    {courseOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
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

      <div className="mb-3 sm:mb-4 flex flex-wrap items-start justify-between gap-2">
        {(setTimeFilter || setCourseFilter) && (
          <div className="flex items-center gap-2">
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
            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={clearFilters}
                className="hidden sm:inline-flex items-center rounded-lg border border-(--line) bg-(--panel) px-3 py-2 text-xs font-semibold text-(--muted) hover:text-(--text) hover:bg-(--bg-elev)"
                aria-label="Clear rating filters"
              >
                Clear
              </button>
            ) : null}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!alreadySubmitted && (
            <button
              type="button"
              onClick={onShareFeedback}
              className="rounded-xl bg-(--primary) px-4 py-2 text-xs font-bold text-white shadow-(--shadow) hover:opacity-90"
            >
              Share feedback
            </button>
          )}
          {hasUser && alreadySubmitted && onEditRating && (
            <button
              type="button"
              onClick={onEditRating}
              className="rounded-xl border border-(--line) bg-(--panel) px-4 py-2 text-xs font-bold text-(--text) hover:bg-(--bg-elev)"
            >
              Edit ratings
            </button>
          )}
          {hasUser && alreadySubmitted && canAddReview && onAddReview && (
            <button
              type="button"
              onClick={onAddReview}
              className="rounded-xl border border-(--line) bg-(--panel) px-4 py-2 text-xs font-bold text-(--text) hover:bg-(--bg-elev)"
            >
              Add review
            </button>
          )}
          {hasUser && alreadySubmitted && onDeleteRating && (
            <button
              type="button"
              onClick={onDeleteRating}
              disabled={deleting}
              className="rounded-xl border border-red-400 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/20 disabled:opacity-60"
            >
              {deleting ? "Removing…" : "Delete feedback"}
            </button>
          )}
        </div>
      </div>

      {!hasRatings ? (
        <div className="border-b border-(--line) pb-4 text-center sm:pb-5">
          <div className="text-4xl font-extrabold text-(--muted) sm:text-5xl">
            —
          </div>
          <p className="mt-2 text-xs font-medium text-(--muted)">
            No ratings yet
          </p>
        </div>
      ) : (
        <div className="border-b border-(--line) pb-4 text-center sm:pb-5">
          <div className="flex flex-col items-center justify-center gap-2">
            <span
              className="text-5xl font-bold sm:text-6xl"
              style={{
                color: getTierColor(
                  getTierFromRating(ratingSummary.overallAverage),
                ),
              }}
            >
              {hasUser
                ? getTierLabel(getTierFromRating(ratingSummary.overallAverage))
                : `${ratingSummary.overallAverage?.toFixed(1) ?? "—"}`}
            </span>
            {hasUser ? (
              <div className="text-2xl font-extrabold text-(--primary) sm:text-3xl">
                {ratingSummary.overallAverage?.toFixed(1) ?? "—"}
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex justify-center">
            <StarRating
              rating={ratingSummary.overallAverage || 0}
              size="text-lg"
            />
          </div>
          <p className="mt-2 text-xs font-medium text-(--muted)">
            {ratingSummary.totalRatings}{" "}
            {ratingSummary.totalRatings === 1 ? "rating" : "ratings"}
          </p>
        </div>
      )}

      {hasRatings && (
        <div className="mt-6 space-y-3">
          {sectionAverages.theory != null && (
            <div className="rounded-xl border border-(--line) overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections((prev) => ({
                    ...prev,
                    theory: !prev.theory,
                  }))
                }
                className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-(--text)">Theory</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold"
                      style={{
                        color: getTierColor(
                          getTierFromRating(sectionAverages.theory),
                        ),
                      }}
                    >
                      {sectionAverages.theory.toFixed(1)}
                    </span>
                    <StarRating
                      rating={sectionAverages.theory || 0}
                      size="text-xs"
                      color={getTierColor(
                        getTierFromRating(sectionAverages.theory),
                      )}
                    />
                  </div>
                </div>
                <span className="text-(--muted) ml-2">
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`h-3 w-3 transition-transform duration-200 ${
                      expandedSections.theory ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </span>
              </button>
              {expandedSections.theory && (
                <div className="bg-(--bg-elev) p-4 space-y-2.5">
                  {THEORY_FIELDS.map((field) => {
                    const value = averages[field.key];
                    return (
                      <div
                        key={field.key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs font-medium text-(--text)">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold"
                            style={{
                              color:
                                value != null
                                  ? getTierColor(getTierFromRating(value))
                                  : "var(--primary)",
                            }}
                          >
                            {value != null ? value.toFixed(1) : "—"}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className="text-xs"
                                style={{
                                  color:
                                    value != null &&
                                    star <= Math.round(value || 0)
                                      ? getTierColor(getTierFromRating(value))
                                      : "var(--line)",
                                }}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {sectionAverages.lab != null && (
            <div className="rounded-xl border border-(--line) overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections((prev) => ({ ...prev, lab: !prev.lab }))
                }
                className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-(--text)">Lab</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold"
                      style={{
                        color: getTierColor(
                          getTierFromRating(sectionAverages.lab),
                        ),
                      }}
                    >
                      {sectionAverages.lab.toFixed(1)}
                    </span>
                    <StarRating
                      rating={sectionAverages.lab || 0}
                      size="text-xs"
                      color={getTierColor(
                        getTierFromRating(sectionAverages.lab),
                      )}
                    />
                  </div>
                </div>
                <span className="text-(--muted) ml-2">
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`h-3 w-3 transition-transform duration-200 ${
                      expandedSections.lab ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </span>
              </button>
              {expandedSections.lab && (
                <div className="bg-(--bg-elev) p-4 space-y-2.5">
                  {LAB_FIELDS.map((field) => {
                    const value = averages[field.key];
                    return (
                      <div
                        key={field.key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs font-medium text-(--text)">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold"
                            style={{
                              color:
                                value != null
                                  ? getTierColor(getTierFromRating(value))
                                  : "var(--primary)",
                            }}
                          >
                            {value != null ? value.toFixed(1) : "—"}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className="text-xs"
                                style={{
                                  color:
                                    value != null &&
                                    star <= Math.round(value || 0)
                                      ? getTierColor(getTierFromRating(value))
                                      : "var(--line)",
                                }}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {sectionAverages.ecs != null && (
            <div className="rounded-xl border border-(--line) overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections((prev) => ({ ...prev, ecs: !prev.ecs }))
                }
                className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-(--text)">
                    ECS / Capstone
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold"
                      style={{
                        color: getTierColor(
                          getTierFromRating(sectionAverages.ecs),
                        ),
                      }}
                    >
                      {sectionAverages.ecs.toFixed(1)}
                    </span>
                    <StarRating
                      rating={sectionAverages.ecs || 0}
                      size="text-xs"
                      color={getTierColor(
                        getTierFromRating(sectionAverages.ecs),
                      )}
                    />
                  </div>
                </div>
                <span className="text-(--muted) ml-2">
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`h-3 w-3 transition-transform duration-200 ${
                      expandedSections.ecs ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </span>
              </button>
              {expandedSections.ecs && (
                <div className="bg-(--bg-elev) p-4 space-y-2.5">
                  {ECS_FIELDS.map((field) => {
                    const value = averages[field.key];
                    return (
                      <div
                        key={field.key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs font-medium text-(--text)">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-bold"
                            style={{
                              color:
                                value != null
                                  ? getTierColor(getTierFromRating(value))
                                  : "var(--primary)",
                            }}
                          >
                            {value != null ? value.toFixed(1) : "—"}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className="text-xs"
                                style={{
                                  color:
                                    value != null &&
                                    star <= Math.round(value || 0)
                                      ? getTierColor(getTierFromRating(value))
                                      : "var(--line)",
                                }}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Notes Summary */}
          {notesSummary &&
            (notesSummary.theoryNotes || notesSummary.labNotes) && (
              <div className="rounded-xl border border-(--line) overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedSections((prev) => ({
                      ...prev,
                      notes: !prev.notes,
                    }))
                  }
                  className="flex w-full items-center justify-between bg-(--panel) px-4 py-3 transition-colors hover:bg-(--bg-elev)"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-(--text)">
                      Notes Information
                    </span>
                  </div>
                  <span className="text-(--muted) ml-2">
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className={`h-3 w-3 transition-transform duration-200 ${
                        expandedSections.notes ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  </span>
                </button>
                {expandedSections.notes && (
                  <div className="bg-(--bg-elev) p-4 space-y-3">
                    {notesSummary.theoryNotes && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-(--text)">
                          Theory Notes Required
                        </span>
                        <span className="text-xs font-bold text-(--primary)">
                          {notesSummary.theoryNotes.percentage}% (
                          {notesSummary.theoryNotes.count}/
                          {notesSummary.theoryNotes.total})
                        </span>
                      </div>
                    )}
                    {notesSummary.labNotes &&
                      Object.keys(notesSummary.labNotes).length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-(--text) block mb-2">
                            Lab Observation Type
                          </span>
                          <div className="space-y-1.5">
                            {Object.entries(notesSummary.labNotes)
                              .filter(([type]) => type !== "None")
                              .sort((a, b) => b[1].count - a[1].count)
                              .map(([type, data]) => (
                                <div
                                  key={type}
                                  className="flex items-center justify-between"
                                >
                                  <span className="text-xs text-(--muted)">
                                    {type}
                                  </span>
                                  <span className="text-xs font-semibold text-(--primary)">
                                    {data.percentage}% ({data.count}/
                                    {data.total})
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
