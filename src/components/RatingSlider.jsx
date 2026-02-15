import { RATING_LABELS, RATING_ORDER } from "../lib/ratingConfig.js";

export default function RatingSlider({ label, value, onChange, name }) {
  return (
    <div className="rating-emoji-slider">
      <p className="mb-3 text-sm font-semibold text-[var(--text)]">{label}</p>
      <div className="relative flex h-14 items-center rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-2 py-1">
        <div
          className="rating-thumb absolute h-10 w-[calc((100%-1rem)/5)] rounded-xl border-2 border-[var(--bg-elev)] bg-[var(--primary)] shadow-md transition-[left] duration-200 ease-out"
          style={{ left: `calc(0.5rem + (100% - 1rem) * ${(value - 1) / 5})` }}
          aria-hidden
        />
        <div className="relative z-[2] grid h-full flex-1 grid-cols-5 items-center gap-0">
          {RATING_ORDER.map((rating) => (
            <span
              key={rating}
              className={`select-none text-center text-xs font-semibold transition-all duration-150 ${
                rating === value ? "scale-105 opacity-100 text-[var(--text)]" : "opacity-50 text-[var(--muted)]"
              }`}
            >
              {RATING_LABELS[rating]}
            </span>
          ))}
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 z-[3] m-0 w-full cursor-pointer opacity-0"
          aria-label={`${label} rating`}
          name={name}
        />
      </div>
    </div>
  );
}
