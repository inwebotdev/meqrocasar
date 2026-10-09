import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QUIZ_STEPS } from "@/domain/quiz/questions";

import { QuickStrip } from "./QuickStrip";

describe("QuickStrip", () => {
  it("renders one button per option with its label, using grid-cols-4 for a 4-option step", () => {
    const step = QUIZ_STEPS[0];
    render(
      <QuickStrip
        options={step.options}
        activeIndex={0}
        selectedId={undefined}
        onSelect={vi.fn()}
      />,
    );

    for (const option of step.options) {
      expect(screen.getByRole("button", { name: option.label })).toBeInTheDocument();
    }
    expect(screen.getByText(`${step.options.length} Colecciones SECTUR`)).toBeInTheDocument();
  });

  it("uses grid-cols-3 for a 3-option step", () => {
    const step = QUIZ_STEPS[1];
    expect(step.options).toHaveLength(3);

    const { container } = render(
      <QuickStrip
        options={step.options}
        activeIndex={0}
        selectedId={undefined}
        onSelect={vi.fn()}
      />,
    );

    expect(container.querySelector(".grid-cols-3")).not.toBeNull();
    expect(container.querySelector(".grid-cols-4")).toBeNull();
  });

  it("marks the selected option aria-pressed and calls onSelect with its index on click", async () => {
    const onSelect = vi.fn();
    const step = QUIZ_STEPS[0];
    const selected = step.options[2];

    render(
      <QuickStrip
        options={step.options}
        activeIndex={0}
        selectedId={selected.id}
        onSelect={onSelect}
      />,
    );

    const selectedButton = screen.getByRole("button", { name: selected.label });
    expect(selectedButton).toHaveAttribute("aria-pressed", "true");

    const otherButton = screen.getByRole("button", { name: step.options[1].label });
    expect(otherButton).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(otherButton);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
