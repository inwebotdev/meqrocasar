import { describe, expect, it } from "vitest";

import { estimateDurationSec, sentenceTimings, type NarrationAlignment } from "./narration";

const TEXT = "Uno. Dos. Tres.";

/** One char every 0.1s, matching `TEXT` exactly (`chars[i]` ↔ `TEXT[i]`). */
function buildAlignment(text: string): NarrationAlignment {
  const chars = text.split("");
  return {
    chars,
    startSec: chars.map((_, index) => Number((index * 0.1).toFixed(2))),
    endSec: chars.map((_, index) => Number(((index + 1) * 0.1).toFixed(2))),
  };
}

describe("estimateDurationSec", () => {
  it("is the alignment's last character's end time", () => {
    const alignment = buildAlignment(TEXT);
    expect(estimateDurationSec(alignment)).toBeCloseTo(1.5, 5);
  });

  it("is 0 for an empty alignment", () => {
    expect(estimateDurationSec({ chars: [], startSec: [], endSec: [] })).toBe(0);
  });
});

describe("sentenceTimings", () => {
  it("splits a 3-sentence script and maps each sentence onto the alignment's times", () => {
    const alignment = buildAlignment(TEXT);
    const sentences = sentenceTimings(TEXT, alignment, estimateDurationSec(alignment));

    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toEqual({ text: "Uno.", startSec: 0, endSec: 0.4 });
    expect(sentences[1]).toEqual({ text: "Dos.", startSec: 0.5, endSec: 0.9 });
    expect(sentences[2]).toEqual({ text: "Tres.", startSec: 1, endSec: 1.5 });
  });

  it("never splits on a decimal point or an abbreviation (no trailing whitespace after the dot)", () => {
    const text = "El precio es $3.5 por persona.";
    const alignment = buildAlignment(text);
    const sentences = sentenceTimings(text, alignment, estimateDurationSec(alignment));

    expect(sentences).toHaveLength(1);
    expect(sentences[0]?.text).toBe(text);
  });

  it("distributes evenly across durationSec when there's no alignment", () => {
    const sentences = sentenceTimings(TEXT, undefined, 3);

    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toEqual({ text: "Uno.", startSec: 0, endSec: 1 });
    expect(sentences[1]).toEqual({ text: "Dos.", startSec: 1, endSec: 2 });
    expect(sentences[2]).toEqual({ text: "Tres.", startSec: 2, endSec: 3 });
  });

  it("returns an empty array for an empty script", () => {
    expect(sentenceTimings("", undefined, 10)).toEqual([]);
  });

  it("handles a trailing fragment with no terminal punctuation", () => {
    const text = "Uno. Dos sin punto final";
    const sentences = sentenceTimings(text, undefined, 2);

    expect(sentences).toHaveLength(2);
    expect(sentences[1]?.text).toBe("Dos sin punto final");
  });
});
