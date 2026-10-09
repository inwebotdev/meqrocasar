import { describe, expect, it } from "vitest";

import {
  CROSSFADE_FRAMES,
  formatTime,
  OUTRO_FRAMES,
  reelDurationInFrames,
  sceneWindow,
} from "./timing";

describe("reelDurationInFrames", () => {
  it("is 330 frames (11s @ 30fps) for 3 photos", () => {
    expect(reelDurationInFrames(3)).toBe(330);
    expect(reelDurationInFrames()).toBe(330);
  });
});

describe("sceneWindow", () => {
  it("overlaps consecutive scenes by CROSSFADE_FRAMES", () => {
    const first = sceneWindow(0);
    const second = sceneWindow(1);

    const firstEnd = first.from + first.durationInFrames;
    const overlap = firstEnd - second.from;

    expect(overlap).toBe(CROSSFADE_FRAMES);
  });

  it("the last scene ends at total - OUTRO_FRAMES", () => {
    const total = reelDurationInFrames(3);
    const last = sceneWindow(2);

    expect(last.from + last.durationInFrames).toBe(total - OUTRO_FRAMES);
  });
});

describe("formatTime", () => {
  it('formats frame 210 as "00:07"', () => {
    expect(formatTime(210)).toBe("00:07");
  });

  it('formats frame 0 as "00:00"', () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("pads minutes and seconds", () => {
    expect(formatTime(30 * 65)).toBe("01:05");
  });
});
