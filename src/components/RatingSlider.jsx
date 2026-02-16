import { RATING_LABELS, RATING_ORDER, TIER_SYSTEM, getTierColor } from "../lib/ratingConfig.js";

export default function RatingSlider({ label, value, onChange, name }) {
  const sliderPosition = (value - 1) / 5;
  const currentTier = RATING_LABELS[value] || "B";
  const tierColor = getTierColor(currentTier);
  
  return (
    <div className="group">
      <p className="mb-2 sm:mb-3 text-xs sm:text-sm font-semibold text-[var(--text)]">{label}</p>
      <div className="relative flex h-12 sm:h-14 items-center rounded-xl sm:rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-1.5 sm:px-2 py-0.5 sm:py-1">
        <div
          className="absolute h-8 sm:h-10 w-[calc((100%-0.75rem)/5)] sm:w-[calc((100%-1rem)/5)] rounded-lg sm:rounded-xl border-2 border-[var(--bg-elev)] shadow-md will-change-transform motion-safe:transition-[left,transform,box-shadow,background-color] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none group-active:scale-[1.02] group-active:shadow-lg group-focus-within:scale-[1.02] group-focus-within:shadow-lg rating-slider-indicator"
          style={{ 
            '--slider-position': sliderPosition,
            backgroundColor: tierColor
          }}
          aria-hidden
        />
        <div className="relative z-[2] grid h-full flex-1 grid-cols-5 items-center gap-0">
          {RATING_ORDER.map((rating) => {
            const tier = RATING_LABELS[rating];
            const tierInfo = TIER_SYSTEM[tier];
            const isSelected = rating === value;
            return (
              <span
                key={rating}
                className={`select-none text-center text-[10px] sm:text-xs font-bold motion-safe:transition-all motion-safe:duration-150 ${
                  isSelected 
                    ? "opacity-100 scale-110" 
                    : "opacity-50 scale-100"
                }`}
                style={{
                  color: isSelected ? tierInfo?.color || "var(--text)" : "var(--muted)"
                }}
              >
                {tier}
              </span>
            );
          })}
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
