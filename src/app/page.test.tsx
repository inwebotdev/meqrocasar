import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home", () => {
  it("renders the quiz shell placeholder", () => {
    render(<Home />);

    expect(screen.getByText("Quiz Swipe & Play")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Cuestionario en construcción/i }),
    ).toBeInTheDocument();
  });
});
