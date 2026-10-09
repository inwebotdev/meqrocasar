import { Card, Icon } from "@/components/ui";

export interface NarrativeCardProps {
  title: string;
  narrative: string;
}

export function NarrativeCard({ title, narrative }: NarrativeCardProps) {
  const paragraphs = narrative.split("\n\n").filter(Boolean);

  return (
    <Card padding="lg" className="space-y-space-md">
      <div className="flex items-start justify-between gap-space-sm">
        <div className="space-y-1">
          <span className="font-label-sm text-label-sm font-bold tracking-wider text-secondary uppercase">
            Estilo Matrimonial Curado
          </span>
          <h3 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">
            {title}
          </h3>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/5">
          <Icon name="local_florist" filled size={20} className="text-primary" />
        </div>
      </div>
      <div className="space-y-space-sm">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="font-body-md text-body-md text-on-surface-variant">
            {paragraph}
          </p>
        ))}
      </div>
    </Card>
  );
}
