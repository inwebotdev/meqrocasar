import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";

import { CROSSFADE_FRAMES, SCENE_FRAMES } from "./timing";

export interface SlidePhoto {
  url: string;
  alt: string;
}

export interface SlideProps {
  photo: SlidePhoto;
  index: number;
  caption?: string;
}

const KEN_BURNS_END_SCALE = 1.12;
const PAN_DISTANCE_PERCENT = 3;

/**
 * One full-bleed photo scene with a slow Ken Burns zoom/pan and a
 * crossfade in/out at the scene boundaries.
 */
export function Slide({ photo, index }: SlideProps) {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, SCENE_FRAMES], [1, KEN_BURNS_END_SCALE], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const panDirection = index % 2 === 0 ? 1 : -1;
  const panPercent = interpolate(
    frame,
    [0, SCENE_FRAMES],
    [0, PAN_DISTANCE_PERCENT * panDirection],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const opacity = interpolate(
    frame,
    [0, CROSSFADE_FRAMES, SCENE_FRAMES - CROSSFADE_FRAMES, SCENE_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${panPercent}%, 0)`,
        }}
      >
        <Img
          src={photo.url}
          alt={photo.alt}
          crossOrigin="anonymous"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
