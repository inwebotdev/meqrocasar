import { describe, expect, it } from "vitest";

import { getStep } from "./questions";
import type { QuizAnswers } from "./schema";
import {
  entryFromCuratedOption,
  foldFacets,
  transcriptFromLegacyAnswers,
  type TranscriptEntry,
} from "./transcript";

function makeEntry(facets: TranscriptEntry["chosen"]["facets"]): TranscriptEntry {
  return {
    stepId: "test",
    question: "¿Pregunta?",
    topic: "Tema",
    chosen: {
      id: "opt",
      title: "Título",
      summary: "Resumen",
      facets,
      refs: { venueIds: [], experienceIds: [] },
    },
  };
}

describe("foldFacets", () => {
  it("merges facets from every entry", () => {
    const entries = [makeEntry({ style: "colonial" }), makeEntry({ zone: "bernal" })];
    expect(foldFacets(entries)).toEqual({ style: "colonial", zone: "bernal" });
  });

  it("lets a later entry override an earlier one for the same key", () => {
    const entries = [
      makeEntry({ scale: "intimate" }),
      makeEntry({ scale: "grand" }),
      makeEntry({ scale: "medium" }),
    ];
    expect(foldFacets(entries).scale).toBe("medium");
  });

  it("returns an empty object for no entries", () => {
    expect(foldFacets([])).toEqual({});
  });
});

describe("entryFromCuratedOption", () => {
  it("builds an entry with a venue ref resolved from the option's venueHint", () => {
    const step = getStep("style");
    const option = step.options.find((candidate) => candidate.id === "rustic_vineyard");
    if (!option) throw new Error("fixture missing");

    const entry = entryFromCuratedOption(step, option);

    expect(entry.stepId).toBe("style");
    expect(entry.chosen.id).toBe("rustic_vineyard");
    expect(entry.chosen.facets.style).toBe("rustic_vineyard");
    expect(entry.chosen.refs.venueIds).toEqual(["v_vinedos-la-redonda"]);
    expect(entry.chosen.refs.experienceIds).toEqual([]);
  });

  it("carries the weekend-getaway scale and lodging facets from the experience step", () => {
    const step = getStep("experience");
    const option = step.options.find((candidate) => candidate.id === "weekend_getaway");
    if (!option) throw new Error("fixture missing");

    const entry = entryFromCuratedOption(step, option);

    expect(entry.chosen.facets.scale).toBe("medium");
    expect(entry.chosen.facets.lodging).toBe("needed");
  });
});

describe("transcriptFromLegacyAnswers", () => {
  const answers: QuizAnswers = {
    style: "rustic_vineyard",
    setting: "day_vineyard",
    experience: "intimate_boutique",
    mustHave: "wine_tasting",
  };

  it("yields exactly 4 entries, one per legacy step, in order", () => {
    const transcript = transcriptFromLegacyAnswers(answers);
    expect(transcript.entries).toHaveLength(4);
    expect(transcript.entries.map((entry) => entry.stepId)).toEqual([
      "style",
      "setting",
      "experience",
      "mustHave",
    ]);
  });

  it("folds into the same facets as facetsFromLegacyAnswers would", () => {
    const transcript = transcriptFromLegacyAnswers(answers);
    const folded = foldFacets(transcript.entries);

    expect(folded).toEqual({
      style: "rustic_vineyard",
      setting: "day_vineyard",
      scale: "intimate",
      experience: "wine_tasting",
    });
  });
});
