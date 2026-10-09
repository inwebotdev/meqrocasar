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

const { createOpenRouterClient } = await import("@/domain/ai/openrouter");
const { ExperienceResultSchema } = await import("@/domain/experience/schema");
const { createExperienceService } = await import("@/domain/experience/service");
const { createStaticImageProvider } = await import("@/domain/images/static-fallback");
const { POST } = await import("./route");

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

const validAnswers = {
  style: "rustic_vineyard",
  setting: "day_vineyard",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
};

function buildMswBackedService() {
  const llm = createOpenRouterClient({
    apiKey: "test-key",
    primaryModel: "primary-model",
    fallbackModel: "fallback-model",
    timeoutMs: 8000,
    appUrl: "http://localhost:3000",
    appTitle: "Querétaro Romance AI",
  });
  const images = createStaticImageProvider();
  return createExperienceService({ llm, images });
}

describe("POST /api/generate-experience", () => {
  beforeEach(() => {
    getExperienceServiceMock.mockReset();
  });

  it("200: happy path returns data validating against ExperienceResultSchema", async () => {
    server.use(
      mockOpenRouterChat(() =>
        HttpResponse.json({ choices: [{ message: { content: fixture("valid.json") } }] }),
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

  it("400: answers fail schema validation (bad enum)", async () => {
    const response = await POST(makeRequest({ ...validAnswers, style: "not-a-real-style" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_answers");
    expect(Array.isArray(body.error.issues)).toBe(true);
    expect(getExperienceServiceMock).not.toHaveBeenCalled();
  });

  it("200: an llm failure still returns 200 with meta.fallbackUsed true", async () => {
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
});
