import type { MoodboardParams } from "./params";

/**
 * Pure presentational template rendered by `next/og`'s Satori engine into
 * the 1200x630 moodboard PNG. No hooks, no Next.js imports: this must stay
 * usable from both the route handler (via `ImageResponse`) and from plain
 * `react-dom/server` in tests.
 *
 * Satori layout constraints (see module docs in the og route):
 * - Every `<div>` with more than one child needs `display: "flex"` and an
 *   explicit `flexDirection`.
 * - Images need literal pixel `width`/`height`.
 */

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;
const OUTER_PADDING = 24;
const GUTTER = 16;

const CONTENT_WIDTH = CANVAS_WIDTH - OUTER_PADDING * 2; // 1152
const CONTENT_HEIGHT = CANVAS_HEIGHT - OUTER_PADDING * 2; // 582

const LEFT_WIDTH = 700;
const RIGHT_WIDTH = CONTENT_WIDTH - LEFT_WIDTH; // 452

const DETAIL_PHOTO_HEIGHT = (CONTENT_HEIGHT - GUTTER) / 2; // 283

const RADIUS_LG = 24;
const RADIUS_SM = 12;

const LINEN = "#F7F4EE";
const DEEP_BURGUNDY = "#812B47";
const AMBER = "#CDBA7B";

const TITLE_MAX_CHARS = 70;

// The typography card's internal sizing is computed (not eyeballed) so a
// truncated, 2-line title never overlaps the palette/zone row below it.
const CARD_PADDING = 28;
const TITLE_FONT_SIZE = 38;
const TITLE_LINE_HEIGHT = 1.1;
const TITLE_BOX_HEIGHT = Math.ceil(TITLE_FONT_SIZE * TITLE_LINE_HEIGHT * 2); // 2 lines, 84
const TITLE_ROW2_GAP = 14;
const ROW2_HEIGHT = 68; // 34px swatch circle + 6px gap + 2 label lines

const TYPOGRAPHY_CARD_HEIGHT = CARD_PADDING * 2 + TITLE_BOX_HEIGHT + TITLE_ROW2_GAP + ROW2_HEIGHT; // 222
const HERO_HEIGHT = CONTENT_HEIGHT - TYPOGRAPHY_CARD_HEIGHT - GUTTER; // 344

export interface MoodboardTemplateProps {
  params: MoodboardParams;
  /** Data URLs, or any non-`data:` string when a photo failed to load (renders a palette-color fallback block instead). */
  images: [string, string, string];
}

/** Truncates `title` to ~`maxChars` characters, adding an ellipsis when cut. */
export function truncateTitle(title: string, maxChars: number = TITLE_MAX_CHARS): string {
  if (title.length <= maxChars) return title;
  return `${title.slice(0, maxChars - 1).trimEnd()}…`;
}

function isDataUrl(value: string): boolean {
  return value.startsWith("data:");
}

/** "PUEBLO MÁGICO · {zone}", or just `{zone}` when it already names Querétaro. */
function zoneLabel(zone: string): string {
  return zone.includes("Querétaro") ? zone : `PUEBLO MÁGICO · ${zone}`;
}

interface PhotoSlotProps {
  src: string;
  fallbackHex: string;
  width: number;
  height: number;
  radius?: number;
}

/** Renders `src` as a cover image, or a solid palette-color block when it isn't a data URL (a failed fetch). */
function PhotoSlot({ src, fallbackHex, width, height, radius = RADIUS_LG }: PhotoSlotProps) {
  if (isDataUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Satori needs a plain <img>, not next/image.
      <img
        src={src}
        width={width}
        height={height}
        alt=""
        style={{ width, height, objectFit: "cover", borderRadius: radius }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        backgroundColor: fallbackHex,
        borderRadius: radius,
      }}
    />
  );
}

function TagPill({
  text,
  top,
  left,
  background,
  color,
}: {
  text: string;
  top: number;
  left: number;
  background: string;
  color: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        display: "flex",
        alignItems: "center",
        background,
        borderRadius: 999,
        padding: "8px 14px",
      }}
    >
      <div
        style={{
          fontFamily: "Plus Jakarta Sans",
          fontWeight: 700,
          fontSize: 11,
          lineHeight: 1,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function TaglinePill({ tagline, bottom, left }: { tagline: string; bottom: number; left: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom,
        left,
        display: "flex",
        alignItems: "center",
        background: "rgba(129,43,71,0.78)",
        borderRadius: RADIUS_SM,
        padding: "10px 16px",
      }}
    >
      <div
        style={{
          fontFamily: "Playfair Display",
          fontWeight: 600,
          fontSize: 18,
          lineHeight: 1.2,
          color: "#FAF8F5",
        }}
      >
        {tagline}
      </div>
    </div>
  );
}

function SealPill() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        background: "rgba(129,43,71,0.9)",
        borderRadius: 999,
        border: "1px solid rgba(205,186,123,0.7)",
        padding: "10px 16px",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 6,
          height: 6,
          borderRadius: 999,
          backgroundColor: AMBER,
        }}
      />
      <div
        style={{
          fontFamily: "Plus Jakarta Sans",
          fontWeight: 700,
          fontSize: 13,
          lineHeight: 1,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "#F1E9D2",
        }}
      >
        SECRETARÍA DE TURISMO · QUERÉTARO
      </div>
    </div>
  );
}

function PaletteSwatch({ hex, name }: { hex: string; name: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 72 }}>
      <div
        style={{
          display: "flex",
          width: 34,
          height: 34,
          borderRadius: 999,
          backgroundColor: hex,
          border: "1px solid rgba(205,186,123,0.6)",
        }}
      />
      <div
        style={{
          marginTop: 6,
          fontFamily: "Plus Jakarta Sans",
          fontWeight: 700,
          fontSize: 12,
          lineHeight: 1.2,
          color: "#F4D6DC",
        }}
      >
        {hex.toUpperCase()}
      </div>
      <div
        style={{
          fontFamily: "Plus Jakarta Sans",
          fontWeight: 400,
          fontSize: 11,
          lineHeight: 1.2,
          color: "#EBD9C8",
        }}
      >
        {name}
      </div>
    </div>
  );
}

export function MoodboardTemplate({ params, images }: MoodboardTemplateProps) {
  const [heroImage, detailImageTop, detailImageBottom] = images;
  const title = truncateTitle(params.title);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        padding: OUTER_PADDING,
        backgroundColor: LINEN,
      }}
    >
      {/* Left column: hero photo + typography card */}
      <div style={{ display: "flex", flexDirection: "column", width: LEFT_WIDTH }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: LEFT_WIDTH,
            height: HERO_HEIGHT,
          }}
        >
          <PhotoSlot
            src={heroImage}
            fallbackHex={params.palette[0].hex}
            width={LEFT_WIDTH}
            height={HERO_HEIGHT}
          />
          <TagPill
            text="QUERÉTARO ROMANCE · SECTUR"
            top={16}
            left={16}
            background="rgba(252,249,243,0.9)"
            color="#812B47"
          />
          {params.tagline ? <TaglinePill tagline={params.tagline} bottom={16} left={16} /> : null}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: LEFT_WIDTH,
            height: TYPOGRAPHY_CARD_HEIGHT,
            marginTop: GUTTER,
            backgroundColor: DEEP_BURGUNDY,
            borderRadius: RADIUS_LG,
            padding: CARD_PADDING,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              width: LEFT_WIDTH - CARD_PADDING * 2,
              height: TITLE_BOX_HEIGHT,
              overflow: "hidden",
              fontFamily: "Playfair Display",
              fontWeight: 700,
              fontSize: TITLE_FONT_SIZE,
              lineHeight: TITLE_LINE_HEIGHT,
              color: "#FAF8F5",
            }}
          >
            {title}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              height: ROW2_HEIGHT,
              marginTop: TITLE_ROW2_GAP,
            }}
          >
            <div style={{ display: "flex", flexDirection: "row", gap: 12 }}>
              {params.palette.map((color) => (
                <PaletteSwatch key={color.hex} hex={color.hex} name={color.name} />
              ))}
            </div>

            <div
              style={{
                display: "flex",
                fontFamily: "Plus Jakarta Sans",
                fontWeight: 600,
                fontSize: 12,
                lineHeight: 1.2,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: AMBER,
              }}
            >
              {zoneLabel(params.zone)}
            </div>
          </div>
        </div>
      </div>

      {/* Right column: two stacked detail photos, seal over the bottom one */}
      <div
        style={{ display: "flex", flexDirection: "column", width: RIGHT_WIDTH, marginLeft: GUTTER }}
      >
        <PhotoSlot
          src={detailImageTop}
          fallbackHex={params.palette[1].hex}
          width={RIGHT_WIDTH}
          height={DETAIL_PHOTO_HEIGHT}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: RIGHT_WIDTH,
            height: DETAIL_PHOTO_HEIGHT,
            marginTop: GUTTER,
          }}
        >
          <PhotoSlot
            src={detailImageBottom}
            fallbackHex={params.palette[2].hex}
            width={RIGHT_WIDTH}
            height={DETAIL_PHOTO_HEIGHT}
          />
          <SealPill />
        </div>
      </div>
    </div>
  );
}
