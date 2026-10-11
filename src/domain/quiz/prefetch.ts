import { z } from "zod";

import { FacetsSchema } from "@/domain/kb/taxonomy";

import type { QuizEngine } from "./engine";
import { TranscriptRefsSchema, TranscriptSchema, type TranscriptEntry } from "./transcript";

/**
 * Speculative prefetch: given the transcript so far and the options of the
 * step the couple is currently looking at, builds the would-be transcript
 * for each option and calls the engine's `nextStep` for all of them
 * concurrently, so whichever one gets chosen is already warm in the
 * engine's step cache (keyed by `hashTranscript`, see `engine.ts`) by the
 * time the real `/api/quiz/next` call for it comes in.
 *
 * Pure TypeScript (no Next.js, no `server-only`): `src/app/api/quiz/prefetch/route.ts`
 * is the thin HTTP wrapper that calls `runPrefetch` with the real engine
 * from `src/lib/quiz-engine-deps.ts`.
 */

export const PrefetchOptionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    facets: FacetsSchema,
    refs: TranscriptRefsSchema,
  })
  .strict();

export type PrefetchOption = z.infer<typeof PrefetchOptionSchema>;

export const PrefetchRequestSchema = z
  .object({
    transcript: TranscriptSchema,
    /** Capped to 4 below (`MAX_OPTIONS`) even if more are sent. */
    options: z.array(PrefetchOptionSchema).min(1).max(4),
    stepId: z.string().min(1),
    question: z.string().min(1),
    topic: z.string().min(1),
  })
  .strict();

export type PrefetchRequest = z.infer<typeof PrefetchRequestSchema>;

export interface PrefetchOutcome {
  warmed: number;
  durationMs: number;
}

/** Matches `GeneratedStep.options`'s own `min(3).max(4)` — there are never more options to warm than this. */
const MAX_OPTIONS = 4;
const MAX_CONCURRENCY = 4;
/**
 * Default per-call budget (overridable via `QUIZ_PREFETCH_BUDGET_MS`, see
 * `src/lib/env.ts`): how long a warm-up call is tracked before it's
 * abandoned for bookkeeping purposes. The HTTP route (`schedulePrefetch`)
 * never waits on this — it's fire-and-forget — so this budget doesn't
 * affect response latency; it just bounds how long `runPrefetch`'s own
 * promise stays open, and a call that's still running past it keeps
 * running and still warms the cache whenever it actually finishes.
 */
const PER_CALL_BUDGET_MS = 12_000;

/** Runs `tasks` with at most `limit` in flight at once, preserving result order. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index] as T, index);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

/** Resolves with `promise`'s value, or `undefined` once `budgetMs` elapses (the promise itself keeps running — it still warms the cache whenever it finishes). */
function withBudget<T>(promise: Promise<T>, budgetMs: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), budgetMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

export function buildPrefetchEntry(
  request: PrefetchRequest,
  option: PrefetchOption,
): TranscriptEntry {
  return {
    stepId: request.stepId,
    question: request.question,
    topic: request.topic,
    chosen: {
      id: option.id,
      title: option.title,
      summary: option.summary,
      facets: option.facets,
      refs: option.refs,
    },
  };
}

/**
 * Warms `engine`'s step cache for every option in `request` (concurrency
 * capped at `MAX_CONCURRENCY`, each call bounded by `PER_CALL_BUDGET_MS`).
 * `warmed` only counts calls that actually generated a fresh step
 * (`meta.cached === false`) within budget — an option whose transcript was
 * already cached, or whose call didn't finish in time, doesn't count.
 * Never throws: `engine.nextStep` already never throws, and a budget
 * timeout just resolves `undefined`.
 */
export async function runPrefetch(
  request: PrefetchRequest,
  engine: QuizEngine,
  now: () => number = Date.now,
  /** Per-call budget override, mainly for tests — defaults to `PER_CALL_BUDGET_MS`. */
  budgetMs: number = PER_CALL_BUDGET_MS,
): Promise<PrefetchOutcome> {
  const start = now();
  const options = request.options.slice(0, MAX_OPTIONS);

  const results = await mapWithConcurrency(options, MAX_CONCURRENCY, async (option) => {
    const entry = buildPrefetchEntry(request, option);
    const transcript = { entries: [...request.transcript.entries, entry] };
    return withBudget(engine.nextStep(transcript), budgetMs);
  });

  const warmed = results.filter((result) => result !== undefined && !result.meta.cached).length;

  return { warmed, durationMs: now() - start };
}

/** What `schedulePrefetch` returns: just how many options it kicked off, not whether/how they finished. */
export interface PrefetchScheduled {
  scheduled: number;
}

/**
 * Fire-and-forget entry point for `POST /api/quiz/prefetch`: immediately
 * returns how many options were scheduled to warm, without waiting on any
 * of them. `runPrefetch` keeps running in the background (not awaited
 * here) and lands its results in the engine's shared step cache — see its
 * own doc comment for the warm-up mechanics. `onSettled`, when given, is
 * called once that background work finishes (e.g. for a debug log); it
 * never affects the return value or delays it.
 */
export function schedulePrefetch(
  request: PrefetchRequest,
  engine: QuizEngine,
  now: () => number = Date.now,
  budgetMs: number = PER_CALL_BUDGET_MS,
  onSettled?: (outcome: PrefetchOutcome) => void,
): PrefetchScheduled {
  const scheduled = Math.min(request.options.length, MAX_OPTIONS);

  void runPrefetch(request, engine, now, budgetMs)
    .then((outcome) => onSettled?.(outcome))
    .catch(() => undefined);

  return { scheduled };
}
