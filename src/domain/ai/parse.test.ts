import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractJsonObject } from "./parse";

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
