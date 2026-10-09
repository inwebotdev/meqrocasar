import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("shows the title and the SECTUR pill", () => {
    render(<AppHeader title="Resultados Moodboard" />);

    expect(screen.getByText("Resultados Moodboard")).toBeInTheDocument();
    expect(screen.getByText("SECTUR Querétaro")).toBeInTheDocument();
  });
});
