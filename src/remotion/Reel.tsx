import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { ReelNarrationSentence, ReelProps } from "./schema";
import { Rail } from "./Rail";
import { Slide } from "./Slide";
import { CROSSFADE_FRAMES, FPS, OUTRO_FRAMES, sceneWindows } from "./timing";

const EYEBROW_TEXT = "QUERÉTARO ROMANCE · SECTUR";
const SEAL_TEXT = "SECRETARÍA DE TURISMO · QUERÉTARO";

/** Caption fade in/out, in frames, at each sentence's `startSec`/`endSec` boundary. */
const CAPTION_FADE_FRAMES = 8;

/** Background-music volume while the narration is speaking — ducked well below the un-narrated 0.8 so the voice stays intelligible. */
const DUCKED_MUSIC_VOLUME = 0.12;

/** Background-music volume once the narration has finished (same level as the un-narrated reel). */
const FULL_MUSIC_VOLUME = 0.8;

/** How long, in seconds, the music takes to ramp from ducked back to full once the narration ends. */
const MUSIC_RAMP_UP_SEC = 1;

/**
 * The sentence from `sentences` whose `[startSec, endSec)` window contains
 * `seconds`, or `undefined` between/after sentences (no caption shown).
 */
export function activeSentence(
  sentences: readonly ReelNarrationSentence[],
  seconds: number,
): ReelNarrationSentence | undefined {
  return sentences.find((sentence) => seconds >= sentence.startSec && seconds < sentence.endSec);
}

/**
 * Background-music volume while a narration track plays: ducked to
 * `DUCKED_MUSIC_VOLUME` for as long as the narration is speaking
 * (`frame/FPS < narrationDurationSec`), then ramped back up to
 * `FULL_MUSIC_VOLUME` over `MUSIC_RAMP_UP_SEC` once it ends. The reel's
 * existing start/end fade (see `backgroundMusicVolume`) is layered on top
 * of this, not replaced by it.
 */
export function narrationMusicVolume(frame: number, narrationDurationSec: number): number {
  const seconds = frame / FPS;

  return interpolate(
    seconds,
    [narrationDurationSec, narrationDurationSec + MUSIC_RAMP_UP_SEC],
    [DUCKED_MUSIC_VOLUME, FULL_MUSIC_VOLUME],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

/**
 * The background-music `<Audio>` volume at `frame`: the original fade-in
 * (0 → 0.8 over the first second) and fade-out (0.8 → 0 over the last 1.5s)
 * when there's no narration, or the narration duck/ramp above when there
 * is — either way multiplied by the same tail fade-out so the ending is
 * unchanged.
 */
function backgroundMusicVolume(
  frame: number,
  durationInFrames: number,
  narrationDurationSec: number | undefined,
): number {
  const base =
    narrationDurationSec === undefined
      ? interpolate(frame, [0, 30], [0, FULL_MUSIC_VOLUME], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : narrationMusicVolume(frame, narrationDurationSec);

  const fadeOut = interpolate(frame, [durationInFrames - 45, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return base * fadeOut;
}

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

/**
 * One narration sentence's caption, in the same bottom-scrim safe zone as
 * `NarrativeLine` (which it replaces when the reel has a narration): fades
 * in/out over `CAPTION_FADE_FRAMES` at the sentence's own `startSec`/
 * `endSec`, clamped to at most 3 lines.
 */
function Caption({ sentence }: { sentence: ReelNarrationSentence }) {
  const frame = useCurrentFrame();

  const startFrame = sentence.startSec * FPS;
  const endFrame = sentence.endSec * FPS;

  const fadeIn = interpolate(frame, [startFrame, startFrame + CAPTION_FADE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [endFrame - CAPTION_FADE_FRAMES, endFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        justifyContent: "flex-end",
        padding: "0 56px 140px",
      }}
    >
      <div
        style={{
          opacity,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 40,
          lineHeight: 1.3,
          color: "#F3F0EA",
          maxWidth: "90%",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {sentence.text}
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

/** Root composition: crossfading photo scenes + a closing tagline card, narrated when the experience has a ready narration. */
export function WeddingReel(props: ReelProps) {
  const { title, tagline, narrativeLines, photos, palette, trackName, audioSrc, narration } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const outroFrom = durationInFrames - OUTRO_FRAMES;
  const windows = sceneWindows(durationInFrames, photos.length);
  const caption = narration ? activeSentence(narration.sentences, frame / FPS) : undefined;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1c1c18",
        fontFamily: "'Plus Jakarta Sans', 'Playfair Display', serif",
      }}
    >
      {photos.map((photo, index) => {
        const { from, durationInFrames: sceneDuration } = windows[index];
        const line = narrativeLines[index] ?? narrativeLines[narrativeLines.length - 1];

        return (
          <Sequence key={photo.url} from={from} durationInFrames={sceneDuration}>
            <Slide photo={photo} index={index} />
            {!narration && line && <NarrativeLine line={line} />}
          </Sequence>
        );
      })}

      <AbsoluteFill style={{ pointerEvents: "none", background: BOTTOM_SCRIM_GRADIENT }} />

      <TitleLayer title={title} />

      {caption && <Caption sentence={caption} />}

      <Rail trackName={trackName} palette={palette} />

      <Sequence from={outroFrom} durationInFrames={OUTRO_FRAMES}>
        <OutroCard tagline={tagline} />
      </Sequence>

      {audioSrc && (
        <Audio
          src={audioSrc}
          volume={(f) => backgroundMusicVolume(f, durationInFrames, narration?.durationSec)}
        />
      )}

      {narration && <Audio src={narration.src} />}
    </AbsoluteFill>
  );
}
