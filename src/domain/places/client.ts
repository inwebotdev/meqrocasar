import {
  PlacesApiError,
  SearchTextResponseSchema,
  type SearchTextRequest,
  type SearchTextResult,
} from "./types";

/**
 * A thin, fully-typed client over the slice of the Google Places API
 * (New) this app uses: Text Search and Photo media. Pure TypeScript: no
 * `server-only`, so it can be unit-tested and used from the ingestion
 * script (`tsx`, outside Next.js) as well as from route handlers.
 */

export interface PlacesClientConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
  /** Defaults to `10000`. */
  timeoutMs?: number;
}

export interface PhotoMediaOptions {
  /** Defaults to `800`. */
  maxWidthPx?: number;
}

export interface FetchedPhoto {
  bytes: Uint8Array;
  contentType: string;
}

export interface PlacesClient {
  searchText(request: SearchTextRequest): Promise<SearchTextResult>;
  /** Builds the (key-bearing) media URL for a photo resource name; never fetches. */
  photoMediaUrl(name: string, options?: PhotoMediaOptions): string;
  /** Fetches the photo bytes, following Google's redirect to the actual image. */
  fetchPhoto(name: string, maxWidthPx?: number): Promise<FetchedPhoto>;
}

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_WIDTH_PX = 800;
const SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.editorialSummary",
  "places.primaryType",
  "places.types",
  "places.priceLevel",
  "places.photos",
  "places.reviews",
  "nextPageToken",
].join(",");

function buildPhotoMediaUrl(apiKey: string, name: string, maxWidthPx: number): string {
  return `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
}

async function withTimeout<T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (error instanceof PlacesApiError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new PlacesApiError(0, `Places API request timed out after ${timeoutMs}ms.`);
    }
    throw new PlacesApiError(
      0,
      error instanceof Error ? error.message : "Places API request failed.",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return (
      text || response.statusText || `Places API request failed with status ${response.status}.`
    );
  } catch {
    return response.statusText || `Places API request failed with status ${response.status}.`;
  }
}

/**
 * Creates a Places (New) client. `fetchImpl` defaults to the global
 * `fetch` (overridable for tests); `timeoutMs` bounds every request,
 * including photo fetches, via `AbortController`.
 */
export function createPlacesClient(config: PlacesClientConfig): PlacesClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async searchText(req: SearchTextRequest): Promise<SearchTextResult> {
      return withTimeout(timeoutMs, async (signal) => {
        const body = {
          textQuery: req.textQuery,
          locationBias: req.locationBias,
          languageCode: req.languageCode ?? "es-MX",
          regionCode: req.regionCode ?? "MX",
          pageSize: req.pageSize ?? 20,
          ...(req.pageToken ? { pageToken: req.pageToken } : {}),
        };

        const response = await fetchImpl(SEARCH_TEXT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": config.apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify(body),
          signal,
        });

        if (!response.ok) {
          throw new PlacesApiError(response.status, await readErrorMessage(response));
        }

        const rawBody: unknown = await response.json();
        const parsed = SearchTextResponseSchema.parse(rawBody);
        return { places: parsed.places ?? [], nextPageToken: parsed.nextPageToken };
      });
    },

    photoMediaUrl(name: string, options?: PhotoMediaOptions): string {
      return buildPhotoMediaUrl(config.apiKey, name, options?.maxWidthPx ?? DEFAULT_MAX_WIDTH_PX);
    },

    async fetchPhoto(name: string, maxWidthPx = DEFAULT_MAX_WIDTH_PX): Promise<FetchedPhoto> {
      return withTimeout(timeoutMs, async (signal) => {
        const url = buildPhotoMediaUrl(config.apiKey, name, maxWidthPx);
        const response = await fetchImpl(url, { signal, redirect: "follow" });

        if (!response.ok) {
          throw new PlacesApiError(response.status, await readErrorMessage(response));
        }

        const contentType = response.headers.get("content-type") ?? "application/octet-stream";
        const buffer = await response.arrayBuffer();
        return { bytes: new Uint8Array(buffer), contentType };
      });
    },
  };
}

export { PlacesApiError } from "./types";
export type {
  Place,
  PlacesPhoto,
  PlacesReview,
  SearchTextLocationBias,
  SearchTextRequest,
  SearchTextResult,
} from "./types";
