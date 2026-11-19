import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { TIER_SYSTEM } from "../../lib/ratingConfig.js";
import { prefersReducedMotion } from "../../lib/motion.js";

/*
 * The strictness scale. One value (t, 0 to 1) drives the needle, the tier word, the example
 * profile card, the bars and the tier colour. Pointer over the scale, a tier button, or nothing
 * (it breathes). Higher is more lenient, matching TIER_SYSTEM (5 = Loose-God).
 */
const TIERS = ["D", "C", "B", "A", "S"].map((key) => ({
  key,
  ...TIER_SYSTEM[key],
}));

const FIELDS = [
  ["Teaching experience", 0.3],
  ["Attendance strictness", -0.5],
  ["Class quality", 0.1],
  ["Correction fairness", -0.2],
];

const START = 0.8;
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const posOf = (t) => 10 + 80 * t; // needle position in % of the scale
const idxOf = (t) => clamp(Math.floor(posOf(t) / 20), 0, 4);
const valueOf = (t) => 1 + 4 * t;
const fieldValue = (overall, offset) => clamp(overall + offset, 1, 5);

export default function Hero({ currentUser, onOpenLogin }) {
  const rootRef = useRef(null);
  const zoneRef = useRef(null);
  const trackRef = useRef(null);
  const setTierRef = useRef(() => {});
  const needleRef = useRef(null);
  const scoreRef = useRef(null);
  const readoutRef = useRef(null);
  const fieldRefs = useRef([]);
  const barRefs = useRef([]);
  const [idx, setIdx] = useState(idxOf(START));
  const tier = TIERS[idx];

  useEffect(() => {
    const root = rootRef.current;
    const zone = zoneRef.current;
    const bar = trackRef.current;
    if (!root || !zone || !bar) return undefined;

    const reduced = prefersReducedMotion();
    const s = { t: START, target: START, idx: idxOf(START), visible: true, w: 0 };

    const setText = (el, text) => {
      if (el && el.textContent !== text) el.textContent = text;
    };

    // t picks the tier; tb (t plus the idle breath) drives the needle, numbers and bars,
    // so the whole profile sways slightly while nobody touches anything.
    const paint = (t, tb) => {
      const value = valueOf(tb);
      gsap.set(needleRef.current, { x: (s.w * posOf(tb)) / 100 });
      setText(scoreRef.current, value.toFixed(1));
      setText(readoutRef.current, value.toFixed(1));
      FIELDS.forEach(([, offset], i) => {
        const v = fieldValue(value, offset);
        setText(fieldRefs.current[i], v.toFixed(1));
        if (barRefs.current[i])
          barRefs.current[i].style.transform = `scaleX(${v / 5})`;
      });
      const i = idxOf(t);
      if (i !== s.idx) {
        s.idx = i;
        setIdx(i);
      }
    };

    const measure = () => {
      s.w = bar.offsetWidth; // layout width, unaffected by the draw-in scale
      paint(s.t, s.t);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);

    const io = new IntersectionObserver(([entry]) => {
      s.visible = entry.isIntersecting;
    });
    io.observe(root);

    const tick = (time) => {
      if (!s.visible) return;
      const k = 1 - Math.pow(1 - 0.1, gsap.ticker.deltaRatio());
      s.t += (s.target - s.t) * k;
      paint(s.t, clamp(s.t + Math.sin(time * 0.8) * 0.04));
    };
    if (!reduced) gsap.ticker.add(tick);

    const setTarget = (v) => {
      s.target = clamp(v);
      if (reduced) {
        s.t = s.target;
        paint(s.t, s.t);
      }
    };

    const onMove = (e) => {
      const r = bar.getBoundingClientRect();
      // x across the bar maps to the 10..90% span the segments occupy.
      setTarget((((e.clientX - r.left) / r.width) * 100 - 10) / 80);
    };
    zone.addEventListener("pointermove", onMove);
    zone.addEventListener("pointerdown", onMove);

    setTierRef.current = (i) => setTarget(i / 4);

    return () => {
      gsap.ticker.remove(tick);
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerdown", onMove);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="hero"
      style={{ "--tier": tier.color }}
    >
      <div className="mx-auto flex min-h-svh max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium text-(--text)">
            KnowYourFaculty
          </span>
          <span className="hidden font-mono text-xs text-(--muted) sm:block">
            VIT-AP faculty ratings
          </span>
        </div>

        <div className="grid flex-1 grid-cols-[minmax(0,1fr)] items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
          <div>
            <h1
              data-split
              data-intro
              className="text-[clamp(2.5rem,1.4rem+4.6vw,5rem)] font-normal leading-[1.04] tracking-[-0.03em] text-(--text)"
            >
              Know how your VIT-AP professors teach before you register
            </h1>
            <p
              data-reveal
              data-intro
              data-delay="0.25"
              className="mt-6 max-w-xl text-lg leading-7 text-(--secondary-text)"
            >
              Anonymous ratings from VIT-AP students, split into theory, lab and
              ECS. See who is strict about attendance and who marks fairly.
            </p>
            <div
              data-reveal
              data-intro
              data-delay="0.35"
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/faculty"
                className="btn-slide inline-flex h-12 items-center rounded-(--radius) bg-(--primary) px-5 text-sm font-medium text-white"
                style={{
                  "--fill": "color-mix(in srgb, var(--primary), #000 35%)",
                }}
              >
                Browse faculty
              </Link>
              {!currentUser && (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="btn-slide inline-flex h-12 items-center rounded-(--radius) border border-(--line) bg-(--bg-elev) px-5 text-sm font-medium text-(--text)"
                  style={{ "--fill": "var(--panel)" }}
                >
                  Sign in to rate
                </button>
              )}
            </div>
          </div>

          <figure
            data-reveal
            data-intro
            data-delay="0.2"
            className="w-full max-w-md justify-self-center lg:justify-self-end"
          >
            <div className="rounded-2xl border border-(--line) bg-(--bg-elev) p-6 shadow-(--shadow-pop)">
              <div className="flex items-center gap-4">
                <div
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-(--panel) font-medium text-(--secondary-text)"
                >
                  LV
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-(--text)">
                    Dr. Lakshmi Varadan
                  </p>
                  <p className="truncate text-sm text-(--muted)">
                    Associate Professor · School of Computer Science
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-end justify-between border-t border-(--line) pt-5">
                <p className="flex items-center gap-3 font-mono text-4xl tabular-nums text-(--text)">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full bg-(--tier) transition-colors duration-300"
                  />
                  <span ref={scoreRef}>{valueOf(START).toFixed(1)}</span>
                  <span className="text-lg text-(--muted)">/ 5</span>
                </p>
                <p className="text-sm font-medium text-(--text)">{tier.label}</p>
              </div>

              <ul className="mt-5 space-y-3">
                {FIELDS.map(([label, offset], i) => {
                  const v = fieldValue(valueOf(START), offset);
                  return (
                    <li
                      key={label}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1"
                    >
                      <span className="text-sm text-(--secondary-text)">
                        {label}
                      </span>
                      <span
                        ref={(el) => (fieldRefs.current[i] = el)}
                        className="font-mono text-sm tabular-nums text-(--text)"
                      >
                        {v.toFixed(1)}
                      </span>
                      <span className="col-span-2 h-1 overflow-hidden rounded-full bg-(--panel)">
                        <span
                          ref={(el) => (barRefs.current[i] = el)}
                          className="block h-full origin-left rounded-full bg-(--tier) transition-colors duration-300"
                          style={{ transform: `scaleX(${v / 5})` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <figcaption className="mt-3 text-xs text-(--muted)">
              Example rating card
            </figcaption>
          </figure>
        </div>

        <div
          ref={zoneRef}
          data-reveal
          data-intro
          data-delay="0.45"
          role="group"
          aria-label="Strictness scale"
          className="scale-zone pb-2 pt-4"
        >
          <p className="sr-only" aria-live="polite">
            {tier.label}, tier {idx + 1} of 5
          </p>
          <div className="flex items-end justify-between gap-6">
            <p className="flex items-baseline gap-4">
              <span
                key={idx}
                aria-hidden="true"
                className="scale-word text-[clamp(3rem,1rem+9vw,8rem)] font-normal leading-[0.95] tracking-[-0.04em] text-(--text)"
              >
                {tier.label}
              </span>
              <span
                ref={readoutRef}
                aria-hidden="true"
                className="font-mono text-lg tabular-nums text-(--muted)"
              >
                {valueOf(START).toFixed(1)}
              </span>
            </p>
            <p
              aria-hidden="true"
              className="hidden pb-3 font-mono text-xs text-(--muted) sm:block"
            >
              Move along the scale
            </p>
          </div>

          <div ref={trackRef} className="relative mt-6">
            <div className="scale-bar" data-draw data-delay="0.6">
              {TIERS.map((t, i) => (
                <span
                  key={t.key}
                  className="scale-seg"
                  data-on={i === idx}
                  style={{ "--c": t.color }}
                />
              ))}
            </div>
            <div
              ref={needleRef}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 w-0"
            >
              <span className="scale-needle" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-5">
            {TIERS.map((t, i) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={i === idx}
                onClick={() => setTierRef.current(i)}
                className="scale-label"
              >
                <span className="text-sm">{t.label}</span>
                <span className="font-mono text-xs tabular-nums">{t.value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
