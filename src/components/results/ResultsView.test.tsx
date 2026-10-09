import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ToastProvider } from "@/components/ui";
import { buildFallbackExperience } from "@/domain/experience/fallback";
import type { ExperienceMeta, ExperienceResult } from "@/domain/experience/types";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { ResultsView } from "./ResultsView";

const ANSWERS: QuizAnswers = {
  style: "colonial",
  setting: "night_casona",
  experience: "grand_traditional",
  mustHave: "fireworks",
};

function buildResult(meta: ExperienceMeta): ExperienceResult {
  return { ...buildFallbackExperience(ANSWERS), meta };
}

function renderResultsView(result: ExperienceResult) {
  return render(
    <ToastProvider>
      <ResultsView result={result} />
    </ToastProvider>,
  );
}

describe("ResultsView", () => {
  it("renders the concept title and the first narrative paragraph", () => {
    const result = buildResult({
      model: "test-model",
      fallbackUsed: false,
      durationMs: 842,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderResultsView(result);

    expect(
      screen.getByRole("heading", { name: result.conceptTitle, level: 1 }),
    ).toBeInTheDocument();

    const [firstParagraph] = result.narrative.split("\n\n");
    expect(screen.getAllByText(firstParagraph).length).toBeGreaterThan(0);
  });

  it("renders all 4 palette hex labels", () => {
    const result = buildResult({
      model: "test-model",
      fallbackUsed: false,
      durationMs: 842,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderResultsView(result);

    for (const color of result.palette) {
      expect(screen.getByText(color.hex)).toBeInTheDocument();
    }
  });

  it("renders a Sede Principal and a Sede Destacada venue badge", () => {
    const result = buildResult({
      model: "test-model",
      fallbackUsed: false,
      durationMs: 842,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderResultsView(result);

    expect(screen.getByText("Sede Principal")).toBeInTheDocument();
    expect(screen.getByText("Sede Destacada")).toBeInTheDocument();
  });

  it("renders the 3 moodboard bento images", () => {
    const result = buildResult({
      model: "test-model",
      fallbackUsed: false,
      durationMs: 842,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderResultsView(result);

    const moodboardHeading = screen.getByText("Moodboard Oficial de Inspiración");
    const moodboardCard = moodboardHeading.closest("div.rounded-xl") ?? document.body;

    for (const photo of result.photos) {
      expect(within(moodboardCard as HTMLElement).getByAltText(photo.alt)).toBeInTheDocument();
    }
  });

  it("the moodboard download link starts with the moodboard path, requests a download and carries a download attribute", () => {
    const result = buildResult({
      model: "test-model",
      fallbackUsed: false,
      durationMs: 842,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderResultsView(result);

    const link = screen.getByRole("link", { name: /Descargar Moodboard/i });
    const href = link.getAttribute("href") ?? "";

    expect(href.startsWith("/api/og/moodboard?d=")).toBe(true);
    expect(href).toContain("download=1");
    expect(link).toHaveAttribute("download");
  });

  it("shows the model and duration in the meta footer, with no fallback pill when fallbackUsed is false", () => {
    const result = buildResult({
      model: "google/gemini-2.5-flash",
      fallbackUsed: false,
      durationMs: 842,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderResultsView(result);

    expect(screen.getByText("Generado con google/gemini-2.5-flash en 842 ms")).toBeInTheDocument();
    expect(screen.queryByText("Modo demo sin IA (fallback local)")).not.toBeInTheDocument();
  });

  it("shows the fallback pill in the meta footer when fallbackUsed is true", () => {
    const result = buildResult({
      model: "fallback",
      fallbackUsed: true,
      durationMs: 12,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    renderResultsView(result);

    expect(screen.getByText("Modo demo sin IA (fallback local)")).toBeInTheDocument();
  });
});
