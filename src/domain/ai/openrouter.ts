import { z } from "zod";

import { LLM_EXPERIENCE_JSON_SCHEMA, type LlmExperience } from "@/domain/experience/schema";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { parseLlmExperience } from "./parse";
import { buildMessages, type ChatMessage } from "./prompt";

export interface OpenRouterConfig {
  apiKey: string;
  primaryModel: string;
  fallbackModel: string;
  timeoutMs: number;
  appUrl: string;
  appTitle: string;
  /** Defaults to `https://openrouter.ai/api/v1`. */
  baseUrl?: string;
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

export interface LlmSuccess {
  ok: true;
  value: LlmExperience;
  model: string;
  attempts: LlmAttempt[];
  usage?: LlmUsage;
}

export interface LlmFailure {
  ok: false;
  attempts: LlmAttempt[];
}

export interface OpenRouterClient {
  generate(answers: QuizAnswers): Promise<LlmSuccess | LlmFailure>;
}

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const TEMPERATURE = 0.7;
const MAX_TOKENS = 1200;

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

// --- One call to one model --------------------------------------------------

type CallOutcome =
  | { ok: true; attempt: LlmAttempt; value: LlmExperience; usage?: LlmUsage; rawContent: string }
  | { ok: false; attempt: LlmAttempt; rawContent?: string; detail?: string };

async function callModel(
  config: OpenRouterConfig,
  fetchImpl: typeof fetch,
  model: string,
  messages: ChatMessage[],
): Promise<CallOutcome> {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const start = Date.now();

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
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "wedding_experience",
            strict: true,
            schema: LLM_EXPERIENCE_JSON_SCHEMA,
          },
        },
        provider: { require_parameters: true },
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

    const parsed = parseLlmExperience(content);

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
 * Creates an OpenRouter client that generates a wedding experience from
 * quiz answers, following a fixed fallback ladder:
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
export function createOpenRouterClient(
  config: OpenRouterConfig,
  fetchImpl: typeof fetch = fetch,
): OpenRouterClient {
  return {
    async generate(answers: QuizAnswers): Promise<LlmSuccess | LlmFailure> {
      const attempts: LlmAttempt[] = [];
      const messages = buildMessages(answers);

      const primary = await callModel(config, fetchImpl, config.primaryModel, messages);
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

        const corrected = await callModel(
          config,
          fetchImpl,
          config.primaryModel,
          correctionMessages,
        );
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

      const fallback = await callModel(config, fetchImpl, config.fallbackModel, messages);
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
