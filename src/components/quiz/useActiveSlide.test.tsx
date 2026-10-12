/** @vitest-environment jsdom */
import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useActiveSlide } from "./useActiveSlide";

afterEach(() => {
  cleanup();
});

/** Waits out the hook's `requestAnimationFrame` debounce (two ticks: one for the scheduled frame, one for React to commit the resulting state update). */
function flushFrame() {
  return act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

interface HarnessProps {
  count: number;
  onActiveIndexChange: (index: number) => void;
  onReady?: (api: { scrollTo: (index: number) => void }) => void;
}

function Harness({ count, onActiveIndexChange, onReady }: HarnessProps) {
  const { scrollerRef, registerSlide, scrollTo } = useActiveSlide({
    options: Array.from({ length: count }, (_, index) => index),
    onActiveIndexChange,
  });

  useEffect(() => {
    onReady?.({ scrollTo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

  return (
    <div ref={scrollerRef} data-testid="scroller">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} ref={registerSlide(index)} data-testid={`slide-${index}`} />
      ))}
    </div>
  );
}

describe("useActiveSlide", () => {
  it("reports the most visible slide via a mocked IntersectionObserver", async () => {
    const observed: Element[] = [];
    let capturedCallback: IntersectionObserverCallback | undefined;

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        capturedCallback = callback;
      }
      observe(target: Element) {
        observed.push(target);
      }
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const onActiveIndexChange = vi.fn();
    const { getByTestId } = render(<Harness count={3} onActiveIndexChange={onActiveIndexChange} />);

    expect(observed).toHaveLength(3);

    const targetSlide = getByTestId("slide-2");
    act(() => {
      capturedCallback?.(
        [
          {
            target: targetSlide,
            isIntersecting: true,
            intersectionRatio: 0.9,
          } as unknown as IntersectionObserverEntry,
          {
            target: getByTestId("slide-0"),
            isIntersecting: true,
            intersectionRatio: 0.2,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });
    await flushFrame();

    expect(onActiveIndexChange).toHaveBeenCalledWith(2);

    vi.unstubAllGlobals();
  });

  it("falls back to a scroll listener and scrollLeft math when IntersectionObserver is unavailable", async () => {
    // jsdom 30+ ships a stub `IntersectionObserver`, unlike older jsdom (or
    // some real WebViews) — simulate its absence explicitly rather than
    // relying on the environment's default.
    vi.stubGlobal("IntersectionObserver", undefined);
    expect(typeof IntersectionObserver).toBe("undefined");

    const onActiveIndexChange = vi.fn();
    const { getByTestId } = render(<Harness count={3} onActiveIndexChange={onActiveIndexChange} />);

    const scroller = getByTestId("scroller");
    Object.defineProperties(scroller, {
      scrollLeft: { value: 200, configurable: true },
      clientWidth: { value: 100, configurable: true },
    });

    const slides = [getByTestId("slide-0"), getByTestId("slide-1"), getByTestId("slide-2")];
    const offsets = [0, 200, 400];
    slides.forEach((slide, index) => {
      Object.defineProperties(slide, {
        offsetLeft: { value: offsets[index], configurable: true },
        offsetWidth: { value: 100, configurable: true },
      });
    });

    act(() => {
      scroller.dispatchEvent(new Event("scroll"));
    });
    await flushFrame();

    // Scroller center is at 200 + 100/2 = 250; slide 1's center (200 + 50 = 250)
    // is the closest match.
    expect(onActiveIndexChange).toHaveBeenCalledWith(1);

    vi.unstubAllGlobals();
  });

  it("scrollTo calls scrollIntoView on the target slide", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    let api: { scrollTo: (index: number) => void } | undefined;
    render(
      <Harness
        count={3}
        onActiveIndexChange={vi.fn()}
        onReady={(ready) => {
          api = ready;
        }}
      />,
    );

    act(() => {
      api?.scrollTo(1);
    });

    expect(scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ inline: "center", block: "nearest" }),
    );

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});
