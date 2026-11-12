"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

import { Button } from "@/components/ui";

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

  function goPrev() {
    if (options.length === 0) return;
    onActiveIndexChange((activeIndex - 1 + options.length) % options.length);
  }

  function goNext() {
    if (options.length === 0) return;
    onActiveIndexChange((activeIndex + 1) % options.length);
  }

  // Mouse drag-to-scroll (touch and trackpad already scroll natively). A real
  // drag suppresses the click that would otherwise land on a card's button.
  const drag = useRef<{ startX: number; startLeft: number; moved: boolean } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    drag.current = { startX: event.clientX, startLeft: scroller.scrollLeft, moved: false };
    scroller.classList.add("cursor-grabbing", "snap-none", "scroll-auto");
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const scroller = scrollerRef.current;
    if (!state || !scroller) return;
    const delta = event.clientX - state.startX;
    if (Math.abs(delta) > 6) state.moved = true;
    scroller.scrollLeft = state.startLeft - delta;
  }

  function endDrag() {
    const scroller = scrollerRef.current;
    if (scroller) scroller.classList.remove("cursor-grabbing", "snap-none", "scroll-auto");
    const moved = drag.current?.moved ?? false;
    drag.current = null;
    if (moved && scroller) {
      // Re-enable snapping and settle on the nearest card.
      const slides = Array.from(scroller.children) as HTMLElement[];
      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      slides.forEach((slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(slideCenter - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      onActiveIndexChange(best);
      scrollTo(best);
    }
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (drag.current?.moved) {
      event.stopPropagation();
      event.preventDefault();
    }
  }

  return (
    <div className="relative w-full">
      <div
        ref={scrollerRef}
        role="group"
        aria-roledescription="carrusel"
        aria-label="Opciones"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleClickCapture}
        className="scrollbar-hidden flex cursor-grab touch-pan-x snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[7%] pb-2 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-bernal/60 motion-reduce:scroll-auto"
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
      {options.length > 1 && (
        <>
          <Button
            variant="circle"
            icon="chevron_left"
            aria-label="Opción anterior"
            onClick={goPrev}
            className="absolute top-1/2 left-1 z-10 h-10 w-10 -translate-y-1/2 bg-surface/90 shadow-level-2 backdrop-blur-md"
          />
          <Button
            variant="circle"
            icon="chevron_right"
            aria-label="Siguiente opción"
            onClick={goNext}
            className="absolute top-1/2 right-1 z-10 h-10 w-10 -translate-y-1/2 bg-surface/90 shadow-level-2 backdrop-blur-md"
          />
        </>
      )}
      {activeOption && (
        <span aria-live="polite" className="sr-only">
          {`Opción ${activeIndex + 1} de ${options.length}: ${activeOption.title}`}
        </span>
      )}
    </div>
  );
}
