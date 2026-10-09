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

/**
 * Total duration of the reel, in frames, for a given number of photo
 * scenes. Each scene after the first overlaps the previous one by
 * `CROSSFADE_FRAMES`, and the outro is appended at the end.
 *
 * With the defaults (3 photos) this is 330 frames = 11s @ 30fps.
 */
export function reelDurationInFrames(photoCount = 3): number {
  return photoCount * SCENE_FRAMES - (photoCount - 1) * CROSSFADE_FRAMES + OUTRO_FRAMES;
}

export interface SceneWindow {
  from: number;
  durationInFrames: number;
}

/**
 * The `<Sequence>` window (start frame + duration) for the photo scene at
 * `index`. Consecutive windows overlap by `CROSSFADE_FRAMES` so the
 * crossfade in `Slide.tsx` has frames from both scenes to blend across.
 */
export function sceneWindow(index: number): SceneWindow {
  const from = index * (SCENE_FRAMES - CROSSFADE_FRAMES);
  return { from, durationInFrames: SCENE_FRAMES };
}

/** Formats a frame number as "mm:ss" at `FPS`. */
export function formatTime(frame: number): string {
  const totalSeconds = Math.max(0, Math.floor(frame / FPS));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
