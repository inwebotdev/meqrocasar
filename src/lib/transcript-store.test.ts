/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";

import type { Transcript } from "@/domain/quiz/transcript";

import {
  clearTranscript,
  loadTranscript,
  saveTranscript,
  TRANSCRIPT_STORAGE_KEY,
} from "./transcript-store";

const validTranscript: Transcript = {
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
  ],
};

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("transcript-store", () => {
  it("saveTranscript then loadTranscript round-trips the exact transcript", () => {
    saveTranscript(validTranscript);
    expect(loadTranscript()).toEqual(validTranscript);
  });

  it("loadTranscript returns undefined when nothing is stored", () => {
    expect(loadTranscript()).toBeUndefined();
  });

  it("loadTranscript returns undefined for invalid stored JSON", () => {
    window.sessionStorage.setItem(TRANSCRIPT_STORAGE_KEY, "{ not json");
    expect(loadTranscript()).toBeUndefined();
  });

  it("loadTranscript returns undefined for data that fails schema validation", () => {
    window.sessionStorage.setItem(
      TRANSCRIPT_STORAGE_KEY,
      JSON.stringify({ entries: [{ stepId: "x" }] }),
    );
    expect(loadTranscript()).toBeUndefined();
  });

  it("clearTranscript removes the stored transcript", () => {
    saveTranscript(validTranscript);
    clearTranscript();
    expect(loadTranscript()).toBeUndefined();
  });

  it("saveTranscript does not throw when sessionStorage.setItem throws (private mode)", () => {
    const original = window.sessionStorage.setItem;
    window.sessionStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    expect(() => saveTranscript(validTranscript)).not.toThrow();

    window.sessionStorage.setItem = original;
  });
});
