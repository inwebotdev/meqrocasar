import { estimateCostUsd } from "@/domain/ai/pricing";
import type { ChatMessage, LlmUsage, StructuredClient } from "@/domain/ai/structured";
import { buildDigest } from "@/domain/kb/digest";
import { loadKb } from "@/domain/kb/load";
import { FACET_KEYS, type Facets } from "@/domain/kb/taxonomy";
import type { Kb } from "@/domain/kb/types";
import type { ImageProvider } from "@/domain/images/provider";
import { placesPhotoPath } from "@/domain/places/photo-url";

import {
  buildStepMessages,
  ENGINE_PROMPT_VERSION,
  LANGUAGE_CORRECTION_MESSAGE,
} from "./engine-prompt";
import {
  resolveVenueSummary,
  resolvedStepFromCurated,
  type GeneratedOption,
  type GeneratedRefs,
  type GeneratedStep,
  type RawGeneratedStep,
  type ResolvedOption,
  type ResolvedOptionPhoto,
  type ResolvedStep,
} from "./generated-step";
import { normaliseGeneratedStep } from "./normalise-step";
import { QUIZ_STEPS } from "./questions";
import type { QuizStep } from "./types";
import { foldFacets, type Transcript, type TranscriptEntry } from "./transcript";
import { hashTranscript } from "./transcript-hash";

/**
 * The adaptive quiz engine: given the transcript so far, decides whether
 * the quiz is done and, if not, generates (or falls back to a curated)
 * next step. The one entry point, `nextStep`, never throws: every LLM or
 * network failure degrades to the deterministic curated decks.
 *
 * Pure TypeScript (no React, no Next.js); callers that want this wired to
 * real OpenRouter/Unsplash config live in `src/lib/quiz-engine-deps.ts`
 * (`server-only`).
 */

/** Model label used whenever a step didn't come from a real LLM call. */
const STATIC_MODEL = "local-fallback";

/** Hard cap on the in-memory step cache (see `CreateQuizEngineOptions.cache`). */
const MAX_CACHE_ENTRIES = 1000;

/** How long a generated step stays warm in the cache (also covers speculative prefetch warm-ups — see `prefetch.ts`). */
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface QuizEngineMeta {
  model: string;
  durationMs: number;
  cached: boolean;
  fallbackUsed: boolean;
  source: "llm" | "static";
  /** Total number of LLM calls made for this `nextStep` invocation (0 for a cache hit or a hard stop). */
  attempts: number;
  usage?: LlmUsage;
  costUsd?: number;
  promptVersion: string;
  /** Number of `normaliseGeneratedStep` fixes applied to the raw LLM output (0 for a static/cached step). */
  normalisations: number;
}

export type QuizEngineResult =
  { done: true; meta: QuizEngineMeta } | { done: false; step: ResolvedStep; meta: QuizEngineMeta };

export interface QuizEngine {
  nextStep(transcript: Transcript): Promise<QuizEngineResult>;
}

/** One cached `nextStep` result, with the millis timestamp (per the engine's `now`) after which it's stale. */
export interface QuizStepCacheEntry {
  result: QuizEngineResult;
  expiresAt: number;
}

/** The engine's step cache: see `CreateQuizEngineOptions.cache` — built as a module-level singleton in `src/lib/quiz-engine-deps.ts` so it's shared process-wide (including by the speculative-prefetch route). */
export type QuizStepCache = Map<string, QuizStepCacheEntry>;

export interface CreateQuizEngineOptions {
  /** Omitted (e.g. no OPENROUTER_API_KEY) to always use the curated static decks. */
  llm?: StructuredClient<RawGeneratedStep>;
  images: ImageProvider;
  /** Defaults to `loadKb()`. */
  kb?: Kb;
  maxSteps: number;
  /** Monotonic-ish millis clock, injected so tests never depend on real time. Defaults to `Date.now`. */
  now?: () => number;
  /** In-memory TTL LRU (max `MAX_CACHE_ENTRIES`, `CACHE_TTL_MS` TTL), injected so tests/callers can inspect/seed/share it. Defaults to a fresh `Map`. */
  cache?: QuizStepCache;
}

// --- meta helpers ------------------------------------------------------

interface BuildMetaInput {
  model: string;
  start: number;
  now: () => number;
  fallbackUsed: boolean;
  source: "llm" | "static";
  attempts: number;
  usage?: LlmUsage;
  normalisations?: number;
}

function buildMeta(input: BuildMetaInput): QuizEngineMeta {
  return {
    model: input.model,
    durationMs: input.now() - input.start,
    cached: false,
    fallbackUsed: input.fallbackUsed,
    source: input.source,
    attempts: input.attempts,
    usage: input.usage,
    costUsd: input.usage ? estimateCostUsd(input.model, input.usage) : undefined,
    promptVersion: ENGINE_PROMPT_VERSION,
    normalisations: input.normalisations ?? 0,
  };
}

function withCachedTiming(
  result: QuizEngineResult,
  start: number,
  now: () => number,
): QuizEngineResult {
  const meta: QuizEngineMeta = { ...result.meta, cached: true, durationMs: now() - start };
  return result.done ? { done: true, meta } : { done: false, step: result.step, meta };
}

function countKnownFacets(facets: Facets): number {
  return FACET_KEYS.filter((key) => facets[key] !== undefined).length;
}

// --- cache (TTL + insertion-order LRU over a Map) ------------------------

function cacheGet(
  cache: QuizStepCache,
  key: string,
  now: () => number,
): QuizEngineResult | undefined {
  const entry = cache.get(key);
  if (entry === undefined) {
    return undefined;
  }

  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return undefined;
  }

  // Refresh recency: delete + re-insert moves it to the end of iteration order.
  cache.delete(key);
  cache.set(key, entry);
  return entry.result;
}

function cacheSet(
  cache: QuizStepCache,
  key: string,
  value: QuizEngineResult,
  now: () => number,
): void {
  cache.delete(key);
  cache.set(key, { result: value, expiresAt: now() + CACHE_TTL_MS });

  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey: string | undefined = cache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    cache.delete(oldestKey);
  }
}

// --- static fallback (curated decks) --------------------------------------

/**
 * Picks the next unused curated step, starting at `min(stepIndex - 1, 3)`
 * and searching forward (wrapping around) for one whose id hasn't already
 * been answered in `entries`. `undefined` when all 4 curated steps have
 * already been used.
 */
function pickFallbackStep(
  entries: readonly TranscriptEntry[],
  stepIndex: number,
): QuizStep | undefined {
  const usedIds = new Set(entries.map((entry) => entry.stepId));
  const startIndex = Math.min(stepIndex - 1, QUIZ_STEPS.length - 1);

  for (let offset = 0; offset < QUIZ_STEPS.length; offset += 1) {
    const candidate = QUIZ_STEPS[(startIndex + offset) % QUIZ_STEPS.length];
    if (candidate && !usedIds.has(candidate.id)) {
      return candidate;
    }
  }

  return undefined;
}

interface StaticFallbackContext {
  entries: readonly TranscriptEntry[];
  stepIndex: number;
  start: number;
  now: () => number;
  attempts: number;
}

function staticFallbackResult(ctx: StaticFallbackContext): QuizEngineResult {
  const meta = buildMeta({
    model: STATIC_MODEL,
    start: ctx.start,
    now: ctx.now,
    fallbackUsed: true,
    source: "static",
    attempts: ctx.attempts,
  });

  const candidateStep = pickFallbackStep(ctx.entries, ctx.stepIndex);
  if (!candidateStep) {
    return { done: true, meta };
  }

  return { done: false, step: resolvedStepFromCurated(candidateStep, ctx.stepIndex), meta };
}

// --- ref validation ------------------------------------------------------

interface FilterOptionsResult {
  options: GeneratedOption[];
  invalidIds: string[];
}

/**
 * Drops venue/experience ids that aren't real KB entries, drops any option
 * that ends up with no valid refs at all (nothing grounds it in a real
 * place or experience), and dedupes option ids (first occurrence wins).
 */
function filterOptions(step: GeneratedStep, kb: Kb): FilterOptionsResult {
  const invalidIds = new Set<string>();
  const seenIds = new Set<string>();
  const options: GeneratedOption[] = [];

  for (const option of step.options) {
    const venueIds = option.refs.venueIds.filter((id) => {
      const valid = kb.venues.some((venue) => venue.id === id);
      if (!valid) invalidIds.add(id);
      return valid;
    });
    const experienceIds = option.refs.experienceIds.filter((id) => {
      const valid = kb.experiences.some((experience) => experience.id === id);
      if (!valid) invalidIds.add(id);
      return valid;
    });

    if (venueIds.length === 0 && experienceIds.length === 0) {
      continue;
    }
    if (seenIds.has(option.id)) {
      continue;
    }
    seenIds.add(option.id);

    const refs: GeneratedRefs = { venueIds, experienceIds };
    options.push({ ...option, refs });
  }

  return { options, invalidIds: [...invalidIds] };
}

function correctionMessage(invalidIds: readonly string[]): string {
  const idsText =
    invalidIds.length > 0
      ? invalidIds.join(", ")
      : "(ninguno inválido, pero quedaron menos de 3 opciones con refs válidos)";

  return `Los siguientes ids no existen en la base de conocimiento: ${idsText}. Devuelve el objeto JSON corregido citando solo ids reales del digest, con al menos 3 opciones válidas.`;
}

// --- photo resolution ------------------------------------------------------

function findPlacesPhoto(option: GeneratedOption, kb: Kb): ResolvedOptionPhoto | undefined {
  for (const venueId of option.refs.venueIds) {
    const venue = kb.venues.find((candidate) => candidate.id === venueId);
    if (!venue) continue;

    const placesPhoto = venue.photos.find((photo) => photo.kind === "places");
    if (placesPhoto) {
      return {
        url: placesPhotoPath(placesPhoto.ref, 800),
        alt: venue.name,
        credit: placesPhoto.attribution ?? venue.name,
      };
    }
  }

  return undefined;
}

async function resolveOptionPhoto(
  option: GeneratedOption,
  kb: Kb,
  images: ImageProvider,
  facets: Facets,
): Promise<ResolvedOption> {
  const placesPhoto = findPlacesPhoto(option, kb);
  const photo = placesPhoto ?? (await images.resolveOne(option.photoQuery, facets));
  const venue = option.refs.venueIds[0]
    ? resolveVenueSummary(option.refs.venueIds[0], kb)
    : undefined;

  return { ...option, photo, venue };
}

// --- the main generate-or-fallback pipeline ------------------------------

interface GenerateContext {
  llm: StructuredClient<RawGeneratedStep> | undefined;
  transcript: Transcript;
  entries: readonly TranscriptEntry[];
  facets: Facets;
  stepIndex: number;
  maxSteps: number;
  kb: Kb;
  images: ImageProvider;
  start: number;
  now: () => number;
}

async function generateStep(ctx: GenerateContext): Promise<QuizEngineResult> {
  const { llm, transcript, entries, facets, stepIndex, maxSteps, kb, images, start, now } = ctx;

  if (!llm) {
    return staticFallbackResult({ entries, stepIndex, start, now, attempts: 0 });
  }

  const messages = buildStepMessages({
    transcript,
    facets,
    digest: buildDigestFor(facets),
    stepIndex,
    maxSteps,
  });
  const primary = await llm.generate(messages);

  if (!primary.ok) {
    return staticFallbackResult({
      entries,
      stepIndex,
      start,
      now,
      attempts: primary.attempts.length,
    });
  }

  let model = primary.model;
  let usage = primary.usage;
  let attempts = primary.attempts.length;
  let normalised = normaliseGeneratedStep(primary.value);

  // The one thing normalisation can't fix itself: non-Latin script means
  // the model answered off-language, so give it one explicit correction
  // turn rather than silently mangling Chinese/Cyrillic/Arabic text.
  if (!normalised.ok && normalised.reason === "language") {
    const languageRetryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: JSON.stringify(primary.value) },
      { role: "user", content: LANGUAGE_CORRECTION_MESSAGE },
    ];

    const languageRetry = await llm.generate(languageRetryMessages);
    attempts += languageRetry.attempts.length;

    if (languageRetry.ok) {
      model = languageRetry.model;
      usage = languageRetry.usage;
      normalised = normaliseGeneratedStep(languageRetry.value);
    }
  }

  if (!normalised.ok) {
    return staticFallbackResult({ entries, stepIndex, start, now, attempts });
  }

  let candidate = normalised.step;
  const normalisations = normalised.fixes.length;

  let { options: validOptions, invalidIds } = filterOptions(candidate, kb);

  if (validOptions.length < 3) {
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: JSON.stringify(candidate) },
      { role: "user", content: correctionMessage(invalidIds) },
    ];

    const retry = await llm.generate(retryMessages);
    attempts += retry.attempts.length;

    if (retry.ok) {
      const retryNormalised = normaliseGeneratedStep(retry.value);
      if (retryNormalised.ok) {
        candidate = retryNormalised.step;
        model = retry.model;
        usage = retry.usage;
        ({ options: validOptions, invalidIds } = filterOptions(candidate, kb));
      }
    }
  }

  if (validOptions.length < 3) {
    return staticFallbackResult({ entries, stepIndex, start, now, attempts });
  }

  if (candidate.done) {
    return {
      done: true,
      meta: buildMeta({
        model,
        start,
        now,
        fallbackUsed: false,
        source: "llm",
        attempts,
        usage,
        normalisations,
      }),
    };
  }

  const resolvedOptions = await Promise.all(
    validOptions.map((option) => resolveOptionPhoto(option, kb, images, facets)),
  );

  const step: ResolvedStep = {
    id: candidate.id,
    topic: candidate.topic,
    question: candidate.question,
    helper: candidate.helper,
    selectLabel: candidate.selectLabel,
    done: false,
    options: resolvedOptions,
    index: stepIndex,
    source: "llm",
  };

  return {
    done: false,
    step,
    meta: buildMeta({
      model,
      start,
      now,
      fallbackUsed: false,
      source: "llm",
      attempts,
      usage,
      normalisations,
    }),
  };
}

function buildDigestFor(facets: Facets) {
  return buildDigest(facets, { maxVenues: 20, maxExperiences: 10, maxChars: 4500 });
}

// --- public entry point --------------------------------------------------

/**
 * Builds the adaptive quiz engine. `nextStep` never throws: an LLM
 * timeout/HTTP error/invalid schema, or a generated step that doesn't
 * survive ref validation, always degrades to a curated step from
 * `QUIZ_STEPS` (or `done: true` once those are exhausted too).
 */
export function createQuizEngine(options: CreateQuizEngineOptions): QuizEngine {
  const kb = options.kb ?? loadKb();
  const images = options.images;
  const maxSteps = options.maxSteps;
  const now = options.now ?? (() => Date.now());
  const cache: QuizStepCache = options.cache ?? new Map();

  return {
    async nextStep(transcript: Transcript): Promise<QuizEngineResult> {
      const start = now();
      const entries = transcript.entries;

      if (entries.length === 0) {
        return {
          done: false,
          step: resolvedStepFromCurated(QUIZ_STEPS[0] as QuizStep, 1),
          meta: buildMeta({
            model: STATIC_MODEL,
            start,
            now,
            fallbackUsed: false,
            source: "static",
            attempts: 0,
          }),
        };
      }

      const facets = foldFacets(entries);
      const stepIndex = entries.length + 1;
      const knownFacetCount = countKnownFacets(facets);

      const hardStop = stepIndex > maxSteps || (entries.length >= 4 && knownFacetCount >= 5);
      if (hardStop) {
        return {
          done: true,
          meta: buildMeta({
            model: STATIC_MODEL,
            start,
            now,
            fallbackUsed: false,
            source: "static",
            attempts: 0,
          }),
        };
      }

      const cacheKey = hashTranscript(transcript);
      const cached = cacheGet(cache, cacheKey, now);
      if (cached) {
        return withCachedTiming(cached, start, now);
      }

      const result = await generateStep({
        llm: options.llm,
        transcript,
        entries,
        facets,
        stepIndex,
        maxSteps,
        kb,
        images,
        start,
        now,
      });

      cacheSet(cache, cacheKey, result, now);
      return result;
    },
  };
}
