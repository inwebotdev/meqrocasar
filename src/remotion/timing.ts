/** Frames per second for the wedding reel composition. */
export const FPS = 30;

/** Composition width in pixels (9:16 vertical). */
export const WIDTH = 1080;

/** Composition height in pixels (9:16 vertical). */
export const HEIGHT = 1920;

/** Duration of a single photo scene, in frames (3.5s @ 30fps). */
export const SCENE_FRAMES = 105;

/** Overlap between consecutive scenes used for the crossfade, in frames. */
export const CROSSFADE_FRAMES = 15;

/** Duration of the closing tagline card, in frames. */
export const OUTRO_FRAMES = 45;

function photoCountDurationInFrames(photoCount: number): number {
  return photoCount * SCENE_FRAMES - (photoCount - 1) * CROSSFADE_FRAMES + OUTRO_FRAMES;
}

export interface ReelDurationProps {
  /** The narration's spoken duration, when the reel has one — drives the duration instead of the fixed photo-scene math below. */
  narrationDurationSec?: number;
  photoCount?: number;
}

/**
 * Total duration of the reel, in frames.
 *
 * Without a narration (the original, still-supported call shape —
 * `reelDurationInFrames(photoCount)` or no args at all): each photo scene
 * after the first overlaps the previous one by `CROSSFADE_FRAMES`, and the
 * outro is appended at the end. With the defaults (3 photos) this is 330
 * frames = 11s @ 30fps.
 *
 * With a narration (`{ narrationDurationSec, photoCount? }`): the reel
 * runs for the narration's length plus 1.5s of breathing room before the
 * outro, floored at the same 330-frame minimum —
 * `max(330, ceil((narrationDurationSec + 1.5) * FPS))`.
 */
export function reelDurationInFrames(props?: number | ReelDurationProps): number {
  if (typeof props === "number") {
    return photoCountDurationInFrames(props);
  }

  const { narrationDurationSec, photoCount = 3 } = props ?? {};

  if (narrationDurationSec === undefined) {
    return photoCountDurationInFrames(photoCount);
  }

  return Math.max(330, Math.ceil((narrationDurationSec + 1.5) * FPS));
}

export interface SceneWindow {
  from: number;
  durationInFrames: number;
}

/**
 * The `<Sequence>` window (start frame + duration) for the photo scene at
 * `index`, assuming the original fixed `SCENE_FRAMES`-per-scene timing
 * (i.e. a reel whose total duration is the unnarrated
 * `reelDurationInFrames(photoCount)`). Consecutive windows overlap by
 * `CROSSFADE_FRAMES` so the crossfade in `Slide.tsx` has frames from both
 * scenes to blend across. Kept for callers that only ever render the
 * unnarrated reel; `Reel.tsx` itself uses `sceneWindows` so scenes also
 * stretch correctly across a narrated reel's (longer or shorter) total.
 */
export function sceneWindow(index: number): SceneWindow {
  const from = index * (SCENE_FRAMES - CROSSFADE_FRAMES);
  return { from, durationInFrames: SCENE_FRAMES };
}

/**
 * The `<Sequence>` windows for every photo scene, spread evenly across
 * `total - OUTRO_FRAMES` (so the outro always gets its fixed
 * `OUTRO_FRAMES` at the end) with the same `CROSSFADE_FRAMES` overlap
 * between consecutive scenes as `sceneWindow`. For the unnarrated default
 * (`total = reelDurationInFrames(photoCount)`) this reproduces exactly
 * the same windows as calling `sceneWindow(i)` for each `i`.
 */
export function sceneWindows(total: number, photoCount: number): SceneWindow[] {
  if (photoCount <= 0) return [];

  const available = total - OUTRO_FRAMES;
  const sceneDuration = Math.round((available + (photoCount - 1) * CROSSFADE_FRAMES) / photoCount);
  const step = Math.max(sceneDuration - CROSSFADE_FRAMES, 1);

  return Array.from({ length: photoCount }, (_, index) => {
    const from = index * step;
    const isLast = index === photoCount - 1;
    return { from, durationInFrames: isLast ? available - from : sceneDuration };
  });
}

/** Formats a frame number as "mm:ss" at `FPS`. */
export function formatTime(frame: number): string {
  const totalSeconds = Math.max(0, Math.floor(frame / FPS));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
