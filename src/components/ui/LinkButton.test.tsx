import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { LinkButton } from "./LinkButton";

describe("LinkButton", () => {
  it("renders an anchor with the given href", () => {
    render(<LinkButton href="/recintos">Ver recintos</LinkButton>);

    expect(screen.getByRole("link", { name: "Ver recintos" })).toHaveAttribute("href", "/recintos");
  });

  it("has a visible focus ring", () => {
    render(<LinkButton href="/">Volver al quiz</LinkButton>);

    expect(screen.getByRole("link", { name: "Volver al quiz" })).toHaveClass(
      "focus-visible:outline-2",
      "focus-visible:outline-amber-bernal/60",
      "focus-visible:outline-offset-2",
    );
  });
});
