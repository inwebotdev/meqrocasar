import {
  LLM_EXPERIENCE_JSON_SCHEMA,
  LlmExperienceSchema,
  type LlmExperience,
} from "@/domain/experience/schema";
import type { QuizAnswers } from "@/domain/quiz/schema";

import { buildMessages } from "./prompt";
import {
  createStructuredClient,
  type OpenRouterConfig,
  type StructuredFailure,
  type StructuredSuccess,
} from "./structured";

export type { LlmAttempt, LlmOutcome, LlmUsage, OpenRouterConfig } from "./structured";

export type LlmSuccess = StructuredSuccess<LlmExperience>;
export type LlmFailure = StructuredFailure;

export interface OpenRouterClient {
  generate(answers: QuizAnswers): Promise<LlmSuccess | LlmFailure>;
}

const TEMPERATURE = 0.7;
const MAX_TOKENS = 1200;

/**
 * Creates an OpenRouter client that generates a wedding experience from
 * quiz answers. A thin, schema-specific wrapper over
 * `createStructuredClient` (same fallback ladder: primary model →
 * correction retry on schema failure → fallback model → give up).
 */
export function createOpenRouterClient(
  config: OpenRouterConfig,
  fetchImpl: typeof fetch = fetch,
): OpenRouterClient {
  const structured = createStructuredClient({
    config,
    schema: LlmExperienceSchema,
    jsonSchema: LLM_EXPERIENCE_JSON_SCHEMA as Record<string, unknown>,
    name: "wedding_experience",
    temperature: TEMPERATURE,
    maxTokens: MAX_TOKENS,
    fetchImpl,
  });

  return {
    generate(answers: QuizAnswers): Promise<LlmSuccess | LlmFailure> {
      return structured.generate(buildMessages(answers));
    },
  };
}
