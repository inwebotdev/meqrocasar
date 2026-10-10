import { beforeEach, describe, expect, it, vi } from "vitest";

const { getQuizEngineMock } = vi.hoisted(() => ({ getQuizEngineMock: vi.fn() }));

vi.mock("@/lib/quiz-engine-deps", () => ({
  getQuizEngine: getQuizEngineMock,
}));

const { resolvedStepFromCurated } = await import("@/domain/quiz/generated-step");
const { QUIZ_STEPS } = await import("@/domain/quiz/questions");
const { POST } = await import("./route");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/quiz/next", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const curatedMeta = {
  model: "local-fallback",
  durationMs: 0,
  cached: false,
  fallbackUsed: false,
  source: "static" as const,
  attempts: 0,
  promptVersion: "quiz-engine-v1",
};

describe("POST /api/quiz/next", () => {
  beforeEach(() => {
    getQuizEngineMock.mockReset();
  });

  it("200: empty transcript returns the curated step via the engine", async () => {
    const step = resolvedStepFromCurated(QUIZ_STEPS[0]!, 1);
    getQuizEngineMock.mockReturnValue({
      nextStep: vi.fn().mockResolvedValue({ done: false, step, meta: curatedMeta }),
    });

    const response = await POST(makeRequest({ transcript: { entries: [] } }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.done).toBe(false);
    expect(body.data.step.id).toBe("style");
    expect(body.data.meta.source).toBe("static");
  });

  it("200: a non-empty transcript returns a generated step from the engine", async () => {
    const step = resolvedStepFromCurated(QUIZ_STEPS[1]!, 2);
    const nextStep = vi.fn().mockResolvedValue({
      done: false,
      step,
      meta: { ...curatedMeta, model: "deepseek/deepseek-chat", source: "llm" as const },
    });
    getQuizEngineMock.mockReturnValue({ nextStep });

    const transcript = {
      entries: [
        {
          stepId: "style",
          question: "¿Qué vibra define su historia?",
          topic: "Estilo",
          chosen: {
            id: "colonial",
            title: "Colonial Imperial & Casonas",
            summary: "La pareja sueña con una boda colonial.",
            facets: { style: "colonial" },
            refs: { venueIds: [], experienceIds: [] },
          },
        },
      ],
    };

    const response = await POST(makeRequest({ transcript }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.meta.source).toBe("llm");
    expect(nextStep).toHaveBeenCalledWith(transcript);
  });

  it("200: a done result from the engine is passed through", async () => {
    getQuizEngineMock.mockReturnValue({
      nextStep: vi.fn().mockResolvedValue({ done: true, meta: curatedMeta }),
    });

    const response = await POST(makeRequest({ transcript: { entries: [] } }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.done).toBe(true);
    expect(body.data.step).toBeUndefined();
  });

  it("400: malformed JSON body", async () => {
    const request = new Request("http://localhost/api/quiz/next", {
      method: "POST",
      body: "{ not valid json",
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      error: { code: "invalid_json", message: expect.any(String) },
    });
    expect(getQuizEngineMock).not.toHaveBeenCalled();
  });

  it("400: missing transcript field", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_transcript");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(getQuizEngineMock).not.toHaveBeenCalled();
  });

  it("400: transcript fails schema validation (bad shape)", async () => {
    const response = await POST(makeRequest({ transcript: { entries: [{ stepId: "x" }] } }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_transcript");
    expect(getQuizEngineMock).not.toHaveBeenCalled();
  });
});
