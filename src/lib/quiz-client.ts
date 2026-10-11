import { z } from "zod";

import type { ApiResponse } from "@/domain/api/envelope";
import { ExperienceResultSchema } from "@/domain/experience/schema";
import type { ExperienceResult } from "@/domain/experience/types";
import type { QuizEngineResult } from "@/domain/quiz/engine";
import { ResolvedStepSchema } from "@/domain/quiz/generated-step";
import { transcriptToLegacyAnswers, type Transcript } from "@/domain/quiz/transcript";

import { ApiClientError, type ApiClientErrorCode, type FetchLike } from "./api-client";

export { ApiClientError, type ApiClientErrorCode, type FetchLike };

/**
 * Client for the adaptive quiz engine: `fetchNextStep` drives
 * `POST /api/quiz/next`, `generateExperienceFromTranscript` drives
 * `POST /api/generate-experience` with a transcript-shaped body, falling
 * back to the legacy `QuizAnswers` shape when the route doesn't accept it
 * yet. Same error-handling shape as `api-client.ts` (`ApiClientError`,
 * reused here rather than duplicated).
 */

const QuizEngineMetaSchema = z.object({
  model: z.string(),
  durationMs: z.number(),
  cached: z.boolean(),
  fallbackUsed: z.boolean(),
  source: z.enum(["llm", "static"]),
  attempts: z.number(),
  usage: z.object({ promptTokens: z.number(), completionTokens: z.number() }).optional(),
  costUsd: z.number().optional(),
  promptVersion: z.string(),
  normalisations: z.number(),
});

const QuizNextResultSchema = z.discriminatedUnion("done", [
  z.object({ done: z.literal(true), meta: QuizEngineMetaSchema }),
  z.object({ done: z.literal(false), step: ResolvedStepSchema, meta: QuizEngineMetaSchema }),
]);

interface Envelope {
  envelope: ApiResponse<unknown>;
  status: number;
}

async function postJson(url: string, body: unknown, fetchImpl: FetchLike): Promise<Envelope> {
  let response: Response;

  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError({ code: "network", message: "No se pudo conectar con el servidor." });
  }

  try {
    const envelope = (await response.json()) as ApiResponse<unknown>;
    return { envelope, status: response.status };
  } catch {
    throw new ApiClientError({
      code: "invalid_response",
      status: response.status,
      message: "La respuesta del servidor no es un JSON válido.",
    });
  }
}

/**
 * Calls `POST /api/quiz/next` with the transcript so far and returns the
 * validated `QuizEngineResult` (either `{ done: true }` or the next
 * `ResolvedStep`). Throws `ApiClientError` for every failure mode.
 */
export async function fetchNextStep(
  transcript: Transcript,
  fetchImpl: FetchLike = fetch,
): Promise<QuizEngineResult> {
  const { envelope, status } = await postJson("/api/quiz/next", { transcript }, fetchImpl);

  if (!envelope.ok) {
    throw new ApiClientError({
      code: envelope.error.code,
      status,
      message: envelope.error.message,
    });
  }

  const parsed = QuizNextResultSchema.safeParse(envelope.data);

  if (!parsed.success) {
    throw new ApiClientError({
      code: "invalid_response",
      status,
      message: "La respuesta del servidor no coincide con el formato esperado.",
    });
  }

  return parsed.data;
}

async function postGenerateExperience(
  body: unknown,
  fetchImpl: FetchLike,
): Promise<ExperienceResult> {
  const { envelope, status } = await postJson("/api/generate-experience", body, fetchImpl);

  if (!envelope.ok) {
    throw new ApiClientError({
      code: envelope.error.code,
      status,
      message: envelope.error.message,
    });
  }

  const parsed = ExperienceResultSchema.safeParse(envelope.data);

  if (!parsed.success) {
    throw new ApiClientError({
      code: "invalid_response",
      status,
      message: "La respuesta del servidor no coincide con el formato esperado.",
    });
  }

  return parsed.data;
}

/**
 * Calls `POST /api/generate-experience` with `{ transcript }`. While that
 * route still only accepts the legacy `QuizAnswers` body, it responds 400
 * `invalid_answers`; on exactly that failure, this retries once with
 * `transcriptToLegacyAnswers(transcript)` instead. Any other failure (network,
 * a different error code, an invalid payload) propagates as-is.
 */
export async function generateExperienceFromTranscript(
  transcript: Transcript,
  fetchImpl: FetchLike = fetch,
): Promise<ExperienceResult> {
  try {
    return await postGenerateExperience({ transcript }, fetchImpl);
  } catch (error) {
    const shouldFallBack =
      error instanceof ApiClientError && error.status === 400 && error.code === "invalid_answers";

    if (!shouldFallBack) {
      throw error;
    }

    return postGenerateExperience(transcriptToLegacyAnswers(transcript), fetchImpl);
  }
}
