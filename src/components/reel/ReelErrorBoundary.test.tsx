import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ReelErrorBoundary } from "./ReelErrorBoundary";

function Bomb(): never {
  throw new Error("boom");
}

describe("ReelErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ReelErrorBoundary fallback={<div>fallback</div>}>
        <div>child content</div>
      </ReelErrorBoundary>,
    );

    expect(screen.getByText("child content")).toBeInTheDocument();
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
  });

  it("renders the fallback when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ReelErrorBoundary fallback={<div>fallback poster</div>}>
        <Bomb />
      </ReelErrorBoundary>,
    );

    expect(screen.getByText("fallback poster")).toBeInTheDocument();
  });
});
