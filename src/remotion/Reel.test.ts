import { describe, expect, it } from "vitest";

import { activeSentence, narrationMusicVolume } from "./Reel";
import type { ReelNarrationSentence } from "./schema";
import { FPS } from "./timing";

const SENTENCES: ReelNarrationSentence[] = [
  { text: "Primera oración.", startSec: 0, endSec: 3 },
  { text: "Segunda oración.", startSec: 3.4, endSec: 6.3 },
  { text: "Tercera oración.", startSec: 6.5, endSec: 9.5 },
];

describe("activeSentence", () => {
  it("returns the sentence whose [startSec, endSec) window contains the given seconds", () => {
    expect(activeSentence(SENTENCES, 0)).toBe(SENTENCES[0]);
    expect(activeSentence(SENTENCES, 1.5)).toBe(SENTENCES[0]);
    expect(activeSentence(SENTENCES, 4)).toBe(SENTENCES[1]);
    expect(activeSentence(SENTENCES, 9.49)).toBe(SENTENCES[2]);
  });

  it("is inclusive of startSec and exclusive of endSec", () => {
    expect(activeSentence(SENTENCES, 3)).toBeUndefined(); // sentence 0 just ended
    expect(activeSentence(SENTENCES, 3.4)).toBe(SENTENCES[1]); // sentence 1 just started
    expect(activeSentence(SENTENCES, 9.5)).toBeUndefined(); // sentence 2 just ended
  });

  it("returns undefined in the silent gap between two sentences", () => {
    expect(activeSentence(SENTENCES, 3.2)).toBeUndefined();
  });

  it("returns undefined for an empty sentence list", () => {
    expect(activeSentence([], 1)).toBeUndefined();
  });
});

describe("narrationMusicVolume", () => {
  const NARRATION_DURATION_SEC = 10;

  it("is ducked (0.12) for every frame while the narration is speaking", () => {
    expect(narrationMusicVolume(0, NARRATION_DURATION_SEC)).toBeCloseTo(0.12, 5);
    expect(
      narrationMusicVolume(Math.floor(NARRATION_DURATION_SEC * FPS * 0.9), NARRATION_DURATION_SEC),
    ).toBeCloseTo(0.12, 5);
  });

  it("ramps back up to 0.8 once the narration has finished", () => {
    const afterRampUp = Math.ceil((NARRATION_DURATION_SEC + 1) * FPS);
    expect(narrationMusicVolume(afterRampUp, NARRATION_DURATION_SEC)).toBeCloseTo(0.8, 5);
  });

  it("is strictly between 0.12 and 0.8 while ramping up, right after the narration ends", () => {
    const midRamp = Math.round((NARRATION_DURATION_SEC + 0.5) * FPS);
    const volume = narrationMusicVolume(midRamp, NARRATION_DURATION_SEC);

    expect(volume).toBeGreaterThan(0.12);
    expect(volume).toBeLessThan(0.8);
  });
});
