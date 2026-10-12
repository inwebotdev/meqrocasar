import { readFileSync } from "node:fs";
import path from "node:path";

import { HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ToastProvider } from "@/components/ui";
import type { ExperienceResult } from "@/domain/experience/types";

import { mockOpenRouterChat } from "../../../../test/msw/handlers";
import { server } from "../../../../test/msw/server";

const { getExperienceServiceMock } = vi.hoisted(() => ({ getExperienceServiceMock: vi.fn() }));

vi.mock("@/lib/experience-deps", () => ({
  getExperienceService: getExperienceServiceMock,
}));

const { createStructuredClient } = await import("@/domain/ai/structured");
const { LLM_EXPERIENCE_V2_JSON_SCHEMA, LlmExperienceV2Schema } =
  await import("@/domain/experience/schema");
const { createExperienceService } = await import("@/domain/experience/service");
const { createStaticImageProvider } = await import("@/domain/images/static-fallback");
const { transcriptFromLegacyAnswers } = await import("@/domain/quiz/transcript");
const { POST } = await import("./route");
const { ResultsView } = await import("@/components/results/ResultsView");

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, "../../../../test/fixtures/llm", name), "utf-8");
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/generate-experience", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function buildMswBackedService() {
  const llm = createStructuredClient({
    config: {
      apiKey: "test-key",
      primaryModel: "primary-model",
      fallbackModel: "fallback-model",
      timeoutMs: 8000,
      appUrl: "http://localhost:3000",
      appTitle: "Querétaro Romance",
    },
    schema: LlmExperienceV2Schema,
    jsonSchema: LLM_EXPERIENCE_V2_JSON_SCHEMA as Record<string, unknown>,
    name: "wedding_experience",
  });
  const images = createStaticImageProvider();
  return createExperienceService({ llm, images });
}

const validTranscriptBody = {
  transcript: transcriptFromLegacyAnswers({
    style: "colonial",
    setting: "night_casona",
    experience: "intimate_boutique",
    mustHave: "callejoneada",
  }),
};

describe("POST /api/generate-experience + ResultsView, with a places-sourced venue and no Google key", () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    getExperienceServiceMock.mockReset();
    originalApiKey = process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY;
    } else {
      process.env.GOOGLE_PLACES_API_KEY = originalApiKey;
    }
  });

  it("never hands out a /api/places/photo URL, and ResultsView renders the result without errors", async () => {
    server.use(
      mockOpenRouterChat(() =>
        HttpResponse.json({ choices: [{ message: { content: fixture("places-venue-v2.json") } }] }),
      ),
    );
    getExperienceServiceMock.mockReturnValue(buildMswBackedService());

    const response = await POST(makeRequest(validTranscriptBody));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { ok: true; data: ExperienceResult };
    expect(body.ok).toBe(true);
    const result = body.data;

    // The recommended venue really is a Places-sourced fixture venue.
    expect(result.venues.some((venue) => venue.id === "v_placesfixturehotellasjacarandas")).toBe(
      true,
    );

    // With no GOOGLE_PLACES_API_KEY, nothing in the result points at the
    // (currently 500ing) Places photo proxy.
    for (const photo of result.photos) {
      expect(photo.url).not.toContain("/api/places/photo");
    }
    for (const venue of result.venues) {
      expect(venue.photoUrl ?? "").not.toContain("/api/places/photo");
    }

    render(
      <ToastProvider>
        <ResultsView result={result} />
      </ToastProvider>,
    );

    expect(
      screen.getByRole("heading", { name: result.conceptTitle, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sede Principal")).toBeInTheDocument();
  });
});
