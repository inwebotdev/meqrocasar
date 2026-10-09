import { AbsoluteFill } from "remotion";

export interface RailPaletteColor {
  hex: string;
  name: string;
}

export interface RailProps {
  trackName: string;
  palette: RailPaletteColor[];
}

/**
 * Right-hand vertical rail: a glass pill with the audio track name and the
 * 4 palette dots, sitting above the 72px thumb-safe zone at the base.
 */
export function Rail({ trackName, palette }: RailProps) {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          right: 32,
          bottom: 96,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            padding: "10px 18px",
            backgroundColor: "rgba(255, 255, 255, 0.16)",
            backdropFilter: "blur(12px)",
            color: "#FAF8F5",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 22,
            fontWeight: 600,
            maxWidth: 280,
          }}
        >
          <span>♫</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {trackName}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {palette.map((color) => (
            <div
              key={color.hex}
              title={color.name}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: color.hex,
                border: "2px solid rgba(255, 255, 255, 0.6)",
              }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
