import { z } from "zod";

import { LlmExperienceSchema, type LlmExperience } from "@/domain/experience/schema";

/**
 * Strips a ```json fenced block (or a bare ``` fenced block) around the
 * first fence pair found, if any; otherwise returns the text unchanged.
 */
function stripFences(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch ? fenceMatch[1] : text;
}

/**
 * Scans forward from the first `{` and returns the first balanced
 * `{...}` substring, respecting JSON string literals (so a `{` or `}`
 * inside a quoted string doesn't throw off the brace count). Returns
 * `undefined` when no balanced object is found (e.g. truncated JSON).
 */
function findBalancedObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return undefined;
}

/**
 * Extracts the first balanced JSON object from raw LLM output: strips a
 * ```json fenced block when present (tolerating prose before/after it),
 * then finds the first balanced `{...}` block. Returns `undefined` when no
 * complete JSON object can be found (e.g. the response was truncated).
 */
export function extractJsonObject(text: string): string | undefined {
  const stripped = stripFences(text);
  return findBalancedObject(stripped) ?? findBalancedObject(text);
}

export type ParseLlmExperienceResult =
  | { ok: true; value: LlmExperience }
  | { ok: false; reason: "no-json" | "invalid-json" | "schema"; detail: string };

/**
 * Tolerantly parses raw LLM output into an `LlmExperience`: extracts the
 * JSON object (fences/prose tolerated), parses it, and validates it
 * against `LlmExperienceSchema`. Never throws; `detail` carries the
 * `JSON.parse` message or the flattened Zod issues, meant to be fed back
 * to the model in a correction retry turn.
 */
export function parseLlmExperience(text: string): ParseLlmExperienceResult {
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

  const result = LlmExperienceSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "schema", detail: JSON.stringify(z.flattenError(result.error)) };
  }

  return { ok: true, value: result.data };
}
