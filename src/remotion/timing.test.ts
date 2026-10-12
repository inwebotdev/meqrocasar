import { describe, expect, it } from "vitest";

import {
  CROSSFADE_FRAMES,
  FPS,
  formatTime,
  OUTRO_FRAMES,
  reelDurationInFrames,
  sceneWindow,
  sceneWindows,
} from "./timing";

describe("reelDurationInFrames", () => {
  it("is 330 frames (11s @ 30fps) for 3 photos (number arg, no args, and object arg without a narration)", () => {
    expect(reelDurationInFrames(3)).toBe(330);
    expect(reelDurationInFrames()).toBe(330);
    expect(reelDurationInFrames({ photoCount: 3 })).toBe(330);
  });

  it("is max(330, ceil((narrationDurationSec + 1.5) * FPS)) when a narration duration is given", () => {
    // ceil((20 + 1.5) * 30) = 645
    expect(reelDurationInFrames({ narrationDurationSec: 20 })).toBe(645);
    // a short narration never shrinks below the 330-frame floor
    expect(reelDurationInFrames({ narrationDurationSec: 2 })).toBe(330);
  });

  it("rounds a fractional narration duration up", () => {
    // ceil((18.41 + 1.5) * 30) = ceil(597.3) = 598
    expect(reelDurationInFrames({ narrationDurationSec: 18.41 })).toBe(598);
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

describe("sceneWindows", () => {
  it("reproduces the same windows as sceneWindow for the unnarrated default (3 photos, 330 total)", () => {
    const total = reelDurationInFrames(3);
    const windows = sceneWindows(total, 3);

    expect(windows).toEqual([sceneWindow(0), sceneWindow(1), sceneWindow(2)]);
  });

  it("overlaps consecutive scenes by CROSSFADE_FRAMES for a stretched (narrated) total", () => {
    const total = reelDurationInFrames({ narrationDurationSec: 20 });
    const windows = sceneWindows(total, 3);

    for (let i = 0; i < windows.length - 1; i++) {
      const end = windows[i].from + windows[i].durationInFrames;
      expect(end - windows[i + 1].from).toBe(CROSSFADE_FRAMES);
    }
  });

  it("the last scene always ends exactly at total - OUTRO_FRAMES, for a shrunk or stretched total", () => {
    for (const total of [
      reelDurationInFrames({ narrationDurationSec: 2 }),
      reelDurationInFrames({ narrationDurationSec: 37 }),
    ]) {
      const windows = sceneWindows(total, 3);
      const last = windows[windows.length - 1];

      expect(last.from + last.durationInFrames).toBe(total - OUTRO_FRAMES);
    }
  });

  it("spreads scenes roughly evenly (no single scene is drastically longer than the others)", () => {
    const total = reelDurationInFrames({ narrationDurationSec: 20 });
    const windows = sceneWindows(total, 3);
    const durations = windows.map((w) => w.durationInFrames);

    expect(Math.max(...durations) - Math.min(...durations)).toBeLessThanOrEqual(CROSSFADE_FRAMES);
  });

  it("returns an empty array for 0 photos", () => {
    expect(sceneWindows(reelDurationInFrames(0), 0)).toEqual([]);
  });
});

describe("FPS", () => {
  it("is 30", () => {
    expect(FPS).toBe(30);
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
