import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ToastProvider } from "@/components/ui";
import { buildFallbackExperience } from "@/domain/experience/fallback";
import type { ExperienceResult } from "@/domain/experience/types";
import type { QuizAnswers } from "@/domain/quiz/schema";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => null,
}));

const { loadResult, clearResult } = vi.hoisted(() => ({
  loadResult: vi.fn(),
  clearResult: vi.fn(),
}));
vi.mock("@/lib/results-store", () => ({ loadResult, clearResult }));

const { ResultsScreen } = await import("./ResultsScreen");

const ANSWERS: QuizAnswers = {
  style: "colonial",
  setting: "night_casona",
  experience: "grand_traditional",
  mustHave: "fireworks",
};

function buildResult(): ExperienceResult {
  return {
    ...buildFallbackExperience(ANSWERS),
    meta: {
      model: "test-model",
      fallbackUsed: false,
      durationMs: 100,
      generatedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function renderScreen() {
  return render(
    <ToastProvider>
      <ResultsScreen />
    </ToastProvider>,
  );
}

describe("ResultsScreen", () => {
  it("redirects to / when no result is stored", () => {
    loadResult.mockReturnValue(undefined);
    renderScreen();

    expect(replace).toHaveBeenCalledWith("/");
  });

  it("renders the concept title when a result is stored", () => {
    const result = buildResult();
    loadResult.mockReturnValue(result);
    renderScreen();

    expect(
      screen.getByRole("heading", { name: result.conceptTitle, level: 1 }),
    ).toBeInTheDocument();
  });
});
