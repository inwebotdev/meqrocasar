"use client";

import { useEffect, type KeyboardEvent } from "react";

import type { ResolvedOption } from "@/domain/quiz/generated-step";

import { OptionCard } from "./OptionCard";
import { useActiveSlide } from "./useActiveSlide";

export interface OptionCarouselProps {
  options: readonly ResolvedOption[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onChoose: (option: ResolvedOption) => void;
  /** The step's call-to-action text, shown on every card's "Elegir" button. */
  selectLabel: string;
}

/**
 * Native horizontal snap carousel replacing the old swipeable card deck:
 * scrolling (touch, trackpad, or the keyboard) is the browser's own
 * scroll-snap behaviour, so there's nothing unreliable left to break.
 * `useActiveSlide` tracks which card is most visible and keeps
 * `activeIndex` in sync both ways — scrolling updates it via
 * `onActiveIndexChange`, and an external change (a dot, the option list,
 * or a keyboard arrow) scrolls the matching card into view.
 */
export function OptionCarousel({
  options,
  activeIndex,
  onActiveIndexChange,
  onChoose,
  selectLabel,
}: OptionCarouselProps) {
  const { scrollerRef, registerSlide, scrollTo } = useActiveSlide({
    options,
    onActiveIndexChange,
  });

  // Keeps the scroll position in sync whenever `activeIndex` changes for a
  // reason other than the user's own scrolling (a dot, the option list, or
  // an arrow key) — re-centering a slide that's already centered is a
  // harmless no-op.
  useEffect(() => {
    scrollTo(activeIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, options]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (options.length === 0) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      onActiveIndexChange((activeIndex + 1) % options.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      onActiveIndexChange((activeIndex - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const active = options[activeIndex];
      if (active) onChoose(active);
    }
  }

  const activeOption = options[activeIndex];

  return (
    <div className="relative w-full">
      <div
        ref={scrollerRef}
        role="group"
        aria-roledescription="carrusel"
        aria-label="Opciones"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="scrollbar-hidden flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[7%] pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-bernal/60 motion-reduce:scroll-auto"
      >
        {options.map((option, index) => (
          <OptionCard
            key={option.id}
            ref={registerSlide(index)}
            option={option}
            selectLabel={selectLabel}
            onChoose={onChoose}
          />
        ))}
      </div>
      {activeOption && (
        <span aria-live="polite" className="sr-only">
          {`Opción ${activeIndex + 1} de ${options.length}: ${activeOption.title}`}
        </span>
      )}
    </div>
  );
}
