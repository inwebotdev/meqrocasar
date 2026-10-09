import { Swatch, type SwatchTone } from "@/components/ui";
import type { PaletteColor } from "@/domain/experience/types";
import { cn } from "@/lib/cn";

export interface PaletteStripProps {
  palette: readonly PaletteColor[];
  tone: SwatchTone;
  label: string;
}

export function PaletteStrip({ palette, tone, label }: PaletteStripProps) {
  return (
    <div className="space-y-space-xs">
      <span
        className={cn(
          "block font-label-sm text-label-sm tracking-wider uppercase",
          tone === "dark" ? "text-center text-on-primary/80" : "text-on-surface-variant",
        )}
      >
        {label}
      </span>
      <div className="grid grid-cols-4 gap-space-xs">
        {palette.map((color) => (
          <Swatch key={color.hex} hex={color.hex} name={color.name} tone={tone} />
        ))}
      </div>
    </div>
  );
}
