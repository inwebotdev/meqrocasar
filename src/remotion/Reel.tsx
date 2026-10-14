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

// --- bottom text-block layout -----------------------------------------------
//
// `TitleLayer`, the narrative line and the narration caption used to be
// three independent `AbsoluteFill`s, each anchoring itself to the bottom
// with its own hand-picked padding. Because none of them accounted for the
// others' height, a long 3-line title and a 3-line caption could (and did,
// see the screenshot that prompted this file) overlap. They're now a single
// bottom-anchored flex column — eyebrow, then a fixed-height title slot,
// then a fixed-height caption/narrative slot — stacked with a fixed gap, so
// no combination of title length and caption length can make them collide.

/** Horizontal inset from both edges of the frame for the text column. */
const TEXT_BLOCK_SIDE_PADDING = 56;

/**
 * Bottom inset for the text column — the same `96px` the `Rail` already
 * sits above the frame's bottom edge with, so the column's floor lines up
 * with the rail's instead of creeping into the 72px thumb-safe zone below
 * both of them.
 */
const TEXT_BLOCK_BOTTOM_PADDING = 96;

/** Keeps the text column clear of the `Rail`'s glass pill on the right. */
const TEXT_BLOCK_MAX_WIDTH = 680;

/** Fixed gap between the eyebrow, title and caption/narrative slots. */
const TEXT_BLOCK_GAP = 20;

const TITLE_LINE_HEIGHT = 1.1;
const TITLE_MAX_LINES = 2;

const CAPTION_FONT_SIZE = 40;
const CAPTION_LINE_HEIGHT = 1.25;
const CAPTION_MAX_LINES = 3;

/** Fixed height (3 lines @ `CAPTION_FONT_SIZE`/`CAPTION_LINE_HEIGHT`) reserved for the caption/narrative slot, so neither resizing it (fewer lines) nor it disappearing between narration sentences ever shifts the title above it. */
const CAPTION_BOX_HEIGHT = CAPTION_FONT_SIZE * CAPTION_LINE_HEIGHT * CAPTION_MAX_LINES;

/**
 * Title font size for a given title, scaled down so long titles still fit
 * their 2-line box instead of overflowing into the caption below:
 * `≤28` chars → 92px, `≤40` chars → 76px, longer → 64px (clamped to 2 lines
 * by `TitleBlock`'s fixed-height box regardless).
 */
export function titleFontSize(title: string): number {
  const length = title.trim().length;

  if (length <= 28) return 92;
  if (length <= 40) return 76;
  return 64;
}

function Eyebrow() {
  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 4,
        color: "#E9A844",
        textTransform: "uppercase",
      }}
    >
      {EYEBROW_TEXT}
    </div>
  );
}

/**
 * The reel's title: the original entrance animation (fade + rise over the
 * first second) unchanged, now in a fixed-height box — sized from
 * `titleFontSize` — that clamps at `TITLE_MAX_LINES` lines via `overflow:
 * hidden`, so it never grows into the caption/narrative slot below it.
 */
function TitleBlock({ title }: { title: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame: Math.min(frame, fps),
    fps,
    config: { damping: 200 },
  });

  const fontSize = titleFontSize(title);

  return (
    <div
      style={{
        opacity: entrance,
        transform: `translateY(${(1 - entrance) * 24}px)`,
        height: fontSize * TITLE_LINE_HEIGHT * TITLE_MAX_LINES,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize,
          fontWeight: 700,
          lineHeight: TITLE_LINE_HEIGHT,
          color: "#FAF8F5",
          display: "-webkit-box",
          WebkitLineClamp: TITLE_MAX_LINES,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {title}
      </div>
    </div>
  );
}

/** Shared fixed-height, fixed-font caption/narrative slot styling — see `CAPTION_BOX_HEIGHT`. */
function TextSlotBox({ opacity, text }: { opacity: number; text: string }) {
  return (
    <div style={{ height: CAPTION_BOX_HEIGHT, overflow: "hidden" }}>
      <div
        style={{
          opacity,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: CAPTION_FONT_SIZE,
          lineHeight: CAPTION_LINE_HEIGHT,
          color: "#F3F0EA",
          display: "-webkit-box",
          WebkitLineClamp: CAPTION_MAX_LINES,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {text}
      </div>
    </div>
  );
}

/**
 * The static (non-narrated) per-scene narrative line, in the same fixed
 * slot a narration caption uses: fades/rises in over `CROSSFADE_FRAMES`
 * from `localFrame` (the current scene's own elapsed frames, i.e. what a
 * `<Sequence>`-local `useCurrentFrame()` would have returned).
 */
function NarrativeSlot({ line, localFrame }: { line: string; localFrame: number }) {
  const progress = interpolate(localFrame, [0, CROSSFADE_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <TextSlotBox opacity={progress} text={line} />;
}

/**
 * One narration sentence's caption, in the same fixed slot
 * `NarrativeSlot` uses (which it replaces when the reel has a narration):
 * fades in/out over `CAPTION_FADE_FRAMES` at the sentence's own
 * `startSec`/`endSec`. Rendered (at opacity 0) even between sentences, so
 * the slot's reserved height never collapses and the title above it never
 * shifts.
 */
function CaptionSlot({ sentence }: { sentence: ReelNarrationSentence | undefined }) {
  const frame = useCurrentFrame();

  if (!sentence) {
    return <TextSlotBox opacity={0} text="" />;
  }

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

  return <TextSlotBox opacity={Math.min(fadeIn, fadeOut)} text={sentence.text} />;
}

interface BottomTextBlockProps {
  title: string;
  narrated: boolean;
  caption: ReelNarrationSentence | undefined;
  narrativeLine: string;
  narrativeLocalFrame: number;
}

/**
 * The single bottom-safe-zone flex column: eyebrow → title → caption (when
 * narrating) or the static narrative line (otherwise), each a fixed-height
 * slot stacked with a fixed `TEXT_BLOCK_GAP`, anchored above the thumb-safe
 * zone and the `Rail`. See the module-level comment above for why this
 * replaced three independently-positioned layers.
 */
function BottomTextBlock({
  title,
  narrated,
  caption,
  narrativeLine,
  narrativeLocalFrame,
}: BottomTextBlockProps) {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: `0 ${TEXT_BLOCK_SIDE_PADDING}px ${TEXT_BLOCK_BOTTOM_PADDING}px`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: TEXT_BLOCK_GAP,
          maxWidth: TEXT_BLOCK_MAX_WIDTH,
        }}
      >
        <Eyebrow />
        <TitleBlock title={title} />
        {narrated ? (
          <CaptionSlot sentence={caption} />
        ) : (
          <NarrativeSlot line={narrativeLine} localFrame={narrativeLocalFrame} />
        )}
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
  const narrated = narration !== undefined;
  const caption = narration ? activeSentence(narration.sentences, frame / FPS) : undefined;

  const activeSceneIndex = windows.findIndex(
    (window) => frame >= window.from && frame < window.from + window.durationInFrames,
  );
  const activeWindow = windows[activeSceneIndex] ?? windows[windows.length - 1];
  const narrativeLocalFrame = activeWindow ? frame - activeWindow.from : 0;
  const narrativeLine =
    narrativeLines[activeSceneIndex] ?? narrativeLines[narrativeLines.length - 1] ?? "";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#1c1c18",
        fontFamily: "'Plus Jakarta Sans', 'Playfair Display', serif",
      }}
    >
      {photos.map((photo, index) => {
        const { from, durationInFrames: sceneDuration } = windows[index];

        return (
          <Sequence key={photo.url} from={from} durationInFrames={sceneDuration}>
            <Slide photo={photo} index={index} />
          </Sequence>
        );
      })}

      <AbsoluteFill style={{ pointerEvents: "none", background: BOTTOM_SCRIM_GRADIENT }} />

      <BottomTextBlock
        title={title}
        narrated={narrated}
        caption={caption}
        narrativeLine={narrativeLine}
        narrativeLocalFrame={narrativeLocalFrame}
      />

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

      {/* The narration track is played by ReelPlayer with a plain <audio> element kept in sync with the player. */}
    </AbsoluteFill>
  );
}
