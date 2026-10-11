import { beforeEach, describe, expect, it, vi } from "vitest";

const { getQuizEngineMock, getEnvMock } = vi.hoisted(() => ({
  getQuizEngineMock: vi.fn(),
  getEnvMock: vi.fn(),
}));

vi.mock("@/lib/quiz-engine-deps", () => ({
  getQuizEngine: getQuizEngineMock,
}));

vi.mock("@/lib/env", () => ({
  getEnv: getEnvMock,
}));

const { POST } = await import("./route");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/quiz/prefetch", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function validBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    transcript: { entries: [] },
    options: [
      {
        id: "opt-1",
        title: "Opción 1",
        summary: "Resumen 1.",
        facets: { experience: "wine_tasting" },
        refs: { venueIds: [], experienceIds: [] },
      },
      {
        id: "opt-2",
        title: "Opción 2",
        summary: "Resumen 2.",
        facets: { experience: "fireworks" },
        refs: { venueIds: [], experienceIds: [] },
      },
    ],
    stepId: "step-2",
    question: "¿Qué experiencia no puede faltar?",
    topic: "Experiencia",
    ...overrides,
  };
}

const curatedMeta = {
  model: "test-model",
  durationMs: 5,
  cached: false,
  fallbackUsed: false,
  source: "llm" as const,
  attempts: 1,
  promptVersion: "quiz-engine-v2",
  normalisations: 0,
};

describe("POST /api/quiz/prefetch", () => {
  beforeEach(() => {
    getQuizEngineMock.mockReset();
    getEnvMock.mockReset();
    getEnvMock.mockReturnValue({ QUIZ_PREFETCH: true });
  });

  it("200: warms the engine once per option and reports warmed/durationMs", async () => {
    const nextStep = vi.fn().mockResolvedValue({
      done: false,
      step: undefined,
      meta: curatedMeta,
    });
    getQuizEngineMock.mockReturnValue({ nextStep });

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.warmed).toBe(2);
    expect(typeof body.data.durationMs).toBe("number");
    expect(nextStep).toHaveBeenCalledTimes(2);
  });

  it("200: a disabled QUIZ_PREFETCH flag short-circuits without calling the engine", async () => {
    getEnvMock.mockReturnValue({ QUIZ_PREFETCH: false });
    const nextStep = vi.fn();
    getQuizEngineMock.mockReturnValue({ nextStep });

    const response = await POST(makeRequest(validBody()));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual({ warmed: 0, durationMs: 0 });
    expect(getQuizEngineMock).not.toHaveBeenCalled();
    expect(nextStep).not.toHaveBeenCalled();
  });

  it("400: malformed JSON body", async () => {
    const request = new Request("http://localhost/api/quiz/prefetch", {
      method: "POST",
      body: "{ not valid json",
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_json");
    expect(getQuizEngineMock).not.toHaveBeenCalled();
  });

  it("400: more than 4 options", async () => {
    const body = validBody({
      options: Array.from({ length: 5 }, (_, i) => ({
        id: `opt-${i + 1}`,
        title: `Opción ${i + 1}`,
        summary: `Resumen ${i + 1}.`,
        facets: {},
        refs: { venueIds: [], experienceIds: [] },
      })),
    });

    const response = await POST(makeRequest(body));

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.error.code).toBe("invalid_params");
    expect(getQuizEngineMock).not.toHaveBeenCalled();
  });

  it("400: missing required fields", async () => {
    const response = await POST(makeRequest({ transcript: { entries: [] } }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_params");
  });
});
