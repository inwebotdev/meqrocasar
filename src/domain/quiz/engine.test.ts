import { delay, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  createStructuredClient,
  type OpenRouterConfig,
  type StructuredClient,
} from "@/domain/ai/structured";
import { createStaticImageProvider } from "@/domain/images/static-fallback";
import { createUnsplashImageProvider } from "@/domain/images/unsplash";
import type { ImageProvider } from "@/domain/images/provider";

import { loadKb } from "@/domain/kb/load";
import type { FacetKey } from "@/domain/kb/taxonomy";

import coupleATranscript from "../../../test/fixtures/demo/couple-a-intima-colonial.transcript.json";
import coupleBTranscript from "../../../test/fixtures/demo/couple-b-grande-vinedos.transcript.json";
import { mockOpenRouterChat, mockUnsplashSearch } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { computeTargetFacet, createQuizEngine } from "./engine";
import {
  RAW_LLM_STEP_JSON_SCHEMA,
  RawGeneratedStepSchema,
  type RawGeneratedStep,
} from "./generated-step";
import { chosenRefs, knownFacets, type Transcript, type TranscriptEntry } from "./transcript";

const kb = loadKb();

const PRIMARY_MODEL = "deepseek/deepseek-chat";
const FALLBACK_MODEL = "qwen/qwen-turbo";

function baseConfig(overrides: Partial<OpenRouterConfig> = {}): OpenRouterConfig {
  return {
    apiKey: "test-key",
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    timeoutMs: 6000,
    appUrl: "http://localhost:3000",
    appTitle: "Querétaro Romance",
    ...overrides,
  };
}

function buildLlmClient(
  overrides: Partial<OpenRouterConfig> = {},
): StructuredClient<RawGeneratedStep> {
  return createStructuredClient({
    config: baseConfig(overrides),
    schema: RawGeneratedStepSchema,
    jsonSchema: RAW_LLM_STEP_JSON_SCHEMA,
    name: "quiz_step",
    temperature: 0.8,
    maxTokens: 900,
  });
}

function chatCompletion(content: string) {
  return HttpResponse.json({ choices: [{ message: { content } }] });
}

interface StepOverrides {
  options?: RawGeneratedStep["options"];
  done?: boolean;
}

// All 4 default options target the "experience" facet (the computed
// targetFacet for `makeTranscript(3)`/`makeEntries(3..5)` below — see their
// facets: style/setting/scale are known by then, experience isn't yet),
// each with a distinct `facets.experience` value and a real experience
// ref, consistent with the known style/setting/scale.
function makeGeneratedStep(overrides: StepOverrides = {}): RawGeneratedStep {
  const options: RawGeneratedStep["options"] = overrides.options ?? [
    {
      id: "vendimia-redonda",
      title: "Vendimia al Atardecer",
      description: "Una tarde entre las vides, copa en mano, mientras el sol se despide.",
      hashtags: ["#Vendimia", "#ValleDeColon", "#AtardecerQueretano"],
      facets: { experience: "vendimia" },
      refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: ["vendimia-la-redonda"] },
      photoQuery: "vineyard harvest sunset wedding",
    },
    {
      id: "cata-de-cote",
      title: "Cata Íntima en Cava",
      description: "Una cata privada entre barricas, con menú de autor para pocos invitados.",
      hashtags: ["#CataPrivada", "#CavaExclusiva", "#MenuDeAutor"],
      facets: { experience: "wine_tasting" },
      refs: { venueIds: ["v_bodegas-de-cote"], experienceIds: ["cata-vinos-de-cote"] },
      photoQuery: "wine cellar intimate wedding dinner",
    },
    {
      id: "globo-tqp",
      title: "Globo al Amanecer",
      description: "Un vuelo en globo aerostático sobre los viñedos antes de la fiesta.",
      hashtags: ["#GloboAerostatico", "#AmanecerQueretano", "#Tequisquiapan"],
      facets: { experience: "hot_air_balloon" },
      refs: { venueIds: [], experienceIds: ["globo-tequisquiapan"] },
      photoQuery: "hot air balloon sunrise wedding",
    },
    {
      id: "ruta-queso",
      title: "Cena Gourmet entre Barricas",
      description:
        "Una cena gourmet entre barricas, maridada con vinos locales para sus invitados.",
      hashtags: ["#CenaGourmet", "#MaridajeLocal", "#ValleDeColon"],
      facets: { experience: "gourmet_banquet" },
      refs: { venueIds: [], experienceIds: ["cena-vinedo-de-cote"] },
      photoQuery: "gourmet dinner wine barrels",
    },
  ];

  return {
    id: "step-2",
    topic: "Experiencia",
    question: "¿Qué experiencia no puede faltar en su celebración?",
    helper: "Elige el momento que mejor represente su historia.",
    done: overrides.done ?? false,
    options,
  };
}

// `experience` is deliberately last: every test below computes the
// targetFacet from a prefix of this list, and keeping `experience` unknown
// through at least 5 entries keeps it the target (matching the default
// `makeGeneratedStep()` fixture, which targets "experience") for every
// entry count these tests actually use (3, 4, 5).
function makeEntries(count: number): TranscriptEntry[] {
  const facetsList = [
    { style: "rustic_vineyard" as const },
    { setting: "day_vineyard" as const },
    { scale: "intimate" as const },
    { zone: "ezequiel_montes" as const },
    { budget: "medio_alto" as const },
    { lodging: "needed" as const },
    { experience: "wine_tasting" as const },
  ];

  return Array.from({ length: count }, (_, i) => ({
    stepId: `gen-${i + 1}`,
    question: `Pregunta generada ${i + 1}`,
    topic: `Tema ${i + 1}`,
    chosen: {
      id: `opt-${i + 1}`,
      title: `Opción ${i + 1}`,
      summary: `Resumen de la opción ${i + 1}.`,
      facets: facetsList[i] ?? {},
      refs: { venueIds: [], experienceIds: [] },
    },
  }));
}

function makeTranscript(count: number): Transcript {
  return { entries: makeEntries(count) };
}

const throwingLlm: StructuredClient<RawGeneratedStep> = {
  generate() {
    throw new Error("the LLM must not be called for this test");
  },
};

const throwingImages: ImageProvider = {
  async resolve() {
    throw new Error("resolve must not be called for this test");
  },
  async resolveOne() {
    throw new Error("resolveOne must not be called for this test");
  },
};

describe("createQuizEngine", () => {
  it("returns the curated step 1 for an empty transcript", async () => {
    const engine = createQuizEngine({
      llm: throwingLlm,
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep({ entries: [] });

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.id).toBe("style");
    expect(result.step.index).toBe(1);
    expect(result.step.source).toBe("static");
    expect(result.meta.source).toBe("static");
    expect(result.meta.fallbackUsed).toBe(false);
  });

  it("yields a validated generated step with resolved photos for a 3-entry transcript", async () => {
    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(makeGeneratedStep()))));

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("llm");
    expect(result.step.options.length).toBeGreaterThanOrEqual(3);
    for (const option of result.step.options) {
      expect(option.photo.url.length).toBeGreaterThan(0);
      expect(option.photo.alt.length).toBeGreaterThan(0);
      expect(option.photo.credit.length).toBeGreaterThan(0);
    }
    expect(result.meta.source).toBe("llm");
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.model).toBe(PRIMARY_MODEL);
    expect(result.meta.attempts).toBe(1);
    expect(result.meta.normalisations).toBe(0);
  });

  it("normalises a messy raw step (degenerate hashtag, hashtag-as-title) and counts the fixes in meta.normalisations", async () => {
    const messy = makeGeneratedStep({
      options: [
        {
          ...makeGeneratedStep().options[0]!,
          title: "#VendimiaAlAtardecer",
          hashtags: ["#", "#Vendimia", "#ValleDeColon"],
        },
        makeGeneratedStep().options[1]!,
        makeGeneratedStep().options[2]!,
        makeGeneratedStep().options[3]!,
      ],
    });

    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(messy))));

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;
    const messyOption = result.step.options.find((option) => option.id === "vendimia-redonda");
    expect(messyOption?.title).toBe("VendimiaAlAtardecer");
    expect(messyOption?.title.startsWith("#")).toBe(false);
    expect(messyOption?.hashtags).toHaveLength(3);
    expect(result.meta.normalisations).toBeGreaterThan(0);
    expect(result.meta.fallbackUsed).toBe(false);
  });

  it("retries once on non-Latin script in the response, then falls back if it recurs", async () => {
    const nonLatinStep = makeGeneratedStep({
      options: [
        { ...makeGeneratedStep().options[0]!, title: "你好世界" },
        makeGeneratedStep().options[1]!,
        makeGeneratedStep().options[2]!,
        makeGeneratedStep().options[3]!,
      ],
    });

    const bodies: Record<string, unknown>[] = [];
    server.use(
      mockOpenRouterChat(({ body }) => {
        bodies.push(body);
        return chatCompletion(JSON.stringify(nonLatinStep));
      }),
    );

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep(makeTranscript(3));

    expect(bodies).toHaveLength(2);
    const correctionMessages = bodies[1]?.messages as Array<{ role: string; content: string }>;
    expect(correctionMessages.at(-2)?.role).toBe("assistant");
    expect(correctionMessages.at(-1)?.role).toBe("user");
    expect(correctionMessages.at(-1)?.content).toContain("español de México");

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("static");
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.attempts).toBe(2);
  });

  it("recovers from a language violation when the correction retry comes back clean", async () => {
    const nonLatinStep = makeGeneratedStep({
      options: [
        { ...makeGeneratedStep().options[0]!, title: "你好世界" },
        makeGeneratedStep().options[1]!,
        makeGeneratedStep().options[2]!,
        makeGeneratedStep().options[3]!,
      ],
    });
    const cleanStep = makeGeneratedStep();

    let callIndex = 0;
    server.use(
      mockOpenRouterChat(() => {
        callIndex += 1;
        return chatCompletion(JSON.stringify(callIndex === 1 ? nonLatinStep : cleanStep));
      }),
    );

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("llm");
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.attempts).toBe(2);
  });

  it("drops options whose venue id isn't a real KB venue, keeping the rest", async () => {
    const step = makeGeneratedStep({
      options: [
        makeGeneratedStep().options[0]!,
        makeGeneratedStep().options[1]!,
        {
          ...makeGeneratedStep().options[2]!,
          refs: { venueIds: ["v_does-not-exist"], experienceIds: [] },
        },
        makeGeneratedStep().options[3]!,
      ],
    });

    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("llm");
    expect(result.step.options).toHaveLength(3);
    expect(result.step.options.some((option) => option.id === "globo-tqp")).toBe(false);
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.attempts).toBe(1);
  });

  it("retries once with a correction turn, then falls back when fewer than 3 options survive", async () => {
    const allInvalid = makeGeneratedStep({
      options: makeGeneratedStep().options.map((option) => ({
        ...option,
        refs: { venueIds: ["v_nope"], experienceIds: [] },
      })),
    });

    const bodies: Record<string, unknown>[] = [];

    server.use(
      mockOpenRouterChat(({ body }) => {
        bodies.push(body);
        return chatCompletion(JSON.stringify(allInvalid));
      }),
    );

    const entries = makeEntries(3);
    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep({ entries });

    expect(bodies).toHaveLength(2);
    const correctionMessages = bodies[1]?.messages as Array<{ role: string; content: string }>;
    expect(correctionMessages.at(-2)?.role).toBe("assistant");
    expect(correctionMessages.at(-1)?.role).toBe("user");
    expect(correctionMessages.at(-1)?.content).toContain("no existe en la base de conocimiento");

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.source).toBe("static");
    expect(result.meta.attempts).toBe(2);
    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("static");
  });

  it("falls back to a static step (fallbackUsed) when the model times out", async () => {
    server.use(
      mockOpenRouterChat(async () => {
        await delay(200);
        return chatCompletion(JSON.stringify(makeGeneratedStep()));
      }),
    );

    const engine = createQuizEngine({
      llm: buildLlmClient({ timeoutMs: 20 }),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep(makeTranscript(3));

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.source).toBe("static");
    expect(result.meta.model).toBe("local-fallback");
    expect(result.done).toBe(false);
  });

  it("caches the second identical call, skipping the LLM entirely", async () => {
    let callCount = 0;
    server.use(
      mockOpenRouterChat(() => {
        callCount += 1;
        return chatCompletion(JSON.stringify(makeGeneratedStep()));
      }),
    );

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const transcript = makeTranscript(3);
    const first = await engine.nextStep(transcript);
    const second = await engine.nextStep(transcript);

    expect(callCount).toBe(1);
    expect(first.meta.cached).toBe(false);
    expect(second.meta.cached).toBe(true);
    expect(first.done).toBe(false);
    expect(second.done).toBe(false);
    if (first.done || second.done) return;
    expect(second.step.id).toBe(first.step.id);
  });

  it("stops once stepIndex exceeds maxSteps, without calling the LLM", async () => {
    const engine = createQuizEngine({ llm: throwingLlm, images: throwingImages, maxSteps: 7 });

    const result = await engine.nextStep(makeTranscript(7));

    expect(result.done).toBe(true);
    expect(result.meta.source).toBe("static");
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.attempts).toBe(0);
  });

  it("does not hard-stop before maxSteps even when 5+ facets are already known after 4 entries", async () => {
    // 5 distinct facet keys across 4 entries (style+setting from the first entry), with
    // "experience" (the default fixture's target) still unknown — the engine keeps calling
    // the LLM for the real unknown facet, bounded only by computeTargetFacet/QUIZ_MAX_STEPS,
    // never a facet-count heuristic and never the model's own say-so.
    const entries: TranscriptEntry[] = [
      {
        stepId: "gen-1",
        question: "Q1",
        topic: "T1",
        chosen: {
          id: "o1",
          title: "O1",
          summary: "S1",
          facets: { style: "rustic_vineyard", setting: "day_vineyard" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
      {
        stepId: "gen-2",
        question: "Q2",
        topic: "T2",
        chosen: {
          id: "o2",
          title: "O2",
          summary: "S2",
          facets: { scale: "intimate" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
      {
        stepId: "gen-3",
        question: "Q3",
        topic: "T3",
        chosen: {
          id: "o3",
          title: "O3",
          summary: "S3",
          facets: { zone: "ezequiel_montes" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
      {
        stepId: "gen-4",
        question: "Q4",
        topic: "T4",
        chosen: {
          id: "o4",
          title: "O4",
          summary: "S4",
          // Not "experience": the default `makeGeneratedStep()` fixture
          // targets "experience", so it must stay unknown here too for
          // the mocked response below to survive validation.
          facets: { budget: "medio_alto" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
    ];

    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(makeGeneratedStep()))));

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep({ entries });

    expect(result.meta.source).toBe("llm");
    expect(result.done).toBe(false);
  });

  it.each([4, 5])(
    "always ignores the model's own done:true, building a real step from its options instead (%i entries answered)",
    async (entryCount) => {
      server.use(
        mockOpenRouterChat(() => chatCompletion(JSON.stringify(makeGeneratedStep({ done: true })))),
      );

      const engine = createQuizEngine({
        llm: buildLlmClient(),
        images: createStaticImageProvider(),
        maxSteps: 7,
      });

      // The only stop conditions are `computeTargetFacet(...) === undefined`
      // (checked before the LLM is even called) and `QUIZ_MAX_STEPS` — the
      // model's own `done` field is always ignored, however many entries
      // have been answered.
      const result = await engine.nextStep(makeTranscript(entryCount));

      expect(result.done).toBe(false);
      if (result.done) return;
      expect(result.step.source).toBe("llm");
      expect(result.step.options.length).toBeGreaterThanOrEqual(3);
      expect(result.meta.source).toBe("llm");
      expect(result.meta.fallbackUsed).toBe(false);
    },
  );

  it("prefers a Places photo over the image provider when a venue ref has one", async () => {
    const placesVenueId = "v_placesfixturehotellasjacarandas";
    const step = makeGeneratedStep({
      options: makeGeneratedStep().options.map((option) => ({
        ...option,
        // Keep the option's own (real) experience ref — the "experience"
        // target requires one — only the venue swaps to the Places fixture.
        refs: { venueIds: [placesVenueId], experienceIds: option.refs.experienceIds },
      })),
    });

    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: throwingImages,
      maxSteps: 7,
      placesUsable: () => true,
    });

    const result = await engine.nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;

    for (const option of result.step.options) {
      expect(option.photo.url).toContain("/api/places/photo?");
      expect(option.photo.url).toContain("fixture-hotel-las-jacarandas");
      expect(option.venue?.id).toBe(placesVenueId);
    }
  });

  it("falls back to the image provider for a Places-photo ref when placesUsable is false", async () => {
    const placesVenueId = "v_placesfixturehotellasjacarandas";
    const step = makeGeneratedStep({
      options: makeGeneratedStep().options.map((option) => ({
        ...option,
        // Keep the option's own (real) experience ref — the "experience"
        // target requires one — only the venue swaps to the Places fixture.
        refs: { venueIds: [placesVenueId], experienceIds: option.refs.experienceIds },
      })),
    });

    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
      placesUsable: () => false,
    });

    const result = await engine.nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;

    for (const option of result.step.options) {
      expect(option.photo.url).not.toContain("/api/places/photo?");
    }
  });

  it("defaults placesUsable to false in this test env (no GOOGLE_PLACES_API_KEY), skipping the Places photo", async () => {
    const placesVenueId = "v_placesfixturehotellasjacarandas";
    const step = makeGeneratedStep({
      options: makeGeneratedStep().options.map((option) => ({
        ...option,
        // Keep the option's own (real) experience ref — the "experience"
        // target requires one — only the venue swaps to the Places fixture.
        refs: { venueIds: [placesVenueId], experienceIds: option.refs.experienceIds },
      })),
    });

    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;

    for (const option of result.step.options) {
      expect(option.photo.url).not.toContain("/api/places/photo?");
    }
  });

  it("uses Unsplash (mocked) to resolve a photo when no ref has a Places photo", async () => {
    server.use(
      mockOpenRouterChat(() => chatCompletion(JSON.stringify(makeGeneratedStep()))),
      mockUnsplashSearch(({ query }) =>
        HttpResponse.json({
          results: [
            {
              urls: {
                regular: `https://images.unsplash.com/ok-${encodeURIComponent(query ?? "")}`,
              },
              alt_description: `photo for ${query}`,
              description: null,
              user: { name: "Real Photographer" },
            },
          ],
        }),
      ),
    );

    const images = createUnsplashImageProvider({
      accessKey: "test-access-key",
      fallback: createStaticImageProvider(),
    });

    const engine = createQuizEngine({ llm: buildLlmClient(), images, maxSteps: 7 });
    const result = await engine.nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;

    const vendimiaOption = result.step.options.find((option) => option.id === "vendimia-redonda");
    expect(vendimiaOption?.photo.url).toBe(
      `https://images.unsplash.com/ok-${encodeURIComponent("vineyard harvest sunset wedding")}`,
    );
  });
});

describe("computeTargetFacet", () => {
  it("picks the first unknown facet in FACET_PRIORITY order", () => {
    expect(computeTargetFacet({}, [])).toBe("setting");
    expect(computeTargetFacet({ setting: "day_vineyard" }, [])).toBe("scale");
    expect(computeTargetFacet({ setting: "day_vineyard", scale: "intimate" }, [])).toBe(
      "experience",
    );
  });

  it("asks zone next once setting/scale/experience are known and no venue has been chosen", () => {
    const known = {
      setting: "day_vineyard",
      scale: "intimate",
      experience: "wine_tasting",
    } as const;
    expect(computeTargetFacet(known, [])).toBe("zone");
  });

  it("treats zone as known once any venue has been chosen, skipping straight to budget", () => {
    const known = {
      setting: "day_vineyard",
      scale: "intimate",
      experience: "wine_tasting",
    } as const;
    expect(computeTargetFacet(known, ["v_vinedos-la-redonda"])).toBe("budget");
  });

  it("returns undefined (done) once every facet is known", () => {
    const known = {
      setting: "day_vineyard",
      scale: "intimate",
      experience: "wine_tasting",
      zone: "ezequiel_montes",
      budget: "medio",
      lodging: "not_needed",
      season: "primavera",
    } as const;
    expect(computeTargetFacet(known, [])).toBeUndefined();
  });
});

describe("filterOptions coherence rules (via createQuizEngine)", () => {
  function engineWithLlm() {
    return createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });
  }

  it("drops an option missing facets[targetFacet], keeping the rest when >= 3 survive", async () => {
    const base = makeGeneratedStep().options;
    const step = makeGeneratedStep({
      options: [
        { ...base[0]!, facets: { budget: "medio" } }, // no "experience" — the target for makeTranscript(3)
        base[1]!,
        base[2]!,
        base[3]!,
      ],
    });
    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const result = await engineWithLlm().nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("llm");
    expect(result.step.options).toHaveLength(3);
    expect(result.step.options.some((option) => option.id === "vendimia-redonda")).toBe(false);
  });

  it("drops an option whose facets[targetFacet] duplicates an earlier option's", async () => {
    const base = makeGeneratedStep().options;
    const step = makeGeneratedStep({
      options: [
        base[0]!, // experience: "vendimia"
        { ...base[1]!, facets: { experience: "vendimia" } }, // duplicate value
        base[2]!,
        base[3]!,
      ],
    });
    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const result = await engineWithLlm().nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.options.map((option) => option.id)).toEqual([
      "vendimia-redonda",
      "globo-tqp",
      "ruta-queso",
    ]);
  });

  it("drops an option that sets another facet to a value contradicting what's already known", async () => {
    const base = makeGeneratedStep().options;
    const step = makeGeneratedStep({
      options: [
        // makeTranscript(3) already knows scale: "intimate" — this option contradicts it.
        { ...base[0]!, facets: { experience: "vendimia", scale: "grand" } },
        base[1]!,
        base[2]!,
        base[3]!,
      ],
    });
    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const result = await engineWithLlm().nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.options).toHaveLength(3);
    expect(result.step.options.some((option) => option.id === "vendimia-redonda")).toBe(false);
  });

  it("drops an option whose venue ref lies outside the known zone", async () => {
    const base = makeGeneratedStep().options;
    const step = makeGeneratedStep({
      options: [
        {
          ...base[0]!,
          // Tequisquiapan, not Ezequiel Montes (known from makeTranscript(4)).
          refs: {
            venueIds: ["v_placesfixturehotellasjacarandas"],
            experienceIds: base[0]!.refs.experienceIds,
          },
        },
        base[1]!,
        base[2]!,
        base[3]!,
      ],
    });
    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const result = await engineWithLlm().nextStep(makeTranscript(4));

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.options).toHaveLength(3);
    expect(result.step.options.some((option) => option.id === "vendimia-redonda")).toBe(false);
  });

  it("for the experience target, drops an option that cites a venue but no real experience", async () => {
    const base = makeGeneratedStep().options;
    const step = makeGeneratedStep({
      options: [
        { ...base[0]!, refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: [] } },
        base[1]!,
        base[2]!,
        base[3]!,
      ],
    });
    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const result = await engineWithLlm().nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.options).toHaveLength(3);
    expect(result.step.options.some((option) => option.id === "vendimia-redonda")).toBe(false);
  });

  // --- the "zone" target: entries that leave setting/scale/experience known, no venue chosen ---

  function zoneTargetEntries(): TranscriptEntry[] {
    return [
      {
        stepId: "gen-1",
        question: "Q1",
        topic: "T1",
        chosen: {
          id: "o1",
          title: "O1",
          summary: "S1",
          facets: { setting: "day_vineyard" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
      {
        stepId: "gen-2",
        question: "Q2",
        topic: "T2",
        chosen: {
          id: "o2",
          title: "O2",
          summary: "S2",
          facets: { scale: "intimate" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
      {
        stepId: "gen-3",
        question: "Q3",
        topic: "T3",
        chosen: {
          id: "o3",
          title: "O3",
          summary: "S3",
          facets: { experience: "wine_tasting" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
    ];
  }

  function makeZoneStep(): RawGeneratedStep {
    return {
      id: "zona-boda",
      topic: "Zona",
      question: "¿En qué zona imaginan celebrar?",
      helper: "Cada zona tiene su propio carácter.",
      done: false,
      options: [
        {
          id: "zona-ezequiel",
          title: "Viñedos de Ezequiel Montes",
          description: "Atardeceres entre las vides de Ezequiel Montes.",
          hashtags: ["#ValleDeColon", "#RutaDelVino", "#AtardecerVinedo"],
          facets: { zone: "ezequiel_montes" },
          refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: [] },
          photoQuery: "vineyard wedding queretaro",
        },
        {
          id: "zona-bernal",
          title: "Peña de Bernal",
          description: "Ceremonias con la Peña de Bernal de telón de fondo.",
          hashtags: ["#PenaDeBernal", "#PuebloMagico", "#SunsetOcre"],
          facets: { zone: "bernal" },
          refs: { venueIds: ["v_bernal-pueblo-magico"], experienceIds: [] },
          photoQuery: "bernal rock formation wedding",
        },
        {
          id: "zona-centro",
          title: "Centro Histórico",
          description: "Patios de cantera rosa en el Centro Histórico.",
          hashtags: ["#CentroHistorico", "#CanteraRosa", "#PatioColonial"],
          facets: { zone: "centro_historico" },
          refs: { venueIds: ["v_casona-cinco-patios"], experienceIds: [] },
          photoQuery: "colonial courtyard wedding queretaro",
        },
      ],
    };
  }

  it("accepts a well-formed zone-target step: distinct zones, each illustrated by a venue of that same zone", async () => {
    const zoneStep = makeZoneStep();
    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(zoneStep))));

    const result = await engineWithLlm().nextStep({ entries: zoneTargetEntries() });

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("llm");
    expect(result.step.options.map((option) => option.facets.zone).sort()).toEqual(
      ["bernal", "centro_historico", "ezequiel_montes"].sort(),
    );
  });

  it("for the zone target, drops an option whose own zone value doesn't match its cited venue's real zone", async () => {
    const zoneStep = makeZoneStep();
    const bad: RawGeneratedStep = {
      ...zoneStep,
      options: [
        zoneStep.options[0]!,
        zoneStep.options[1]!,
        {
          ...zoneStep.options[2]!,
          // Claims centro_historico but cites an Ezequiel Montes venue.
          refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: [] },
        },
      ],
    };
    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(bad))));

    const result = await engineWithLlm().nextStep({ entries: zoneTargetEntries() });

    // Only 2 of 3 options survive — below the 3-option floor, so the engine
    // falls back to a static step rather than ever showing the mismatch.
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.source).toBe("static");
  });

  it("skips a curated fallback step whose options mostly contradict known facets, falling through to the next", async () => {
    const entries: TranscriptEntry[] = [
      {
        stepId: "gen-1",
        question: "Q1",
        topic: "T1",
        chosen: {
          id: "o1",
          title: "O1",
          summary: "S1",
          facets: { setting: "day_vineyard" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
    ];

    // No `llm` configured — always the static/curated fallback.
    const engine = createQuizEngine({ images: createStaticImageProvider(), maxSteps: 7 });
    const result = await engine.nextStep({ entries });

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("static");
    // The curated "setting" step would normally be picked next, but 2 of
    // its 3 options contradict the already-known setting (day_vineyard),
    // leaving only 1 — below the floor, so it's skipped for "experience".
    expect(result.step.id).toBe("experience");
    expect(result.step.options).toHaveLength(3);
    for (const option of result.step.options) {
      expect(option.facets.setting).toBeUndefined();
    }
  });

  it("the static fallback's 'mustHave' options all cite a real experience ref, not just a venue (the owner-reported defect)", async () => {
    const entries: TranscriptEntry[] = [
      {
        stepId: "gen-1",
        question: "Q1",
        topic: "T1",
        chosen: {
          id: "o1",
          title: "O1",
          summary: "S1",
          facets: { style: "colonial", setting: "night_casona" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
      {
        stepId: "gen-2",
        question: "Q2",
        topic: "T2",
        chosen: {
          id: "o2",
          title: "O2",
          summary: "S2",
          facets: { scale: "intimate" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
    ];

    // No `llm` configured: the curated "experience" step (sets only scale,
    // not the "experience" facet target) gets skipped, landing on "mustHave".
    const engine = createQuizEngine({ images: createStaticImageProvider(), maxSteps: 7 });
    const result = await engine.nextStep({ entries });

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("static");
    expect(result.step.id).toBe("mustHave");
    expect(result.step.options).toHaveLength(4);
    for (const option of result.step.options) {
      expect(option.refs.experienceIds.length).toBeGreaterThan(0);
    }
  });

  it("the static fallback does NOT zone-restrict curated options (unlike a generated step) — it only drops ones that contradict a known facet", async () => {
    // A zone implied from a chosen venue in step 1 (exactly what happens in
    // real sessions once `knownFacets` implies zone from a venue ref) must
    // never gut the curated "mustHave" deck down past the 3-option floor:
    // each of its 4 options cites a venue in a *different* zone by design
    // (showcasing variety), so zone-restricting them here would make the
    // one safety net for an LLM outage fail far too easily.
    const entries: TranscriptEntry[] = [
      {
        stepId: "gen-1",
        question: "Q1",
        topic: "T1",
        chosen: {
          id: "o1",
          title: "O1",
          summary: "S1",
          facets: { style: "colonial", setting: "night_casona" },
          refs: { venueIds: ["v_casona-cinco-patios"], experienceIds: [] }, // implies zone: centro_historico
        },
      },
      {
        stepId: "gen-2",
        question: "Q2",
        topic: "T2",
        chosen: {
          id: "o2",
          title: "O2",
          summary: "S2",
          facets: { scale: "intimate" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
    ];

    const engine = createQuizEngine({ images: createStaticImageProvider(), maxSteps: 7 });
    const result = await engine.nextStep({ entries });

    expect(result.done).toBe(false);
    if (result.done) return;
    expect(result.step.source).toBe("static");
    expect(result.step.id).toBe("mustHave");
    expect(result.step.options).toHaveLength(4);
  });
});

describe("replaying the demo fixtures (test/fixtures/demo)", () => {
  const fixtures: Array<{ name: string; transcript: Transcript }> = [
    { name: "couple-a-intima-colonial", transcript: coupleATranscript as Transcript },
    { name: "couple-b-grande-vinedos", transcript: coupleBTranscript as Transcript },
  ];

  for (const { name, transcript } of fixtures) {
    const { entries } = transcript;

    it(`${name}: computeTargetFacet never targets zone again once a venue has been chosen`, () => {
      let sawVenue = false;

      for (let i = 0; i <= entries.length; i += 1) {
        const prefix = entries.slice(0, i);
        const known = knownFacets(prefix, kb);
        const { venueIds } = chosenRefs(prefix);
        const target = computeTargetFacet(known, venueIds);

        if (venueIds.length > 0) sawVenue = true;
        if (sawVenue) {
          expect(target).not.toBe("zone");
        }
      }
    });

    it(`${name}: a freshly generated (static-fallback) step's options never contradict the facets known at that point`, async () => {
      const engine = createQuizEngine({ images: createStaticImageProvider(), maxSteps: 7 });

      for (let i = 0; i < entries.length; i += 1) {
        const prefix = entries.slice(0, i);
        const known = knownFacets(prefix, kb);
        const result = await engine.nextStep({ entries: prefix });

        if (result.done) continue;
        for (const option of result.step.options) {
          const contradicts = (Object.keys(option.facets) as FacetKey[]).some((key) => {
            const value = option.facets[key];
            const knownValue = known[key];
            return value !== undefined && knownValue !== undefined && value !== knownValue;
          });
          expect(contradicts).toBe(false);
        }
      }
    });
  }
});
