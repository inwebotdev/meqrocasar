import { estimateDurationSec, sentenceTimings, type NarrationProvider } from "./narration";
import { narrationHash } from "./narration-hash";
import { NarrationRefSchema, type NarrationRef } from "./narration-ref";
import { runInBackground } from "@/lib/runtime";

import type { NarrationStore } from "./store";

/**
 * Re-exported from `./narration-ref` (not declared here) so that
 * `@/domain/experience/schema.ts` — pulled into the browser bundle by
 * `src/lib/quiz-client.ts` — can import the schema/type without dragging
 * in this file's own server-only imports above (`node:crypto` via
 * `./narration-hash`, `node:fs` via `./store`). Import `NarrationRefSchema`/
 * `NarrationRef` from `./narration-ref` directly in any client-reachable
 * module; this re-export exists only for already-server-only callers that
 * found it here first (`createNarrationService` itself, `narration-deps.ts`).
 */
export { NarrationRefSchema };
export type { NarrationRef };

export interface NarrationEnsureOptions {
  /** How long `ensure` waits for a fresh synthesis before reporting `"pending"` instead (the synthesis itself keeps running in the background either way). */
  budgetMs: number;
}

export interface NarrationService {
  /**
   * Resolves the `NarrationRef` for `script`: a cache hit (keyed by
   * `narrationHash({ voiceId, modelId, text: script })`) resolves
   * `"ready"` immediately with no network call; otherwise synthesis is
   * started (single-flight per hash) and awaited up to `budgetMs` — done
   * in time resolves `"ready"`, otherwise `"pending"` while the synthesis
   * keeps running in the background and writes the cache when it
   * finishes. No provider configured (no API key/voice id) always
   * resolves `"disabled"` without ever touching the store.
   */
  ensure(script: string, options: NarrationEnsureOptions): Promise<NarrationRef>;
}

export interface NarrationServiceDeps {
  /** Omitted (no `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID`) to always resolve `"disabled"`. */
  provider?: NarrationProvider;
  store: NarrationStore;
  /** The voice/model the cache hash and the stored meta are keyed by — must match what `provider` actually uses. */
  voiceId: string;
  modelId: string;
  /** Wall clock for `meta.createdAt`. Defaults to `() => new Date()`. */
  now?: () => Date;
}

/** Rough reading-speed fallback (chars/sec) for a provider that didn't return per-character alignment — ElevenLabs' `with-timestamps` endpoint always does, so this only matters for a hypothetical alignment-less `NarrationProvider`. */
const FALLBACK_CHARS_PER_SECOND = 15;

function estimateDurationFromText(text: string): number {
  return Math.max(text.length / FALLBACK_CHARS_PER_SECOND, 1);
}

/** Resolves with `promise`'s value, or `undefined` once `budgetMs` elapses (the promise itself keeps running). */
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

export function createNarrationService(deps: NarrationServiceDeps): NarrationService {
  const now = deps.now ?? (() => new Date());
  /** Single-flight per hash: a synthesis already running for a hash is reused instead of started twice. */
  const inFlight = new Map<string, Promise<void>>();

  async function synthesize(
    hash: string,
    script: string,
    provider: NarrationProvider,
  ): Promise<void> {
    try {
      const audio = await provider.synthesize(script);
      const durationSec = audio.alignment
        ? estimateDurationSec(audio.alignment)
        : estimateDurationFromText(script);
      const sentences = sentenceTimings(script, audio.alignment, durationSec);

      await deps.store.put(hash, audio.audio, {
        script,
        voiceId: deps.voiceId,
        modelId: deps.modelId,
        durationSec,
        sentences,
        createdAt: now().toISOString(),
      });
    } catch (error) {
      console.error("[audio/service] narration synthesis failed", error);
      await deps.store.clearPending(hash);
    }
  }

  function startSynthesis(
    hash: string,
    script: string,
    provider: NarrationProvider,
  ): Promise<void> {
    const existing = inFlight.get(hash);
    if (existing) {
      return existing;
    }

    const task = (async () => {
      await deps.store.markPending(hash);
      await synthesize(hash, script, provider);
    })().finally(() => {
      inFlight.delete(hash);
    });

    inFlight.set(hash, task);
    return task;
  }

  return {
    async ensure(script, { budgetMs }) {
      if (!deps.provider) {
        return { status: "disabled" };
      }

      const hash = narrationHash({ voiceId: deps.voiceId, modelId: deps.modelId, text: script });
      const src = `/api/narration/${hash}`;

      const cached = await deps.store.get(hash);
      if (cached) {
        return {
          status: "ready",
          hash,
          src,
          durationSec: cached.meta.durationSec,
          sentences: cached.meta.sentences,
        };
      }

      const task = startSynthesis(hash, script, deps.provider);
      // Keep the synthesis alive past the response on serverless (waitUntil).
      runInBackground(task);
      await withBudget(task, budgetMs);

      const finished = await deps.store.get(hash);
      if (finished) {
        return {
          status: "ready",
          hash,
          src,
          durationSec: finished.meta.durationSec,
          sentences: finished.meta.sentences,
        };
      }

      return { status: "pending", hash, src };
    },
  };
}
