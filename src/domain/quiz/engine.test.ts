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

import { mockOpenRouterChat, mockUnsplashSearch } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { createQuizEngine } from "./engine";
import { GeneratedStepSchema, LLM_STEP_JSON_SCHEMA, type GeneratedStep } from "./generated-step";
import type { Transcript, TranscriptEntry } from "./transcript";

const PRIMARY_MODEL = "deepseek/deepseek-chat";
const FALLBACK_MODEL = "qwen/qwen-turbo";

function baseConfig(overrides: Partial<OpenRouterConfig> = {}): OpenRouterConfig {
  return {
    apiKey: "test-key",
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    timeoutMs: 6000,
    appUrl: "http://localhost:3000",
    appTitle: "Querétaro Romance AI",
    ...overrides,
  };
}

function buildLlmClient(
  overrides: Partial<OpenRouterConfig> = {},
): StructuredClient<GeneratedStep> {
  return createStructuredClient({
    config: baseConfig(overrides),
    schema: GeneratedStepSchema,
    jsonSchema: LLM_STEP_JSON_SCHEMA,
    name: "quiz_step",
    temperature: 0.8,
    maxTokens: 900,
  });
}

function chatCompletion(content: string) {
  return HttpResponse.json({ choices: [{ message: { content } }] });
}

interface StepOverrides {
  options?: GeneratedStep["options"];
  done?: boolean;
}

function makeGeneratedStep(overrides: StepOverrides = {}): GeneratedStep {
  const options: GeneratedStep["options"] = overrides.options ?? [
    {
      id: "vendimia-redonda",
      title: "Vendimia al Atardecer",
      description: "Una tarde entre las vides, copa en mano, mientras el sol se despide.",
      hashtags: ["#Vendimia", "#ValleDeColon", "#AtardecerQueretano"],
      facets: { experience: "vendimia" },
      refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: ["vendimia-la-redonda"] },
      photoQuery: "vineyard harvest sunset wedding",
      badge: "Ruta del Vino",
      matchLabel: "96% AFINIDAD",
    },
    {
      id: "cata-de-cote",
      title: "Cata Íntima en Cava",
      description: "Una cata privada entre barricas, con menú de autor para pocos invitados.",
      hashtags: ["#CataPrivada", "#CavaExclusiva", "#MenuDeAutor"],
      facets: { scale: "intimate" },
      refs: { venueIds: ["v_bodegas-de-cote"], experienceIds: [] },
      photoQuery: "wine cellar intimate wedding dinner",
      badge: "Boutique SECTUR",
      matchLabel: "94% AFINIDAD",
    },
    {
      id: "globo-tqp",
      title: "Globo al Amanecer",
      description: "Un vuelo en globo aerostático sobre los viñedos antes de la fiesta.",
      hashtags: ["#GloboAerostatico", "#AmanecerQueretano", "#Tequisquiapan"],
      facets: { zone: "tequisquiapan" },
      refs: { venueIds: [], experienceIds: ["vendimia-freixenet"] },
      photoQuery: "hot air balloon sunrise wedding",
      badge: "Aventura SECTUR",
      matchLabel: "90% AFINIDAD",
    },
    {
      id: "ruta-queso",
      title: "Ruta del Arte Queso y Vino",
      description: "Una tarde probando quesos artesanales y vinos locales con sus invitados.",
      hashtags: ["#RutaDelQueso", "#SaboresLocales", "#Tequisquiapan"],
      facets: { experience: "cheese_route" },
      refs: { venueIds: [], experienceIds: ["ruta-arte-queso-vino"] },
      photoQuery: "artisan cheese and wine tasting",
      badge: "Sabores SECTUR",
      matchLabel: "89% AFINIDAD",
    },
  ];

  return {
    id: "step-2",
    topic: "Experiencia",
    question: "¿Qué experiencia no puede faltar en su celebración?",
    helper: "Elige el momento que mejor represente su historia.",
    selectLabel: "Elegir esta Experiencia",
    done: overrides.done ?? false,
    options,
  };
}

function makeEntries(count: number): TranscriptEntry[] {
  const facetsList = [
    { style: "rustic_vineyard" as const },
    { setting: "day_vineyard" as const },
    { scale: "intimate" as const },
    { zone: "ezequiel_montes" as const },
    { experience: "wine_tasting" as const },
    { budget: "medio_alto" as const },
    { lodging: "needed" as const },
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

const throwingLlm: StructuredClient<GeneratedStep> = {
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
    expect(correctionMessages.at(-1)?.content).toContain("no existen en la base de conocimiento");

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

  it("hard-stops once 5+ facets are known after 4 entries, without calling the LLM", async () => {
    const engine = createQuizEngine({ llm: throwingLlm, images: throwingImages, maxSteps: 7 });

    // 5 distinct facet keys across 4 entries (style+setting from the first entry).
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
          facets: { experience: "wine_tasting" },
          refs: { venueIds: [], experienceIds: [] },
        },
      },
    ];

    const result = await engine.nextStep({ entries });

    expect(result.done).toBe(true);
    expect(result.meta.source).toBe("static");
  });

  it("maps the model's own done: true into an engine-level done result", async () => {
    server.use(
      mockOpenRouterChat(() => chatCompletion(JSON.stringify(makeGeneratedStep({ done: true })))),
    );

    const engine = createQuizEngine({
      llm: buildLlmClient(),
      images: createStaticImageProvider(),
      maxSteps: 7,
    });

    const result = await engine.nextStep(makeTranscript(4));

    expect(result.done).toBe(true);
    expect(result.meta.source).toBe("llm");
    expect(result.meta.fallbackUsed).toBe(false);
  });

  it("prefers a Places photo over the image provider when a venue ref has one", async () => {
    const placesVenueId = "v_placesfixturehotellasjacarandas";
    const step = makeGeneratedStep({
      options: makeGeneratedStep().options.map((option) => ({
        ...option,
        refs: { venueIds: [placesVenueId], experienceIds: [] },
      })),
    });

    server.use(mockOpenRouterChat(() => chatCompletion(JSON.stringify(step))));

    const engine = createQuizEngine({ llm: buildLlmClient(), images: throwingImages, maxSteps: 7 });

    const result = await engine.nextStep(makeTranscript(3));

    expect(result.done).toBe(false);
    if (result.done) return;

    for (const option of result.step.options) {
      expect(option.photo.url).toContain("/api/places/photo?");
      expect(option.photo.url).toContain("fixture-hotel-las-jacarandas");
      expect(option.venue?.id).toBe(placesVenueId);
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
