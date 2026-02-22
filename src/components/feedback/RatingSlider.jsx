import { memo } from "react";
import { RATING_LABELS, RATING_ORDER } from "../../lib/ratingConfig.js";

function RatingSlider({ label, value, onChange, name }) {
  return (
    <div className="group">
      <p className="mb-3 text-sm font-semibold text-(--text)">
        {label}
      </p>

      {/* container */}
      <div className="relative grid grid-cols-5 overflow-hidden rounded-2xl border border-(--line) bg-(--panel) p-1">

        {/* blue pill */}
        <div
          className="absolute inset-y-1 w-1/5 rounded-xl bg-(--primary) transition-transform duration-200 ease-out"
          style={{
            transform: `translateX(${(value - 1) * 100}%)`,
          }}
        />

        {/* Options */}
        {RATING_ORDER.map((rating) => (
          <button
            key={rating}
            onClick={() => onChange(rating)}
            type="button"
            className="relative z-10 flex items-center justify-center p-2 text-xs font-semibold transition-colors duration-150"
          >
            <span
              className={
                rating === value
                  ? "text-(--text)"
                  : "text-(--muted) opacity-60"
              }
            >
              {RATING_LABELS[rating]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(RatingSlider);