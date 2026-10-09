import { describe, expect, it } from "vitest";

import { describeAnswers, QuizAnswersSchema } from "./schema";

const VALID_ANSWERS = {
  style: "colonial",
  setting: "sunset_garden",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
} as const;

describe("QuizAnswersSchema", () => {
  it("accepts a valid payload", () => {
    expect(QuizAnswersSchema.parse(VALID_ANSWERS)).toEqual(VALID_ANSWERS);
  });

  it("rejects an unknown option id", () => {
    expect(() => QuizAnswersSchema.parse({ ...VALID_ANSWERS, style: "not-a-style" })).toThrow();
  });

  it("rejects a payload missing a key", () => {
    const incomplete: Record<string, unknown> = { ...VALID_ANSWERS };
    delete incomplete.mustHave;
    expect(() => QuizAnswersSchema.parse(incomplete)).toThrow();
  });

  it("rejects a payload with an extra key", () => {
    expect(() => QuizAnswersSchema.parse({ ...VALID_ANSWERS, extra: "nope" })).toThrow();
  });
});

describe("describeAnswers", () => {
  it("renders one line per answer with topic, title and prompt hint", () => {
    const description = describeAnswers(VALID_ANSWERS);
    const lines = description.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("Estilo");
    expect(lines[0]).toContain("Colonial Imperial & Casonas");
    expect(description).toContain("Horario y Entorno");
    expect(description).toContain("Experiencia");
    expect(description).toContain("Elemento Infaltable");
  });
});
