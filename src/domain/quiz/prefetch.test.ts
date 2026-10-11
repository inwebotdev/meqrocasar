import { describe, expect, it, vi } from "vitest";

import type { QuizEngine, QuizEngineMeta, QuizEngineResult } from "./engine";
import {
  buildPrefetchEntry,
  PrefetchRequestSchema,
  runPrefetch,
  type PrefetchRequest,
} from "./prefetch";
import type { Transcript } from "./transcript";

function meta(overrides: Partial<QuizEngineMeta> = {}): QuizEngineMeta {
  return {
    model: "test-model",
    durationMs: 10,
    cached: false,
    fallbackUsed: false,
    source: "llm",
    attempts: 1,
    promptVersion: "quiz-engine-v2",
    normalisations: 0,
    ...overrides,
  };
}

function makeOption(id: string) {
  return {
    id,
    title: `Opción ${id}`,
    summary: `Resumen de ${id}.`,
    facets: { experience: "wine_tasting" as const },
    refs: { venueIds: [], experienceIds: [] },
  };
}

function makeRequest(
  optionCount: number,
  transcript: Transcript = { entries: [] },
): PrefetchRequest {
  return {
    transcript,
    options: Array.from({ length: optionCount }, (_, i) => makeOption(`opt-${i + 1}`)),
    stepId: "step-2",
    question: "¿Qué experiencia no puede faltar?",
    topic: "Experiencia",
  };
}

describe("PrefetchRequestSchema", () => {
  it("accepts a well-formed request", () => {
    expect(PrefetchRequestSchema.safeParse(makeRequest(3)).success).toBe(true);
  });

  it("rejects more than 4 options", () => {
    const result = PrefetchRequestSchema.safeParse(makeRequest(5));
    expect(result.success).toBe(false);
  });

  it("rejects zero options", () => {
    const result = PrefetchRequestSchema.safeParse(makeRequest(0));
    expect(result.success).toBe(false);
  });
});

describe("buildPrefetchEntry", () => {
  it("builds a transcript entry straight from the request's stepId/question/topic and the option", () => {
    const request = makeRequest(1);
    const entry = buildPrefetchEntry(request, request.options[0]!);

    expect(entry).toEqual({
      stepId: "step-2",
      question: "¿Qué experiencia no puede faltar?",
      topic: "Experiencia",
      chosen: {
        id: "opt-1",
        title: "Opción opt-1",
        summary: "Resumen de opt-1.",
        facets: { experience: "wine_tasting" },
        refs: { venueIds: [], experienceIds: [] },
      },
    });
  });
});

describe("runPrefetch", () => {
  function fakeEngine(resultFor: (transcript: Transcript) => QuizEngineResult): QuizEngine {
    return { nextStep: vi.fn(async (transcript: Transcript) => resultFor(transcript)) };
  }

  it("calls nextStep once per option, with the option's entry appended", async () => {
    const request = makeRequest(3);
    const nextStep = vi.fn(
      async (_transcript: Transcript) =>
        ({ done: false, step: undefined, meta: meta() }) as unknown as QuizEngineResult,
    );
    const engine: QuizEngine = { nextStep };

    await runPrefetch(request, engine, () => 0);

    expect(nextStep).toHaveBeenCalledTimes(3);
    const calledEntries = nextStep.mock.calls.map((call) => (call[0] as Transcript).entries.length);
    expect(calledEntries).toEqual([1, 1, 1]);

    const firstCallIds = nextStep.mock.calls.map(
      (call) => (call[0] as Transcript).entries[0]?.chosen.id,
    );
    expect(new Set(firstCallIds)).toEqual(new Set(["opt-1", "opt-2", "opt-3"]));
  });

  it("caps at 4 options even if more are sent", async () => {
    // PrefetchRequestSchema already rejects >4 at the HTTP boundary, but
    // runPrefetch defends on its own too (it's called directly in tests).
    const request = {
      ...makeRequest(3),
      options: [...makeRequest(3).options, makeOption("opt-4"), makeOption("opt-5")],
    };
    const nextStep = vi.fn(
      async (_transcript: Transcript) =>
        ({ done: false, step: undefined, meta: meta() }) as unknown as QuizEngineResult,
    );
    const engine: QuizEngine = { nextStep };

    await runPrefetch(request, engine, () => 0);

    expect(nextStep).toHaveBeenCalledTimes(4);
  });

  it("counts only fresh warm-ups (meta.cached === false) in `warmed`", async () => {
    const request = makeRequest(3);
    let callIndex = 0;
    const engine = fakeEngine(() => {
      callIndex += 1;
      // The first call is already warm; the other two are fresh.
      return {
        done: false,
        step: undefined,
        meta: meta({ cached: callIndex === 1 }),
      } as unknown as QuizEngineResult;
    });

    const outcome = await runPrefetch(request, engine, () => 0);

    expect(outcome.warmed).toBe(2);
  });

  it("reports durationMs from the injected clock", async () => {
    const request = makeRequest(1);
    const engine = fakeEngine(
      () => ({ done: false, step: undefined, meta: meta() }) as unknown as QuizEngineResult,
    );

    let now = 100;
    const outcome = await runPrefetch(request, engine, () => {
      now += 5;
      return now;
    });

    expect(outcome.durationMs).toBeGreaterThan(0);
  });

  it("abandons a call that exceeds its per-call budget, counting it as not-warmed", async () => {
    const request = makeRequest(1);
    const engine: QuizEngine = {
      nextStep: () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                done: false,
                step: undefined,
                meta: meta(),
              } as unknown as QuizEngineResult),
            200,
          );
        }),
    };

    const outcome = await runPrefetch(request, engine, () => 0, 20);
    expect(outcome.warmed).toBe(0);
  });
});
