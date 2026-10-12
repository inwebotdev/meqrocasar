import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { ReelProps } from "./schema";
import { Rail } from "./Rail";
import { Slide } from "./Slide";
import { CROSSFADE_FRAMES, OUTRO_FRAMES, sceneWindow } from "./timing";

const EYEBROW_TEXT = "QUERÉTARO ROMANCE · SECTUR";
const SEAL_TEXT = "SECRETARÍA DE TURISMO · QUERÉTARO";

const BOTTOM_SCRIM_GRADIENT =
  "linear-gradient(to top, rgba(20, 10, 12, 0.85) 0%, rgba(20, 10, 12, 0) 50%)";

function TitleLayer({ title }: { title: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: Math.min(frame, fps),
    fps,
    config: { damping: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        justifyContent: "flex-end",
        padding: "0 56px 220px",
      }}
    >
      <div
        style={{
          opacity: entrance,
          transform: `translateY(${(1 - entrance) * 24}px)`,
        }}
      >
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 4,
            color: "#E9A844",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          {EYEBROW_TEXT}
        </div>
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1.05,
            color: "#FAF8F5",
          }}
        >
          {title}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function NarrativeLine({ line }: { line: string }) {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        justifyContent: "flex-end",
        padding: "0 56px 120px",
      }}
    >
      <div
        style={{
          opacity: progress,
          transform: `translateY(${(1 - progress) * 16}px)`,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 44,
          lineHeight: 1.3,
          color: "#F3F0EA",
          maxWidth: "90%",
        }}
      >
        {line}
      </div>
    </AbsoluteFill>
  );
}

function OutroCard({ tagline }: { tagline: string }) {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#4A1525",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          padding: "0 64px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 64,
            fontWeight: 700,
            color: "#FAF8F5",
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#FFDDB3",
          }}
        >
          {SEAL_TEXT}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Root composition: 3 crossfading photo scenes + a closing tagline card. */
export function WeddingReel(props: ReelProps) {
  const { title, tagline, narrativeLines, photos, palette, trackName, audioSrc } = props;
  const { durationInFrames } = useVideoConfig();
  const outroFrom = durationInFrames - OUTRO_FRAMES;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1c1c18",
        fontFamily: "'Plus Jakarta Sans', 'Playfair Display', serif",
      }}
    >
      {photos.map((photo, index) => {
        const { from, durationInFrames: sceneDuration } = sceneWindow(index);
        const line = narrativeLines[index] ?? narrativeLines[narrativeLines.length - 1];

        return (
          <Sequence key={photo.url} from={from} durationInFrames={sceneDuration}>
            <Slide photo={photo} index={index} />
            {line && <NarrativeLine line={line} />}
          </Sequence>
        );
      })}

      <AbsoluteFill style={{ pointerEvents: "none", background: BOTTOM_SCRIM_GRADIENT }} />

      <TitleLayer title={title} />

      <Rail trackName={trackName} palette={palette} />

      <Sequence from={outroFrom} durationInFrames={OUTRO_FRAMES}>
        <OutroCard tagline={tagline} />
      </Sequence>

      {audioSrc && (
        <Audio
          src={audioSrc}
          volume={(f) =>
            interpolate(f, [0, 30, durationInFrames - 45, durationInFrames], [0, 0.8, 0.8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      )}
    </AbsoluteFill>
  );
}
