import { HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import {
  createStructuredClient,
  type ChatMessage,
  type StructuredClient,
} from "../../src/domain/ai/structured";
import type { KbVenue } from "../../src/domain/kb/types";
import type { Place } from "../../src/domain/places";
import { mockOpenRouterChat } from "../../test/msw/handlers";
import { server } from "../../test/msw/server";
import {
  batchVenues,
  buildEnrichmentMessages,
  buildVenueFacts,
  ENRICHMENT_JSON_SCHEMA,
  EnrichmentResponseSchema,
  enrichBatch,
  type EnrichedVenue,
  type EnrichmentResponse,
  mergeEnrichment,
  runEnrichment,
  selectVenuesForEnrichment,
  sortVenues,
} from "./enrich-lib";

function venue(overrides: Partial<KbVenue> = {}): KbVenue {
  return {
    id: "v_test",
    name: "Test Venue",
    aliases: [],
    zone: "ezequiel_montes",
    municipality: "Ezequiel Montes",
    capacityEstimate: 150,
    capacityApprox: true,
    oneLiner: "",
    whyWeddings: "",
    highlights: ["", "", ""],
    facets: {
      styles: ["rustic_vineyard"],
      settings: ["day_vineyard"],
      scale: ["medium"],
      experiences: [],
      budget: "medio_alto",
    },
    photos: [],
    source: "places",
    confidence: 0.4,
    ...overrides,
  };
}

function curatedVenue(overrides: Partial<KbVenue> = {}): KbVenue {
  return venue({
    source: "curated",
    confidence: 1,
    oneLiner: "Una frase ya escrita a mano.",
    whyWeddings: "Razones ya escritas a mano sobre por qué es ideal para bodas.",
    highlights: ["Jardines", "Cava", "Vista"],
    ...overrides,
  });
}

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "places/fixture-1",
    displayName: { text: "Test Venue" },
    primaryType: "winery",
    types: ["winery", "tourist_attraction"],
    editorialSummary: { text: "Un viñedo con vista espectacular." },
    reviews: [{ text: { text: "La vendimia fue inolvidable." } }],
    websiteUri: "https://example.com",
    ...overrides,
  };
}

function enriched(overrides: Partial<EnrichedVenue> = {}): EnrichedVenue {
  return {
    id: "v_test",
    isWeddingVenue: true,
    facets: {
      styles: ["rustic_vineyard"],
      settings: ["day_vineyard"],
      scale: ["medium"],
      experiences: ["wine_tasting"],
      budget: "medio_alto",
    },
    capacityEstimate: 180,
    capacityApprox: true,
    oneLiner: "Un viñedo dorado al atardecer.",
    whyWeddings: "Cava subterránea y terraza con vista al valle para la recepción.",
    highlights: ["Viñedo propio", "Cava", "Terraza"],
    confidence: 0.85,
    ...overrides,
  };
}

describe("selectVenuesForEnrichment", () => {
  it("selects places-sourced venues below the confidence threshold", () => {
    const venues = [
      venue({ id: "v_low", confidence: 0.4 }),
      venue({ id: "v_high", confidence: 0.95, whyWeddings: "ya tiene copia" }),
    ];
    const selected = selectVenuesForEnrichment(venues);
    expect(selected.map((v) => v.id)).toEqual(["v_low"]);
  });

  it("selects a venue with missing whyWeddings even above the confidence threshold", () => {
    const venues = [venue({ id: "v_missing_copy", confidence: 0.95, whyWeddings: "" })];
    expect(selectVenuesForEnrichment(venues).map((v) => v.id)).toEqual(["v_missing_copy"]);
  });

  it("skips curated seeds by default, even when below threshold", () => {
    const venues = [
      curatedVenue({ id: "v_curated", confidence: 1 }),
      venue({ id: "v_places", confidence: 0.4 }),
    ];
    expect(selectVenuesForEnrichment(venues).map((v) => v.id)).toEqual(["v_places"]);
  });

  it("includes curated seeds when --all is set and they'd otherwise qualify", () => {
    const venues = [curatedVenue({ id: "v_curated", whyWeddings: "" })];
    expect(selectVenuesForEnrichment(venues, { all: true }).map((v) => v.id)).toEqual([
      "v_curated",
    ]);
  });
});

describe("batchVenues", () => {
  it("splits into chunks of the given size, preserving order", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const batches = batchVenues(items, 8);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toHaveLength(8);
    expect(batches[1]).toEqual([8, 9]);
  });
});

describe("buildVenueFacts", () => {
  it("pulls types, editorial summary, review snippets and website from the matching place", () => {
    const v = venue({ id: "v_1", placeId: "places/fixture-1" });
    const placesById = new Map([["places/fixture-1", place()]]);
    const facts = buildVenueFacts(v, placesById);

    expect(facts.id).toBe("v_1");
    expect(facts.types).toContain("winery");
    expect(facts.editorialSummary).toContain("viñedo");
    expect(facts.reviewSnippets).toEqual(["La vendimia fue inolvidable."]);
    expect(facts.websiteUri).toBe("https://example.com");
  });

  it("falls back to empty facts when there's no matching place", () => {
    const v = venue({ id: "v_2" });
    const facts = buildVenueFacts(v, new Map());
    expect(facts.types).toEqual([]);
    expect(facts.reviewSnippets).toEqual([]);
  });
});

describe("buildEnrichmentMessages", () => {
  it("includes every venue's id, name and facts in the user message", () => {
    const facts = [
      buildVenueFacts(
        venue({ id: "v_1", placeId: "places/fixture-1" }),
        new Map([["places/fixture-1", place()]]),
      ),
    ];
    const messages = buildEnrichmentMessages(facts);

    expect(messages[0]?.role).toBe("system");
    const userMessage = messages[1]?.content ?? "";
    expect(userMessage).toContain("[v_1]");
    expect(userMessage).toContain("Test Venue");
    expect(userMessage).toContain("winery");
    expect(userMessage).toContain("La vendimia fue inolvidable.");
  });
});

describe("mergeEnrichment", () => {
  it("overwrites a places-sourced venue's facets/copy/capacity/confidence, keeping ratings and photos", () => {
    const v = venue({
      id: "v_1",
      rating: 4.5,
      userRatingCount: 100,
      photos: [{ kind: "places", ref: "places/fixture-1/photos/p1" }],
    });
    const result = mergeEnrichment([v], [enriched({ id: "v_1" })]);

    expect(result.enrichedIds).toEqual(["v_1"]);
    expect(result.droppedIds).toEqual([]);
    const merged = result.venues[0]!;
    expect(merged.oneLiner).toBe("Un viñedo dorado al atardecer.");
    expect(merged.confidence).toBe(0.85);
    expect(merged.rating).toBe(4.5);
    expect(merged.photos).toEqual(v.photos);
  });

  it("drops a venue the model marks as not a wedding venue", () => {
    const v = venue({ id: "v_restaurant" });
    const result = mergeEnrichment([v], [enriched({ id: "v_restaurant", isWeddingVenue: false })]);

    expect(result.venues).toEqual([]);
    expect(result.droppedIds).toEqual(["v_restaurant"]);
  });

  it("drops a venue with confidence below 0.5", () => {
    const v = venue({ id: "v_unsure" });
    const result = mergeEnrichment([v], [enriched({ id: "v_unsure", confidence: 0.3 })]);

    expect(result.venues).toEqual([]);
    expect(result.droppedIds).toEqual(["v_unsure"]);
  });

  it("leaves a curated seed's existing copy untouched, only filling blanks", () => {
    const seed = curatedVenue({ id: "v_curated" });
    const result = mergeEnrichment([seed], [enriched({ id: "v_curated" })]);

    const merged = result.venues[0]!;
    expect(merged.oneLiner).toBe(seed.oneLiner);
    expect(merged.whyWeddings).toBe(seed.whyWeddings);
    expect(merged.highlights).toEqual(seed.highlights);
    expect(merged.confidence).toBe(1);
  });

  it("fills a curated seed's blank fields from the enrichment result", () => {
    const seed = curatedVenue({ id: "v_curated_blank", whyWeddings: "", highlights: ["", "", ""] });
    const result = mergeEnrichment([seed], [enriched({ id: "v_curated_blank" })]);

    const merged = result.venues[0]!;
    expect(merged.whyWeddings).toBe(
      "Cava subterránea y terraza con vista al valle para la recepción.",
    );
    expect(merged.highlights).toEqual(["Viñedo propio", "Cava", "Terraza"]);
    expect(merged.confidence).toBe(1); // curated confidence is never overwritten
  });

  it("leaves a venue with no matching result untouched", () => {
    const v = venue({ id: "v_untouched" });
    const result = mergeEnrichment([v], []);
    expect(result.venues).toEqual([v]);
    expect(result.enrichedIds).toEqual([]);
    expect(result.droppedIds).toEqual([]);
  });
});

describe("sortVenues", () => {
  it("puts curated seeds first, then sorts by rating descending", () => {
    const venues = [
      venue({ id: "v_places_low", rating: 4.2 }),
      curatedVenue({ id: "v_curated" }),
      venue({ id: "v_places_high", rating: 4.8 }),
    ];

    const sorted = sortVenues(venues);
    expect(sorted.map((v) => v.id)).toEqual(["v_curated", "v_places_high", "v_places_low"]);
  });
});

function fakeClient(
  responder: (messages: ChatMessage[], callIndex: number) => EnrichmentResponse | "http-error",
): StructuredClient<EnrichmentResponse> {
  let callIndex = 0;
  return {
    async generate(messages: ChatMessage[]) {
      callIndex += 1;
      const response = responder(messages, callIndex);
      if (response === "http-error") {
        return {
          ok: false,
          attempts: [{ model: "primary", outcome: "http-error", status: 500, durationMs: 1 }],
        };
      }
      return {
        ok: true,
        value: response,
        model: "primary",
        attempts: [{ model: "primary", outcome: "ok", status: 200, durationMs: 1 }],
        usage: { promptTokens: 100, completionTokens: 50 },
      };
    },
  };
}

describe("enrichBatch", () => {
  it("requeues missing ids exactly once and merges the requeued result", async () => {
    const facts = [
      buildVenueFacts(venue({ id: "v_1" }), new Map()),
      buildVenueFacts(venue({ id: "v_2" }), new Map()),
    ];

    const client = fakeClient((_messages, callIndex) => {
      if (callIndex === 1) {
        return { venues: [enriched({ id: "v_1" })] }; // v_2 missing
      }
      return { venues: [enriched({ id: "v_2" })] };
    });

    const result = await enrichBatch(client, facts, { sleep: async () => {} });

    expect(result.results.map((r) => r.id).sort()).toEqual(["v_1", "v_2"]);
    expect(result.attempts).toHaveLength(2);
  });

  it("ignores ids in the response that weren't requested", async () => {
    const facts = [buildVenueFacts(venue({ id: "v_1" }), new Map())];

    const client = fakeClient(() => ({
      venues: [enriched({ id: "v_1" }), enriched({ id: "v_unknown" })],
    }));

    const result = await enrichBatch(client, facts, { sleep: async () => {} });
    expect(result.results.map((r) => r.id)).toEqual(["v_1"]);
  });

  it("does not requeue beyond once even if the retry is also missing ids", async () => {
    const facts = [buildVenueFacts(venue({ id: "v_1" }), new Map())];
    const client = fakeClient(() => ({ venues: [] }));

    const result = await enrichBatch(client, facts, { sleep: async () => {} });
    expect(result.results).toEqual([]);
    // One initial call + one requeue = 2, never more.
    expect(result.attempts).toHaveLength(2);
  });
});

describe("runEnrichment", () => {
  it("batches selected venues, merges results and estimates cost from usage", async () => {
    const venues = [venue({ id: "v_1" }), venue({ id: "v_2" }), curatedVenue({ id: "v_curated" })];
    const generate = vi.fn(async (messages: ChatMessage[]) => {
      const ids = [...messages[1]!.content.matchAll(/\[(v_\w+)\]/g)].map((m) => m[1] as string);
      return {
        ok: true as const,
        value: { venues: ids.map((id) => enriched({ id })) },
        model: "qwen/qwen-2.5-72b-instruct",
        attempts: [
          {
            model: "qwen/qwen-2.5-72b-instruct",
            outcome: "ok" as const,
            status: 200,
            durationMs: 1,
          },
        ],
        usage: { promptTokens: 1000, completionTokens: 500 },
      };
    });

    const result = await runEnrichment({
      venues,
      places: [],
      client: { generate },
      sleep: async () => {},
    });

    expect(result.selectedCount).toBe(2); // curated skipped by default
    expect(result.skippedCount).toBe(1);
    expect(result.enrichedIds.sort()).toEqual(["v_1", "v_2"]);
    expect(result.venues).toHaveLength(3);
    expect(result.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.usageByModel["qwen/qwen-2.5-72b-instruct"]).toEqual({
      promptTokens: 1000,
      completionTokens: 500,
    });
  });

  it("is idempotent: re-running with already-enriched venues selects nothing and changes nothing", async () => {
    const enrichedVenue = venue({
      id: "v_1",
      confidence: 0.95,
      whyWeddings: "Ya enriquecido.",
      oneLiner: "Ya tiene copia.",
    });
    const generate = vi.fn(async () => ({
      ok: true as const,
      value: { venues: [] },
      model: "qwen/qwen-2.5-72b-instruct",
      attempts: [],
    }));

    const result = await runEnrichment({
      venues: [enrichedVenue],
      places: [],
      client: { generate },
      sleep: async () => {},
    });

    expect(result.selectedCount).toBe(0);
    expect(generate).not.toHaveBeenCalled();
    expect(result.venues).toEqual([enrichedVenue]);
  });
});

describe("runEnrichment (real OpenRouter request/response shape, via MSW)", () => {
  function realClient(): StructuredClient<EnrichmentResponse> {
    return createStructuredClient({
      config: {
        apiKey: "test-key",
        primaryModel: "qwen/qwen-2.5-72b-instruct",
        fallbackModel: "deepseek/deepseek-chat",
        timeoutMs: 8000,
        appUrl: "http://localhost:3000",
        appTitle: "Querétaro Romance AI",
      },
      schema: EnrichmentResponseSchema,
      jsonSchema: ENRICHMENT_JSON_SCHEMA,
      name: "kb_venue_enrichment",
      temperature: 0.3,
      maxTokens: 1500,
    });
  }

  it("splits 9 selected venues into two HTTP calls (batches of 8), each prompt carrying its venues' facts", async () => {
    const venues = Array.from({ length: 9 }, (_, i) =>
      venue({
        id: `v_${i}`,
        name: `Viñedo Fixture ${i}`,
        placeId: `places/fixture-${i}`,
      }),
    );
    const places: Place[] = venues.map((v) =>
      place({ id: v.placeId as string, displayName: { text: v.name } }),
    );

    const requestBodies: Record<string, unknown>[] = [];
    server.use(
      mockOpenRouterChat(({ body }) => {
        requestBodies.push(body);
        const userContent = (body.messages as Array<{ content: string }>)[1]?.content ?? "";
        const ids = [...userContent.matchAll(/\[(v_\w+)\]/g)].map((m) => m[1] as string);
        const responseVenues: EnrichedVenue[] = ids.map((id) => enriched({ id }));
        return HttpResponse.json({
          choices: [{ message: { content: JSON.stringify({ venues: responseVenues }) } }],
          usage: { prompt_tokens: 200, completion_tokens: 100 },
        });
      }),
    );

    const result = await runEnrichment({
      venues,
      places,
      client: realClient(),
      sleep: async () => {},
    });

    expect(requestBodies).toHaveLength(2);
    expect(result.enrichedIds.sort()).toEqual(venues.map((v) => v.id).sort());
    expect(result.droppedIds).toEqual([]);

    const firstPrompt = requestBodies[0]?.messages as Array<{ content: string }>;
    expect(firstPrompt[1]?.content).toContain("Viñedo Fixture");
    expect(firstPrompt[1]?.content).toContain("winery");

    expect(result.usageByModel["qwen/qwen-2.5-72b-instruct"]).toEqual({
      promptTokens: 400,
      completionTokens: 200,
    });
    expect(result.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("requeues an id the model omitted from its response, over real HTTP", async () => {
    const venues = [venue({ id: "v_1" }), venue({ id: "v_2" })];
    let callIndex = 0;

    server.use(
      mockOpenRouterChat(() => {
        callIndex += 1;
        const responseVenues =
          callIndex === 1 ? [enriched({ id: "v_1" })] : [enriched({ id: "v_2" })];
        return HttpResponse.json({
          choices: [{ message: { content: JSON.stringify({ venues: responseVenues }) } }],
        });
      }),
    );

    const result = await runEnrichment({
      venues,
      places: [],
      client: realClient(),
      sleep: async () => {},
    });

    expect(callIndex).toBe(2);
    expect(result.enrichedIds.sort()).toEqual(["v_1", "v_2"]);
  });
});
