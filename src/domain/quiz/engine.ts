import { estimateCostUsd } from "@/domain/ai/pricing";
import type { ChatMessage, LlmUsage, StructuredClient } from "@/domain/ai/structured";
import { buildDigest } from "@/domain/kb/digest";
import { loadKb } from "@/domain/kb/load";
import {
  EXPERIENCE_VALUES,
  FACET_PRIORITY,
  facetLabel,
  type FacetKey,
  type FacetPriority,
  type Facets,
  SCALE_VALUES,
  SETTING_VALUES,
} from "@/domain/kb/taxonomy";
import type { Kb } from "@/domain/kb/types";
import type { ImageProvider } from "@/domain/images/provider";
import { isPlacesUsable } from "@/domain/places/availability";
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
import { templateStepFor, type TemplateFacet } from "./template-steps";
import type { QuizStep } from "./types";
import { chosenRefs, knownFacets, type Transcript, type TranscriptEntry } from "./transcript";
import { hashTranscript } from "./transcript-hash";

/** `budget`/`lodging`/`season` never reach the LLM or the curated decks — see `template-steps.ts`. */
function isTemplateFacet(facet: FacetPriority): facet is TemplateFacet {
  return facet === "budget" || facet === "lodging" || facet === "season";
}

function templateStepResult(
  targetFacet: TemplateFacet,
  known: Facets,
  chosenVenueIds: readonly string[],
  kb: Kb,
  stepIndex: number,
  start: number,
  now: () => number,
): QuizEngineResult {
  const chosenVenue = kb.venues.find((venue) => venue.id === chosenVenueIds[0]);
  const step: ResolvedStep = {
    ...templateStepFor(targetFacet, { known, chosenVenue, kb }),
    index: stepIndex,
  };

  return {
    done: false,
    step,
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
  /** Whether a venue ref's `"places"` photo may be used. Defaults to the process-wide `isPlacesUsable`. */
  placesUsable?: () => boolean;
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

// --- targeting -------------------------------------------------------------

/**
 * The facet this step must fill, computed by the engine — never left to
 * the model. The first unknown key in `FACET_PRIORITY`, except `zone`:
 * once any venue has been chosen, its zone is already known (via
 * `knownFacets`/`impliedFacets`), so the zone question is skipped
 * entirely rather than asked again. `undefined` once nothing is left to
 * ask (the step is `done`).
 */
export function computeTargetFacet(
  known: Facets,
  chosenVenueIds: readonly string[],
): FacetPriority | undefined {
  for (const key of FACET_PRIORITY) {
    if (key === "zone" && chosenVenueIds.length > 0) {
      continue;
    }
    if (known[key] === undefined) {
      return key;
    }
  }

  return undefined;
}

// --- static fallback (curated decks) --------------------------------------

/**
 * True when `facets` sets any key also present in `known` to a different
 * value. Deliberately NOT the full `filterOptions` treatment: the curated
 * decks predate per-zone targeting (each step's options are intentionally
 * spread across different zones to showcase variety, not confined to one),
 * so applying `filterOptions`'s zone-restriction/target-facet-presence
 * rules here would gut every curated step down to 0-1 survivors as soon as
 * any zone is known (e.g. implied from step 1's own venue) — turning the
 * one safety net the real adaptive flow has (when the LLM is unavailable
 * or fails) into an early "done" far more often than intended. Keeping
 * this to contradiction-only (the one rule the curated decks' per-step,
 * single-facet options can always satisfy) is what the plan actually
 * calls for.
 */
function contradictsKnownFacets(facets: Facets, known: Facets): boolean {
  return (Object.keys(facets) as FacetKey[]).some((key) => {
    const value = facets[key];
    const knownValue = known[key];
    return value !== undefined && knownValue !== undefined && value !== knownValue;
  });
}

/**
 * Picks the next unused curated step, starting at `min(stepIndex - 1, 3)`
 * and searching forward (wrapping around) for one whose id hasn't already
 * been answered in `entries` and whose options — once any contradicting
 * `known` facets are dropped (`contradictsKnownFacets`) — still leave at
 * least 3. The curated decks have no dedicated "zone" step today, but this
 * generically covers the same defect for whichever curated step is picked:
 * a step whose fixed options no longer make sense (e.g. a style other
 * than the one already chosen) is skipped rather than asked half-empty.
 * `undefined` once every curated step has been used or exhausted this way.
 */
function pickFallbackStep(
  entries: readonly TranscriptEntry[],
  stepIndex: number,
  known: Facets,
): ResolvedStep | undefined {
  const usedIds = new Set(entries.map((entry) => entry.stepId));
  const startIndex = Math.min(stepIndex - 1, QUIZ_STEPS.length - 1);

  for (let offset = 0; offset < QUIZ_STEPS.length; offset += 1) {
    const candidate = QUIZ_STEPS[(startIndex + offset) % QUIZ_STEPS.length];
    if (!candidate || usedIds.has(candidate.id)) {
      continue;
    }

    const resolved = resolvedStepFromCurated(candidate, stepIndex);
    const options = resolved.options.filter(
      (option) => !contradictsKnownFacets(option.facets, known),
    );
    if (options.length >= 3) {
      return { ...resolved, options };
    }
  }

  return undefined;
}

interface StaticFallbackContext {
  entries: readonly TranscriptEntry[];
  stepIndex: number;
  targetFacet: FacetPriority;
  known: Facets;
  chosenVenueIds: readonly string[];
  kb: Kb;
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

  // `budget`/`lodging`/`season` have no curated deck of their own (and
  // forcing them through `pickFallbackStep`'s contradiction-only filter is
  // exactly what exhausted the curated steps once style/setting/scale/
  // experience were already pinned — see the template-steps.ts doc
  // comment): any failure at these three facets falls back to the same
  // deterministic template the primary path uses, never to `done`.
  if (isTemplateFacet(ctx.targetFacet)) {
    const chosenVenue = ctx.kb.venues.find((venue) => venue.id === ctx.chosenVenueIds[0]);
    const step: ResolvedStep = {
      ...templateStepFor(ctx.targetFacet, { known: ctx.known, chosenVenue, kb: ctx.kb }),
      index: ctx.stepIndex,
    };
    return { done: false, step, meta };
  }

  const step = pickFallbackStep(ctx.entries, ctx.stepIndex, ctx.known);
  if (!step) {
    return { done: true, meta };
  }

  return { done: false, step, meta };
}

// --- option validation (refs + coherence) ---------------------------------

interface FilterOptionsResult {
  options: GeneratedOption[];
  /** Human-readable rule violations, fed back as one correction-turn message (`correctionMessage`) when fewer than 3 options survive. */
  violations: string[];
}

/**
 * Validates every option against this step's target facet and the known
 * facets — the per-facet question contract (see `engine-prompt.ts`'s
 * `targetFacetContract`), enforced code-side rather than trusted from the
 * model alone:
 *
 * - refs must resolve to real KB entries (unknown ids dropped);
 * - every option must set `facets[targetFacet]` to a taxonomy value, and
 *   that value must be distinct from every other kept option's (first
 *   occurrence wins);
 * - no option may set any OTHER facet to a value that contradicts `known`;
 * - once a zone is known, a venue ref outside it invalidates the option;
 * - the `experience` target requires at least one real experience ref
 *   (never a venue standing in for one);
 * - the `zone` target requires the option's own zone value to match a
 *   cited venue's actual zone (when it cites one).
 *
 * Also dedupes option ids (first occurrence wins), same as before this
 * layer.
 */
function filterOptions(
  step: GeneratedStep,
  kb: Kb,
  targetFacet: FacetPriority,
  known: Facets,
): FilterOptionsResult {
  const violations = new Set<string>();
  const seenIds = new Set<string>();
  const seenTargetValues = new Set<string>();
  const options: GeneratedOption[] = [];

  for (const option of step.options) {
    if (seenIds.has(option.id)) {
      continue;
    }

    const venueIds = option.refs.venueIds.filter((id) => {
      const valid = kb.venues.some((venue) => venue.id === id);
      if (!valid) violations.add(`el id "${id}" no existe en la base de conocimiento`);
      return valid;
    });
    const experienceIds = option.refs.experienceIds.filter((id) => {
      const valid = kb.experiences.some((experience) => experience.id === id);
      if (!valid) violations.add(`el id "${id}" no existe en la base de conocimiento`);
      return valid;
    });

    if (
      venueIds.length === 0 &&
      experienceIds.length === 0 &&
      (targetFacet === "experience" || targetFacet === "zone")
    ) {
      violations.add("cada opción debe citar al menos un venue o experiencia real en refs");
      continue;
    }

    const targetValue = option.facets[targetFacet];
    if (targetValue === undefined) {
      violations.add(`cada opción debe fijar facets.${targetFacet}`);
      continue;
    }
    if (seenTargetValues.has(targetValue)) {
      // A repeated value is just a duplicate card: keep the first one, drop this one.
      continue;
    }

    const contradictsOtherFacets = (Object.keys(option.facets) as FacetKey[]).some((key) => {
      if (key === targetFacet) return false;
      const value = option.facets[key];
      const knownValue = known[key];
      return value !== undefined && knownValue !== undefined && value !== knownValue;
    });
    if (contradictsOtherFacets) {
      violations.add("ninguna opción puede contradecir un facet ya conocido");
      continue;
    }

    let zoneSafeVenueIds = venueIds;
    if (known.zone !== undefined && targetFacet !== "zone") {
      // Keep the card, drop only the references that point outside the known zone.
      zoneSafeVenueIds = venueIds.filter((id) => {
        const venue = kb.venues.find((candidate) => candidate.id === id);
        return venue === undefined || venue.zone === known.zone;
      });
    }

    if (targetFacet === "experience" && experienceIds.length === 0) {
      violations.add("las opciones de experiencia deben citar al menos un id de experiencia real");
      continue;
    }

    if (targetFacet === "zone") {
      const matchesCitedVenue =
        venueIds.length === 0 ||
        venueIds.some(
          (id) => kb.venues.find((candidate) => candidate.id === id)?.zone === targetValue,
        );
      if (!matchesCitedVenue) {
        violations.add("cada opción de zona debe ilustrarse con un venue real de esa misma zona");
        continue;
      }
    }

    seenIds.add(option.id);
    seenTargetValues.add(targetValue);

    const refs: GeneratedRefs = { venueIds: zoneSafeVenueIds, experienceIds };
    options.push({ ...option, refs });
  }

  return { options, violations: [...violations] };
}

const PAD_VALUES: Partial<Record<FacetPriority, readonly string[]>> = {
  setting: SETTING_VALUES,
  scale: SCALE_VALUES,
  experience: EXPERIENCE_VALUES,
};

/**
 * Tops a generated step up to three options with plain template cards for
 * the target facet's unused values, so one weak model answer never throws
 * the whole step away.
 */
function padOptions(
  options: readonly GeneratedOption[],
  targetFacet: FacetPriority,
  known: Facets,
  kb: Kb,
): GeneratedOption[] {
  const values = PAD_VALUES[targetFacet];
  if (!values || options.length >= 3) return [...options];
  const used = new Set(options.map((option) => option.facets[targetFacet]));
  const zoneLabel = known.zone ? facetLabel("zone", known.zone) : "Querétaro";
  const padded = [...options];
  for (const value of values) {
    if (padded.length >= 3) break;
    if (used.has(value as never)) continue;
    const label = facetLabel(targetFacet, value as never);
    const experienceIds =
      targetFacet === "experience"
        ? kb.experiences
            .filter(
              (experience) =>
                experience.facets.experiences.includes(value as never) &&
                (known.zone === undefined ||
                  experience.zoneIds.includes(known.zone) ||
                  experience.zoneIds.length > 1),
            )
            .slice(0, 1)
            .map((experience) => experience.id)
        : [];
    if (targetFacet === "experience" && experienceIds.length === 0) continue;
    const words = label
      .replace(/[^\p{L}\p{N} ]/gu, "")
      .split(/\s+/)
      .filter(Boolean);
    const camel = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
    padded.push({
      id: `auto-${targetFacet}-${value}`,
      title: label.slice(0, 40),
      description:
        `Una boda con ${label.toLowerCase()} en ${zoneLabel}, pensada a su medida.`.slice(0, 160),
      hashtags: [`#${camel || "Boda"}`, `#${zoneLabel.replace(/\s+/g, "")}`, "#QueretaroRomance"],
      facets: { [targetFacet]: value } as GeneratedOption["facets"],
      refs: { venueIds: [], experienceIds },
      photoQuery: `${label} wedding Mexico`.slice(0, 60),
      badge: "Sugerencia SECTUR",
      matchLabel: "88% AFINIDAD",
    } as GeneratedOption);
  }
  return padded;
}

function correctionMessage(violations: readonly string[]): string {
  const rulesText =
    violations.length > 0
      ? violations.join("; ")
      : "quedaron menos de 3 opciones válidas tras aplicar las reglas de coherencia de este paso";

  return `La respuesta anterior rompió esta(s) regla(s): ${rulesText}. Devuelve el objeto JSON corregido cumpliendo todas las reglas, con al menos 3 opciones válidas.`;
}

// --- photo resolution ------------------------------------------------------

/** `undefined` whenever `isUsable()` is false — the engine must never hand out a `/api/places/photo` URL it knows won't resolve. */
function findPlacesPhoto(
  option: GeneratedOption,
  kb: Kb,
  isUsable: () => boolean,
): ResolvedOptionPhoto | undefined {
  if (!isUsable()) return undefined;

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
  isUsable: () => boolean,
): Promise<ResolvedOption> {
  const placesPhoto = findPlacesPhoto(option, kb, isUsable);
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
  known: Facets;
  targetFacet: FacetPriority;
  chosenVenueIds: readonly string[];
  stepIndex: number;
  maxSteps: number;
  kb: Kb;
  images: ImageProvider;
  start: number;
  now: () => number;
  placesUsable: () => boolean;
}

async function generateStep(ctx: GenerateContext): Promise<QuizEngineResult> {
  const {
    llm,
    transcript,
    entries,
    known,
    targetFacet,
    chosenVenueIds,
    stepIndex,
    maxSteps,
    kb,
    images,
    start,
    now,
    placesUsable,
  } = ctx;

  if (!llm) {
    return staticFallbackResult({
      entries,
      stepIndex,
      targetFacet,
      known,
      chosenVenueIds,
      kb,
      start,
      now,
      attempts: 0,
    });
  }

  const messages = buildStepMessages({
    transcript,
    facets: known,
    digest: buildDigestFor(known, chosenVenueIds),
    targetFacet,
    stepIndex,
    maxSteps,
  });
  const primary = await llm.generate(messages);

  if (!primary.ok) {
    return staticFallbackResult({
      entries,
      stepIndex,
      targetFacet,
      known,
      chosenVenueIds,
      kb,
      start,
      now,
      attempts: primary.attempts.length,
    });
  }

  let model = primary.model;
  let usage = primary.usage;
  let attempts = primary.attempts.length;
  let normalised = normaliseGeneratedStep(primary.value, targetFacet);

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
      normalised = normaliseGeneratedStep(languageRetry.value, targetFacet);
    }
  }

  if (!normalised.ok) {
    return staticFallbackResult({
      entries,
      stepIndex,
      targetFacet,
      known,
      chosenVenueIds,
      kb,
      start,
      now,
      attempts,
    });
  }

  let candidate = normalised.step;
  const normalisations = normalised.fixes.length;

  let { options: validOptions, violations } = filterOptions(candidate, kb, targetFacet, known);
  if (validOptions.length > 0) validOptions = padOptions(validOptions, targetFacet, known, kb);
  if (validOptions.length < 3) {
    console.warn(
      "[quiz/engine] step rejected",
      JSON.stringify({
        targetFacet,
        known,
        violations: [...violations],
        options: candidate.options.map((o) => ({ id: o.id, facets: o.facets, refs: o.refs })),
      }),
    );
  }

  if (validOptions.length < 3) {
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: JSON.stringify(candidate) },
      { role: "user", content: correctionMessage(violations) },
    ];

    const retry = await llm.generate(retryMessages);
    attempts += retry.attempts.length;

    if (retry.ok) {
      const retryNormalised = normaliseGeneratedStep(retry.value, targetFacet);
      if (retryNormalised.ok) {
        candidate = retryNormalised.step;
        model = retry.model;
        usage = retry.usage;
        ({ options: validOptions, violations } = filterOptions(candidate, kb, targetFacet, known));
        if (validOptions.length > 0)
          validOptions = padOptions(validOptions, targetFacet, known, kb);
      }
    }
  }

  if (validOptions.length < 3) {
    return staticFallbackResult({
      entries,
      stepIndex,
      targetFacet,
      known,
      chosenVenueIds,
      kb,
      start,
      now,
      attempts,
    });
  }

  // The model's own `done` is never honored — the schema still requires
  // the field (so it isn't a correction-worthy shape error), but the only
  // two stop conditions are `computeTargetFacet` returning `undefined`
  // (checked in `nextStep`, before the LLM is even called) and
  // `QUIZ_MAX_STEPS`. `engine-prompt.ts` tells the model to always return
  // `done: false` accordingly.
  const resolvedOptions = await Promise.all(
    validOptions.map((option) => resolveOptionPhoto(option, kb, images, known, placesUsable)),
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

function buildDigestFor(known: Facets, chosenVenueIds: readonly string[]) {
  return buildDigest(known, {
    maxVenues: 20,
    maxExperiences: 10,
    maxChars: 4500,
    zone: known.zone,
    style: known.style,
    chosenVenueIds,
  });
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
  const placesUsable = options.placesUsable ?? isPlacesUsable;

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

      const known = knownFacets(entries, kb);
      const { venueIds: chosenVenueIds } = chosenRefs(entries);
      const stepIndex = entries.length + 1;

      // The only two stop conditions left are `QUIZ_MAX_STEPS` (checked
      // here, before the LLM is even called) and `computeTargetFacet`
      // returning `undefined` below — the model's own `done` is never
      // honored (see `generateStep`).
      const hardStop = stepIndex > maxSteps;
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

      // Code-driven targeting: the engine (not the model) decides which
      // facet this step must fill. Once nothing is left unknown, the quiz
      // is done — this is checked before the LLM is even called, which is
      // also what makes the zone question disappear entirely once a venue
      // has been chosen (`computeTargetFacet` treats zone as known then).
      const targetFacet = computeTargetFacet(known, chosenVenueIds);
      if (targetFacet === undefined) {
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

      // `budget`/`lodging`/`season` are deterministic, LLM-free steps (see
      // `template-steps.ts`) — never cached, since they're already free.
      if (isTemplateFacet(targetFacet)) {
        return templateStepResult(targetFacet, known, chosenVenueIds, kb, stepIndex, start, now);
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
        known,
        targetFacet,
        chosenVenueIds,
        stepIndex,
        maxSteps,
        kb,
        images,
        start,
        now,
        placesUsable,
      });

      cacheSet(cache, cacheKey, result, now);
      return result;
    },
  };
}
