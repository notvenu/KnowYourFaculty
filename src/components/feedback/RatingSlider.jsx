import { memo } from "react";
import { RATING_LABELS, RATING_ORDER } from "../../lib/ratingConfig.js";

function RatingSlider({ label, value, onChange, name }) {
  return (
    <div className="group">
      <p className="mb-3 text-sm font-semibold text-(--text)">
        {label}
      </p>

      <div className="relative h-14 rounded-2xl border border-(--line) bg-(--panel) p-1">
        
        {/* GRID CONTAINER */}
        <div className="relative grid h-full grid-cols-5 items-center">

          {/* Highlight (now grid positioned) */}
          <div
            className="absolute top-1 bottom-1 rounded-xl border-2 border-(--bg-elev) bg-(--primary) shadow-md transition-all duration-200 ease-out"
            style={{
              width: "20%",
              transform: `translateX(${(value - 1) * 100}%)`,
            }}
          />

          {/* Labels */}
          {RATING_ORDER.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              className={`relative z-10 text-center text-xs font-semibold transition-all duration-150 ${
                rating === value
                  ? "scale-105 text-(--text)"
                  : "opacity-50 text-(--muted)"
              }`}
            >
              {RATING_LABELS[rating]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(RatingSlider);