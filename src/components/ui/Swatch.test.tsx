import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Swatch } from "./Swatch";

describe("Swatch", () => {
  it("renders the inline background color, hex and name", () => {
    render(<Swatch hex="#68182E" name="Vino Tinto" tone="light" />);

    expect(screen.getByText("#68182E")).toBeInTheDocument();
    expect(screen.getByText("Vino Tinto")).toBeInTheDocument();

    const block = screen.getByText("#68182E").previousElementSibling;
    expect(block).toHaveStyle({ backgroundColor: "#68182E" });
  });
});
