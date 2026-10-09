import { describe, expect, it } from "vitest";

import { getPhoto } from "@/domain/media/photos";

import { continueLabel, getOption, getStep, nextStep, QUIZ_STEPS } from "./questions";

describe("QUIZ_STEPS", () => {
  it("has 4 steps in order with the expected option counts", () => {
    expect(QUIZ_STEPS.map((step) => step.id)).toEqual([
      "style",
      "setting",
      "experience",
      "mustHave",
    ]);
    expect(QUIZ_STEPS.map((step) => step.order)).toEqual([1, 2, 3, 4]);
    expect(QUIZ_STEPS.map((step) => step.options.length)).toEqual([4, 3, 3, 4]);
  });

  it("every option has complete, non-empty fields", () => {
    for (const step of QUIZ_STEPS) {
      for (const option of step.options) {
        expect(option.id.length).toBeGreaterThan(0);
        expect(option.label.length).toBeGreaterThan(0);
        expect(option.label.length).toBeLessThanOrEqual(12);
        expect(option.icon.length).toBeGreaterThan(0);
        expect(option.title.length).toBeGreaterThan(0);
        expect(option.description.length).toBeGreaterThan(0);
        expect(option.description.length).toBeLessThanOrEqual(160);
        expect(option.venueHint.length).toBeGreaterThan(0);
        expect(option.matchLabel.length).toBeGreaterThan(0);
        expect(option.badge.length).toBeGreaterThan(0);
        expect(option.promptHint.length).toBeGreaterThan(0);
        expect(option.hashtags).toHaveLength(3);
        for (const hashtag of option.hashtags) {
          expect(hashtag.startsWith("#")).toBe(true);
        }
        // Throws if the photoId isn't registered.
        expect(() => getPhoto(option.photoId)).not.toThrow();
      }
    }
  });

  it("match labels for steps 2-4 fall between 86% and 97%", () => {
    for (const step of QUIZ_STEPS.slice(1)) {
      for (const option of step.options) {
        const value = Number(option.matchLabel.replace(/[^\d]/g, ""));
        expect(value).toBeGreaterThanOrEqual(86);
        expect(value).toBeLessThanOrEqual(97);
      }
    }
  });
});

describe("getStep / getOption", () => {
  it("resolves a known step and option", () => {
    const step = getStep("style");
    expect(step.id).toBe("style");
    const option = getOption("style", "colonial");
    expect(option.title).toBe("Colonial Imperial & Casonas");
  });

  it("throws for an unknown option", () => {
    expect(() => getOption("style", "not-an-option")).toThrow();
  });
});

describe("nextStep", () => {
  it("returns the following step, and undefined after the last", () => {
    expect(nextStep("style")?.id).toBe("setting");
    expect(nextStep("setting")?.id).toBe("experience");
    expect(nextStep("experience")?.id).toBe("mustHave");
    expect(nextStep("mustHave")).toBeUndefined();
  });
});

describe("continueLabel", () => {
  it("names the next step for steps 1-3", () => {
    expect(continueLabel(getStep("style"))).toBe("Continuar al Paso 2: Horario y Entorno");
    expect(continueLabel(getStep("setting"))).toBe("Continuar al Paso 3: Experiencia");
    expect(continueLabel(getStep("experience"))).toBe("Continuar al Paso 4: Elemento Infaltable");
  });

  it("is 'Crear mi experiencia' for the last step", () => {
    expect(continueLabel(getStep("mustHave"))).toBe("Crear mi experiencia");
  });
});
