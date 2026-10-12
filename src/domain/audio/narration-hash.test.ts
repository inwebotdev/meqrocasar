import { describe, expect, it } from "vitest";

import { narrationHash } from "./narration-hash";

describe("narrationHash", () => {
  it("is a 64-char lowercase hex sha256 digest", () => {
    const hash = narrationHash({ voiceId: "v1", modelId: "eleven_multilingual_v2", text: "Hola" });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const input = { voiceId: "v1", modelId: "eleven_multilingual_v2", text: "Hola" };
    expect(narrationHash(input)).toBe(narrationHash({ ...input }));
  });

  it("differs when the voice id differs", () => {
    const a = narrationHash({ voiceId: "v1", modelId: "m", text: "Hola" });
    const b = narrationHash({ voiceId: "v2", modelId: "m", text: "Hola" });
    expect(a).not.toBe(b);
  });

  it("differs when the model id differs", () => {
    const a = narrationHash({ voiceId: "v1", modelId: "m1", text: "Hola" });
    const b = narrationHash({ voiceId: "v1", modelId: "m2", text: "Hola" });
    expect(a).not.toBe(b);
  });

  it("differs when the text differs", () => {
    const a = narrationHash({ voiceId: "v1", modelId: "m", text: "Hola" });
    const b = narrationHash({ voiceId: "v1", modelId: "m", text: "Adiós" });
    expect(a).not.toBe(b);
  });

  it("doesn't collide across a shifted field boundary (e.g. 'ab'+'c' vs 'a'+'bc')", () => {
    const a = narrationHash({ voiceId: "ab", modelId: "c", text: "x" });
    const b = narrationHash({ voiceId: "a", modelId: "bc", text: "x" });
    expect(a).not.toBe(b);
  });
});
