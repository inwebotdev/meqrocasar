import { Pill } from "@/components/ui";
import type { PaletteColor } from "@/domain/experience/types";

import { PaletteStrip } from "./PaletteStrip";

export interface HeroCardProps {
  title: string;
  narrative: string;
  palette: readonly PaletteColor[];
}

export function HeroCard({ title, narrative, palette }: HeroCardProps) {
  const [firstParagraph] = narrative.split("\n\n");

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary-container to-secondary p-space-lg text-on-primary shadow-xl">
      <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-secondary-container/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-primary-fixed/20 blur-xl" />
      <div className="relative z-10 flex flex-col items-center space-y-space-sm text-center">
        <Pill
          tone="glass-light"
          icon="hotel_class"
          className="bg-white/15 tracking-wider uppercase backdrop-blur-md [&>span:first-child]:text-tertiary-fixed-dim"
        >
          Curaduría Romance SECTUR Querétaro
        </Pill>
        <div className="space-y-1">
          <h1 className="font-display-hero-mobile text-display-hero-mobile leading-tight font-bold text-on-primary">
            {title}
          </h1>
        </div>
        <p className="max-w-xs font-body-md text-body-md text-surface-container-low/90">
          {firstParagraph}
        </p>
        <div className="w-full pt-space-xs">
          <div className="space-y-space-xs rounded-xl bg-black/25 p-space-sm backdrop-blur-sm">
            <PaletteStrip palette={palette} tone="dark" label="Paleta de Color Sugerida" />
          </div>
        </div>
      </div>
    </div>
  );
}
