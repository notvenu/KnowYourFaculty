import { useRef } from "react";
import { Link } from "react-router-dom";
import { TIER_SYSTEM } from "../lib/ratingConfig.js";
import { useReveals } from "../lib/motion.js";

const SEGMENT_COLORS = ["D", "C", "B", "A", "S"].map((k) => TIER_SYSTEM[k].color);

// The 404 is the scale with the needle past the end: this page is off the scale.
export default function NotFoundPage() {
  const ref = useRef(null);
  useReveals(ref);

  return (
    <div ref={ref} className="flex min-h-[70svh] flex-col justify-center py-16">
      <p data-reveal data-intro className="font-mono text-xs text-(--muted)">
        404
      </p>
      <h1
        data-split
        data-intro
        className="mt-4 text-[clamp(3rem,1rem+9vw,8rem)] font-normal leading-[0.95] tracking-[-0.04em] text-(--text)"
      >
        Off the scale
      </h1>
      <p
        data-reveal
        data-intro
        data-delay="0.3"
        className="mt-6 max-w-lg text-lg leading-7 text-(--secondary-text)"
      >
        There is no page at this address. The faculty directory is on the scale.
      </p>

      <div className="relative mt-12 max-w-3xl pr-6" aria-hidden="true">
        <div data-draw className="grid grid-cols-5 gap-0.5">
          {SEGMENT_COLORS.map((c) => (
            <span
              key={c}
              className="h-2 rounded-[2px]"
              style={{ background: c, opacity: 0.28 }}
            />
          ))}
        </div>
        <span className="absolute -top-4 right-0 block h-10 w-0.5 bg-(--text)">
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-(--bg) bg-(--muted)" />
        </span>
      </div>

      <div data-reveal data-intro data-delay="0.45" className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/faculty"
          className="btn-slide inline-flex h-12 items-center rounded-(--radius) bg-(--primary) px-5 text-sm font-medium text-white"
          style={{ "--fill": "color-mix(in srgb, var(--primary), #000 35%)" }}
        >
          Browse faculty
        </Link>
        <Link
          to="/"
          className="btn-slide inline-flex h-12 items-center rounded-(--radius) border border-(--line) bg-(--bg-elev) px-5 text-sm font-medium text-(--text)"
          style={{ "--fill": "var(--panel)" }}
        >
          Home
        </Link>
      </div>
    </div>
  );
}
