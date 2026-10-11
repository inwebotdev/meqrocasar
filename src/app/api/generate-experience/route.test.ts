import { readFileSync } from "node:fs";
import path from "node:path";

import { HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockOpenRouterChat } from "../../../../test/msw/handlers";
import { server } from "../../../../test/msw/server";

const { getExperienceServiceMock } = vi.hoisted(() => ({ getExperienceServiceMock: vi.fn() }));

vi.mock("@/lib/experience-deps", () => ({
  getExperienceService: getExperienceServiceMock,
}));

const { createStructuredClient } = await import("@/domain/ai/structured");
const { ExperienceResultSchema, LLM_EXPERIENCE_V2_JSON_SCHEMA, LlmExperienceV2Schema } =
  await import("@/domain/experience/schema");
const { createExperienceService } = await import("@/domain/experience/service");
const { createStaticImageProvider } = await import("@/domain/images/static-fallback");
const { transcriptFromLegacyAnswers } = await import("@/domain/quiz/transcript");
const { POST } = await import("./route");

type QuizAnswers = Parameters<typeof transcriptFromLegacyAnswers>[0];

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, "../../../../test/fixtures/llm", name), "utf-8");
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/generate-experience", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const validAnswers: QuizAnswers = {
  style: "rustic_vineyard",
  setting: "day_vineyard",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
};

const validTranscriptBody = { transcript: transcriptFromLegacyAnswers(validAnswers) };

function buildMswBackedService() {
  const llm = createStructuredClient({
    config: {
      apiKey: "test-key",
      primaryModel: "primary-model",
      fallbackModel: "fallback-model",
      timeoutMs: 8000,
      appUrl: "http://localhost:3000",
      appTitle: "Querétaro Romance AI",
    },
    schema: LlmExperienceV2Schema,
    jsonSchema: LLM_EXPERIENCE_V2_JSON_SCHEMA as Record<string, unknown>,
    name: "wedding_experience",
  });
  const images = createStaticImageProvider();
  return createExperienceService({ llm, images });
}

describe("POST /api/generate-experience", () => {
  beforeEach(() => {
    getExperienceServiceMock.mockReset();
  });

  it("200: happy path (legacy body) returns data validating against ExperienceResultSchema", async () => {
    server.use(
      mockOpenRouterChat(() =>
        HttpResponse.json({ choices: [{ message: { content: fixture("valid-v2.json") } }] }),
      ),
    );
    getExperienceServiceMock.mockReturnValue(buildMswBackedService());

    const response = await POST(makeRequest(validAnswers));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(ExperienceResultSchema.safeParse(body.data).success).toBe(true);
    expect(body.data.meta.fallbackUsed).toBe(false);
    expect(body.data.answers).toEqual(validAnswers);
  });

  it("200: happy path (transcript body) returns data validating against ExperienceResultSchema", async () => {
    server.use(
      mockOpenRouterChat(() =>
        HttpResponse.json({ choices: [{ message: { content: fixture("valid-v2.json") } }] }),
      ),
    );
    getExperienceServiceMock.mockReturnValue(buildMswBackedService());

    const response = await POST(makeRequest(validTranscriptBody));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(ExperienceResultSchema.safeParse(body.data).success).toBe(true);
    expect(body.data.meta.fallbackUsed).toBe(false);
    expect(body.data.transcript).toEqual(validTranscriptBody.transcript);
    expect(body.data.answers).toBeUndefined();
    expect(body.data.venues.length).toBeGreaterThan(0);
    expect(body.data.itineraryHint).toEqual(expect.any(String));
  });

  it("400: malformed JSON body", async () => {
    const request = new Request("http://localhost/api/generate-experience", {
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
    expect(getExperienceServiceMock).not.toHaveBeenCalled();
  });

  it("400: body matches neither the transcript nor the legacy answers shape", async () => {
    const response = await POST(makeRequest({ ...validAnswers, style: "not-a-real-style" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_answers");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(getExperienceServiceMock).not.toHaveBeenCalled();
  });

  it("400: a transcript with more than 8 entries is rejected", async () => {
    const tooManyEntries = {
      transcript: {
        entries: Array.from({ length: 9 }, (_, index) => ({
          ...validTranscriptBody.transcript.entries[0],
          stepId: `step-${index}`,
        })),
      },
    };

    const response = await POST(makeRequest(tooManyEntries));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_answers");
    expect(getExperienceServiceMock).not.toHaveBeenCalled();
  });

  it("200: an llm failure still returns 200 with meta.fallbackUsed true (legacy body)", async () => {
    server.use(
      mockOpenRouterChat(() => HttpResponse.json({ error: "server error" }, { status: 500 })),
    );
    getExperienceServiceMock.mockReturnValue(buildMswBackedService());

    const response = await POST(makeRequest(validAnswers));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.meta.fallbackUsed).toBe(true);
    expect(body.data.meta.model).toBe("local-fallback");
    expect(ExperienceResultSchema.safeParse(body.data).success).toBe(true);
  });

  it("200: an llm failure still returns 200 with meta.fallbackUsed true (transcript body)", async () => {
    server.use(
      mockOpenRouterChat(() => HttpResponse.json({ error: "server error" }, { status: 500 })),
    );
    getExperienceServiceMock.mockReturnValue(buildMswBackedService());

    const response = await POST(makeRequest(validTranscriptBody));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.meta.fallbackUsed).toBe(true);
    expect(body.data.meta.model).toBe("local-fallback");
    expect(ExperienceResultSchema.safeParse(body.data).success).toBe(true);
  });
});
