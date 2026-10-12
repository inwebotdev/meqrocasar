import type { PropsWithChildren } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { resolvedStepFromCurated, type ResolvedOption } from "@/domain/quiz/generated-step";
import { QUIZ_STEPS } from "@/domain/quiz/questions";

import { DeckDots } from "./DeckDots";
import { OptionList } from "./OptionList";

type MotionStubProps = PropsWithChildren<Record<string, unknown>>;

vi.mock("framer-motion", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    motion: {
      article: React.forwardRef(function MotionArticleStub(
        { children, whileTap, ...rest }: MotionStubProps,
        ref: React.Ref<HTMLElement>,
      ) {
        void whileTap;
        return React.createElement("article", { ref, ...rest }, children);
      }),
    },
  };
});

const { OptionCarousel } = await import("./OptionCarousel");

const options = resolvedStepFromCurated(QUIZ_STEPS[0]!, 1).options;
const selectLabel = "Elegir este Estilo";

function cardFor(title: string) {
  return screen.getByRole("heading", { name: title }).closest("article")!;
}

interface HarnessProps {
  onChoose: (option: ResolvedOption) => void;
  withNavigation?: boolean;
}

/** Wires `OptionCarousel` to its own `activeIndex` state, plus `DeckDots`/`OptionList` when `withNavigation`, the way `QuizFlow` does. */
function Harness({ onChoose, withNavigation }: HarnessProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      <OptionCarousel
        options={options}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onChoose={onChoose}
        selectLabel={selectLabel}
      />
      {withNavigation && (
        <>
          <DeckDots total={options.length} activeIndex={activeIndex} onSelect={setActiveIndex} />
          <OptionList
            options={options}
            activeIndex={activeIndex}
            selectedId={undefined}
            onSelect={setActiveIndex}
          />
        </>
      )}
    </div>
  );
}

describe("OptionCarousel", () => {
  it("renders one slide per option, each with exactly one Elegir button", () => {
    render(<Harness onChoose={vi.fn()} />);

    for (const option of options) {
      const card = cardFor(option.title);
      expect(within(card).getAllByRole("button", { name: selectLabel })).toHaveLength(1);
    }
  });

  it("clicking a card's Elegir button calls onChoose with that option", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChoose={onChoose} />);

    const third = options[2]!;
    await user.click(within(cardFor(third.title)).getByRole("button", { name: selectLabel }));

    expect(onChoose).toHaveBeenCalledWith(third);
  });

  it("clicking a dot or an option-list item scrolls the matching slide into view", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const user = userEvent.setup();
    render(<Harness onChoose={vi.fn()} withNavigation />);
    scrollIntoView.mockClear(); // drop the initial mount's scrollTo(0)

    await user.click(screen.getByRole("button", { name: "Ir a opción 3" }));
    expect(scrollIntoView).toHaveBeenCalled();

    scrollIntoView.mockClear();
    // Back to the first option via the option list — a different index
    // than the dot above, so the active index actually changes again.
    const first = options[0]!;
    await user.click(screen.getByRole("button", { name: first.title }));
    expect(scrollIntoView).toHaveBeenCalled();

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("ArrowRight moves the active index, then Enter chooses that option", () => {
    const onChoose = vi.fn();
    render(<Harness onChoose={onChoose} />);

    const carousel = screen.getByRole("group", { name: "Opciones" });
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    fireEvent.keyDown(carousel, { key: "Enter" });

    expect(onChoose).toHaveBeenCalledWith(options[1]);
  });

  it("announces the active option via an aria-live region", () => {
    render(<Harness onChoose={vi.fn()} />);

    expect(screen.getByText(`Opción 1 de ${options.length}: ${options[0]!.title}`)).toHaveClass(
      "sr-only",
    );
  });
});
