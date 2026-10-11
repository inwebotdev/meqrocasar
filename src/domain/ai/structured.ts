import { z } from "zod";

import { extractJsonObject } from "./parse";

/**
 * Generic structured-output OpenRouter client: given a Zod schema, a
 * matching JSON Schema (for `response_format`) and a list of chat
 * messages, calls OpenRouter and returns a value validated against the
 * schema, following a fixed fallback ladder (see `createStructuredClient`).
 *
 * `src/lib/experience-deps.ts`/`src/lib/quiz-engine-deps.ts` (the
 * wedding-experience and quiz-step clients) and `scripts/kb/enrich-lib.ts`
 * (the knowledge-base enrichment client) all build their
 * `StructuredClient` straight from this module, schema-specific.
 */

export interface OpenRouterConfig {
  apiKey: string;
  primaryModel: string;
  fallbackModel: string;
  timeoutMs: number;
  appUrl: string;
  appTitle: string;
  /** Defaults to `https://openrouter.ai/api/v1`. */
  baseUrl?: string;
  /**
   * Optional provider routing order (e.g. `["Cerebras", "Groq"]`), sent as
   * `provider: { order, allow_fallbacks: true }` so OpenRouter tries the
   * listed providers first (for speed) but still falls back to any other
   * provider rather than failing outright. Omitted/empty leaves provider
   * selection to OpenRouter's own defaults.
   */
  providerOrder?: string[];
}

export type LlmOutcome =
  "ok" | "http-error" | "timeout" | "network" | "no-json" | "invalid-json" | "schema";

export interface LlmAttempt {
  model: string;
  outcome: LlmOutcome;
  status?: number;
  durationMs: number;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StructuredSuccess<T> {
  ok: true;
  value: T;
  model: string;
  attempts: LlmAttempt[];
  usage?: LlmUsage;
}

export interface StructuredFailure {
  ok: false;
  attempts: LlmAttempt[];
}

export interface StructuredClient<T> {
  generate(messages: ChatMessage[]): Promise<StructuredSuccess<T> | StructuredFailure>;
}

export interface CreateStructuredClientOptions<T> {
  config: OpenRouterConfig;
  schema: z.ZodType<T>;
  /** JSON Schema describing `schema`, passed verbatim as `response_format.json_schema.schema`. */
  jsonSchema: Record<string, unknown>;
  /** `response_format.json_schema.name`. */
  name: string;
  /** Defaults to `0.3`. */
  temperature?: number;
  /** Defaults to `1500`. */
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 1500;

const CORRECTABLE_OUTCOMES: readonly LlmOutcome[] = ["no-json", "invalid-json", "schema"];

// --- OpenRouter response shape (defensive, never throws on surprises) -----

const ContentPartSchema = z
  .object({
    text: z.string().optional(),
  })
  .loose();

const MessageSchema = z
  .object({
    content: z.union([z.string(), z.array(ContentPartSchema)]).optional(),
  })
  .loose();

const ChoiceSchema = z
  .object({
    message: MessageSchema.optional(),
  })
  .loose();

const UsageSchema = z
  .object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
  })
  .loose();

const OpenRouterResponseSchema = z
  .object({
    choices: z.array(ChoiceSchema).optional(),
    usage: UsageSchema.optional(),
  })
  .loose();

function extractContent(content: string | Array<{ text?: string }> | undefined): string {
  if (content === undefined) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  return content.map((part) => part.text ?? "").join("");
}

function toUsage(
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
): LlmUsage | undefined {
  if (usage?.prompt_tokens === undefined || usage?.completion_tokens === undefined) {
    return undefined;
  }

  return { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens };
}

// --- tolerant parsing, generalised from `parse.ts` -------------------------

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "no-json" | "invalid-json" | "schema"; detail: string };

/**
 * Tolerantly parses raw LLM output against an arbitrary Zod schema: extracts
 * the JSON object (fences/prose tolerated, via `extractJsonObject`), parses
 * it, and validates it. Never throws; `detail` is meant to be fed back to
 * the model in a correction retry turn.
 */
function parseStructured<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  const jsonText = extractJsonObject(text);

  if (jsonText === undefined) {
    return {
      ok: false,
      reason: "no-json",
      detail: "No se encontró un objeto JSON en la respuesta.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: "invalid-json", detail: message };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "schema", detail: JSON.stringify(z.flattenError(result.error)) };
  }

  return { ok: true, value: result.data };
}

// --- One call to one model --------------------------------------------------

type CallOutcome<T> =
  | { ok: true; attempt: LlmAttempt; value: T; usage?: LlmUsage; rawContent: string }
  | { ok: false; attempt: LlmAttempt; rawContent?: string; detail?: string };

async function callModel<T>(
  config: OpenRouterConfig,
  fetchImpl: typeof fetch,
  model: string,
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  jsonSchema: Record<string, unknown>,
  name: string,
  temperature: number,
  maxTokens: number,
): Promise<CallOutcome<T>> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const start = Date.now();

  const provider =
    config.providerOrder && config.providerOrder.length > 0
      ? { require_parameters: true, order: config.providerOrder, allow_fallbacks: true }
      : { require_parameters: true };

  try {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": config.appUrl,
        "X-OpenRouter-Title": config.appTitle,
        "X-Title": config.appTitle,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: {
            name,
            strict: true,
            schema: jsonSchema,
          },
        },
        provider,
      }),
      signal: controller.signal,
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
      return {
        ok: false,
        attempt: { model, outcome: "http-error", status: response.status, durationMs },
      };
    }

    const rawBody: unknown = await response.json();
    const parsedBody = OpenRouterResponseSchema.safeParse(rawBody);

    const content = parsedBody.success
      ? extractContent(parsedBody.data.choices?.[0]?.message?.content)
      : "";
    const usage = parsedBody.success ? toUsage(parsedBody.data.usage) : undefined;

    const parsed = parseStructured(content, schema);

    if (parsed.ok) {
      return {
        ok: true,
        attempt: { model, outcome: "ok", status: response.status, durationMs },
        value: parsed.value,
        usage,
        rawContent: content,
      };
    }

    return {
      ok: false,
      attempt: { model, outcome: parsed.reason, status: response.status, durationMs },
      rawContent: content,
      detail: parsed.detail,
    };
  } catch {
    const durationMs = Date.now() - start;
    const outcome: LlmOutcome = controller.signal.aborted ? "timeout" : "network";
    return { ok: false, attempt: { model, outcome, durationMs } };
  } finally {
    clearTimeout(timer);
  }
}

// --- Fallback ladder ---------------------------------------------------------

/**
 * Creates a structured-output OpenRouter client for an arbitrary Zod
 * schema, following a fixed fallback ladder:
 *
 * 1. Primary model.
 * 2. If (1) failed with a parseable-but-invalid response (`no-json`,
 *    `invalid-json` or `schema`), retry the primary model once with a
 *    correction turn (the previous raw content as an assistant message,
 *    plus a user message asking for the corrected JSON).
 * 3. Fallback model, once, with the original messages (no correction).
 * 4. Give up and return `{ ok: false, attempts }`.
 *
 * HTTP errors, timeouts and network errors skip straight to the next
 * model (no correction retry). Never throws.
 */
export function createStructuredClient<T>(
  options: CreateStructuredClientOptions<T>,
): StructuredClient<T> {
  const { config, schema, jsonSchema, name } = options;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async generate(messages: ChatMessage[]): Promise<StructuredSuccess<T> | StructuredFailure> {
      const attempts: LlmAttempt[] = [];

      const call = (model: string, callMessages: ChatMessage[]) =>
        callModel(
          config,
          fetchImpl,
          model,
          callMessages,
          schema,
          jsonSchema,
          name,
          temperature,
          maxTokens,
        );

      const primary = await call(config.primaryModel, messages);
      attempts.push(primary.attempt);

      if (primary.ok) {
        return {
          ok: true,
          value: primary.value,
          model: config.primaryModel,
          attempts,
          usage: primary.usage,
        };
      }

      const canCorrect =
        CORRECTABLE_OUTCOMES.includes(primary.attempt.outcome) && primary.rawContent !== undefined;

      if (canCorrect) {
        const correctionMessages: ChatMessage[] = [
          ...messages,
          { role: "assistant", content: primary.rawContent as string },
          {
            role: "user",
            content: `Tu respuesta anterior no cumplió el esquema: ${primary.detail}. Devuelve únicamente el objeto JSON corregido.`,
          },
        ];

        const corrected = await call(config.primaryModel, correctionMessages);
        attempts.push(corrected.attempt);

        if (corrected.ok) {
          return {
            ok: true,
            value: corrected.value,
            model: config.primaryModel,
            attempts,
            usage: corrected.usage,
          };
        }
      }

      const fallback = await call(config.fallbackModel, messages);
      attempts.push(fallback.attempt);

      if (fallback.ok) {
        return {
          ok: true,
          value: fallback.value,
          model: config.fallbackModel,
          attempts,
          usage: fallback.usage,
        };
      }

      return { ok: false, attempts };
    },
  };
}
