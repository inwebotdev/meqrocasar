import { z } from "zod";

import { loadKb } from "@/domain/kb/load";
import { FacetsSchema, ZONE_VALUES, type ZoneValue } from "@/domain/kb/taxonomy";
import type { Kb } from "@/domain/kb/types";
import { getPhoto } from "@/domain/media/photos";

import { facetsForLegacyStepOption, kbVenueRefs } from "./transcript";
import type { TranscriptEntry } from "./transcript";
import type { QuizOption, QuizStep } from "./types";

/**
 * The shape an adaptive quiz step must validate against when it comes back
 * from the LLM (`GeneratedStepSchema`/`LLM_STEP_JSON_SCHEMA`), and the
 * "resolved" shape the UI actually consumes once refs are checked against
 * the knowledge base and photos are attached (`ResolvedStep`). Also maps
 * the curated step-1/fallback decks (`QUIZ_STEPS`) into that same resolved
 * shape, so the UI never needs to know whether a step was generated or
 * curated.
 *
 * Pure TypeScript + Zod: no React, no Next.js, no `server-only` (the
 * engine that calls the LLM and resolves photos lives in `engine.ts`).
 */

// --- generated option --------------------------------------------------

const OPTION_ID_PATTERN = /^[a-z0-9_-]{2,40}$/;

// `.regex(/^#/)` rather than `.startsWith("#")`: Zod's JSON Schema export
// for `startsWith` adds a non-standard `format: "starts_with"` alongside
// the `pattern`, which OpenAI's strict structured-output validator (and
// potentially others) rejects outright ("'starts_with' is not a valid
// format"). `regex` emits a plain `pattern`, which every provider accepts.
//
// No `.min()` beyond the implicit "#": real-run testing against several
// fast OpenRouter models showed grammar-constrained decoders frequently
// satisfy a `pattern` + `minLength` combination on a short string by
// emitting the shortest valid match ("#") regardless of prompt
// instructions, so requiring more than "starts with #" here just produces
// schema failures instead of better content.
const HashtagSchema = z.string().max(40).regex(/^#/);

export const GeneratedRefsSchema = z
  .object({
    venueIds: z.array(z.string().min(1)).max(3),
    experienceIds: z.array(z.string().min(1)).max(3),
  })
  .strict();

export type GeneratedRefs = z.infer<typeof GeneratedRefsSchema>;

export const GeneratedOptionSchema = z
  .object({
    id: z.string().regex(OPTION_ID_PATTERN),
    title: z.string().min(1).max(40),
    description: z.string().min(1).max(160),
    hashtags: z.array(HashtagSchema).length(3),
    facets: FacetsSchema,
    refs: GeneratedRefsSchema,
    /** Short English stock-photo search query. */
    photoQuery: z.string().min(1).max(60),
    badge: z.string().min(1).max(24),
    matchLabel: z.string().min(1).max(16),
  })
  .strict();

export type GeneratedOption = z.infer<typeof GeneratedOptionSchema>;

// --- generated step --------------------------------------------------

export const GeneratedStepSchema = z
  .object({
    id: z.string().min(1).max(40),
    topic: z.string().min(1).max(24),
    question: z.string().min(1).max(80),
    helper: z.string().min(1).max(140),
    selectLabel: z.string().min(1).max(32),
    options: z.array(GeneratedOptionSchema).min(3).max(4),
    done: z.boolean(),
    doneReason: z.string().max(120).optional(),
  })
  .strict();

export type GeneratedStep = z.infer<typeof GeneratedStepSchema>;

/** JSON Schema for `GeneratedStepSchema`, passed verbatim as `response_format.json_schema.schema`. */
export const LLM_STEP_JSON_SCHEMA = z.toJSONSchema(GeneratedStepSchema) as Record<string, unknown>;

// --- raw (decode-headroom) schemas --------------------------------------

/**
 * Looser mirror of `GeneratedOptionSchema`/`GeneratedStepSchema`: every
 * free-text field gets roughly 2x the real max, so a grammar-constrained
 * decoder has headroom to naturally finish a sentence instead of
 * hard-truncating mid-word exactly at the tight limit (the bug this layer
 * fixes — see `normalise-step.ts`, which smart-truncates back down to the
 * real max at a word boundary). Hashtags are only checked for count/length
 * here; `normaliseGeneratedStep` fixes missing "#" prefixes and
 * regenerates empty/degenerate ones. `refs`/`facets` are left exactly as
 * strict as the real schema — those are controlled vocabulary, not
 * free text, so there's no truncation/language risk to buy headroom for.
 * Fields `normaliseGeneratedStep` defaults when empty (`hashtags`
 * entries) drop even the `.min(1)` a real field keeps, so a
 * literally-empty string still reaches normalisation instead of failing
 * shape validation before it gets the chance to default it.
 *
 * `badge`, `matchLabel` (option-level) and `selectLabel` (step-level) are
 * deliberately NOT part of this raw shape at all: the model no longer
 * generates them (fewer output tokens → faster cold steps).
 * `normaliseGeneratedStep` derives all three deterministically instead
 * (badge from the option's dominant facet, matchLabel from a seeded hash
 * of the option id, selectLabel from the step's topic) and fills them
 * onto the real `GeneratedOption`/`GeneratedStep` the UI consumes.
 *
 * This is what's actually sent as `response_format.json_schema.schema`
 * (`RAW_LLM_STEP_JSON_SCHEMA`) and what the quiz engine's structured
 * client validates against (`RawGeneratedStepSchema`); `GeneratedStepSchema`
 * only ever sees the output of `normaliseGeneratedStep`.
 */
export const RawGeneratedOptionSchema = z
  .object({
    id: z.string().regex(OPTION_ID_PATTERN),
    title: z.string().min(1).max(80),
    description: z.string().min(1).max(260),
    hashtags: z.array(z.string().max(60)).length(3),
    facets: FacetsSchema,
    refs: GeneratedRefsSchema,
    /** Short English stock-photo search query. */
    photoQuery: z.string().min(1).max(100),
  })
  .strict();

export type RawGeneratedOption = z.infer<typeof RawGeneratedOptionSchema>;

export const RawGeneratedStepSchema = z
  .object({
    id: z.string().min(1).max(60),
    topic: z.string().min(1).max(50),
    question: z.string().min(1).max(140),
    helper: z.string().min(1).max(220),
    options: z.array(RawGeneratedOptionSchema).min(3).max(4),
    done: z.boolean(),
    doneReason: z.string().max(200).optional(),
  })
  .strict();

export type RawGeneratedStep = z.infer<typeof RawGeneratedStepSchema>;

/**
 * JSON Schema for `RawGeneratedStepSchema` — see its doc comment for why
 * this, not `GeneratedStepSchema`, is what's actually sent as
 * `response_format.json_schema.schema` for the quiz engine's fast model.
 */
export const RAW_LLM_STEP_JSON_SCHEMA = z.toJSONSchema(RawGeneratedStepSchema) as Record<
  string,
  unknown
>;

// --- resolved step (what the UI consumes) --------------------------------

export interface ResolvedOptionPhoto {
  url: string;
  alt: string;
  credit: string;
}

export interface ResolvedOptionVenue {
  id: string;
  name: string;
  zone: ZoneValue;
  rating?: number;
  userRatingCount?: number;
}

export type ResolvedOption = GeneratedOption & {
  photo: ResolvedOptionPhoto;
  venue?: ResolvedOptionVenue;
};

export type ResolvedStep = Omit<GeneratedStep, "options"> & {
  index: number;
  options: ResolvedOption[];
  source: "llm" | "static";
};

// --- resolved step/option Zod schemas (for validating the API response client-side) ---

export const ResolvedOptionPhotoSchema = z
  .object({
    url: z.string().min(1),
    alt: z.string().min(1),
    credit: z.string().min(1),
  })
  .strict();

export const ResolvedOptionVenueSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    zone: z.enum(ZONE_VALUES),
    rating: z.number().optional(),
    userRatingCount: z.number().optional(),
  })
  .strict();

export const ResolvedOptionSchema = GeneratedOptionSchema.extend({
  photo: ResolvedOptionPhotoSchema,
  venue: ResolvedOptionVenueSchema.optional(),
});

export const ResolvedStepSchema = GeneratedStepSchema.extend({
  index: z.number().int().positive(),
  options: z.array(ResolvedOptionSchema),
  source: z.enum(["llm", "static"]),
});

/**
 * Builds the transcript entry for choosing `option` within `step`: both a
 * curated (`source: "static"`) and an LLM-generated (`source: "llm"`) step
 * resolve to the same `ResolvedOption` shape, so the entry's `summary`,
 * `facets` and `refs` all come straight off the chosen option — no step-id
 * dispatch needed (contrast `entryFromCuratedOption`, which still has to
 * derive facets/refs itself because it works from the raw curated
 * `QuizOption`, not a resolved one).
 */
export function entryFromResolvedOption(
  step: ResolvedStep,
  option: ResolvedOption,
): TranscriptEntry {
  return {
    stepId: step.id,
    question: step.question,
    topic: step.topic,
    chosen: {
      id: option.id,
      title: option.title,
      summary: option.description,
      facets: option.facets,
      refs: option.refs,
    },
  };
}

/**
 * Looks up `venueId` in `kb` and maps it to the compact venue summary a
 * `ResolvedOption` carries. `undefined` when the id isn't a real KB venue
 * (callers only ever pass validated ids, so this is mostly defensive).
 */
export function resolveVenueSummary(venueId: string, kb: Kb): ResolvedOptionVenue | undefined {
  const venue = kb.venues.find((candidate) => candidate.id === venueId);

  if (!venue) {
    return undefined;
  }

  return {
    id: venue.id,
    name: venue.name,
    zone: venue.zone,
    rating: venue.rating,
    userRatingCount: venue.userRatingCount,
  };
}

function toResolvedOption(step: QuizStep, option: QuizOption, kb: Kb): ResolvedOption {
  const photo = getPhoto(option.photoId);
  const refs = { venueIds: kbVenueRefs(option.venueHint), experienceIds: [] as string[] };
  const venue = refs.venueIds[0] ? resolveVenueSummary(refs.venueIds[0], kb) : undefined;

  return {
    id: option.id,
    title: option.title,
    description: option.description,
    hashtags: option.hashtags,
    facets: facetsForLegacyStepOption(step.id, option.id),
    refs,
    photoQuery: `${option.label} wedding venue Queretaro`.slice(0, 60),
    badge: option.badge,
    matchLabel: option.matchLabel,
    photo: { url: photo.url, alt: photo.alt, credit: photo.credit },
    venue,
  };
}

/**
 * Maps one of the curated decks (`QUIZ_STEPS`, used for step 1 and as the
 * static fallback) into the same `ResolvedStep` shape a generated step
 * resolves to: facets via the legacy-answer mapping, refs via `matchVenue`
 * (`v_` ids), photos straight from the local registry (never the network).
 */
export function resolvedStepFromCurated(step: QuizStep, index: number): ResolvedStep {
  const kb = loadKb();

  return {
    id: step.id,
    topic: step.topic,
    question: step.question,
    helper: step.helper,
    selectLabel: step.selectLabel,
    done: false,
    options: step.options.map((option) => toResolvedOption(step, option, kb)),
    index,
    source: "static",
  };
}
