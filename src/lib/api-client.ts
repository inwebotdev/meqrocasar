import { ExperienceResultSchema } from "@/domain/experience/schema";
import type { ExperienceResult } from "@/domain/experience/types";
import type { ApiErrorCode, ApiResponse } from "@/domain/api/envelope";
import type { QuizAnswers } from "@/domain/quiz/schema";

export type ApiClientErrorCode = ApiErrorCode | "network" | "invalid_response";

export class ApiClientError extends Error {
  code: ApiClientErrorCode;
  status?: number;

  constructor(params: { code: ApiClientErrorCode; status?: number; message: string }) {
    super(params.message);
    this.name = "ApiClientError";
    this.code = params.code;
    this.status = params.status;
  }
}

export type FetchLike = typeof fetch;

/**
 * Calls `POST /api/generate-experience` with the quiz answers, validates
 * the response envelope and the `data` payload, and returns the parsed
 * `ExperienceResult`. Throws `ApiClientError` for every failure mode
 * (network failure, non-ok envelope, or a payload that doesn't match
 * `ExperienceResultSchema`).
 */
export async function generateExperience(
  answers: QuizAnswers,
  fetchImpl: FetchLike = fetch,
): Promise<ExperienceResult> {
  let response: Response;

  try {
    response = await fetchImpl("/api/generate-experience", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(answers),
    });
  } catch {
    throw new ApiClientError({ code: "network", message: "No se pudo conectar con el servidor." });
  }

  let envelope: ApiResponse<unknown>;

  try {
    envelope = (await response.json()) as ApiResponse<unknown>;
  } catch {
    throw new ApiClientError({
      code: "invalid_response",
      status: response.status,
      message: "La respuesta del servidor no es un JSON válido.",
    });
  }

  if (!envelope.ok) {
    throw new ApiClientError({
      code: envelope.error.code,
      status: response.status,
      message: envelope.error.message,
    });
  }

  const parsed = ExperienceResultSchema.safeParse(envelope.data);

  if (!parsed.success) {
    throw new ApiClientError({
      code: "invalid_response",
      status: response.status,
      message: "La respuesta del servidor no coincide con el formato esperado.",
    });
  }

  return parsed.data;
}
