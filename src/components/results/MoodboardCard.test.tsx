import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { buildFallbackExperience } from "@/domain/experience/fallback";
import type { ExperienceResult } from "@/domain/experience/types";

import { MoodboardCard } from "./MoodboardCard";

function buildResult(): ExperienceResult {
  const fallback = buildFallbackExperience({
    style: "colonial",
    setting: "night_casona",
    experience: "grand_traditional",
    mustHave: "callejoneada",
  });

  return {
    ...fallback,
    meta: { model: "fallback", fallbackUsed: true, durationMs: 0, generatedAt: "2026-01-01" },
  };
}

describe("MoodboardCard", () => {
  it("renders the moodboard preview and download link when all photos are valid", () => {
    render(<MoodboardCard result={buildResult()} />);

    expect(screen.getByText("Moodboard Oficial de Inspiración")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Descargar Moodboard/i })).toBeInTheDocument();
  });

  it("renders an unavailable note with no download link when every photo is invalid", () => {
    const result = buildResult();
    const withBadPhotos: ExperienceResult = {
      ...result,
      photos: result.photos.map((photo) => ({
        ...photo,
        url: "https://evil.example.com/photo.jpg",
      })),
    };

    render(<MoodboardCard result={withBadPhotos} />);

    expect(screen.getByText("Moodboard Oficial de Inspiración")).toBeInTheDocument();
    expect(screen.getByText("Vista previa no disponible")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Descargar Moodboard/i })).not.toBeInTheDocument();
  });
});
