import { z } from "zod";

import type { ChatMessage, LlmAttempt, StructuredClient } from "../../src/domain/ai/structured";
import { estimateCostUsd, type TokenUsage } from "../../src/domain/ai/pricing";
import {
  BUDGET_VALUES,
  EXPERIENCE_VALUES,
  facetLabel,
  SCALE_VALUES,
  SETTING_VALUES,
  STYLE_VALUES,
} from "../../src/domain/kb/taxonomy";
import { KbVenueFacetsSchema, type KbVenue } from "../../src/domain/kb/types";
import type { Place } from "../../src/domain/places";

/**
 * Pure (no network, no `fs`) building blocks for `enrich-kb.ts`: venue
 * selection, batching, prompt construction, the response schema, the
 * batch/requeue protocol, the merge rules and the final sort. Kept
 * separate from the script entrypoint so every rule is unit-testable
 * directly, and so the script itself stays a thin orchestration shell
 * (reading/writing `data/kb/*.json`, printing the summary).
 */

// --- selection ------------------------------------------------------------

export interface SelectVenuesOptions {
  /** Include curated seeds too. Defaults to `false`. */
  all?: boolean;
  /** Defaults to `0.9`. */
  confidenceThreshold?: number;
}

/**
 * Selects the venues that still need enrichment: `confidence` below the
 * threshold, or an empty `whyWeddings` (the places-sourced venues
 * pending their first enrichment pass). Curated seeds are skipped unless
 * `all` is set, so a normal run never touches hand-written copy.
 */
export function selectVenuesForEnrichment(
  venues: readonly KbVenue[],
  options: SelectVenuesOptions = {},
): KbVenue[] {
  const threshold = options.confidenceThreshold ?? 0.9;

  return venues.filter((venue) => {
    if (venue.source === "curated" && !options.all) {
      return false;
    }

    return venue.confidence < threshold || venue.whyWeddings.trim().length === 0;
  });
}

// --- batching ---------------------------------------------------------

/** Splits `items` into chunks of at most `batchSize` (defaults to `8`), preserving order. */
export function batchVenues<T>(items: readonly T[], batchSize = 8): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

// --- venue facts (what the model sees) -------------------------------------

export interface VenueFacts {
  id: string;
  name: string;
  zoneLabel: string;
  address?: string;
  types: string[];
  editorialSummary?: string;
  reviewSnippets: string[];
  websiteUri?: string;
}

function placeTypesOf(place: Place): string[] {
  const types = place.types ?? [];
  return place.primaryType ? [place.primaryType, ...types] : types;
}

function reviewSnippetsOf(place: Place | undefined): string[] {
  return (place?.reviews ?? [])
    .map((review) => review.text?.text)
    .filter((text): text is string => Boolean(text && text.trim().length > 0))
    .slice(0, 3);
}

/**
 * Builds the compact fact sheet the prompt shows the model for one
 * venue: the curated/places-mapped `KbVenue` fields plus, when the venue
 * carries a `placeId`, the raw Google Places types/editorial
 * summary/review snippets from the ingestion snapshot (`KbVenue` itself
 * doesn't keep those).
 */
export function buildVenueFacts(
  venue: KbVenue,
  placesById: ReadonlyMap<string, Place>,
): VenueFacts {
  const place = venue.placeId ? placesById.get(venue.placeId) : undefined;

  return {
    id: venue.id,
    name: venue.name,
    zoneLabel: facetLabel("zone", venue.zone),
    address: venue.address ?? place?.formattedAddress,
    types: place ? placeTypesOf(place) : [],
    editorialSummary: place?.editorialSummary?.text,
    reviewSnippets: reviewSnippetsOf(place),
    websiteUri: venue.websiteUri ?? place?.websiteUri,
  };
}

// --- response schema ---------------------------------------------------

export const EnrichedVenueSchema = z
  .object({
    id: z.string().min(1),
    isWeddingVenue: z.boolean(),
    facets: KbVenueFacetsSchema,
    capacityEstimate: z.number().int().positive(),
    capacityApprox: z.literal(true),
    oneLiner: z.string().min(1).max(120),
    whyWeddings: z.string().min(1).max(240),
    highlights: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type EnrichedVenue = z.infer<typeof EnrichedVenueSchema>;

export const EnrichmentResponseSchema = z
  .object({
    venues: z.array(EnrichedVenueSchema),
  })
  .strict();

export type EnrichmentResponse = z.infer<typeof EnrichmentResponseSchema>;

/** JSON Schema for the OpenRouter `response_format` (structured outputs). */
export const ENRICHMENT_JSON_SCHEMA = z.toJSONSchema(EnrichmentResponseSchema) as Record<
  string,
  unknown
>;

// --- prompt ---------------------------------------------------------------

function buildSystemPrompt(): string {
  return [
    "Eres un experto en turismo de bodas del estado de Querétaro, México.",
    "",
    "Para cada recinto que se te presente, clasifícalo en esta taxonomía cerrada (usa únicamente estos valores):",
    `- styles (uno o más): ${STYLE_VALUES.join(", ")}`,
    `- settings (uno o más): ${SETTING_VALUES.join(", ")}`,
    `- scale (uno o más): ${SCALE_VALUES.join(", ")}`,
    `- experiences (cero o más): ${EXPERIENCE_VALUES.join(", ")}`,
    `- budget (exactamente uno): ${BUDGET_VALUES.join(", ")}`,
    "",
    "Además, para cada recinto:",
    "- capacityEstimate: número entero de invitados aproximado; capacityApprox siempre true.",
    "- oneLiner: frase evocadora en español latinoamericano, máximo 120 caracteres, sin lenguaje publicitario (nada de 'reserva ahora' ni precios).",
    "- whyWeddings: por qué conecta con bodas, máximo 240 caracteres, concreto (arquitectura, paisaje, logística), sin lenguaje publicitario.",
    "- highlights: exactamente 3 chips cortos (rasgos distintivos).",
    "- isWeddingVenue: false si el lugar es un restaurante, tienda o atractivo turístico que NO puede albergar una boda; true si sí puede.",
    "- confidence: número entre 0 y 1 que exprese tu seguridad en esta clasificación.",
    "",
    'Responde ÚNICAMENTE un objeto JSON con la forma { "venues": [...] }, un elemento por cada id recibido, EXACTAMENTE con esos ids (no inventes ids nuevos, no omitas ninguno, no agregues texto antes o después del JSON).',
  ].join("\n");
}

function formatVenueFactsBlock(fact: VenueFacts): string {
  const lines = [
    `[${fact.id}] ${fact.name} — Zona: ${fact.zoneLabel}`,
    fact.address ? `Dirección: ${fact.address}` : undefined,
    fact.types.length > 0 ? `Tipos: ${fact.types.join(", ")}` : undefined,
    fact.editorialSummary ? `Resumen editorial: "${fact.editorialSummary}"` : undefined,
    ...fact.reviewSnippets.map((snippet) => `Reseña: "${snippet}"`),
    fact.websiteUri ? `Sitio web: ${fact.websiteUri}` : undefined,
  ];

  return lines.filter((line): line is string => line !== undefined).join("\n");
}

/** Builds the system + user chat messages for one batch of venues. */
export function buildEnrichmentMessages(facts: readonly VenueFacts[]): ChatMessage[] {
  const userMessage = [
    "Clasifica los siguientes recintos:",
    "",
    facts.map((fact) => formatVenueFactsBlock(fact)).join("\n\n"),
    "",
    "Devuelve únicamente el objeto JSON solicitado, con un elemento por cada id listado arriba.",
  ].join("\n");

  return [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: userMessage },
  ];
}

// --- merge rules ---------------------------------------------------------

export interface MergeEnrichmentResult {
  venues: KbVenue[];
  droppedIds: string[];
  enrichedIds: string[];
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function facetsAreEmpty(facets: KbVenue["facets"]): boolean {
  return facets.styles.length === 0 || facets.settings.length === 0 || facets.scale.length === 0;
}

function highlightsAreEmpty(highlights: KbVenue["highlights"]): boolean {
  return highlights.every((highlight) => isBlank(highlight));
}

/** Curated seeds only gain fields that were empty; everything else about the seed wins. */
function mergeCuratedVenue(seed: KbVenue, result: EnrichedVenue): KbVenue {
  return {
    ...seed,
    facets: facetsAreEmpty(seed.facets) ? result.facets : seed.facets,
    oneLiner: isBlank(seed.oneLiner) ? result.oneLiner : seed.oneLiner,
    whyWeddings: isBlank(seed.whyWeddings) ? result.whyWeddings : seed.whyWeddings,
    highlights: highlightsAreEmpty(seed.highlights) ? result.highlights : seed.highlights,
  };
}

/** Places-sourced venues: the enrichment result overwrites facets/copy/capacity/confidence; ratings/photos/links are untouched. */
function mergePlacesVenue(seed: KbVenue, result: EnrichedVenue): KbVenue {
  return {
    ...seed,
    facets: result.facets,
    capacityEstimate: result.capacityEstimate,
    capacityApprox: true,
    oneLiner: result.oneLiner,
    whyWeddings: result.whyWeddings,
    highlights: result.highlights,
    confidence: result.confidence,
  };
}

/**
 * Applies the merge rules to `venues` given a batch of (deduped,
 * id-matched) `results`: a venue with no matching result is left
 * untouched; a matching result with `isWeddingVenue === false` or
 * `confidence < 0.5` drops the venue entirely; otherwise the venue is
 * enriched (curated seeds only gain empty fields, places-sourced venues
 * are overwritten — see `mergeCuratedVenue`/`mergePlacesVenue`).
 */
export function mergeEnrichment(
  venues: readonly KbVenue[],
  results: readonly EnrichedVenue[],
): MergeEnrichmentResult {
  const resultById = new Map(results.map((result) => [result.id, result] as const));
  const droppedIds: string[] = [];
  const enrichedIds: string[] = [];
  const merged: KbVenue[] = [];

  for (const venue of venues) {
    const result = resultById.get(venue.id);
    if (!result) {
      merged.push(venue);
      continue;
    }

    if (!result.isWeddingVenue || result.confidence < 0.5) {
      droppedIds.push(venue.id);
      continue;
    }

    enrichedIds.push(venue.id);
    merged.push(
      venue.source === "curated"
        ? mergeCuratedVenue(venue, result)
        : mergePlacesVenue(venue, result),
    );
  }

  return { venues: merged, droppedIds, enrichedIds };
}

// --- sort ---------------------------------------------------------------

/** Curated seeds first, then by rating descending (no rating sorts last), ties broken by name. */
export function sortVenues(venues: readonly KbVenue[]): KbVenue[] {
  return [...venues].sort((a, b) => {
    if (a.source !== b.source) {
      return a.source === "curated" ? -1 : 1;
    }

    const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
    if (ratingDiff !== 0) {
      return ratingDiff;
    }

    return a.name.localeCompare(b.name, "es");
  });
}

// --- batch + requeue protocol (network, but injected) ----------------------

export interface TokenUsageByModel {
  [model: string]: TokenUsage;
}

function addUsage(map: TokenUsageByModel, model: string, usage: TokenUsage): void {
  const existing = map[model] ?? { promptTokens: 0, completionTokens: 0 };
  map[model] = {
    promptTokens: existing.promptTokens + usage.promptTokens,
    completionTokens: existing.completionTokens + usage.completionTokens,
  };
}

function isRetryableAttempt(attempt: LlmAttempt | undefined): boolean {
  if (!attempt || attempt.outcome !== "http-error" || attempt.status === undefined) {
    return false;
  }
  return attempt.status === 429 || attempt.status >= 500;
}

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface EnrichBatchOptions {
  /** Extra attempts after a 429/5xx, with linear backoff. Defaults to `2`. */
  maxRetries?: number;
  /** Defaults to the real `setTimeout`-based sleep; tests override to skip delays. */
  sleep?: (ms: number) => Promise<void>;
}

export interface EnrichBatchResult {
  /** Results matching a requested id, deduped (unknown ids are dropped). */
  results: EnrichedVenue[];
  attempts: LlmAttempt[];
  usageByModel: TokenUsageByModel;
}

async function callWithRetry(
  client: StructuredClient<EnrichmentResponse>,
  messages: ChatMessage[],
  maxRetries: number,
  sleep: (ms: number) => Promise<void>,
): Promise<Awaited<ReturnType<StructuredClient<EnrichmentResponse>["generate"]>>> {
  let attempt = 0;

  while (true) {
    const outcome = await client.generate(messages);

    if (outcome.ok) {
      return outcome;
    }

    const lastAttempt = outcome.attempts.at(-1);
    if (attempt >= maxRetries || !isRetryableAttempt(lastAttempt)) {
      return outcome;
    }

    attempt += 1;
    await sleep(attempt * 500);
  }
}

/**
 * Runs one batch end to end: the initial structured call (itself retried
 * up to `maxRetries` times on a 429/5xx, via `callWithRetry`), then — if
 * any requested id came back missing from the response — a single
 * requeue call for just the missing ids. An id in the response that
 * wasn't requested is silently ignored.
 */
export async function enrichBatch(
  client: StructuredClient<EnrichmentResponse>,
  facts: readonly VenueFacts[],
  options: EnrichBatchOptions = {},
): Promise<EnrichBatchResult> {
  const maxRetries = options.maxRetries ?? 2;
  const sleep = options.sleep ?? defaultSleep;

  const requestedIds = new Set(facts.map((fact) => fact.id));
  const resultsById = new Map<string, EnrichedVenue>();
  const attempts: LlmAttempt[] = [];
  const usageByModel: TokenUsageByModel = {};

  const first = await callWithRetry(client, buildEnrichmentMessages(facts), maxRetries, sleep);
  attempts.push(...first.attempts);

  if (first.ok) {
    if (first.usage) {
      addUsage(usageByModel, first.model, first.usage);
    }
    for (const result of first.value.venues) {
      if (requestedIds.has(result.id)) {
        resultsById.set(result.id, result);
      }
    }
  }

  const missingFacts = facts.filter((fact) => !resultsById.has(fact.id));

  if (missingFacts.length > 0) {
    const requeue = await callWithRetry(
      client,
      buildEnrichmentMessages(missingFacts),
      maxRetries,
      sleep,
    );
    attempts.push(...requeue.attempts);

    if (requeue.ok) {
      if (requeue.usage) {
        addUsage(usageByModel, requeue.model, requeue.usage);
      }
      for (const result of requeue.value.venues) {
        if (requestedIds.has(result.id)) {
          resultsById.set(result.id, result);
        }
      }
    }
  }

  return { results: [...resultsById.values()], attempts, usageByModel };
}

// --- orchestration ---------------------------------------------------------

async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const current = nextIndex;
    nextIndex += 1;
    if (current >= items.length) return;
    results[current] = await worker(items[current] as T);
    await runNext();
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));

  return results;
}

export interface RunEnrichmentOptions {
  venues: readonly KbVenue[];
  places: readonly Place[];
  client: StructuredClient<EnrichmentResponse>;
  /** Include curated seeds. Defaults to `false`. */
  all?: boolean;
  /** Defaults to `0.9`. */
  confidenceThreshold?: number;
  /** Defaults to `8`. */
  batchSize?: number;
  /** Concurrent batches in flight. Defaults to `2`. */
  concurrency?: number;
  /** Extra attempts after a 429/5xx, per batch call. Defaults to `2`. */
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RunEnrichmentResult {
  /** The full venue list (selected + untouched), merged and sorted. */
  venues: KbVenue[];
  enrichedIds: string[];
  droppedIds: string[];
  /** Venues that didn't meet the selection criteria at all (already enriched / curated). */
  skippedCount: number;
  selectedCount: number;
  attempts: LlmAttempt[];
  usageByModel: TokenUsageByModel;
  estimatedCostUsd: number;
}

/**
 * Selects the venues due for enrichment, batches them (8 per batch, 2
 * batches in flight at a time), runs the batch/requeue protocol for
 * each, merges the results back into the full venue list and sorts it.
 * Idempotent: a venue whose enriched `confidence` already clears
 * `confidenceThreshold` is not selected on a later run.
 */
export async function runEnrichment(options: RunEnrichmentOptions): Promise<RunEnrichmentResult> {
  const batchSize = options.batchSize ?? 8;
  const concurrency = options.concurrency ?? 2;
  const maxRetries = options.maxRetries ?? 2;

  const selected = selectVenuesForEnrichment(options.venues, {
    all: options.all,
    confidenceThreshold: options.confidenceThreshold,
  });

  const placesById = new Map(options.places.map((place) => [place.id, place] as const));
  const batches = batchVenues(selected, batchSize);

  const batchOutcomes = await runWithConcurrency(batches, concurrency, (batch) => {
    const facts = batch.map((venue) => buildVenueFacts(venue, placesById));
    return enrichBatch(options.client, facts, { maxRetries, sleep: options.sleep });
  });

  const attempts: LlmAttempt[] = [];
  const usageByModel: TokenUsageByModel = {};
  const allResults: EnrichedVenue[] = [];

  for (const outcome of batchOutcomes) {
    attempts.push(...outcome.attempts);
    allResults.push(...outcome.results);
    for (const [model, usage] of Object.entries(outcome.usageByModel)) {
      addUsage(usageByModel, model, usage);
    }
  }

  const {
    venues: mergedVenues,
    droppedIds,
    enrichedIds,
  } = mergeEnrichment(options.venues, allResults);

  const estimatedCostUsd = Object.entries(usageByModel).reduce(
    (sum, [model, usage]) => sum + estimateCostUsd(model, usage),
    0,
  );

  return {
    venues: sortVenues(mergedVenues),
    enrichedIds,
    droppedIds,
    skippedCount: options.venues.length - selected.length,
    selectedCount: selected.length,
    attempts,
    usageByModel,
    estimatedCostUsd,
  };
}
