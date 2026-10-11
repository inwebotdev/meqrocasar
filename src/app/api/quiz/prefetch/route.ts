import type { ApiResponse } from "@/domain/api/envelope";
import { PrefetchRequestSchema, runPrefetch, type PrefetchOutcome } from "@/domain/quiz/prefetch";
import { getEnv } from "@/lib/env";
import { getQuizEngine } from "@/lib/quiz-engine-deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse<T>(body: ApiResponse<T>, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Warms the quiz engine's step cache for every option of the step the
 * client is currently showing, so the option the couple actually picks
 * resolves as a near-instant cache hit on the next `POST /api/quiz/next`.
 * Bone-thin: all the orchestration (concurrency cap, per-call budget,
 * building each option's would-be transcript) lives in
 * `src/domain/quiz/prefetch.ts`'s `runPrefetch`.
 */
export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON body";
    return jsonResponse({ ok: false, error: { code: "invalid_json", message } }, 400);
  }

  const parsed = PrefetchRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "invalid_params",
          message: "The request body doesn't match the expected prefetch shape.",
          issues: parsed.error.issues,
        },
      },
      400,
    );
  }

  if (!getEnv().QUIZ_PREFETCH) {
    return jsonResponse(
      { ok: true, data: { warmed: 0, durationMs: 0 } satisfies PrefetchOutcome },
      200,
    );
  }

  try {
    const engine = getQuizEngine();
    const result = await runPrefetch(parsed.data, engine);
    return jsonResponse({ ok: true, data: result }, 200);
  } catch {
    return jsonResponse(
      { ok: false, error: { code: "internal", message: "Unexpected error." } },
      500,
    );
  }
}
