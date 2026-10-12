import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { ExperienceMeta } from "@/domain/experience/types";
import type { Transcript } from "@/domain/quiz/transcript";

const { useSearchParams } = vi.hoisted(() => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));
vi.mock("next/navigation", () => ({ useSearchParams }));

const { MetaFooter } = await import("./MetaFooter");

const BASE_META: ExperienceMeta = {
  model: "qwen/qwen-2.5-7b-instruct",
  fallbackUsed: false,
  durationMs: 842,
  generatedAt: "2026-01-01T00:00:00.000Z",
};

const TRANSCRIPT: Transcript = {
  entries: [
    {
      stepId: "style",
      question: "¿Qué estilo?",
      topic: "Estilo",
      chosen: {
        id: "colonial",
        title: "Colonial",
        summary: "Colonial",
        facets: { style: "colonial" },
        refs: { venueIds: [], experienceIds: [] },
      },
    },
    {
      stepId: "setting",
      question: "¿Qué entorno?",
      topic: "Entorno",
      chosen: {
        id: "night_casona",
        title: "Noche de Casona",
        summary: "Noche de Casona",
        facets: { setting: "night_casona" },
        refs: { venueIds: [], experienceIds: [] },
      },
    },
  ],
};

describe("MetaFooter", () => {
  beforeEach(() => {
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("shows the plain sentence with seconds and a 4-answer fallback when no transcript is given", () => {
    render(<MetaFooter meta={BASE_META} />);

    expect(screen.getByText("Propuesta generada en 0.8 s · 4 respuestas")).toBeInTheDocument();
  });

  it("uses the transcript's entry count instead of the fallback", () => {
    render(<MetaFooter meta={BASE_META} transcript={TRANSCRIPT} />);

    expect(screen.getByText("Propuesta generada en 0.8 s · 2 respuestas")).toBeInTheDocument();
  });

  it("shows the fallback pill, with the 'sin conexión' wording, when fallbackUsed is true", () => {
    render(<MetaFooter meta={{ ...BASE_META, fallbackUsed: true }} />);

    expect(screen.getByText("Modo demo sin conexión")).toBeInTheDocument();
  });

  it("omits the fallback pill when fallbackUsed is false", () => {
    render(<MetaFooter meta={BASE_META} />);

    expect(screen.queryByText("Modo demo sin conexión")).not.toBeInTheDocument();
  });

  it("hides the technical line (model, tokens, cost) by default", () => {
    render(
      <MetaFooter meta={{ ...BASE_META, usage: { promptTokens: 10, completionTokens: 20 } }} />,
    );

    expect(screen.queryByTestId("meta-footer-debug")).not.toBeInTheDocument();
  });

  it("shows the technical line only when the URL has ?debug=1", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("debug=1"));

    render(
      <MetaFooter meta={{ ...BASE_META, usage: { promptTokens: 10, completionTokens: 20 } }} />,
    );

    expect(
      screen.getByText("qwen/qwen-2.5-7b-instruct en 842 ms · 30 tokens · ≈ < $0.01"),
    ).toBeInTheDocument();
  });
});
