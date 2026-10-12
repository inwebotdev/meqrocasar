import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import type { NarrationRef } from "@/domain/audio/service";

import { ReelCard } from "./ReelCard";

const HASH = "f".repeat(64);

describe("ReelCard", () => {
  it("renders no narration pill when narration is undefined", () => {
    render(<ReelCard title="Título" trackName="Vals" />);
    expect(screen.queryByText(/Preparando narración/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Narración · Querétaro Romance/)).not.toBeInTheDocument();
  });

  it("renders no narration pill when narration is 'disabled'", () => {
    render(<ReelCard title="Título" trackName="Vals" narration={{ status: "disabled" }} />);
    expect(screen.queryByText(/Preparando narración/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Narración · Querétaro Romance/)).not.toBeInTheDocument();
  });

  it("shows 'Preparando narración…' when narration is pending", () => {
    const narration: NarrationRef = {
      status: "pending",
      hash: HASH,
      src: `/api/narration/${HASH}`,
    };
    render(<ReelCard title="Título" trackName="Vals" narration={narration} />);
    expect(screen.getByText("Preparando narración…")).toBeInTheDocument();
  });

  it("shows 'Narración · Querétaro Romance' when narration is ready", () => {
    const narration: NarrationRef = {
      status: "ready",
      hash: HASH,
      src: `/api/narration/${HASH}`,
      durationSec: 10,
      sentences: [],
    };
    render(<ReelCard title="Título" trackName="Vals" narration={narration} />);
    expect(screen.getByText("Narración · Querétaro Romance")).toBeInTheDocument();
  });
});
