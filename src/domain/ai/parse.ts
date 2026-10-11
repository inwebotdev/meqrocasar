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
