import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home", () => {
  it("renders the placeholder heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /Querétaro Romance AI — PoC en construcción/i }),
    ).toBeInTheDocument();
  });
});
