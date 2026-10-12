import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { resolvedStepFromCurated } from "@/domain/quiz/generated-step";
import { QUIZ_STEPS } from "@/domain/quiz/questions";

import { OptionList } from "./OptionList";

describe("OptionList", () => {
  it("renders one button per option with its title, using grid-cols-4 for a 4-option step", () => {
    const step = resolvedStepFromCurated(QUIZ_STEPS[0]!, 1);
    render(
      <OptionList
        options={step.options}
        activeIndex={0}
        selectedId={undefined}
        onSelect={vi.fn()}
      />,
    );

    for (const option of step.options) {
      expect(screen.getByRole("button", { name: option.title })).toBeInTheDocument();
    }
    expect(screen.getByText("Opciones de esta pregunta")).toBeInTheDocument();
    expect(screen.getByText(`${step.options.length} opciones`)).toBeInTheDocument();
  });

  it("uses grid-cols-3 for a 3-option step", () => {
    const step = resolvedStepFromCurated(QUIZ_STEPS[1]!, 2);
    expect(step.options).toHaveLength(3);

    const { container } = render(
      <OptionList
        options={step.options}
        activeIndex={0}
        selectedId={undefined}
        onSelect={vi.fn()}
      />,
    );

    expect(container.querySelector(".grid-cols-3")).not.toBeNull();
    expect(container.querySelector(".grid-cols-4")).toBeNull();
  });

  it("marks the selected option aria-pressed and calls onSelect with its index on click (navigation only)", async () => {
    const onSelect = vi.fn();
    const step = resolvedStepFromCurated(QUIZ_STEPS[0]!, 1);
    const selected = step.options[2]!;

    render(
      <OptionList
        options={step.options}
        activeIndex={0}
        selectedId={selected.id}
        onSelect={onSelect}
      />,
    );

    const selectedButton = screen.getByRole("button", { name: selected.title });
    expect(selectedButton).toHaveAttribute("aria-pressed", "true");

    const otherButton = screen.getByRole("button", { name: step.options[1]!.title });
    expect(otherButton).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(otherButton);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
