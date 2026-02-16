import { useState } from "react";
import { THEORY_FIELDS, LAB_FIELDS, ECS_FIELDS } from "../lib/ratingConfig.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faChevronDown } from "@fortawesome/free-solid-svg-icons";

export default function FacultyRatingsCard({
  ratingSummary,
  sectionAverages,
  averages,
  hasUser,
  alreadySubmitted,
  onShareFeedback,
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
    <div className="p-4 sm:p-5 md:p-6">
      <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-[var(--text)] sm:text-2xl">
          Ratings
        </h2>
        {hasUser && (
          <div className="flex flex-wrap items-center gap-2">
            {!alreadySubmitted && (
              <button
                type="button"
                onClick={onShareFeedback}
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow)] hover:opacity-90"
              >
                Share feedback
              </button>
            )}
            {alreadySubmitted && onEditRating && (
              <button
                type="button"
                onClick={onEditRating}
                className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-xs font-bold text-[var(--text)] hover:bg-[var(--bg-elev)]"
              >
                Edit ratings
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
        <div className="border-b border-[var(--line)] pb-4 text-center sm:pb-5">
          <div className="text-4xl font-extrabold text-[var(--muted)] sm:text-5xl">
            —
          </div>
          <p className="mt-2 text-xs font-medium text-[var(--muted)]">
            No ratings yet
          </p>
        </div>
      ) : (
        <div className="border-b border-[var(--line)] pb-4 text-center sm:pb-5">
          <div className="text-4xl font-extrabold text-[var(--primary)] sm:text-5xl">
            {ratingSummary.overallAverage?.toFixed(1) ?? "—"}
          </div>
          <div className="mt-2 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-lg motion-safe:transition-transform motion-safe:transition-opacity ${
                  star <= Math.round(ratingSummary.overallAverage || 0)
                    ? "scale-105 opacity-100 text-[var(--primary)]"
                    : "opacity-30 text-[var(--muted)]"
                }`}
              >
                <FontAwesomeIcon icon={faStar} />
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-[var(--muted)]">
            {ratingSummary.totalRatings}{" "}
            {ratingSummary.totalRatings === 1 ? "rating" : "ratings"}
          </p>
        </div>
      )}

      {hasRatings && (
        <div className="mt-6 space-y-3">
          {sectionAverages.theory != null && (
            <div className="rounded-xl border border-[var(--line)] overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections((prev) => ({
                    ...prev,
                    theory: !prev.theory,
                  }))
                }
                className="flex w-full items-center justify-between bg-[var(--panel)] px-4 py-3 transition-colors hover:bg-[var(--bg-elev)]"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-[var(--text)]">
                    Theory
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--primary)]">
                      {sectionAverages.theory.toFixed(1)}
                    </span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-xs ${
                            star <= Math.round(sectionAverages.theory || 0)
                              ? "text-[var(--primary)]"
                              : "text-[var(--line)]"
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <span className="text-[var(--muted)] ml-2">
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`h-3 w-3 transition-transform duration-200 ${
                      expandedSections.theory ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </span>
              </button>
              {expandedSections.theory && (
                <div className="bg-[var(--bg-elev)] p-4 space-y-2.5">
                  {THEORY_FIELDS.map((field) => {
                    const value = averages[field.key];
                    return (
                      <div
                        key={field.key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs font-medium text-[var(--text)]">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--primary)]">
                            {value != null ? value.toFixed(1) : "—"}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-xs ${
                                  star <= Math.round(value || 0)
                                    ? "text-[var(--primary)]"
                                    : "text-[var(--line)]"
                                }`}
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
            <div className="rounded-xl border border-[var(--line)] overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections((prev) => ({ ...prev, lab: !prev.lab }))
                }
                className="flex w-full items-center justify-between bg-[var(--panel)] px-4 py-3 transition-colors hover:bg-[var(--bg-elev)]"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-[var(--text)]">Lab</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--primary)]">
                      {sectionAverages.lab.toFixed(1)}
                    </span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-xs ${
                            star <= Math.round(sectionAverages.lab || 0)
                              ? "text-[var(--primary)]"
                              : "text-[var(--line)]"
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <span className="text-[var(--muted)] ml-2">
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`h-3 w-3 transition-transform duration-200 ${
                      expandedSections.lab ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </span>
              </button>
              {expandedSections.lab && (
                <div className="bg-[var(--bg-elev)] p-4 space-y-2.5">
                  {LAB_FIELDS.map((field) => {
                    const value = averages[field.key];
                    return (
                      <div
                        key={field.key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs font-medium text-[var(--text)]">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--primary)]">
                            {value != null ? value.toFixed(1) : "—"}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-xs ${
                                  star <= Math.round(value || 0)
                                    ? "text-[var(--primary)]"
                                    : "text-[var(--line)]"
                                }`}
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
            <div className="rounded-xl border border-[var(--line)] overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setExpandedSections((prev) => ({ ...prev, ecs: !prev.ecs }))
                }
                className="flex w-full items-center justify-between bg-[var(--panel)] px-4 py-3 transition-colors hover:bg-[var(--bg-elev)]"
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-[var(--text)]">
                    ECS / Capstone
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--primary)]">
                      {sectionAverages.ecs.toFixed(1)}
                    </span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-xs ${
                            star <= Math.round(sectionAverages.ecs || 0)
                              ? "text-[var(--primary)]"
                              : "text-[var(--line)]"
                          }`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <span className="text-[var(--muted)] ml-2">
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`h-3 w-3 transition-transform duration-200 ${
                      expandedSections.ecs ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </span>
              </button>
              {expandedSections.ecs && (
                <div className="bg-[var(--bg-elev)] p-4 space-y-2.5">
                  {ECS_FIELDS.map((field) => {
                    const value = averages[field.key];
                    return (
                      <div
                        key={field.key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs font-medium text-[var(--text)]">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--primary)]">
                            {value != null ? value.toFixed(1) : "—"}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-xs ${
                                  star <= Math.round(value || 0)
                                    ? "text-[var(--primary)]"
                                    : "text-[var(--line)]"
                                }`}
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
