import type { ReactElement } from "react";

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SectionErrorBoundary } from "./SectionErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("SectionErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <SectionErrorBoundary title="Sección">
        <div>child content</div>
      </SectionErrorBoundary>,
    );

    expect(screen.getByText("child content")).toBeInTheDocument();
    expect(screen.queryByText("Esta sección no se pudo mostrar")).not.toBeInTheDocument();
  });

  it("renders the fallback card with the title when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SectionErrorBoundary title="Moodboard">
        <Bomb />
      </SectionErrorBoundary>,
    );

    expect(screen.getByText("Moodboard")).toBeInTheDocument();
    expect(screen.getByText("Esta sección no se pudo mostrar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("resets the error state when Reintentar is clicked, re-rendering children", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    let shouldThrow = true;
    function MaybeBomb(): ReactElement {
      if (shouldThrow) throw new Error("boom");
      return <div>recovered content</div>;
    }

    render(
      <SectionErrorBoundary title="Moodboard">
        <MaybeBomb />
      </SectionErrorBoundary>,
    );

    expect(screen.getByText("Esta sección no se pudo mostrar")).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(screen.getByText("recovered content")).toBeInTheDocument();
    expect(screen.queryByText("Esta sección no se pudo mostrar")).not.toBeInTheDocument();
  });
});
