import { THEORY_FIELDS, LAB_FIELDS, ECS_FIELDS } from "../lib/ratingConfig.js";

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
        <h2 className="text-xl font-bold text-[var(--text)] sm:text-2xl">Ratings</h2>
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
        <div className="text-4xl font-extrabold text-[var(--primary)] sm:text-5xl">
          {ratingSummary.overallAverage?.toFixed(1) ?? "—"}
        </div>
        <div className="mt-2 flex justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`emoji text-lg transition-opacity ${
                star <= Math.round(ratingSummary.overallAverage || 0) ? "opacity-100" : "opacity-30"
              }`}
            >
              ★
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs font-medium text-[var(--muted)]">
          {ratingSummary.totalRatings} {ratingSummary.totalRatings === 1 ? "rating" : "ratings"}
        </p>
      </div>

      <div className="mt-6 space-y-6">
        <section>
          <h3 className="mb-3 flex items-center justify-between text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
            Theory
            <span className="font-bold normal-case text-[var(--primary)]">
              {sectionAverages.theory != null ? sectionAverages.theory.toFixed(1) : "—"}
            </span>
          </h3>
          <div className="space-y-2.5">
            {THEORY_FIELDS.map((field) => {
              const value = averages[field.key];
              return (
                <div key={field.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text)]">{field.label}</span>
                    <span className="text-xs font-bold text-[var(--primary)]">
                      {value != null ? value.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          star <= Math.round(value || 0) ? "bg-[var(--primary)]" : "bg-[var(--line)]"
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
            <span className="font-bold normal-case text-[var(--primary)]">
              {sectionAverages.lab != null ? sectionAverages.lab.toFixed(1) : "—"}
            </span>
          </h3>
          <div className="space-y-2.5">
            {LAB_FIELDS.map((field) => {
              const value = averages[field.key];
              return (
                <div key={field.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text)]">{field.label}</span>
                    <span className="text-xs font-bold text-[var(--primary)]">
                      {value != null ? value.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          star <= Math.round(value || 0) ? "bg-[var(--primary)]" : "bg-[var(--line)]"
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
            <span className="font-bold normal-case text-[var(--primary)]">
              {sectionAverages.ecs != null ? sectionAverages.ecs.toFixed(1) : "—"}
            </span>
          </h3>
          <div className="space-y-2.5">
            {ECS_FIELDS.map((field) => {
              const value = averages[field.key];
              return (
                <div key={field.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text)]">{field.label}</span>
                    <span className="text-xs font-bold text-[var(--primary)]">
                      {value != null ? value.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          star <= Math.round(value || 0) ? "bg-[var(--primary)]" : "bg-[var(--line)]"
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
