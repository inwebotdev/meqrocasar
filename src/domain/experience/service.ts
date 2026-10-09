import type { LlmAttempt, LlmFailure, LlmSuccess } from "@/domain/ai/openrouter";
import { SYSTEM_PROMPT_VERSION } from "@/domain/ai/prompt";
import type { ImageProvider } from "@/domain/images/provider";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { assembleVenues, buildFallbackExperience } from "./fallback";
import { ExperienceResultSchema } from "./schema";
import type { ExperienceAttempt, ExperienceResult } from "./types";

export interface ExperienceLlm {
  generate(answers: QuizAnswers): Promise<LlmSuccess | LlmFailure>;
}

export interface ExperienceServiceDeps {
  /** Omitted (e.g. no OPENROUTER_API_KEY) to always use the local fallback. */
  llm?: ExperienceLlm;
  images: ImageProvider;
  /** Monotonic-ish millis clock, injected so tests never depend on real time. Defaults to `Date.now`. */
  now?: () => number;
  /** Wall clock for `meta.generatedAt`. Defaults to `() => new Date()`. */
  clock?: () => Date;
}

export interface ExperienceService {
  generate(answers: QuizAnswers): Promise<ExperienceResult>;
}

function toExperienceAttempt(attempt: LlmAttempt): ExperienceAttempt {
  return { model: attempt.model, outcome: attempt.outcome, durationMs: attempt.durationMs };
}

interface FallbackContext {
  attempts?: LlmAttempt[];
  start: number;
  now: () => number;
  clock: () => Date;
}

async function buildLocalFallback(
  answers: QuizAnswers,
  images: ImageProvider,
  ctx: FallbackContext,
): Promise<ExperienceResult> {
  const fallback = buildFallbackExperience(answers);
  const photos = await images.resolve(fallback.searchQueries, answers);

  return {
    ...fallback,
    photos,
    meta: {
      model: "local-fallback",
      fallbackUsed: true,
      durationMs: ctx.now() - ctx.start,
      generatedAt: ctx.clock().toISOString(),
      promptVersion: SYSTEM_PROMPT_VERSION,
      attempts: ctx.attempts?.map(toExperienceAttempt),
    },
  };
}

/**
 * Builds the experience service: generates a wedding experience from quiz
 * answers, trying the LLM (when configured) and always falling back to the
 * deterministic local experience on any failure — including an LLM
 * success whose assembled result unexpectedly fails final validation.
 * Never throws for provider failures.
 */
export function createExperienceService(deps: ExperienceServiceDeps): ExperienceService {
  const now = deps.now ?? (() => Date.now());
  const clock = deps.clock ?? (() => new Date());

  return {
    async generate(answers: QuizAnswers): Promise<ExperienceResult> {
      const start = now();

      if (!deps.llm) {
        return buildLocalFallback(answers, deps.images, { start, now, clock });
      }

      const llmResult = await deps.llm.generate(answers);

      if (!llmResult.ok) {
        return buildLocalFallback(answers, deps.images, {
          attempts: llmResult.attempts,
          start,
          now,
          clock,
        });
      }

      const photos = await deps.images.resolve(llmResult.value.searchQueries, answers);

      const candidate: ExperienceResult = {
        conceptTitle: llmResult.value.conceptTitle,
        palette: llmResult.value.colorPalette.map((color) => ({
          hex: color.hex,
          name: color.name,
        })),
        narrative: llmResult.value.narrative,
        reelTagline: llmResult.value.reelTagline,
        searchQueries: llmResult.value.searchQueries,
        venues: assembleVenues(llmResult.value.recommendedVenues, answers),
        photos,
        answers,
        meta: {
          model: llmResult.model,
          fallbackUsed: false,
          durationMs: now() - start,
          generatedAt: clock().toISOString(),
          promptVersion: SYSTEM_PROMPT_VERSION,
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
      return buildLocalFallback(answers, deps.images, {
        attempts: llmResult.attempts,
        start,
        now,
        clock,
      });
    },
  };
}
