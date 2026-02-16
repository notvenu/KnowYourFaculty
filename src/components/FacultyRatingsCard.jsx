import { THEORY_FIELDS, LAB_FIELDS, ECS_FIELDS, getTierFromRating, getTierColor, TIER_SYSTEM } from "../lib/ratingConfig.js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";

export default function FacultyRatingsCard({
  ratingSummary,
  sectionAverages,
  averages,
  hasUser,
  alreadySubmitted,
  onShareFeedback,
}) {
  return (
    <div className="p-4 sm:p-5 md:p-6">
      <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-[var(--text)] sm:text-2xl">
          Ratings
        </h2>
        {hasUser && (
          <button
            type="button"
            onClick={onShareFeedback}
            className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow)] hover:opacity-90"
          >
            {alreadySubmitted ? "Edit my review" : "Share feedback"}
          </button>
        )}
      </div>
      <div className="border-b border-[var(--line)] pb-4 text-center sm:pb-5">
        {ratingSummary.overallAverage != null ? (
          <>
            <div className="mb-2">
              <span
                className="inline-block rounded-xl px-6 py-3 text-5xl sm:text-6xl font-black"
                style={{
                  color: getTierColor(getTierFromRating(ratingSummary.overallAverage)),
                  backgroundColor: `${getTierColor(getTierFromRating(ratingSummary.overallAverage))}15`,
                }}
              >
                {getTierFromRating(ratingSummary.overallAverage)}
              </span>
            </div>
            <div className="text-sm font-semibold text-[var(--muted)] mb-2">
              {ratingSummary.overallAverage.toFixed(1)} / 5.0
            </div>
          </>
        ) : (
          <div className="text-4xl font-extrabold text-[var(--muted)] sm:text-5xl">—</div>
        )}
        <p className="mt-2 text-xs font-medium text-[var(--muted)]">
          {ratingSummary.totalRatings}{" "}
          {ratingSummary.totalRatings === 1 ? "rating" : "ratings"}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <section>
          <h3 className="mb-3 flex items-center justify-between text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
            Theory
            {sectionAverages.theory != null ? (
              <span
                className="font-bold normal-case px-2 py-1 rounded"
                style={{
                  color: getTierColor(getTierFromRating(sectionAverages.theory)),
                  backgroundColor: `${getTierColor(getTierFromRating(sectionAverages.theory))}15`,
                }}
              >
                {getTierFromRating(sectionAverages.theory)} ({sectionAverages.theory.toFixed(1)})
              </span>
            ) : (
              <span className="font-bold normal-case text-[var(--muted)]">—</span>
            )}
          </h3>
          <div className="space-y-2.5">
            {THEORY_FIELDS.map((field) => {
              const value = averages[field.key];
              return (
                <div key={field.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text)]">
                      {field.label}
                    </span>
                    {value != null ? (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          color: getTierColor(getTierFromRating(value)),
                          backgroundColor: `${getTierColor(getTierFromRating(value))}15`,
                        }}
                      >
                        {getTierFromRating(value)} ({value.toFixed(1)})
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-[var(--muted)]">—</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          star <= Math.round(value || 0)
                            ? "bg-[var(--primary)]"
                            : "bg-[var(--line)]"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center justify-between text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
            Lab
            {sectionAverages.lab != null ? (
              <span
                className="font-bold normal-case px-2 py-1 rounded"
                style={{
                  color: getTierColor(getTierFromRating(sectionAverages.lab)),
                  backgroundColor: `${getTierColor(getTierFromRating(sectionAverages.lab))}15`,
                }}
              >
                {getTierFromRating(sectionAverages.lab)} ({sectionAverages.lab.toFixed(1)})
              </span>
            ) : (
              <span className="font-bold normal-case text-[var(--muted)]">—</span>
            )}
          </h3>
          <div className="space-y-2.5">
            {LAB_FIELDS.map((field) => {
              const value = averages[field.key];
              return (
                <div key={field.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text)]">
                      {field.label}
                    </span>
                    {value != null ? (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          color: getTierColor(getTierFromRating(value)),
                          backgroundColor: `${getTierColor(getTierFromRating(value))}15`,
                        }}
                      >
                        {getTierFromRating(value)} ({value.toFixed(1)})
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-[var(--muted)]">—</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          star <= Math.round(value || 0)
                            ? "bg-[var(--primary)]"
                            : "bg-[var(--line)]"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-3 flex items-center justify-between text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
            ECS / Capstone
            {sectionAverages.ecs != null ? (
              <span
                className="font-bold normal-case px-2 py-1 rounded"
                style={{
                  color: getTierColor(getTierFromRating(sectionAverages.ecs)),
                  backgroundColor: `${getTierColor(getTierFromRating(sectionAverages.ecs))}15`,
                }}
              >
                {getTierFromRating(sectionAverages.ecs)} ({sectionAverages.ecs.toFixed(1)})
              </span>
            ) : (
              <span className="font-bold normal-case text-[var(--muted)]">—</span>
            )}
          </h3>
          <div className="space-y-2.5">
            {ECS_FIELDS.map((field) => {
              const value = averages[field.key];
              return (
                <div key={field.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text)]">
                      {field.label}
                    </span>
                    {value != null ? (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          color: getTierColor(getTierFromRating(value)),
                          backgroundColor: `${getTierColor(getTierFromRating(value))}15`,
                        }}
                      >
                        {getTierFromRating(value)} ({value.toFixed(1)})
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-[var(--muted)]">—</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          star <= Math.round(value || 0)
                            ? "bg-[var(--primary)]"
                            : "bg-[var(--line)]"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
