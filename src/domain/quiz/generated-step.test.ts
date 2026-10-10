import { describe, expect, it } from "vitest";

import { QUIZ_STEPS } from "./questions";
import {
  entryFromResolvedOption,
  GeneratedOptionSchema,
  GeneratedStepSchema,
  ResolvedStepSchema,
  resolvedStepFromCurated,
} from "./generated-step";

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

describe("GeneratedOptionSchema", () => {
  it("accepts a well-formed option", () => {
    expect(GeneratedOptionSchema.safeParse(validOption()).success).toBe(true);
  });

  it("rejects a title longer than 40 chars", () => {
    const result = GeneratedOptionSchema.safeParse(validOption({ title: "x".repeat(41) }));
    expect(result.success).toBe(false);
  });

  it("rejects when hashtags aren't exactly 3", () => {
    const result = GeneratedOptionSchema.safeParse(
      validOption({ hashtags: ["#Uno", "#Dos", "#Tres", "#Cuatro"] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a hashtag that doesn't start with #", () => {
    const result = GeneratedOptionSchema.safeParse(
      validOption({ hashtags: ["Vendimia", "#ValleDeColon", "#AtardecerQueretano"] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects more than 3 venueIds", () => {
    const result = GeneratedOptionSchema.safeParse(
      validOption({ refs: { venueIds: ["a", "b", "c", "d"], experienceIds: [] } }),
    );
    expect(result.success).toBe(false);
  });
});

describe("GeneratedStepSchema", () => {
  it("accepts a well-formed step", () => {
    expect(GeneratedStepSchema.safeParse(validStep()).success).toBe(true);
  });

  it("rejects a step with only 2 options", () => {
    const step = validStep();
    const result = GeneratedStepSchema.safeParse({
      ...step,
      options: (step.options as unknown[]).slice(0, 2),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a step with 5 options", () => {
    const step = validStep();
    const result = GeneratedStepSchema.safeParse({
      ...step,
      options: [
        ...(step.options as unknown[]),
        validOption({ id: "extra-option-a" }),
        validOption({ id: "extra-option-b" }),
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown property (strict)", () => {
    const result = GeneratedStepSchema.safeParse({ ...validStep(), extra: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("resolvedStepFromCurated", () => {
  it("maps the curated style deck into a resolved step with 4 options, photos and facets", () => {
    const step = resolvedStepFromCurated(QUIZ_STEPS[0]!, 1);

    expect(step.source).toBe("static");
    expect(step.index).toBe(1);
    expect(step.done).toBe(false);
    expect(step.options).toHaveLength(4);

    for (const option of step.options) {
      expect(option.photo.url.length).toBeGreaterThan(0);
      expect(option.photo.alt.length).toBeGreaterThan(0);
      expect(option.photo.credit.length).toBeGreaterThan(0);
    }

    const rustic = step.options.find((option) => option.id === "rustic_vineyard");
    expect(rustic?.facets.style).toBe("rustic_vineyard");
    expect(rustic?.refs.venueIds).toEqual(["v_vinedos-la-redonda"]);
    expect(rustic?.venue?.id).toBe("v_vinedos-la-redonda");
  });

  it("round-trips through ResolvedStepSchema", () => {
    const step = resolvedStepFromCurated(QUIZ_STEPS[0]!, 1);
    expect(ResolvedStepSchema.safeParse(step).success).toBe(true);
  });
});

describe("entryFromResolvedOption", () => {
  it("builds a transcript entry straight from the resolved option's own fields", () => {
    const step = resolvedStepFromCurated(QUIZ_STEPS[0]!, 1);
    const option = step.options.find((candidate) => candidate.id === "rustic_vineyard");
    if (!option) throw new Error("fixture missing");

    const entry = entryFromResolvedOption(step, option);

    expect(entry).toEqual({
      stepId: step.id,
      question: step.question,
      topic: step.topic,
      chosen: {
        id: option.id,
        title: option.title,
        summary: option.description,
        facets: option.facets,
        refs: option.refs,
      },
    });
  });
});
