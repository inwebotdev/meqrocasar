import {
  PlacesApiError,
  type Place,
  type PlacesClient,
  type SearchTextLocationBias,
} from "../../src/domain/places";

/**
 * Pure (no network, no fs) building blocks for `ingest-places.ts`: the
 * query plan, the keep/drop filter, dedupe, sort and the per-zone summary
 * table. Kept separate from the script entrypoint so they can be unit
 * tested directly, and so the script itself stays a thin orchestration
 * shell (rate limiting, retries, `fs.writeFile`).
 */

// --- query plan --------------------------------------------------------

/** The six category queries every zone is searched for. */
export const INGEST_CATEGORIES = [
  "hacienda para bodas",
  "viñedo bodas eventos",
  "salón de eventos para bodas",
  "hotel boutique bodas",
  "jardín para bodas",
  "casona eventos bodas",
] as const;

export type IngestCategory = (typeof INGEST_CATEGORIES)[number];

export interface IngestZone {
  id: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
}

export interface IngestQuery {
  zoneId: string;
  category: string;
  textQuery: string;
  locationBias: SearchTextLocationBias;
}

/** Builds the zone × category query plan (`zones.length * categories.length` queries). */
export function buildQueryPlan(
  zones: readonly IngestZone[],
  categories: readonly string[] = INGEST_CATEGORIES,
): IngestQuery[] {
  const queries: IngestQuery[] = [];

  for (const zone of zones) {
    for (const category of categories) {
      queries.push({
        zoneId: zone.id,
        category,
        textQuery: `${category} en ${zone.id.replace(/_/g, " ")}, Querétaro`,
        locationBias: {
          circle: {
            center: { latitude: zone.center.lat, longitude: zone.center.lng },
            radius: zone.radiusMeters,
          },
        },
      });
    }
  }

  return queries;
}

// --- keep/drop filter ---------------------------------------------------

/** Place types that indicate a real wedding-adjacent venue or landmark. */
export const ALLOWED_PLACE_TYPES = [
  "wedding_venue",
  "event_venue",
  "banquet_hall",
  "hotel",
  "resort_hotel",
  "lodging",
  "winery",
  "vineyard",
  "park",
  "garden",
  "restaurant",
  "tourist_attraction",
  "historical_landmark",
] as const;

const ALLOWED_PLACE_TYPES_SET = new Set<string>(ALLOWED_PLACE_TYPES);

/** Place types indicating a wedding/event-capable use, used to rescue an otherwise-noisy type (e.g. `church`). */
const EVENT_CAPABLE_TYPES = new Set(["wedding_venue", "event_venue", "banquet_hall"]);

const NOISE_TYPES = new Set(["store", "school"]);

function placeTypes(place: Place): string[] {
  const types = place.types ?? [];
  return place.primaryType ? [place.primaryType, ...types] : types;
}

/** True when `place` carries at least one type from `ALLOWED_PLACE_TYPES`. */
export function hasAllowedType(place: Place): boolean {
  return placeTypes(place).some((type) => ALLOWED_PLACE_TYPES_SET.has(type));
}

/** True when `place` looks like noise: a plain store/school, a car-related business, or a church with no event/banquet type. */
export function isNoisyPlace(place: Place): boolean {
  const types = placeTypes(place);

  if (types.some((type) => NOISE_TYPES.has(type) || type.startsWith("car_"))) {
    return true;
  }

  const isChurch = types.includes("church");
  const isEventCapable = types.some((type) => EVENT_CAPABLE_TYPES.has(type));
  if (isChurch && !isEventCapable) {
    return true;
  }

  return false;
}

export interface KeepPlaceOptions {
  /** Defaults to `20`. */
  minUserRatingCount?: number;
}

/** The combined keep rule: rated enough, a real venue/landmark type, and not noise. */
export function keepPlace(place: Place, options: KeepPlaceOptions = {}): boolean {
  const minUserRatingCount = options.minUserRatingCount ?? 20;

  if ((place.userRatingCount ?? 0) < minUserRatingCount) {
    return false;
  }

  return hasAllowedType(place) && !isNoisyPlace(place);
}

/** Filters `places` down to the ones worth keeping (see `keepPlace`). */
export function filterPlaces(places: readonly Place[], options: KeepPlaceOptions = {}): Place[] {
  return places.filter((place) => keepPlace(place, options));
}

// --- dedupe + sort --------------------------------------------------------

/** Deduplicates by `id`, keeping the first occurrence's data (insertion order preserved). */
export function dedupePlaces(places: readonly Place[]): Place[] {
  const byId = new Map<string, Place>();

  for (const place of places) {
    if (!byId.has(place.id)) {
      byId.set(place.id, place);
    }
  }

  return [...byId.values()];
}

/** Sorts by `userRatingCount` descending (places with no count sort last), stable otherwise. */
export function sortPlacesByRatingCount(places: readonly Place[]): Place[] {
  return [...places].sort((a, b) => (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0));
}

// --- summary table --------------------------------------------------------

export interface ZoneSummaryRow {
  zoneId: string;
  count: number;
}

/** Counts, per zone, how many of `places` were kept for that zone's queries. */
export function summarizeByZone(
  zoneIds: readonly string[],
  placesByZone: ReadonlyMap<string, readonly Place[]>,
): ZoneSummaryRow[] {
  return zoneIds.map((zoneId) => ({ zoneId, count: placesByZone.get(zoneId)?.length ?? 0 }));
}

/** Renders a fixed-width "zone | count" table for console output. */
export function formatSummaryTable(rows: readonly ZoneSummaryRow[]): string {
  const zoneWidth = Math.max(4, ...rows.map((row) => row.zoneId.length));
  const header = `${"Zone".padEnd(zoneWidth)}  Count`;
  const separator = `${"-".repeat(zoneWidth)}  -----`;
  const lines = rows.map((row) => `${row.zoneId.padEnd(zoneWidth)}  ${String(row.count)}`);
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return [header, separator, ...lines, separator, `${"Total".padEnd(zoneWidth)}  ${total}`].join(
    "\n",
  );
}

// --- orchestration (network, but injected) --------------------------------

export interface RunIngestOptions {
  zones: readonly IngestZone[];
  categories?: readonly string[];
  /** Defaults to `20`. */
  minUserRatingCount?: number;
  /** Max pages (`searchText` calls) per zone × category query. Defaults to `2`. */
  maxPagesPerQuery?: number;
  /** Minimum delay between successive `searchText` calls, in ms. Defaults to `200` (~5 req/s). */
  rateLimitMs?: number;
  /** Extra attempts after a 429/5xx, with linear backoff. Defaults to `2`. */
  maxRetries?: number;
  /** Defaults to `() => new Date()`. */
  now?: () => Date;
  /** Defaults to the real `setTimeout`-based sleep; tests override to skip delays. */
  sleep?: (ms: number) => Promise<void>;
}

export interface RunIngestResult {
  fetchedAt: string;
  queries: number;
  places: Place[];
  summary: ZoneSummaryRow[];
}

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function searchTextWithRetry(
  client: PlacesClient,
  request: Parameters<PlacesClient["searchText"]>[0],
  maxRetries: number,
  sleep: (ms: number) => Promise<void>,
) {
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await client.searchText(request);
    } catch (error) {
      const retryable = error instanceof PlacesApiError && isRetryableStatus(error.status);
      if (!retryable || attempt >= maxRetries) {
        throw error;
      }
      attempt += 1;
      await sleep(attempt * 500);
    }
  }
}

/**
 * Runs the full zone × category ingestion against `client`: for every
 * query, up to `maxPagesPerQuery` pages, rate-limited and retried on
 * 429/5xx. Returns the deduped, filtered, rating-sorted place list plus a
 * per-zone kept-count summary. Network access is entirely through
 * `client`, so this is deterministic and offline-testable under MSW.
 */
export async function runIngest(
  client: PlacesClient,
  options: RunIngestOptions,
): Promise<RunIngestResult> {
  const categories = options.categories ?? INGEST_CATEGORIES;
  const maxPagesPerQuery = options.maxPagesPerQuery ?? 2;
  const rateLimitMs = options.rateLimitMs ?? 200;
  const maxRetries = options.maxRetries ?? 2;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;

  const plan = buildQueryPlan(options.zones, categories);
  const placesByZone = new Map<string, Place[]>();
  let queryCount = 0;
  let isFirstRequest = true;

  for (const query of plan) {
    let pageToken: string | undefined;
    const kept = placesByZone.get(query.zoneId) ?? [];

    for (let page = 0; page < maxPagesPerQuery; page += 1) {
      if (!isFirstRequest) {
        await sleep(rateLimitMs);
      }
      isFirstRequest = false;
      queryCount += 1;

      const response = await searchTextWithRetry(
        client,
        {
          textQuery: query.textQuery,
          locationBias: query.locationBias,
          pageToken,
        },
        maxRetries,
        sleep,
      );

      kept.push(
        ...filterPlaces(response.places, { minUserRatingCount: options.minUserRatingCount }),
      );

      if (!response.nextPageToken) break;
      pageToken = response.nextPageToken;
    }

    placesByZone.set(query.zoneId, kept);
  }

  const zoneIds = options.zones.map((zone) => zone.id);
  const summary = summarizeByZone(zoneIds, placesByZone);

  const allPlaces = dedupePlaces([...placesByZone.values()].flat());
  const sorted = sortPlacesByRatingCount(allPlaces);

  return {
    fetchedAt: now().toISOString(),
    queries: queryCount,
    places: sorted,
    summary,
  };
}
