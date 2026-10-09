import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui";
import { buildFallbackExperience } from "@/domain/experience/fallback";
import type { ExperienceResult } from "@/domain/experience/types";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { ResultActions, SAVED_EXPERIENCES_KEY as SAVED_KEY } from "./ResultActions";

const ANSWERS: QuizAnswers = {
  style: "colonial",
  setting: "night_casona",
  experience: "grand_traditional",
  mustHave: "fireworks",
};

function buildResult(generatedAt: string): ExperienceResult {
  return {
    ...buildFallbackExperience(ANSWERS),
    meta: {
      model: "test-model",
      fallbackUsed: false,
      durationMs: 100,
      generatedAt,
    },
  };
}

function renderActions(result: ExperienceResult) {
  return render(
    <ToastProvider>
      <ResultActions result={result} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("ResultActions", () => {
  it("falls back to the clipboard and toasts when the Web Share API is unavailable", async () => {
    const user = userEvent.setup();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    renderActions(buildResult("2026-01-01T00:00:00.000Z"));

    await user.click(screen.getByRole("button", { name: /Compartir en Redes/i }));

    expect(await screen.findByText("Enlace copiado")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("saves the experience to localStorage and dedupes by generatedAt", async () => {
    const user = userEvent.setup();
    const result = buildResult("2026-01-01T00:00:00.000Z");
    renderActions(result);

    await user.click(screen.getByRole("button", { name: /Guardar mi Experiencia/i }));
    await user.click(screen.getByRole("button", { name: /Guardar mi Experiencia/i }));

    expect(await screen.findByText("¡Guardado en tus favoritos!")).toBeInTheDocument();

    const raw = window.localStorage.getItem(SAVED_KEY);
    const saved = raw ? (JSON.parse(raw) as ExperienceResult[]) : [];
    expect(saved).toHaveLength(1);
    expect(saved[0]?.meta.generatedAt).toBe(result.meta.generatedAt);
  });

  it("renders the contact planner action as a mailto link", () => {
    renderActions(buildResult("2026-01-01T00:00:00.000Z"));

    const link = screen.getByRole("link", { name: /Contactar Planner/i });
    expect(link.getAttribute("href")).toMatch(/^mailto:romance@queretaro\.travel\?/);
  });
});
