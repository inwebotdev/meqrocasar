import { ExperienceResultSchema } from "@/domain/experience/schema";
import type { ExperienceResult } from "@/domain/experience/types";
import { QuizAnswersSchema } from "@/domain/quiz/schema";
import type { ApiResponse } from "@/domain/api/envelope";
import { getExperienceService } from "@/lib/experience-deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const parsed = QuizAnswersSchema.safeParse(payload);

  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "invalid_answers",
          message: "The request body doesn't match the expected quiz answers shape.",
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }

  try {
    const service = getExperienceService();
    const data: ExperienceResult = await service.generate(parsed.data);

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
