import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractJsonObject, parseLlmExperience } from "./parse";

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, "../../../test/fixtures/llm", name), "utf-8");
}

describe("extractJsonObject", () => {
  it("returns the object as-is for plain JSON", () => {
    const text = fixture("valid.json");
    const result = extractJsonObject(text);
    expect(result).toBeDefined();
    expect(() => JSON.parse(result as string)).not.toThrow();
  });

  it("strips a ```json fence and surrounding prose", () => {
    const text = fixture("fenced.txt");
    const result = extractJsonObject(text);
    expect(result).toBeDefined();
    const parsed = JSON.parse(result as string);
    expect(parsed.conceptTitle).toBe("Noche Virreinal en Casona de Cantera");
  });

  it("returns undefined for truncated/malformed JSON", () => {
    const text = fixture("malformed.txt");
    expect(extractJsonObject(text)).toBeUndefined();
  });

  it("returns the balanced object for JSON with a missing field (still well-formed)", () => {
    const text = fixture("wrong-shape.json");
    const result = extractJsonObject(text);
    expect(result).toBeDefined();
    expect(() => JSON.parse(result as string)).not.toThrow();
  });

  it("returns undefined when there is no object at all", () => {
    expect(extractJsonObject("just some prose, no JSON here")).toBeUndefined();
  });
});

describe("parseLlmExperience", () => {
  it("parses valid.json into a valid LlmExperience", () => {
    const result = parseLlmExperience(fixture("valid.json"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.conceptTitle).toBe("Atardecer Dorado entre Viñedos de Ezequiel Montes");
      expect(result.value.colorPalette).toHaveLength(4);
      expect(result.value.recommendedVenues.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("parses fenced.txt (prose + ```json fence) into a valid LlmExperience", () => {
    const result = parseLlmExperience(fixture("fenced.txt"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.conceptTitle).toBe("Noche Virreinal en Casona de Cantera");
    }
  });

  it("fails with reason 'no-json' for malformed.txt (no balanced object found)", () => {
    const result = parseLlmExperience(fixture("malformed.txt"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no-json");
      expect(result.detail.length).toBeGreaterThan(0);
    }
  });

  it("fails with reason 'schema' for wrong-shape.json (5 colors, missing reelTagline)", () => {
    const result = parseLlmExperience(fixture("wrong-shape.json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("schema");
      expect(result.detail).toContain("colorPalette");
      expect(result.detail).toContain("reelTagline");
    }
  });

  it("fails with reason 'invalid-json' for syntactically broken JSON text", () => {
    const result = parseLlmExperience('{ "conceptTitle": "x", }');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid-json");
      expect(result.detail.length).toBeGreaterThan(0);
    }
  });
});
