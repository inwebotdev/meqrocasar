import { z } from "zod";

/**
 * `NarrationRefSchema`/`NarrationRef` only — split out of `service.ts` so
 * that importing them (e.g. from `@/domain/experience/schema.ts`, which
 * `src/lib/quiz-client.ts` pulls into the browser bundle to validate API
 * responses) never drags in `createNarrationService`'s server-only
 * dependency graph (`./narration-hash.ts` → `node:crypto`, `./store.ts` →
 * `node:fs`). This module itself is pure TypeScript + Zod: no React, no
 * Next.js, no `server-only`, no Node builtins.
 */

const NarrationSentenceRefSchema = z.object({
  text: z.string(),
  startSec: z.number(),
  endSec: z.number(),
});

export const NarrationRefSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    hash: z.string().regex(/^[0-9a-f]{64}$/),
    src: z.string().min(1),
    durationSec: z.number().nonnegative(),
    sentences: z.array(NarrationSentenceRefSchema),
  }),
  z.object({
    status: z.literal("pending"),
    hash: z.string().regex(/^[0-9a-f]{64}$/),
    src: z.string().min(1),
  }),
  z.object({
    status: z.literal("disabled"),
  }),
]);

/** What `NarrationService.ensure` resolves to — see `service.ts`'s module doc comment for each state. */
export type NarrationRef = z.infer<typeof NarrationRefSchema>;
