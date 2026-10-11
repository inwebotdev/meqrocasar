import { describe, expect, it } from "vitest";

import { buildDigest } from "@/domain/kb/digest";
import type { Facets } from "@/domain/kb/taxonomy";

import { buildStepMessages, ENGINE_PROMPT_VERSION } from "./engine-prompt";
import type { Transcript } from "./transcript";

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

describe("buildStepMessages", () => {
  it("returns a system message and a user message", () => {
    const digest = buildDigest(facets, { maxVenues: 5, maxExperiences: 3 });
    const messages = buildStepMessages({
      transcript: makeTranscript(),
      facets,
      digest,
      stepIndex: 3,
      maxSteps: 7,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");
  });

  it("includes the digest's venue/experience ids, known and unknown facets, and the step counters", () => {
    const digest = buildDigest(facets, { maxVenues: 5, maxExperiences: 3 });
    const messages = buildStepMessages({
      transcript: makeTranscript(),
      facets,
      digest,
      stepIndex: 3,
      maxSteps: 7,
    });

    const userContent = messages[1]?.content ?? "";

    for (const id of digest.venueIds) {
      expect(userContent).toContain(id);
    }
    for (const id of digest.experienceIds) {
      expect(userContent).toContain(id);
    }

    expect(userContent).toContain("Rústico Viñedo");
    expect(userContent).toContain("Día de Viñedo");
    expect(userContent).toContain("Zona");
    expect(userContent).toContain("Experiencia");
    expect(userContent).toContain("3");
    expect(userContent).toContain("7");
  });

  it("includes the transcript as question → chosen title lines", () => {
    const digest = buildDigest(facets, { maxVenues: 5, maxExperiences: 3 });
    const messages = buildStepMessages({
      transcript: makeTranscript(),
      facets,
      digest,
      stepIndex: 3,
      maxSteps: 7,
    });

    const userContent = messages[1]?.content ?? "";
    expect(userContent).toContain("¿Qué vibra define su historia? → Rústico Viñedo & Enológico");
  });

  it("stays well under the fast model's prompt budget with a 25-venue digest", () => {
    const digest = buildDigest(facets, { maxVenues: 25, maxExperiences: 10, maxChars: 4500 });
    const messages = buildStepMessages({
      transcript: makeTranscript(),
      facets,
      digest,
      stepIndex: 3,
      maxSteps: 7,
    });

    // The user message scales with the digest; the fixed system message is
    // small and constant regardless of knowledge-base size.
    const userContent = messages[1]?.content ?? "";
    expect(userContent.length).toBeLessThan(6000);

    // The fixed system message grew in the engine-quality layer (explicit
    // language rule, headroom guidance, style guide, one few-shot example)
    // to fix real truncation/language bugs — a deliberate, documented
    // trade: a few hundred extra prompt tokens for materially better
    // output, still comfortably inside any fast model's context window and
    // a small fraction of a step's end-to-end latency (dominated by
    // generation, not prompt processing).
    const totalChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    expect(totalChars).toBeLessThan(11000);
  });

  it("exports a stable prompt version string", () => {
    expect(ENGINE_PROMPT_VERSION.length).toBeGreaterThan(0);
  });
});
