import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DeckDots } from "./DeckDots";

describe("DeckDots", () => {
  it("renders one dot per option, marking the active one aria-pressed", () => {
    render(<DeckDots total={4} activeIndex={1} onSelect={vi.fn()} />);

    const dots = screen.getAllByRole("button", { name: /Ir a opción/i });
    expect(dots).toHaveLength(4);
    expect(dots[1]).toHaveAttribute("aria-pressed", "true");
    expect(dots[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the clicked dot's index", async () => {
    const onSelect = vi.fn();
    render(<DeckDots total={3} activeIndex={0} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Ir a opción 3" }));

    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
