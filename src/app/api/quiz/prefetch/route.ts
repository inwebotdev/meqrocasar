import type { ApiResponse } from "@/domain/api/envelope";
import {
  PrefetchRequestSchema,
  schedulePrefetch,
  type PrefetchScheduled,
} from "@/domain/quiz/prefetch";
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
 * Fire-and-forget: responds with `{ scheduled }` as soon as the warm-up
 * calls are kicked off, never waiting on them (a slow/hanging LLM call
 * must never add latency to the step the couple is currently looking
 * at). All the orchestration (concurrency cap, per-call budget, building
 * each option's would-be transcript) lives in
 * `src/domain/quiz/prefetch.ts`'s `schedulePrefetch`/`runPrefetch`.
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
    return jsonResponse({ ok: true, data: { scheduled: 0 } satisfies PrefetchScheduled }, 200);
  }

  try {
    const engine = getQuizEngine();
    const scheduled = schedulePrefetch(
      parsed.data,
      engine,
      undefined,
      getEnv().QUIZ_PREFETCH_BUDGET_MS,
      (outcome) => {
        // Background-only: lets `kool run dev` logs confirm warm-ups are
        // actually landing in the cache without the response waiting on them.
        console.debug(
          `[quiz/prefetch] warmed ${outcome.warmed}/${scheduled.scheduled} option(s) in ${outcome.durationMs}ms`,
        );
      },
    );
    return jsonResponse({ ok: true, data: scheduled }, 200);
  } catch {
    return jsonResponse(
      { ok: false, error: { code: "internal", message: "Unexpected error." } },
      500,
    );
  }
}
