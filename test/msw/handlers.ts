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
