import { z } from "zod";

import { loadKb } from "@/domain/kb/load";
import { FacetsSchema, type ZoneValue } from "@/domain/kb/taxonomy";
import type { Kb } from "@/domain/kb/types";
import { getPhoto } from "@/domain/media/photos";

import { facetsForLegacyStepOption, kbVenueRefs } from "./transcript";
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

const HashtagSchema = z.string().min(2).max(40).startsWith("#");

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
