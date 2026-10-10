import type { ApiResponse } from "@/domain/api/envelope";
import type { QuizEngineResult } from "@/domain/quiz/engine";
import { TranscriptSchema } from "@/domain/quiz/transcript";
import { getQuizEngine } from "@/lib/quiz-engine-deps";

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

  const body = payload as { transcript?: unknown } | null;
  const parsed = TranscriptSchema.safeParse(body?.transcript);

  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "invalid_transcript",
          message: "The request body doesn't match the expected transcript shape.",
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }

  try {
    const engine = getQuizEngine();
    const result: QuizEngineResult = await engine.nextStep(parsed.data);

    return jsonResponse({ ok: true, data: result }, 200);
  } catch {
    return jsonResponse(
      { ok: false, error: { code: "internal", message: "Unexpected error." } },
      500,
    );
  }
}
