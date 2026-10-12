import { http } from "msw";
import type { RequestHandler } from "msw";

export const handlers: RequestHandler[] = [];

export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterRequestInfo {
  request: Request;
  /** Parsed JSON request body (includes `model`, `messages`, etc). */
  body: Record<string, unknown>;
  /** 1-based index of this call, scoped to this handler instance. */
  callIndex: number;
}

/**
 * Builds a request-body-aware MSW handler for OpenRouter's chat-completions
 * endpoint. `respond` receives the parsed body (so it can branch on
 * `body.model`) and a per-handler call counter (so tests can assert how
 * many times each model was called, and what the Nth call's body looked
 * like, e.g. to check a correction turn was appended on retry).
 */
export function mockOpenRouterChat(
  respond: (info: OpenRouterRequestInfo) => Promise<Response> | Response,
): RequestHandler {
  let callIndex = 0;

  return http.post(OPENROUTER_CHAT_COMPLETIONS_URL, async ({ request }) => {
    callIndex += 1;
    const body = (await request.clone().json()) as Record<string, unknown>;
    return respond({ request, body, callIndex });
  });
}

export const PLACES_SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";

export interface PlacesSearchTextRequestInfo {
  request: Request;
  /** Parsed JSON request body (`textQuery`, `locationBias`, `pageToken`, …). */
  body: Record<string, unknown>;
  /** 1-based index of this call, scoped to this handler instance. */
  callIndex: number;
}

/**
 * Builds a request-body-aware MSW handler for the Places API (New) Text
 * Search endpoint. `respond` receives the parsed body (so it can branch on
 * `body.pageToken`) and a per-handler call counter (so tests can assert
 * paging across calls).
 */
export function mockPlacesSearchText(
  respond: (info: PlacesSearchTextRequestInfo) => Promise<Response> | Response,
): RequestHandler {
  let callIndex = 0;

  return http.post(PLACES_SEARCH_TEXT_URL, async ({ request }) => {
    callIndex += 1;
    const body = (await request.clone().json()) as Record<string, unknown>;
    return respond({ request, body, callIndex });
  });
}

export interface PlacesPhotoMediaRequestInfo {
  request: Request;
  /** 1-based index of this call, scoped to this handler instance. */
  callIndex: number;
}

/**
 * Builds an MSW handler for the Places API (New) photo media endpoint
 * (`GET /v1/{photo resource name}/media`). Matches any resource name so
 * tests can assert the request was made without hand-building the path.
 */
export function mockPlacesPhotoMedia(
  respond: (info: PlacesPhotoMediaRequestInfo) => Promise<Response> | Response,
): RequestHandler {
  let callIndex = 0;

  return http.get("https://places.googleapis.com/v1/*", ({ request }) => {
    callIndex += 1;
    return respond({ request, callIndex });
  });
}

export const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";

export interface UnsplashRequestInfo {
  request: Request;
  query: string | null;
  /** 1-based index of this call, scoped to this handler instance. */
  callIndex: number;
}

/**
 * Builds a query-aware MSW handler for Unsplash's search/photos endpoint.
 * `respond` receives the `query` search param (so it can return a
 * different fixture per query) and a per-handler call counter (so tests
 * can assert how many requests were made at all, e.g. to prove the static
 * provider never hits the network).
 */
export function mockUnsplashSearch(
  respond: (info: UnsplashRequestInfo) => Promise<Response> | Response,
): RequestHandler {
  let callIndex = 0;

  return http.get(UNSPLASH_SEARCH_URL, ({ request }) => {
    callIndex += 1;
    const query = new URL(request.url).searchParams.get("query");
    return respond({ request, query, callIndex });
  });
}

export const ELEVENLABS_TTS_URL_PATTERN =
  "https://api.elevenlabs.io/v1/text-to-speech/:voiceId/with-timestamps";

export interface ElevenLabsTtsRequestInfo {
  request: Request;
  /** Parsed JSON request body (`text`, `model_id`, `voice_settings`, …). */
  body: Record<string, unknown>;
  /** The `:voiceId` path param. */
  voiceId: string;
  /** 1-based index of this call, scoped to this handler instance. */
  callIndex: number;
}

/**
 * Builds a request-body-aware MSW handler for ElevenLabs'
 * `POST /v1/text-to-speech/{voiceId}/with-timestamps` endpoint. `respond`
 * receives the parsed body and the `voiceId` path param, so a test can
 * assert on either and return a fixture `{ audio_base64, alignment }`
 * response (or an error status).
 */
export function mockElevenLabsTts(
  respond: (info: ElevenLabsTtsRequestInfo) => Promise<Response> | Response,
): RequestHandler {
  let callIndex = 0;

  return http.post(ELEVENLABS_TTS_URL_PATTERN, async ({ request, params }) => {
    callIndex += 1;
    const body = (await request.clone().json()) as Record<string, unknown>;
    const voiceId = Array.isArray(params.voiceId) ? params.voiceId[0]! : params.voiceId;
    return respond({ request, body, voiceId, callIndex });
  });
}
