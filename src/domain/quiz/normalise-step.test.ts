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
    ...overrides,
  };
}

function validStep(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "step-2",
    topic: "Experiencia",
    question: "¿Qué momento no puede faltar?",
    helper: "Elige la experiencia que mejor describe su celebración.",
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

  it("rejects a raw step still carrying badge/matchLabel/selectLabel (the model must not send them)", () => {
    const withBadge = validStep({
      options: [
        validOption({ badge: "Algo" }),
        validOption({ id: "cata-de-cote" }),
        validOption({ id: "globo-tqp" }),
      ],
    });
    expect(normaliseGeneratedStep(withBadge)).toEqual({ ok: false, reason: "shape" });

    const withSelectLabel = validStep({ selectLabel: "Elegir esta opción" });
    expect(normaliseGeneratedStep(withSelectLabel)).toEqual({ ok: false, reason: "shape" });
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

  it("derives matchLabel deterministically from the option id, seeded into 86-97% AFINIDAD", () => {
    const result = normaliseGeneratedStep(validStep());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const option of result.step.options) {
      expect(option.matchLabel).toMatch(/^\d{2}% AFINIDAD$/);
      const percent = Number(option.matchLabel.match(/^(\d{2})%/)?.[1]);
      expect(percent).toBeGreaterThanOrEqual(86);
      expect(percent).toBeLessThanOrEqual(97);
    }

    // Stable across calls for the same id.
    const again = normaliseGeneratedStep(validStep());
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.step.options[0]?.matchLabel).toBe(result.step.options[0]?.matchLabel);

    // Different ids get (almost always) different labels, proving it's
    // seeded by id rather than a single constant.
    const labels = new Set(result.step.options.map((option) => option.matchLabel));
    expect(labels.size).toBeGreaterThan(1);
  });

  it("derives badge from the option's dominant facet", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ setting: "sunset_garden" }, "Momento ideal"],
      [{ experience: "wine_tasting" }, "Experiencia SECTUR"],
      [{ scale: "intimate" }, "Escala"],
      [{ budget: "medio_alto" }, "Presupuesto"],
      [{ season: "otono" }, "Temporada"],
    ];

    for (const [facets, expectedBadge] of cases) {
      const step = validStep({
        options: [
          validOption({ facets }),
          validOption({ id: "opt-b" }),
          validOption({ id: "opt-c" }),
        ],
      });
      const result = normaliseGeneratedStep(step);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.step.options[0]?.badge).toBe(expectedBadge);
    }
  });

  it("derives the zone badge as 'Pueblo Mágico' for a pueblo mágico zone and 'Destino' otherwise", () => {
    const puebloMagicoStep = validStep({
      options: [
        validOption({ facets: { zone: "bernal" } }),
        validOption({ id: "opt-b" }),
        validOption({ id: "opt-c" }),
      ],
    });
    const destinoStep = validStep({
      options: [
        validOption({ facets: { zone: "colon" } }),
        validOption({ id: "opt-b" }),
        validOption({ id: "opt-c" }),
      ],
    });

    const puebloMagicoResult = normaliseGeneratedStep(puebloMagicoStep);
    const destinoResult = normaliseGeneratedStep(destinoStep);

    expect(puebloMagicoResult.ok).toBe(true);
    expect(destinoResult.ok).toBe(true);
    if (!puebloMagicoResult.ok || !destinoResult.ok) return;

    expect(puebloMagicoResult.step.options[0]?.badge).toBe("Pueblo Mágico");
    expect(destinoResult.step.options[0]?.badge).toBe("Destino");
  });

  it("always derives the invariant selectLabel, regardless of the step's topic", () => {
    const feminine = normaliseGeneratedStep(validStep({ topic: "Experiencia" }));
    const masculine = normaliseGeneratedStep(validStep({ topic: "Entorno" }));
    expect(feminine.ok).toBe(true);
    expect(masculine.ok).toBe(true);
    if (!feminine.ok || !masculine.ok) return;
    expect(feminine.step.selectLabel).toBe("Elegir esta opción");
    expect(masculine.step.selectLabel).toBe("Elegir esta opción");
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

  describe("targetFacet canonicalisation", () => {
    it("maps a free-text Spanish label back to the canonical taxonomy id ('íntima' → 'intimate')", () => {
      const step = validStep({
        options: [
          validOption({ id: "opt-a", facets: { scale: "íntima" } }),
          validOption({ id: "opt-b", facets: { scale: "medium" } }),
          validOption({ id: "opt-c", facets: { scale: "grand" } }),
        ],
      });

      const result = normaliseGeneratedStep(step, "scale");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.step.options[0]?.facets.scale).toBe("intimate");
    });

    it("maps a setting label to its canonical id ('atardecer' → 'sunset_garden')", () => {
      const step = validStep({
        options: [
          validOption({ id: "opt-a", facets: { setting: "atardecer" } }),
          validOption({ id: "opt-b", facets: { setting: "night_casona" } }),
          validOption({ id: "opt-c", facets: { setting: "day_vineyard" } }),
        ],
      });

      const result = normaliseGeneratedStep(step, "setting");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.step.options[0]?.facets.setting).toBe("sunset_garden");
    });

    it("maps a capitalized zone name to its canonical id ('Tequisquiapan' → 'tequisquiapan')", () => {
      const step = validStep({
        options: [
          validOption({ id: "opt-a", facets: { zone: "Tequisquiapan" } }),
          validOption({ id: "opt-b", facets: { zone: "bernal" } }),
          validOption({ id: "opt-c", facets: { zone: "colon" } }),
        ],
      });

      const result = normaliseGeneratedStep(step, "zone");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.step.options[0]?.facets.zone).toBe("tequisquiapan");
    });

    it("leaves facets untouched (and still rejects, if invalid) when no targetFacet is given", () => {
      const step = validStep({
        options: [
          validOption({ id: "opt-a", facets: { scale: "íntima" } }),
          validOption({ id: "opt-b", facets: { scale: "medium" } }),
          validOption({ id: "opt-c", facets: { scale: "grand" } }),
        ],
      });

      expect(normaliseGeneratedStep(step)).toEqual({ ok: false, reason: "shape" });
    });
  });
});
