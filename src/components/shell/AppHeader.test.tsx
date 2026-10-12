import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("shows the title and the SECTUR pill", () => {
    render(<AppHeader title="Resultados Moodboard" />);

    expect(screen.getByText("Resultados Moodboard")).toBeInTheDocument();
    expect(screen.getByText("SECTUR Querétaro")).toBeInTheDocument();
  });

  it("keeps the long title in a single truncated element so the header stays one line", () => {
    render(<AppHeader title="Resultados Moodboard" />);

    const title = screen.getByText("Resultados Moodboard");
    expect(title.tagName).toBe("SPAN");
    expect(title.textContent).toBe("Resultados Moodboard");
    expect(title).toHaveClass("truncate");

    const eyebrow = screen.getByText("Querétaro Romance");
    expect(eyebrow).toHaveClass("truncate");
  });

  it("gives the left column min-w-0 flex-1 so it can shrink and the title can truncate", () => {
    render(<AppHeader title="Resultados Moodboard" />);

    const title = screen.getByText("Resultados Moodboard");
    const leftColumn = title.closest("a");
    expect(leftColumn).toHaveClass("min-w-0", "flex-1");
  });

  it("marks the SECTUR pill accessible by name even though its text hides below sm", () => {
    render(<AppHeader title="Resultados Moodboard" />);

    expect(screen.getByLabelText("SECTUR Querétaro")).toBeInTheDocument();
  });
});
