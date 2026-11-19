import { useRef } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import Hero from "../components/landing/Hero.jsx";
import { TIER_SYSTEM } from "../lib/ratingConfig.js";
import { faqs, features, trust } from "../data/siteContent.js";
import { useReveals, useSmoothScroll } from "../lib/motion.js";

const TIER_COLORS = ["D", "C", "B", "A", "S"].map((k) => TIER_SYSTEM[k].color);

function LandingPage({ onOpenLogin }) {
  const currentUser = useSelector((state) => state.auth.currentUser);
  const pageRef = useRef(null);
  useSmoothScroll();
  useReveals(pageRef);

  return (
    <div ref={pageRef}>
      <Hero currentUser={currentUser} onOpenLogin={onOpenLogin} />

      {/* Features */}
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2
            data-split
            className="max-w-2xl text-[clamp(2rem,1.2rem+2.6vw,3.5rem)] font-normal leading-[1.08] tracking-[-0.03em] text-(--text)"
          >
            What you get on every faculty page
          </h2>
          <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-3">
            {features.map((item, i) => (
              <div key={item.title} data-reveal data-delay={i * 0.08}>
                <div data-draw className="h-px bg-(--text)/30" />
                <h3 className="mt-5 text-lg font-medium text-(--text)">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-(--secondary-text)">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-24">
        <div className="mx-auto grid max-w-7xl px-4 sm:px-6 gap-12 lg:grid-cols-[1fr_2fr]">
          <h2
            data-split
            className="text-[clamp(2rem,1.2rem+2.6vw,3.5rem)] font-normal leading-[1.08] tracking-[-0.03em] text-(--text)"
          >
            Built for trust and control
          </h2>
          <dl className="border-t border-(--line)">
            {trust.map((item) => (
              <div
                key={item.title}
                data-reveal
                className="grid gap-1 border-b border-(--line) py-6 sm:grid-cols-[14rem_1fr] sm:gap-6"
              >
                <dt className="text-sm font-medium text-(--text)">
                  {item.title}
                </dt>
                <dd className="text-sm leading-6 text-(--secondary-text)">
                  {item.text}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2
            data-split
            className="text-[clamp(2rem,1.2rem+2.6vw,3.5rem)] font-normal leading-[1.08] tracking-[-0.03em] text-(--text)"
          >
            Frequently asked questions
          </h2>
          <div className="mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {faqs.map((item, i) => (
              <div key={item.q} data-reveal data-delay={(i % 2) * 0.08}>
                <div className="h-px bg-(--line)" />
                <h3 className="mt-5 text-base font-medium text-(--text)">
                  {item.q}
                </h3>
                <p className="mt-2 text-sm leading-6 text-(--secondary-text)">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA: the scale again, drawn across the page */}
      <section className="pb-24 pt-16 lg:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div data-draw className="grid grid-cols-5 gap-0.5" aria-hidden="true">
            {TIER_COLORS.map((c) => (
              <span
                key={c}
                className="h-2 rounded-xs"
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
            <p
              data-split
              className="max-w-3xl text-[clamp(2.25rem,1rem+5vw,5.5rem)] font-normal leading-[1.02] tracking-[-0.035em] text-(--text)"
            >
              By students, for students
            </p>
            <Link
              to="/faculty"
              className="btn-slide inline-flex h-12 shrink-0 items-center rounded-(--radius) bg-(--primary) px-5 text-sm font-medium text-white"
              style={{ "--fill": "color-mix(in srgb, var(--primary), #000 35%)" }}
            >
              Browse faculty
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
