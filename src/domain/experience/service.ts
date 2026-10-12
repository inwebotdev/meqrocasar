import {
  EXPERIENCE_DIGEST_OPTIONS,
  EXPERIENCE_PROMPT_VERSION,
  buildExperienceMessages,
} from "@/domain/ai/experience-prompt";
import type { LlmAttempt, StructuredClient } from "@/domain/ai/structured";
import type { NarrationRef, NarrationService } from "@/domain/audio/service";
import { buildDigest } from "@/domain/kb/digest";
import { loadKb } from "@/domain/kb/load";
import type { Facets } from "@/domain/kb/taxonomy";
import type { Kb } from "@/domain/kb/types";
import type { ImageProvider } from "@/domain/images/provider";
import type { QuizAnswers } from "@/domain/quiz/schema";
import {
  foldFacets,
  legacyAnswersFromFacets,
  transcriptFromLegacyAnswers,
  type Transcript,
} from "@/domain/quiz/transcript";

import { assembleVenuesFromKb } from "./assemble";
import { buildFallbackExperience, buildFallbackExperienceFromFacets } from "./fallback";
import { ExperienceResultSchema, type LlmExperienceV2 } from "./schema";
import type {
  ExperienceAttempt,
  ExperienceResult,
  ExperiencePhoto,
  ExperienceVenue,
} from "./types";

/** Either a real adaptive-engine transcript, or the legacy 4-answer shape (converted internally). */
export type ExperienceServiceInput = { transcript: Transcript } | QuizAnswers;

export interface ExperienceServiceDeps {
  /** Omitted (e.g. no OPENROUTER_API_KEY) to always use the local fallback. */
  llm?: StructuredClient<LlmExperienceV2>;
  images: ImageProvider;
  /** Omitted to never attach `narration` to the result (same effect as it resolving "disabled"). */
  narration?: NarrationService;
  /** Defaults to `loadKb()`. */
  kb?: Kb;
  /** Monotonic-ish millis clock, injected so tests never depend on real time. Defaults to `Date.now`. */
  now?: () => number;
  /** Wall clock for `meta.generatedAt`. Defaults to `() => new Date()`. */
  clock?: () => Date;
  /** Forwarded to `assembleVenuesFromKb`'s `isUsable`. Defaults to the process-wide `isPlacesUsable`. */
  isPlacesUsable?: () => boolean;
}

export interface ExperienceService {
  generate(input: ExperienceServiceInput): Promise<ExperienceResult>;
}

function isTranscriptInput(input: ExperienceServiceInput): input is { transcript: Transcript } {
  return "transcript" in input;
}

function toExperienceAttempt(attempt: LlmAttempt): ExperienceAttempt {
  return { model: attempt.model, outcome: attempt.outcome, durationMs: attempt.durationMs };
}

/** Up to `max` photos straight from the recommended venues' real Places/KB photo, in venue order. */
function photosFromVenues(venues: readonly ExperienceVenue[], max: number): ExperiencePhoto[] {
  const photos: ExperiencePhoto[] = [];

  for (const venue of venues) {
    if (photos.length >= max) break;
    if (!venue.photoUrl) continue;

    photos.push({
      url: venue.photoUrl,
      alt: venue.name,
      credit: venue.photoAttribution ?? venue.name,
    });
  }

  return photos;
}

/**
 * Merges the recommended venues' real photos (preferred, slots 1-2) with
 * the Unsplash/registry search results (filling the rest), deduplicated
 * by url, always resolving exactly 3 photos.
 */
function mergePhotos(
  venuePhotos: readonly ExperiencePhoto[],
  searchedPhotos: readonly ExperiencePhoto[],
): ExperiencePhoto[] {
  const result: ExperiencePhoto[] = [];
  const usedUrls = new Set<string>();

  for (const photo of [...venuePhotos, ...searchedPhotos]) {
    if (result.length >= 3) break;
    if (usedUrls.has(photo.url)) continue;
    usedUrls.add(photo.url);
    result.push(photo);
  }

  const lastSearched = searchedPhotos.at(-1);
  while (result.length < 3 && lastSearched) {
    result.push(lastSearched);
  }

  return result.slice(0, 3);
}

/** Budget `narration.ensure` gets before `generate` leaves it running in the background and reports "pending" instead. */
const NARRATION_BUDGET_MS = 8000;

/** `undefined` when there's no narration service, or it resolved "disabled" — never attached to the result either way. */
async function resolveNarration(
  narration: NarrationService | undefined,
  script: string,
): Promise<NarrationRef | undefined> {
  if (!narration) {
    return undefined;
  }

  const ref = await narration.ensure(script, { budgetMs: NARRATION_BUDGET_MS });
  return ref.status === "disabled" ? undefined : ref;
}

interface FallbackContext {
  input: ExperienceServiceInput;
  facets: Facets;
  transcript: Transcript;
  attempts?: LlmAttempt[];
  start: number;
  now: () => number;
  clock: () => Date;
}

async function buildLocalFallback(
  images: ImageProvider,
  narration: NarrationService | undefined,
  legacyAnswersForImages: QuizAnswers,
  ctx: FallbackContext,
): Promise<ExperienceResult> {
  // The legacy input path reuses `buildFallbackExperience` directly (byte-for-byte
  // the same deterministic result as before this layer), while a real adaptive
  // transcript uses the facets-keyed variant (same tables, mapped facets).
  const fallback = isTranscriptInput(ctx.input)
    ? buildFallbackExperienceFromFacets(ctx.facets, ctx.transcript)
    : buildFallbackExperience(ctx.input);

  const [photos, narrationRef] = await Promise.all([
    images.resolve(fallback.searchQueries, legacyAnswersForImages),
    resolveNarration(narration, fallback.reelScript),
  ]);

  return {
    ...fallback,
    photos,
    narration: narrationRef,
    meta: {
      model: "local-fallback",
      fallbackUsed: true,
      durationMs: ctx.now() - ctx.start,
      generatedAt: ctx.clock().toISOString(),
      promptVersion: EXPERIENCE_PROMPT_VERSION,
      attempts: ctx.attempts?.map(toExperienceAttempt),
    },
  };
}

/**
 * Builds the experience service: generates a wedding experience from the
 * couple's full adaptive-quiz transcript (or the legacy 4-answer shape,
 * converted via `transcriptFromLegacyAnswers`) and the knowledge-base
 * digest for their facets, trying the LLM (when configured) and always
 * falling back to the deterministic local experience on any failure —
 * including an LLM success whose assembled result unexpectedly fails
 * final validation. Never throws for provider failures.
 */
export function createExperienceService(deps: ExperienceServiceDeps): ExperienceService {
  const now = deps.now ?? (() => Date.now());
  const clock = deps.clock ?? (() => new Date());
  const kb = deps.kb ?? loadKb();

  return {
    async generate(input: ExperienceServiceInput): Promise<ExperienceResult> {
      const start = now();

      const transcript = isTranscriptInput(input)
        ? input.transcript
        : transcriptFromLegacyAnswers(input);
      const facets = foldFacets(transcript.entries);
      // A legacy caller already has real `QuizAnswers`; a real transcript has
      // none, so `images.resolve` (which still takes the legacy shape — see
      // `ImageProvider`) gets the closest legacy equivalent instead.
      const legacyAnswersForImages = isTranscriptInput(input)
        ? legacyAnswersFromFacets(facets)
        : input;

      const fallbackCtx: FallbackContext = { input, facets, transcript, start, now, clock };

      if (!deps.llm) {
        return buildLocalFallback(deps.images, deps.narration, legacyAnswersForImages, fallbackCtx);
      }

      const digest = buildDigest(facets, EXPERIENCE_DIGEST_OPTIONS);
      const messages = buildExperienceMessages({ transcript, facets, digest });
      const llmResult = await deps.llm.generate(messages);

      if (!llmResult.ok) {
        return buildLocalFallback(deps.images, deps.narration, legacyAnswersForImages, {
          ...fallbackCtx,
          attempts: llmResult.attempts,
        });
      }

      const venues = assembleVenuesFromKb(llmResult.value.recommendedVenues, facets, kb, {
        isUsable: deps.isPlacesUsable,
      });
      const venuePhotos = photosFromVenues(venues, 2);
      const [searchedPhotos, narration] = await Promise.all([
        deps.images.resolve(llmResult.value.searchQueries, legacyAnswersForImages),
        resolveNarration(deps.narration, llmResult.value.reelScript),
      ]);
      const photos = mergePhotos(venuePhotos, searchedPhotos);

      const candidate: ExperienceResult = {
        conceptTitle: llmResult.value.conceptTitle,
        palette: llmResult.value.colorPalette.map((color) => ({
          hex: color.hex,
          name: color.name,
        })),
        narrative: llmResult.value.narrative,
        reelTagline: llmResult.value.reelTagline,
        reelScript: llmResult.value.reelScript,
        searchQueries: llmResult.value.searchQueries,
        venues,
        photos,
        answers: isTranscriptInput(input) ? undefined : input,
        transcript,
        facets,
        itineraryHint: llmResult.value.itineraryHint,
        narration,
        meta: {
          model: llmResult.model,
          fallbackUsed: false,
          durationMs: now() - start,
          generatedAt: clock().toISOString(),
          promptVersion: EXPERIENCE_PROMPT_VERSION,
          attempts: llmResult.attempts.map(toExperienceAttempt),
          usage: llmResult.usage,
        },
      };

      const validated = ExperienceResultSchema.safeParse(candidate);
      if (validated.success) {
        return candidate;
      }

      // Defensive: the assembled result somehow failed validation (e.g. an
      // unexpected empty venues array). Fall back to the local experience
      // rather than ever returning something that doesn't match the contract.
      return buildLocalFallback(deps.images, deps.narration, legacyAnswersForImages, {
        ...fallbackCtx,
        attempts: llmResult.attempts,
      });
    },
  };
}
