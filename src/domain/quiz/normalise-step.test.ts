import { describe, expect, it } from "vitest";

import { GeneratedStepSchema } from "./generated-step";
import { normaliseGeneratedStep } from "./normalise-step";

function validOption(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "vendimia-redonda",
    title: "Vendimia al Atardecer",
    description: "Una tarde entre las vides, copa en mano, mientras el sol se despide.",
    hashtags: ["#Vendimia", "#ValleDeColon", "#AtardecerQueretano"],
    facets: { experience: "vendimia" },
    refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: [] },
    photoQuery: "vineyard harvest sunset wedding",
    badge: "Ruta del Vino",
    matchLabel: "96% AFINIDAD",
    ...overrides,
  };
}

function validStep(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "step-2",
    topic: "Experiencia",
    question: "¿Qué momento no puede faltar?",
    helper: "Elige la experiencia que mejor describe su celebración.",
    selectLabel: "Elegir esta Experiencia",
    options: [validOption(), validOption({ id: "cata-de-cote" }), validOption({ id: "globo-tqp" })],
    done: false,
    ...overrides,
  };
}

describe("normaliseGeneratedStep", () => {
  it("passes a well-formed step through unchanged, with no fixes", () => {
    const result = normaliseGeneratedStep(validStep());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fixes).toEqual([]);
    expect(GeneratedStepSchema.safeParse(result.step).success).toBe(true);
  });

  it("rejects a malformed shape (missing required fields)", () => {
    const result = normaliseGeneratedStep({ nope: true });
    expect(result).toEqual({ ok: false, reason: "shape" });
  });

  it("trims and collapses internal whitespace", () => {
    const step = validStep({
      topic: "  Experiencia   Queretana  ",
      options: [
        validOption({ title: "  Vendimia   al   Atardecer " }),
        validOption({ id: "cata-de-cote" }),
        validOption({ id: "globo-tqp" }),
      ],
    });

    const result = normaliseGeneratedStep(step);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.topic).toBe("Experiencia Queretana");
    expect(result.step.options[0]?.title).toBe("Vendimia al Atardecer");
    expect(result.fixes).toContain("collapsed-whitespace");
  });

  it("strips a leading # from a title used as a hashtag", () => {
    const step = validStep({
      options: [
        validOption({ title: "#CallejoneadaRealDelVirrey" }),
        validOption({ id: "cata-de-cote" }),
        validOption({ id: "globo-tqp" }),
      ],
    });

    const result = normaliseGeneratedStep(step);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.options[0]?.title).toBe("CallejoneadaRealDelVirrey");
    expect(result.fixes).toContain("stripped-hashtag-title");
  });

  it("drops empty/degenerate hashtags and regenerates them from the title", () => {
    const step = validStep({
      options: [
        validOption({ hashtags: ["#", "", "#Vendimia"] }),
        validOption({ id: "cata-de-cote" }),
        validOption({ id: "globo-tqp" }),
      ],
    });

    const result = normaliseGeneratedStep(step);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hashtags = result.step.options[0]?.hashtags ?? [];
    expect(hashtags).toHaveLength(3);
    for (const tag of hashtags) {
      expect(tag).toMatch(/^#/);
      expect(tag.length).toBeGreaterThan(1);
    }
    expect(result.fixes).toContain("dropped-degenerate-hashtag");
    expect(result.fixes).toContain("regenerated-hashtag");
  });

  it("smart-truncates an over-long field at a word boundary, never mid-word", () => {
    const longDescription =
      "Una celebracion muy larga que definitivamente se extiende bastante mas alla del limite permitido para este campo en particular y sigue y sigue sin parar, contando cada detalle sensorial posible una y otra vez sin ninguna consideracion por el limite";
    const step = validStep({
      options: [
        validOption({ description: longDescription }),
        validOption({ id: "cata-de-cote" }),
        validOption({ id: "globo-tqp" }),
      ],
    });

    const result = normaliseGeneratedStep(step);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const description = result.step.options[0]?.description ?? "";
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
    // Never mid-word: the character right before the ellipsis is a full
    // word boundary (not a partial word fragment).
    expect(description.slice(0, -1).endsWith(" ")).toBe(false);
    expect(longDescription.startsWith(description.slice(0, -1).trimEnd())).toBe(true);
  });

  it("coerces matchLabel into the 'NN% AFINIDAD' shape, clamped to 80-99", () => {
    const step = validStep({
      options: [
        validOption({ matchLabel: "la pareja encaja al 120%!!" }),
        validOption({ id: "cata-de-cote", matchLabel: "linda opcion" }),
        validOption({ id: "globo-tqp", matchLabel: "55% afinidad" }),
      ],
    });

    const result = normaliseGeneratedStep(step);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.options[0]?.matchLabel).toBe("99% AFINIDAD");
    expect(result.step.options[1]?.matchLabel).toBe("90% AFINIDAD");
    expect(result.step.options[2]?.matchLabel).toBe("80% AFINIDAD");
    expect(result.fixes).toContain("coerced-match-label");
  });

  it("defaults badge to 'Sugerencia SECTUR' when empty", () => {
    const step = validStep({
      options: [
        validOption({ badge: "   " }),
        validOption({ id: "cata-de-cote" }),
        validOption({ id: "globo-tqp" }),
      ],
    });

    const result = normaliseGeneratedStep(step);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.options[0]?.badge).toBe("Sugerencia SECTUR");
    expect(result.fixes).toContain("defaulted-badge");
  });

  it("defaults selectLabel to 'Elegir esta opción' when empty", () => {
    const step = validStep({ selectLabel: "" });

    const result = normaliseGeneratedStep(step);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.step.selectLabel).toBe("Elegir esta opción");
    expect(result.fixes).toContain("defaulted-select-label");
  });

  it("rejects with reason 'language' when any field contains CJK text", () => {
    const step = validStep({
      options: [
        validOption({ title: "你好世界 Boda" }),
        validOption({ id: "cata-de-cote" }),
        validOption({ id: "globo-tqp" }),
      ],
    });

    const result = normaliseGeneratedStep(step);
    expect(result).toEqual({ ok: false, reason: "language" });
  });

  it("rejects with reason 'language' when a hashtag contains Cyrillic text", () => {
    const step = validStep({
      options: [
        validOption({ hashtags: ["#Привет", "#Vendimia", "#Queretano"] }),
        validOption({ id: "cata-de-cote" }),
        validOption({ id: "globo-tqp" }),
      ],
    });

    const result = normaliseGeneratedStep(step);
    expect(result).toEqual({ ok: false, reason: "language" });
  });

  it("accepts photoQuery's English text (Latin script isn't a language violation)", () => {
    const result = normaliseGeneratedStep(validStep());
    expect(result.ok).toBe(true);
  });
});
