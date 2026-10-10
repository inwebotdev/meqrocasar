import { z } from "zod";

import {
  facetsFromLegacyExperience,
  facetsFromLegacyMustHave,
  facetsFromLegacySetting,
  facetsFromLegacyStyle,
} from "@/domain/kb/legacy-map";
import { FacetsSchema, type Facets } from "@/domain/kb/taxonomy";
import { matchVenue } from "@/domain/venues/match";

import {
  getOption,
  getStep,
  STYLE_IDS,
  SETTING_IDS,
  EXPERIENCE_IDS,
  MUST_HAVE_IDS,
} from "./questions";
import type { QuizAnswers } from "./schema";
import type { QuizOption, QuizStep, QuizStepId } from "./types";

/**
 * The transcript the quiz engine builds up one step at a time: every
 * entry records the question asked, the option the couple chose, and the
 * facets/venue-or-experience refs that choice is known to carry. Pure
 * TypeScript: no React, no Next.js, no `node:crypto` (see
 * `transcript-hash.ts` for the hash, kept separate so this module stays
 * importable from client components).
 */

export const TranscriptRefsSchema = z
  .object({
    venueIds: z.array(z.string()),
    experienceIds: z.array(z.string()),
  })
  .strict();

export type TranscriptRefs = z.infer<typeof TranscriptRefsSchema>;

export const TranscriptChosenSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    facets: FacetsSchema,
    refs: TranscriptRefsSchema,
  })
  .strict();

export const TranscriptEntrySchema = z
  .object({
    stepId: z.string().min(1),
    question: z.string().min(1),
    topic: z.string().min(1),
    chosen: TranscriptChosenSchema,
  })
  .strict();

export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;

export const TranscriptSchema = z
  .object({
    entries: z.array(TranscriptEntrySchema).max(8),
  })
  .strict();

export type Transcript = z.infer<typeof TranscriptSchema>;

/**
 * Folds every entry's facets into a single `Facets`, one value per key,
 * later entries winning (so a later step can override what an earlier
 * one implied).
 */
export function foldFacets(entries: readonly TranscriptEntry[]): Facets {
  return entries.reduce<Facets>((facets, entry) => ({ ...facets, ...entry.chosen.facets }), {});
}

function kbVenueRefs(venueHint: string): string[] {
  const matched = matchVenue(venueHint);
  return matched ? [`v_${matched.id}`] : [];
}

/**
 * Builds a transcript entry from one of the curated step-1 decks
 * (`QUIZ_STEPS`): the facets come from the matching legacy-answer mapping
 * for that step, and the venue ref is resolved from the option's
 * `venueHint` via `matchVenue`. `option.promptHint` becomes the entry's
 * summary (it is already a one-sentence es-MX description of the choice).
 */
export function entryFromCuratedOption(step: QuizStep, option: QuizOption): TranscriptEntry {
  return {
    stepId: step.id,
    question: step.question,
    topic: step.topic,
    chosen: {
      id: option.id,
      title: option.title,
      summary: option.promptHint,
      facets: facetsForLegacyStepOption(step.id, option.id),
      refs: { venueIds: kbVenueRefs(option.venueHint), experienceIds: [] },
    },
  };
}

function facetsForLegacyStepOption(stepId: QuizStepId, optionId: string): Facets {
  switch (stepId) {
    case "style":
      assertOneOf(optionId, STYLE_IDS, stepId);
      return facetsFromLegacyStyle(optionId);
    case "setting":
      assertOneOf(optionId, SETTING_IDS, stepId);
      return facetsFromLegacySetting(optionId);
    case "experience":
      assertOneOf(optionId, EXPERIENCE_IDS, stepId);
      return facetsFromLegacyExperience(optionId);
    case "mustHave":
      assertOneOf(optionId, MUST_HAVE_IDS, stepId);
      return facetsFromLegacyMustHave(optionId);
  }
}

function assertOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  stepId: QuizStepId,
): asserts value is T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`Unknown option "${value}" for step "${stepId}"`);
  }
}

const STEP_ORDER: readonly QuizStepId[] = ["style", "setting", "experience", "mustHave"];

/**
 * Converts the old 4-answer quiz into a 4-entry transcript: one entry per
 * step, built from that step's fixed `QUIZ_STEPS` content and the chosen
 * option, via `entryFromCuratedOption`.
 */
export function transcriptFromLegacyAnswers(answers: QuizAnswers): Transcript {
  const entries = STEP_ORDER.map((stepId) => {
    const step = getStep(stepId);
    const option = getOption(stepId, answers[stepId]);
    return entryFromCuratedOption(step, option);
  });

  return { entries };
}
