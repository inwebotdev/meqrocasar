import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import type { ExperienceMeta } from "@/domain/experience/types";
import type { Transcript } from "@/domain/quiz/transcript";

import { MetaFooter } from "./MetaFooter";

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
  it("shows the token count when usage is present, with no cost line below $0.01", () => {
    render(
      <MetaFooter meta={{ ...BASE_META, usage: { promptTokens: 10, completionTokens: 20 } }} />,
    );

    expect(
      screen.getByText("Generado con qwen/qwen-2.5-7b-instruct en 842 ms · 30 tokens · ≈ < $0.01"),
    ).toBeInTheDocument();
  });

  it("shows the estimated cost line once it crosses $0.01", () => {
    render(
      <MetaFooter
        meta={{ ...BASE_META, usage: { promptTokens: 100000, completionTokens: 50000 } }}
      />,
    );

    expect(screen.getByText((text) => text.includes("≈ $0.02"))).toBeInTheDocument();
  });

  it("prefixes the step count from the transcript when present", () => {
    render(
      <MetaFooter
        meta={{ ...BASE_META, usage: { promptTokens: 10, completionTokens: 20 } }}
        transcript={TRANSCRIPT}
      />,
    );

    expect(screen.getByText((text) => text.startsWith("2 pasos ·"))).toBeInTheDocument();
  });

  it("omits the step count when no transcript is given", () => {
    render(<MetaFooter meta={BASE_META} />);

    expect(screen.queryByText((text) => text.includes("pasos"))).not.toBeInTheDocument();
  });
});
