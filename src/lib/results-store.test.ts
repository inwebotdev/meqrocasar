/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";

import type { ExperienceResult } from "@/domain/experience/types";

import { clearResult, loadResult, RESULT_STORAGE_KEY, saveResult } from "./results-store";

const validResult: ExperienceResult = {
  conceptTitle: "Atardecer Dorado entre Viñedos",
  palette: [
    { hex: "#4B001A", name: "Vino Profundo" },
    { hex: "#944933", name: "Terracota" },
    { hex: "#E9A844", name: "Ámbar Bernal" },
    { hex: "#FCF9F3", name: "Lino" },
  ],
  narrative: "Una celebración íntima entre viñedos centenarios y atardeceres dorados.",
  reelTagline: "Su historia, entre viñedos y atardeceres.",
  searchQueries: ["boda viñedo querétaro"],
  venues: [],
  photos: [
    { url: "https://images.unsplash.com/photo-1", alt: "Viñedo", credit: "Autor A" },
    { url: "https://images.unsplash.com/photo-2", alt: "Atardecer", credit: "Autor B" },
    { url: "https://images.unsplash.com/photo-3", alt: "Cava", credit: "Autor C" },
  ],
  answers: {
    style: "rustic_vineyard",
    setting: "day_vineyard",
    experience: "intimate_boutique",
    mustHave: "wine_tasting",
  },
  meta: {
    model: "test-model",
    fallbackUsed: false,
    durationMs: 1234,
    generatedAt: "2026-01-01T00:00:00.000Z",
  },
};

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("results-store", () => {
  it("saveResult then loadResult round-trips the exact result", () => {
    saveResult(validResult);
    expect(loadResult()).toEqual(validResult);
  });

  it("loadResult returns undefined when nothing is stored", () => {
    expect(loadResult()).toBeUndefined();
  });

  it("loadResult returns undefined for invalid stored JSON", () => {
    window.sessionStorage.setItem(RESULT_STORAGE_KEY, "{ not json");
    expect(loadResult()).toBeUndefined();
  });

  it("loadResult returns undefined for data that fails schema validation", () => {
    window.sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify({ conceptTitle: "x" }));
    expect(loadResult()).toBeUndefined();
  });

  it("clearResult removes the stored result", () => {
    saveResult(validResult);
    clearResult();
    expect(loadResult()).toBeUndefined();
  });

  it("saveResult does not throw when sessionStorage.setItem throws (private mode)", () => {
    const original = window.sessionStorage.setItem;
    window.sessionStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    expect(() => saveResult(validResult)).not.toThrow();

    window.sessionStorage.setItem = original;
  });
});
