import { memo, useRef } from "react";
import { RATING_LABELS, RATING_ORDER } from "../../lib/ratingConfig.js";

function RatingSlider({ label, value, onChange, name }) {
  const containerRef = useRef(null);

  const getValueFromPointer = (event) => {
    if (!containerRef.current) return value;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;

    const relativeX = clientX - rect.left;
    const ratio = Math.min(Math.max(relativeX / rect.width, 0), 1);

    return Math.round(ratio * (RATING_ORDER.length - 1)) + 1;
  };

  const handlePointerSet = (event) => {
    event.preventDefault();
    onChange(getValueFromPointer(event));
  };

  return (
    <div className="group">
      <p className="mb-3 text-sm font-semibold text-(--text)">
        {label}
      </p>

      <div
        ref={containerRef}
        className="relative flex h-14 items-center rounded-2xl border border-(--line) bg-(--panel) px-2 py-1"
      >
        {/* Active Highlight */}
        <div
          className="absolute h-10 w-[calc((100%-1rem)/5)] rounded-xl border-2 border-(--bg-elev) bg-(--primary) shadow-md transition-all duration-200 ease-out"
          style={{
            left: `calc(0.5rem + (100% - 1rem) * ${
              (value - 1) / (RATING_ORDER.length - 1)
            })`,
          }}
          aria-hidden
        />

        {/* Labels */}
        <div className="relative z-10 grid h-full flex-1 grid-cols-5 items-center">
          {RATING_ORDER.map((rating) => (
            <span
              key={rating}
              className={`select-none text-center text-xs font-semibold transition-all duration-150 ${
                rating === value
                  ? "scale-105 opacity-100 text-(--text)"
                  : "opacity-50 text-(--muted)"
              }`}
            >
              {RATING_LABELS[rating]}
            </span>
          ))}
        </div>

        {/* Invisible Range Input */}
        <input
          type="range"
          min={1}
          max={RATING_ORDER.length}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={handlePointerSet}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            handlePointerSet(event);
          }}
          onTouchStart={handlePointerSet}
          onTouchMove={handlePointerSet}
          className="absolute inset-y-0 left-2 right-2 z-20 m-0 w-auto cursor-pointer opacity-0 touch-pan-x"
          aria-label={`${label} rating`}
          name={name}
        />
      </div>
    </div>
  );
}

export default memo(RatingSlider);