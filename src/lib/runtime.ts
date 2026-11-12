import os from "node:os";
import path from "node:path";

import { waitUntil } from "@vercel/functions";

/** True on the Vercel platform (it sets `VERCEL=1`); false in the local Docker setup. */
export function isVercel(): boolean {
  return process.env.VERCEL === "1";
}

/** Default cache directory for `sub`: `.cache/<sub>` locally, a `/tmp`-based path on Vercel (the only writable disk there). */
export function defaultCacheDir(sub: string): string {
  return isVercel() ? path.join(os.tmpdir(), "meqrocasar", sub) : `.cache/${sub}`;
}

/**
 * Keeps `promise` running after the response is sent: `waitUntil` on
 * Vercel (otherwise the function is frozen), plain fire-and-forget locally.
 * Rejections are logged, never thrown.
 */
export function runInBackground(promise: Promise<unknown>): void {
  const guarded = promise.catch((error: unknown) => {
    console.error("[runtime] background task failed", error);
  });

  if (isVercel()) {
    try {
      waitUntil(guarded);
      return;
    } catch (error) {
      console.error("[runtime] waitUntil unavailable", error);
    }
  }

  void guarded;
}
