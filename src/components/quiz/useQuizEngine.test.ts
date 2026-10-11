/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolvedStepFromCurated, type ResolvedStep } from "@/domain/quiz/generated-step";
import { QUIZ_STEPS } from "@/domain/quiz/questions";
import type { ExperienceResult } from "@/domain/experience/types";

import { quizEngineReducer } from "./useQuizEngine";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { fetchNextStep, generateExperienceFromTranscript, ApiClientErrorMock } = vi.hoisted(() => {
  class ApiClientErrorMock extends Error {
    code: string;
    status?: number;
    constructor(params: { code: string; status?: number; message: string }) {
      super(params.message);
      this.name = "ApiClientError";
      this.code = params.code;
      this.status = params.status;
    }
  }
  return {
    fetchNextStep: vi.fn(),
    generateExperienceFromTranscript: vi.fn(),
    ApiClientErrorMock,
  };
});
vi.mock("@/lib/quiz-client", () => ({
  fetchNextStep,
  generateExperienceFromTranscript,
  ApiClientError: ApiClientErrorMock,
}));

const { saveResult } = vi.hoisted(() => ({ saveResult: vi.fn() }));
vi.mock("@/lib/results-store", () => ({ saveResult }));

const { saveTranscript } = vi.hoisted(() => ({ saveTranscript: vi.fn() }));
vi.mock("@/lib/transcript-store", () => ({ saveTranscript }));

const { useQuizEngine } = await import("./useQuizEngine");

const curatedMeta = {
  model: "local-fallback",
  durationMs: 1,
  cached: false,
  fallbackUsed: false,
  source: "static" as const,
  attempts: 0,
  promptVersion: "quiz-engine-v2",
  normalisations: 0,
};

function step(index: number): ResolvedStep {
  return resolvedStepFromCurated(QUIZ_STEPS[index]!, index + 1);
}

const validResult: ExperienceResult = {
  conceptTitle: "Atardecer Dorado entre Viñedos",
  palette: [
    { hex: "#4B001A", name: "Vino Profundo" },
    { hex: "#944933", name: "Terracota" },
    { hex: "#E9A844", name: "Ámbar Bernal" },
    { hex: "#FCF9F3", name: "Lino" },
  ],
  narrative: "Una celebración íntima entre viñedos centenarios y atardeceres dorados.",
  reelTagline: "Su historia, entre viñedos y atardeceres.",
  searchQueries: ["boda viñedo querétaro"],
  venues: [],
  photos: [
    { url: "https://images.unsplash.com/photo-1", alt: "Viñedo", credit: "Autor A" },
    { url: "https://images.unsplash.com/photo-2", alt: "Atardecer", credit: "Autor B" },
    { url: "https://images.unsplash.com/photo-3", alt: "Cava", credit: "Autor C" },
  ],
  answers: {
    style: "colonial",
    setting: "sunset_garden",
    experience: "intimate_boutique",
    mustHave: "wine_tasting",
  },
  meta: {
    model: "test-model",
    fallbackUsed: false,
    durationMs: 1234,
    generatedAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("quizEngineReducer", () => {
  const initial = { entries: [], status: "loading-step" as const, activeOptionIndex: 0 };

  it("loading_step sets status and the attempted entries", () => {
    const next = quizEngineReducer(initial, { type: "loading_step", entries: [] });
    expect(next.status).toBe("loading-step");
    expect(next.entries).toEqual([]);
  });

  it("step_loaded sets status answering with the resolved step and active index", () => {
    const resolved = step(0);
    const next = quizEngineReducer(initial, {
      type: "step_loaded",
      entries: [],
      step: resolved,
      meta: curatedMeta,
      activeOptionIndex: 2,
    });
    expect(next.status).toBe("answering");
    expect(next.step).toBe(resolved);
    expect(next.activeOptionIndex).toBe(2);
  });

  it("generating sets status generating", () => {
    const next = quizEngineReducer(initial, { type: "generating" });
    expect(next.status).toBe("generating");
  });

  it("error sets status, message and retryKind", () => {
    const next = quizEngineReducer(initial, {
      type: "error",
      message: "boom",
      retryKind: "generate",
    });
    expect(next.status).toBe("error");
    expect(next.error).toBe("boom");
    expect((next as { retryKind?: string }).retryKind).toBe("generate");
  });

  it("select_option sets selectedOptionId without changing status", () => {
    const next = quizEngineReducer(initial, { type: "select_option", optionId: "colonial" });
    expect(next.selectedOptionId).toBe("colonial");
    expect(next.status).toBe("loading-step");
  });

  it("next_option / prev_option wrap around the step's options", () => {
    const resolved = step(0);
    const withStep = { ...initial, status: "answering" as const, step: resolved };

    const afterNext = quizEngineReducer(
      { ...withStep, activeOptionIndex: resolved.options.length - 1 },
      { type: "next_option" },
    );
    expect(afterNext.activeOptionIndex).toBe(0);

    const afterPrev = quizEngineReducer(
      { ...withStep, activeOptionIndex: 0 },
      { type: "prev_option" },
    );
    expect(afterPrev.activeOptionIndex).toBe(resolved.options.length - 1);
  });

  it("go_to_option ignores an out-of-range index", () => {
    const resolved = step(0);
    const withStep = {
      ...initial,
      status: "answering" as const,
      step: resolved,
      activeOptionIndex: 1,
    };

    const next = quizEngineReducer(withStep, { type: "go_to_option", index: 99 });
    expect(next.activeOptionIndex).toBe(1);
  });
});

describe("useQuizEngine", () => {
  beforeEach(() => {
    fetchNextStep.mockReset();
    generateExperienceFromTranscript.mockReset();
    saveResult.mockReset();
    saveTranscript.mockReset();
    push.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  /** Lets the real ~350ms selection-animation `setTimeout` inside `choose()` elapse. */
  async function waitOutSelectAnimation() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
  }

  it("loads the curated step 1 on mount", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step(0), meta: curatedMeta });
    const { result } = renderHook(() => useQuizEngine());

    await waitFor(() => expect(result.current.state.status).toBe("answering"));

    expect(fetchNextStep).toHaveBeenCalledWith({ entries: [] });
    expect(result.current.step?.id).toBe("style");
  });

  it("choose() marks the option selected, then after the animation delay requests the next step", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step(0), meta: curatedMeta });
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step(1), meta: curatedMeta });
    const { result } = renderHook(() => useQuizEngine());

    await waitFor(() => expect(result.current.state.status).toBe("answering"));
    const option = result.current.step!.options[0]!;

    act(() => result.current.choose(option));
    expect(result.current.state.selectedOptionId).toBe(option.id);
    expect(result.current.state.status).toBe("answering");

    await waitOutSelectAnimation();

    await waitFor(() => expect(result.current.step?.id).toBe("setting"));
    expect(saveTranscript).toHaveBeenCalledWith({
      entries: [
        expect.objectContaining({
          stepId: "style",
          chosen: expect.objectContaining({ id: option.id }),
        }),
      ],
    });
    expect(fetchNextStep).toHaveBeenNthCalledWith(2, {
      entries: [expect.objectContaining({ stepId: "style" })],
    });
  });

  it("back() pops the last entry and restores the active index to the previously chosen option", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step(0), meta: curatedMeta });
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step(1), meta: curatedMeta });
    const { result } = renderHook(() => useQuizEngine());
    await waitFor(() => expect(result.current.state.status).toBe("answering"));

    const chosen = result.current.step!.options[1]!;
    act(() => result.current.choose(chosen));
    await waitOutSelectAnimation();
    await waitFor(() => expect(result.current.step?.id).toBe("setting"));

    fetchNextStep.mockResolvedValueOnce({ done: false, step: step(0), meta: curatedMeta });
    act(() => result.current.back());

    await waitFor(() => expect(result.current.step?.id).toBe("style"));
    expect(result.current.state.activeOptionIndex).toBe(1);
    expect(fetchNextStep).toHaveBeenNthCalledWith(3, { entries: [] });
  });

  it("generates the experience, saves it and navigates to /resultados when the engine is done", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: true, meta: curatedMeta });
    generateExperienceFromTranscript.mockResolvedValueOnce(validResult);
    renderHook(() => useQuizEngine());

    await waitFor(() => expect(generateExperienceFromTranscript).toHaveBeenCalled());
    await waitFor(() => expect(saveResult).toHaveBeenCalledWith(validResult));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/resultados"));
  });

  it("surfaces a step-fetch failure as status error, and retry() re-requests the same entries", async () => {
    fetchNextStep.mockRejectedValueOnce(
      new ApiClientErrorMock({ code: "network", message: "offline" }),
    );
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step(0), meta: curatedMeta });
    const { result } = renderHook(() => useQuizEngine());

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state.error).toBe("offline");

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("answering"));
    expect(fetchNextStep).toHaveBeenCalledTimes(2);
  });
});
