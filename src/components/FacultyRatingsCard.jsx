import { useState } from "react";
import {
  THEORY_FIELDS,
  LAB_FIELDS,
  ECS_FIELDS,
  getTierFromRating,
  getTierColor,
} from "../lib/ratingConfig.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faChevronDown } from "@fortawesome/free-solid-svg-icons";

export default function FacultyRatingsCard({
  ratingSummary,
  sectionAverages,
  averages,
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
  const [expandedSections, setExpandedSections] = useState({
    theory: true,
    lab: false,
    ecs: false,
  });

  return (
    <div className="rounded-xl border border-(--line) bg-(--panel-dark) p-4 shadow-lg sm:p-5 md:p-6">
      <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-end gap-2">
        {hasUser && (
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
            {alreadySubmitted && onEditRating && (
              <button
                type="button"
                onClick={onEditRating}
                className="rounded-xl border border-(--line) bg-(--panel) px-4 py-2 text-xs font-bold text-(--text) hover:bg-(--bg-elev)"
              >
                Edit ratings
              </button>
            )}
            {alreadySubmitted && canAddReview && onAddReview && (
              <button
                type="button"
                onClick={onAddReview}
                className="rounded-xl border border-(--line) bg-(--panel) px-4 py-2 text-xs font-bold text-(--text) hover:bg-(--bg-elev)"
              >
                Add review
              </button>
            )}
            {alreadySubmitted && onDeleteRating && (
              <button
                type="button"
                onClick={onDeleteRating}
                disabled={deleting}
                className="rounded-xl border border-red-400 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500/20 disabled:opacity-60"
              >
                {deleting ? "Removing…" : "Delete ratings"}
              </button>
            )}
          </div>
        )}
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
              {getTierFromRating(ratingSummary.overallAverage)}
            </span>
            <div className="text-2xl font-extrabold text-(--primary) sm:text-3xl">
              {ratingSummary.overallAverage?.toFixed(1) ?? "—"} / 5
            </div>
          </div>
          <div className="mt-2 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((starIndex) => {
              const rating = ratingSummary.overallAverage || 0;
              const fillPercentage = Math.min(
                100,
                Math.max(0, (rating - (starIndex - 1)) * 100),
              );

              return (
                <span key={starIndex} className="relative inline-block text-lg">
                  {/* Background star (empty/muted) */}
                  <FontAwesomeIcon
                    icon={faStar}
                    className="text-(--muted) opacity-30"
                  />
                  {/* Foreground star (filled) clipped to percentage */}
                  <span
                    className="absolute left-0 top-0 overflow-hidden text-(--primary)"
                    style={{ width: `${fillPercentage}%` }}
                  >
                    <FontAwesomeIcon icon={faStar} />
                  </span>
                </span>
              );
            })}
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
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className="text-xs"
                          style={{
                            color:
                              star <= Math.round(sectionAverages.theory || 0)
                                ? getTierColor(
                                    getTierFromRating(sectionAverages.theory),
                                  )
                                : "var(--line)",
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
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
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className="text-xs"
                          style={{
                            color:
                              star <= Math.round(sectionAverages.lab || 0)
                                ? getTierColor(
                                    getTierFromRating(sectionAverages.lab),
                                  )
                                : "var(--line)",
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
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
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className="text-xs"
                          style={{
                            color:
                              star <= Math.round(sectionAverages.ecs || 0)
                                ? getTierColor(
                                    getTierFromRating(sectionAverages.ecs),
                                  )
                                : "var(--line)",
                          }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
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
        </div>
      )}
    </div>
  );
}
