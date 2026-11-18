// Motion helpers for the landing page and directory. One clock: everything runs on gsap.ticker.
import { useEffect, useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

export const EASE = "expo.out";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Wire `[data-split]` (masked line reveal) and `[data-reveal]` (fade and rise) inside rootRef.
 * Elements marked `data-intro` play immediately; the rest play when they scroll into view.
 * Everything is reverted on unmount.
 */
export function useReveals(rootRef) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return undefined;

    const ctx = gsap.context(() => {
      root.querySelectorAll("[data-split]").forEach((el) => {
        const delay = parseFloat(el.dataset.delay || "0");
        const inView = el.hasAttribute("data-intro")
          ? undefined
          : { trigger: el, start: "top 88%", once: true };
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              duration: 1.2,
              stagger: 0.08,
              ease: EASE,
              delay,
              scrollTrigger: inView,
            }),
        });
      });

      root.querySelectorAll("[data-reveal]").forEach((el) => {
        const delay = parseFloat(el.dataset.delay || "0");
        const inView = el.hasAttribute("data-intro")
          ? undefined
          : { trigger: el, start: "top 90%", once: true };
        const tween = gsap.from(el, {
          y: 28,
          autoAlpha: 0,
          duration: 1,
          ease: EASE,
          delay,
          scrollTrigger: inView,
        });
        // Keyboard focus must never land on something still hidden: finish the reveal at once.
        el.addEventListener("focusin", () => tween.progress(1), { once: true });
      });

      // Hairlines that draw themselves left to right.
      root.querySelectorAll("[data-draw]").forEach((el) => {
        gsap.from(el, {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 1.4,
          ease: EASE,
          delay: parseFloat(el.dataset.delay || "0"),
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
      });
    }, root);

    return () => ctx.revert();
  }, [rootRef]);
}

/**
 * Smooth scroll for one page. Driven by the GSAP ticker and read by ScrollTrigger.
 * Stops while a modal locks body scroll.
 */
export function useSmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const lenis = new Lenis({ lerp: 0.1 });
    const raf = (time) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const sync = () => {
      if (document.body.style.overflow === "hidden") lenis.stop();
      else lenis.start();
    };
    // Lenis owns the scroll position, so the browser's own scroll-into-view on keyboard focus
    // does not stick. Bring a focused element that is off screen into view ourselves.
    const onFocus = (event) => {
      const el = event.target;
      if (!(el instanceof HTMLElement)) return;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        lenis.scrollTo(el, { offset: -window.innerHeight / 3, immediate: true });
      }
    };
    document.addEventListener("focusin", onFocus);

    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocus);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);
}

/** Staggered entrance for freshly rendered `[data-card]` children when `key` changes. */
export function useCardStagger(listRef, key) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || prefersReducedMotion()) return undefined;
    const cards = list.querySelectorAll("[data-card]");
    if (!cards.length) return undefined;
    const tween = gsap.from(cards, {
      y: 14,
      autoAlpha: 0,
      duration: 0.7,
      ease: EASE,
      stagger: { each: 0.035, amount: 0.5 },
      clearProps: "transform,opacity,visibility",
    });
    return () => tween.revert();
  }, [listRef, key]);
}
