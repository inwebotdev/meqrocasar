"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/**
 * Drives `OptionCarousel`'s active-slide tracking: watches a horizontally
 * scrolling container and reports whichever slide is most visible inside
 * it, and exposes `scrollTo(index)` to snap a given slide into view
 * (keyboard navigation, dots, the option list).
 *
 * Primary mechanism is an `IntersectionObserver` rooted at the scroller
 * (`threshold: 0.6`), debounced via `requestAnimationFrame` so a fast
 * flick doesn't fire `onActiveIndexChange` once per intermediate frame.
 * `IntersectionObserver` doesn't exist in jsdom (or some older WebViews),
 * so when it's unavailable this falls back to a `scroll` listener that
 * picks whichever slide's center is closest to the scroller's visible
 * center, same debounce.
 */

export interface UseActiveSlideParams {
  /** Only `.length` and reference identity matter: a new step's options array re-observes fresh slide elements. */
  options: readonly unknown[];
  onActiveIndexChange: (index: number) => void;
}

export interface UseActiveSlideResult {
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Ref callback factory: `ref={registerSlide(index)}` on each slide element. */
  registerSlide: (index: number) => (element: HTMLElement | null) => void;
  /** Snaps the slide at `index` into view, centered, smooth unless the viewer prefers reduced motion. */
  scrollTo: (index: number) => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useActiveSlide({
  options,
  onActiveIndexChange,
}: UseActiveSlideParams): UseActiveSlideResult {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slideElementsRef = useRef<Array<HTMLElement | null>>([]);
  const frameRef = useRef<number | null>(null);

  const registerSlide = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      slideElementsRef.current[index] = element;
    },
    [],
  );

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;

    function scheduleReport(compute: () => number | undefined) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const index = compute();
        if (index !== undefined) {
          onActiveIndexChange(index);
        }
      });
    }

    if (typeof IntersectionObserver === "undefined") {
      function handleScroll() {
        scheduleReport(() => {
          const center = scroller!.scrollLeft + scroller!.clientWidth / 2;
          let closestIndex: number | undefined;
          let closestDistance = Infinity;

          slideElementsRef.current.forEach((slide, index) => {
            if (!slide) return;
            const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
            const distance = Math.abs(slideCenter - center);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestIndex = index;
            }
          });

          return closestIndex;
        });
      }

      scroller.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        scroller.removeEventListener("scroll", handleScroll);
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        scheduleReport(() => {
          let bestIndex: number | undefined;
          let bestRatio = 0;

          for (const entry of entries) {
            if (!entry.isIntersecting || entry.intersectionRatio <= bestRatio) continue;
            const index = slideElementsRef.current.findIndex((slide) => slide === entry.target);
            if (index === -1) continue;
            bestRatio = entry.intersectionRatio;
            bestIndex = index;
          }

          return bestIndex;
        });
      },
      { root: scroller, threshold: 0.6 },
    );

    for (const slide of slideElementsRef.current) {
      if (slide) observer.observe(slide);
    }

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // `options` (not its `.length`): a new step produces a new array
    // reference even when the option count is unchanged, and that's
    // exactly when the previous slide elements have been unmounted and
    // replaced — the observer must be rebuilt against the fresh nodes.
  }, [options, onActiveIndexChange]);

  const scrollTo = useCallback((index: number) => {
    const slide = slideElementsRef.current[index];
    if (!slide) return;
    slide.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, []);

  return { scrollerRef, registerSlide, scrollTo };
}
