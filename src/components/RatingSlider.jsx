import { RATING_LABELS, RATING_ORDER } from "../lib/ratingConfig.js";

export default function RatingSlider({ label, value, onChange, name }) {
  const getValueFromPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const ratio = Math.min(Math.max(relativeX / rect.width, 0), 1);
    return Math.round(ratio * (RATING_ORDER.length - 1)) + 1;
  };

  const handlePointerSet = (event) => {
    onChange(getValueFromPointer(event));
  };

  return (
    <div className="group">
      <p className="mb-3 text-sm font-semibold text-(--text)">{label}</p>
      <div className="relative flex h-14 items-center rounded-2xl border border-(--line) bg-(--panel) px-2 py-1">
        <div
          className="absolute h-10 w-[calc((100%-1rem)/5)] rounded-xl border-2 border-(--bg-elev) bg-(--primary) shadow-md will-change-transform motion-safe:transition-[left,transform,box-shadow] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none group-active:scale-[1.02] group-active:shadow-lg group-focus-within:scale-[1.02] group-focus-within:shadow-lg"
          style={{ left: `calc(0.5rem + (100% - 1rem) * ${(value - 1) / 5})` }}
          aria-hidden
        />
        <div className="relative z-2 grid h-full flex-1 grid-cols-5 items-center gap-0">
          {RATING_ORDER.map((rating) => (
            <span
              key={rating}
              className={`select-none text-center text-xs font-semibold motion-safe:transition-all motion-safe:duration-150 ${
                rating === value
                  ? "scale-105 opacity-100 text-(--text)"
                  : "opacity-50 text-(--muted)"
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
          onPointerDown={handlePointerSet}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            handlePointerSet(event);
          }}
          className="absolute inset-y-0 left-2 right-2 z-3 m-0 w-auto cursor-pointer touch-none opacity-0"
          aria-label={`${label} rating`}
          name={name}
        />
      </div>
    </div>
  );
}
