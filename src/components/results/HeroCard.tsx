import { Pill } from "@/components/ui";

export interface HeroCardProps {
  title: string;
  narrative: string;
}

/** First one or two sentences of the narrative, capped so the hero stays short like the design. */
export function heroSummary(narrative: string, maxChars = 200): string {
  const firstParagraph = narrative.split("\n\n")[0] ?? narrative;
  const sentences = firstParagraph.split(/(?<=[.!?…])\s+/).filter(Boolean);
  let out = "";
  for (const sentence of sentences) {
    if (out.length > 0 && (out + " " + sentence).length > maxChars) break;
    out = out ? `${out} ${sentence}` : sentence;
    if (out.length >= maxChars) break;
  }
  return out.length > maxChars ? `${out.slice(0, maxChars - 1).trimEnd()}…` : out;
}

export function HeroCard({ title, narrative }: HeroCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-secondary to-primary p-space-lg text-on-primary shadow-xl">
      <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-surface-container-low/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-primary-fixed/20 blur-xl" />
      <div className="relative z-10 flex flex-col items-center space-y-space-sm text-center">
        <Pill
          tone="glass-light"
          icon="hotel_class"
          className="bg-white/85 tracking-wider text-primary uppercase [&>span:first-child]:text-secondary"
        >
          Curaduría Romance SECTUR Querétaro
        </Pill>
        <h1 className="font-display-hero-mobile text-display-hero-mobile leading-tight font-bold text-on-primary">
          {title}
        </h1>
        <p className="max-w-xs font-body-sm text-body-sm text-surface-container-low/90">
          {heroSummary(narrative)}
        </p>
        <div className="w-full pt-space-xs">
          <Pill
            tone="glass-light"
            icon="favorite"
            className="w-full justify-center bg-primary/50 text-on-primary/90 backdrop-blur-sm [&>span:first-child]:text-primary-fixed-dim"
          >
            Selección exclusiva inspirada en el romance queretano
          </Pill>
        </div>
      </div>
    </div>
  );
}
