import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders the material symbol ligature text", () => {
    render(<Icon name="favorite" />);

    expect(screen.getByText("favorite")).toBeInTheDocument();
  });

  it("sets 'FILL' 1 when filled is true", () => {
    render(<Icon name="favorite" filled label="Favorito" />);

    expect(screen.getByRole("img", { name: "Favorito" })).toHaveStyle({
      fontVariationSettings: "'FILL' 1",
    });
  });

  it("sets 'FILL' 0 by default", () => {
    render(<Icon name="favorite" label="Favorito" />);

    expect(screen.getByRole("img", { name: "Favorito" })).toHaveStyle({
      fontVariationSettings: "'FILL' 0",
    });
  });

  it("exposes role img and aria-label when label is set", () => {
    render(<Icon name="favorite" label="Favorito" />);

    const icon = screen.getByRole("img", { name: "Favorito" });
    expect(icon).not.toHaveAttribute("aria-hidden");
  });

  it("is aria-hidden with no role when label is not set", () => {
    render(<Icon name="favorite" />);

    const icon = screen.getByText("favorite");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).not.toHaveAttribute("role");
  });
});
