import { Icon } from "@/components/ui";
import type { ResolvedOption } from "@/domain/quiz/generated-step";
import { cn } from "@/lib/cn";

export type PeekCardVariant = "next" | "back";

export interface PeekCardProps {
  option: ResolvedOption;
  variant: PeekCardVariant;
  onClick?: () => void;
}

const VARIANT_CLASSES: Record<PeekCardVariant, string> = {
  next: "w-[94%] h-[97%] scale-[0.96] translate-x-3 rotate-1 opacity-90 shadow-lg cursor-pointer",
  back: "w-[90%] h-[94%] scale-[0.92] -translate-y-2 opacity-70 shadow-md pointer-events-none",
};

export function PeekCard({ option, variant, onClick }: PeekCardProps) {
  return (
    <article
      onClick={variant === "next" ? onClick : undefined}
      className={cn(
        "absolute overflow-hidden rounded-xl bg-surface-container-high transition-all duration-300",
        VARIANT_CLASSES[variant],
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- resolved remote photo (Unsplash/Places), not a build-time asset */}
      <img src={option.photo.url} alt={option.photo.alt} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/30 to-transparent" />

      {variant === "next" ? (
        <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1 text-on-primary">
          {option.venue && (
            <div className="inline-flex items-center gap-1 self-start rounded-full bg-surface-container-lowest/20 px-2 py-0.5 font-label-sm text-label-sm text-on-primary backdrop-blur-sm">
              <Icon name="location_on" size={12} />
              <span>{option.venue.name}</span>
            </div>
          )}
          <h2 className="font-headline-md text-headline-md">{option.title}</h2>
          <p className="line-clamp-1 font-body-sm text-body-sm text-surface-container-highest">
            {option.description}
          </p>
        </div>
      ) : (
        <div className="absolute inset-x-4 bottom-4 text-on-primary">
          <p className="font-headline-sm text-headline-sm">{option.title}</p>
        </div>
      )}
    </article>
  );
}
