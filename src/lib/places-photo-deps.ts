import "server-only";

import { getEnv } from "./env";

export interface PlacesPhotoDeps {
  /** `undefined` when `GOOGLE_PLACES_API_KEY` isn't configured — the photo route is disabled. */
  apiKey?: string;
  cacheDir: string;
}

/**
 * The config `/api/places/photo` needs, isolated from `getEnv()` so route
 * tests can `vi.mock` this one module (per-test apiKey/cacheDir) instead
 * of fighting `getEnv()`'s process-wide memoisation.
 */
export function getPlacesPhotoDeps(): PlacesPhotoDeps {
  const env = getEnv();
  return { apiKey: env.GOOGLE_PLACES_API_KEY, cacheDir: env.PLACES_PHOTO_CACHE_DIR };
}
