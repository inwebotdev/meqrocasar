import { describe, expect, it } from "vitest";

import { buildDigest } from "@/domain/kb/digest";
import type { Facets } from "@/domain/kb/taxonomy";
import type { QuizAnswers } from "@/domain/quiz/schema";
import type { Transcript } from "@/domain/quiz/transcript";

import {
  buildExperienceMessages,
  buildMessages,
  EXPERIENCE_PROMPT_VERSION,
} from "./experience-prompt";

const facets: Facets = { style: "rustic_vineyard", setting: "day_vineyard" };

function makeTranscript(): Transcript {
  return {
    entries: [
      {
        stepId: "style",
        question: "¿Qué vibra define su historia?",
        topic: "Estilo",
        chosen: {
          id: "rustic_vineyard",
          title: "Rústico Viñedo & Enológico",
          summary: "La pareja imagina una boda rústica entre viñedos.",
          facets: { style: "rustic_vineyard" },
          refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: [] },
        },
      },
      {
        stepId: "setting",
        question: "¿En qué momento del día cobra vida su celebración?",
        topic: "Horario y Entorno",
        chosen: {
          id: "day_vineyard",
          title: "Día de Viñedo",
          summary: "Imaginan una celebración diurna entre las vides.",
          facets: { setting: "day_vineyard" },
          refs: { venueIds: ["v_vinedos-la-redonda"], experienceIds: [] },
        },
      },
    ],
  };
}

describe("buildExperienceMessages", () => {
  it("returns a system message and a user message", () => {
    const digest = buildDigest(facets, { maxVenues: 20, maxExperiences: 10, maxChars: 5000 });
    const messages = buildExperienceMessages({ transcript: makeTranscript(), facets, digest });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");
  });

  it("mentions JSON and the output contract keys in the system prompt", () => {
    const digest = buildDigest(facets, { maxVenues: 20, maxExperiences: 10, maxChars: 5000 });
    const messages = buildExperienceMessages({ transcript: makeTranscript(), facets, digest });
    const systemContent = messages[0]?.content ?? "";

    expect(systemContent).toMatch(/JSON/);
    for (const key of [
      "conceptTitle",
      "colorPalette",
      "narrative",
      "searchQueries",
      "recommendedVenues",
      "reelTagline",
      "itineraryHint",
      "reelScript",
    ]) {
      expect(systemContent).toContain(key);
    }
  });

  it("includes the transcript as 'Pregunta → Eligieron: título (resumen)' lines", () => {
    const digest = buildDigest(facets, { maxVenues: 20, maxExperiences: 10, maxChars: 5000 });
    const messages = buildExperienceMessages({ transcript: makeTranscript(), facets, digest });
    const userContent = messages[1]?.content ?? "";

    expect(userContent).toContain(
      "¿Qué vibra define su historia? → Eligieron: Rústico Viñedo & Enológico (La pareja imagina una boda rústica entre viñedos.)",
    );
    expect(userContent).toContain(
      "¿En qué momento del día cobra vida su celebración? → Eligieron: Día de Viñedo (Imaginan una celebración diurna entre las vides.)",
    );
  });

  it("includes the folded facets with their es-MX labels", () => {
    const digest = buildDigest(facets, { maxVenues: 20, maxExperiences: 10, maxChars: 5000 });
    const messages = buildExperienceMessages({ transcript: makeTranscript(), facets, digest });
    const userContent = messages[1]?.content ?? "";

    expect(userContent).toContain("Estilo: Rústico Viñedo");
    expect(userContent).toContain("Entorno: Día de Viñedo");
  });

  it("includes the digest's venue and experience ids", () => {
    const digest = buildDigest(facets, { maxVenues: 20, maxExperiences: 10, maxChars: 5000 });
    const messages = buildExperienceMessages({ transcript: makeTranscript(), facets, digest });
    const userContent = messages[1]?.content ?? "";

    expect(digest.venueIds.length).toBeGreaterThan(0);
    for (const id of digest.venueIds) {
      expect(userContent).toContain(id);
    }
    for (const id of digest.experienceIds) {
      expect(userContent).toContain(id);
    }
  });

  it("exports a stable prompt version string", () => {
    expect(EXPERIENCE_PROMPT_VERSION.length).toBeGreaterThan(0);
  });
});

describe("buildMessages (legacy answers)", () => {
  const answers: QuizAnswers = {
    style: "rustic_vineyard",
    setting: "day_vineyard",
    experience: "intimate_boutique",
    mustHave: "wine_tasting",
  };

  it("converts the legacy answers into a transcript and produces the same shape of prompt", () => {
    const messages = buildMessages(answers);

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");

    const userContent = messages[1]?.content ?? "";
    expect(userContent).toContain("Estilo: Rústico Viñedo");
    expect(userContent).toContain("Entorno: Día de Viñedo");
    expect(userContent).toMatch(/Eligieron/);
  });
});
