/**
 * Process-wide circuit breaker for Google Places photos. The project's
 * `GOOGLE_PLACES_API_KEY` can be disabled on Google's side at any time
 * (the Places API itself turned off for the project returns a 403
 * `SERVICE_DISABLED`), so every codepath that would otherwise embed a
 * `/api/places/photo` URL needs a cheap, synchronous answer to "would
 * this even work right now?" — and the whole app needs to stop handing
 * out Places photo URLs once the answer is "no", rather than minting a
 * fresh batch of broken links on every request.
 *
 * Pure TypeScript (no `server-only`, no Next.js imports) so it's
 * importable from plain-domain code (`assembleVenuesFromKb`, the quiz
 * engine) as well as route handlers. The process-wide singleton below
 * reads `process.env.GOOGLE_PLACES_API_KEY` directly rather than going
 * through `src/lib/env.ts` (which is `server-only`): Next.js loads `.env`
 * into `process.env` for all server code either way, and this module
 * must stay framework-free.
 */

const DISABLE_MS = 10 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 5;

export interface PlacesFailureInfo {
  /** The upstream HTTP status, when known (e.g. `403`). */
  httpStatus?: number;
  /** Google's own `error.status` body field, when known (e.g. `"SERVICE_DISABLED"`, `"PERMISSION_DENIED"`). */
  code?: string;
}

export interface PlacesAvailability {
  /** False with no API key configured, or while temporarily disabled after a recent failure run. */
  isUsable(): boolean;
  /** Call on every upstream Places failure (bad status, network error, timeout). */
  markFailure(failure?: PlacesFailureInfo): void;
  /** Call on every upstream Places success; resets the consecutive-failure counter. */
  markSuccess(): void;
}

export interface PlacesAvailabilityDeps {
  hasApiKey: () => boolean;
  /** Monotonic-ish millis clock, injected so tests never depend on real time. Defaults to `Date.now`. */
  now?: () => number;
  /** Defaults to `console.error`; injected so tests can assert the "log once" behavior. */
  log?: (message: string) => void;
}

function isPermanentDenial(failure: PlacesFailureInfo | undefined): boolean {
  return (
    failure?.httpStatus === 403 &&
    (failure.code === "SERVICE_DISABLED" || failure.code === "PERMISSION_DENIED")
  );
}

/**
 * Builds an independent `PlacesAvailability` state machine: false from
 * `isUsable()` whenever `hasApiKey()` is false, and for 10 minutes after
 * either a 403 `SERVICE_DISABLED`/`PERMISSION_DENIED` failure or 5
 * consecutive failures of any kind (logged once per disable, via `log`).
 * Tests build their own instance with injected `hasApiKey`/`now`/`log`
 * rather than touching the process-wide singleton below.
 */
export function createPlacesAvailability(deps: PlacesAvailabilityDeps): PlacesAvailability {
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? ((message: string) => console.error(message));

  let disabledUntil: number | undefined;
  let consecutiveFailures = 0;
  let hasLoggedDisable = false;

  function disable(reason: string): void {
    disabledUntil = now() + DISABLE_MS;
    if (!hasLoggedDisable) {
      log(`[places] disabling Places photos for 10 minutes: ${reason}`);
      hasLoggedDisable = true;
    }
  }

  function recoverIfExpired(): void {
    if (disabledUntil !== undefined && now() >= disabledUntil) {
      disabledUntil = undefined;
      consecutiveFailures = 0;
      hasLoggedDisable = false;
    }
  }

  return {
    isUsable(): boolean {
      if (!deps.hasApiKey()) return false;
      recoverIfExpired();
      return disabledUntil === undefined;
    },
    markFailure(failure?: PlacesFailureInfo): void {
      consecutiveFailures += 1;

      if (isPermanentDenial(failure)) {
        disable(`${String(failure?.httpStatus)} ${String(failure?.code)}`);
        return;
      }

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        disable(`${consecutiveFailures} consecutive failures`);
      }
    },
    markSuccess(): void {
      consecutiveFailures = 0;
    },
  };
}

/**
 * The process-wide instance every caller defaults to (`assembleVenuesFromKb`,
 * the quiz engine's option photo resolution, and the Places photo proxy
 * route), so a single upstream failure disables Places photos everywhere
 * at once rather than per-module. `hasApiKey` mirrors `src/lib/env.ts`'s
 * `optionalSecret` (trimmed, empty treated as absent).
 */
const processWideAvailability = createPlacesAvailability({
  hasApiKey: () => Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim()),
});

export function isPlacesUsable(): boolean {
  return processWideAvailability.isUsable();
}

export function markPlacesFailure(failure?: PlacesFailureInfo): void {
  processWideAvailability.markFailure(failure);
}

export function markPlacesSuccess(): void {
  processWideAvailability.markSuccess();
}
