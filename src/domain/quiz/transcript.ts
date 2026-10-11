import { z } from "zod";

import {
  facetsFromLegacyExperience,
  facetsFromLegacyMustHave,
  facetsFromLegacySetting,
  facetsFromLegacyStyle,
} from "@/domain/kb/legacy-map";
import {
  FacetsSchema,
  type ExperienceValue,
  type Facets,
  type SettingValue,
  type StyleValue,
} from "@/domain/kb/taxonomy";
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

/**
 * Resolves a curated option's free-text `venueHint` to the matching
 * knowledge-base venue id (`v_{legacy-catalog-id}`), or `[]` when no match
 * is found. Exported so `generated-step.ts` can build the same refs when
 * mapping a curated deck into the generated-step shape.
 */
export function kbVenueRefs(venueHint: string): string[] {
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

/**
 * Facets a curated step's option contributes alone, dispatched by legacy
 * step id. Exported so `generated-step.ts` can derive the same facets when
 * mapping a curated deck into the generated-step shape.
 */
export function facetsForLegacyStepOption(stepId: QuizStepId, optionId: string): Facets {
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

// --- adaptive transcript → legacy answers (for the /api/generate-experience fallback) ---

/**
 * Reverse of `facetsFromLegacyStyle`/`facetsFromLegacySetting`/etc: maps a
 * folded `Facets` value back onto the closest legacy quiz-answer id, for
 * facet values the old 4-question quiz never had (e.g. `garden_romantic`,
 * `rooftop_city`), picking the closest sensible legacy equivalent rather
 * than failing.
 */
const STYLE_FACET_TO_LEGACY: Record<StyleValue, QuizAnswers["style"]> = {
  colonial: "colonial",
  rustic_vineyard: "rustic_vineyard",
  boho_desert: "boho_chic",
  modern_elegant: "modern_elegant",
  garden_romantic: "colonial",
  pueblo_magico: "boho_chic",
};

const SETTING_FACET_TO_LEGACY: Record<SettingValue, QuizAnswers["setting"]> = {
  sunset_garden: "sunset_garden",
  night_casona: "night_casona",
  day_vineyard: "day_vineyard",
  rooftop_city: "night_casona",
  chapel_courtyard: "sunset_garden",
};

const MUST_HAVE_FACET_TO_LEGACY: Record<ExperienceValue, QuizAnswers["mustHave"]> = {
  wine_tasting: "wine_tasting",
  vendimia: "wine_tasting",
  callejoneada: "callejoneada",
  hot_air_balloon: "wine_tasting",
  temazcal: "wine_tasting",
  cheese_route: "wine_tasting",
  fireworks: "fireworks",
  gourmet_banquet: "gourmet_mexican_banquet",
  mariachi_huapango: "callejoneada",
  sierra_gorda_escape: "wine_tasting",
};

const DEFAULT_LEGACY_STYLE: QuizAnswers["style"] = "colonial";
const DEFAULT_LEGACY_SETTING: QuizAnswers["setting"] = "sunset_garden";
const DEFAULT_LEGACY_MUST_HAVE: QuizAnswers["mustHave"] = "wine_tasting";

/**
 * The old "experience" (step 3) answer is really about party scale/lodging
 * (see `facetsFromLegacyExperience`): `lodging: "needed"` wins first
 * (that's what `weekend_getaway` uniquely implies), then `scale` maps
 * directly; a `medium` scale with no lodging need has no exact legacy
 * match, so it defaults to `grand_traditional`.
 */
function legacyExperienceFromFacets(facets: Facets): QuizAnswers["experience"] {
  if (facets.lodging === "needed") {
    return "weekend_getaway";
  }
  if (facets.scale === "intimate") {
    return "intimate_boutique";
  }
  return "grand_traditional";
}

/**
 * Maps a folded `Facets` onto the closest legacy 4-answer `QuizAnswers`
 * shape (sensible defaults when a facet is unknown or has no legacy
 * equivalent). Shared by `transcriptToLegacyAnswers` (below) and by
 * `buildFallbackExperienceFromFacets` (`src/domain/experience/fallback.ts`),
 * which reuses the legacy deterministic fallback tables (keyed by legacy
 * style × setting) for the adaptive-engine fallback path too.
 */
export function legacyAnswersFromFacets(facets: Facets): QuizAnswers {
  return {
    style: facets.style ? STYLE_FACET_TO_LEGACY[facets.style] : DEFAULT_LEGACY_STYLE,
    setting: facets.setting ? SETTING_FACET_TO_LEGACY[facets.setting] : DEFAULT_LEGACY_SETTING,
    experience: legacyExperienceFromFacets(facets),
    mustHave: facets.experience
      ? MUST_HAVE_FACET_TO_LEGACY[facets.experience]
      : DEFAULT_LEGACY_MUST_HAVE,
  };
}

/**
 * Converts an adaptive-engine transcript into the legacy 4-answer shape,
 * by folding the transcript's facets and delegating to
 * `legacyAnswersFromFacets`. Kept as a test/adapter helper now that
 * `/api/generate-experience` accepts a transcript directly (see
 * `src/lib/quiz-client.ts`'s `generateExperienceFromTranscript`).
 */
export function transcriptToLegacyAnswers(transcript: Transcript): QuizAnswers {
  return legacyAnswersFromFacets(foldFacets(transcript.entries));
}
