import { z } from "zod";

import { ExperienceResultSchema } from "@/domain/experience/schema";
import type { ExperienceServiceInput } from "@/domain/experience/service";
import type { ExperienceResult } from "@/domain/experience/types";
import { QuizAnswersSchema } from "@/domain/quiz/schema";
import { TranscriptSchema } from "@/domain/quiz/transcript";
import type { ApiResponse } from "@/domain/api/envelope";
import { getExperienceService } from "@/lib/experience-deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Accepts either the new transcript-based body (`{ transcript }`, up to 8
 * entries — see `TranscriptSchema`) or the legacy 4-answer body
 * (`{ style, setting, experience, mustHave }`), so older clients and
 * `quiz-client.ts`'s legacy-conversion test path both keep working.
 */
const RequestBodySchema = z.union([
  z.object({ transcript: TranscriptSchema }).strict(),
  QuizAnswersSchema,
]);

function jsonResponse<T>(body: ApiResponse<T>, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON body";
    return jsonResponse({ ok: false, error: { code: "invalid_json", message } }, 400);
  }

  const parsed = RequestBodySchema.safeParse(payload);

  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "invalid_answers",
          message: "The request body doesn't match the expected transcript or quiz answers shape.",
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }

  try {
    const service = getExperienceService();
    const input: ExperienceServiceInput = parsed.data;
    const data: ExperienceResult = await service.generate(input);

    // Defensive, should already be guaranteed by the service.
    ExperienceResultSchema.parse(data);

    return jsonResponse({ ok: true, data }, 200);
  } catch {
    return jsonResponse(
      { ok: false, error: { code: "internal", message: "Unexpected error." } },
      500,
    );
  }
}
