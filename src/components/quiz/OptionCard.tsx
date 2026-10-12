"use client";

import { forwardRef, useState } from "react";
import { motion } from "framer-motion";

import { Button, Chip, Icon, Pill } from "@/components/ui";
import type { ResolvedOption } from "@/domain/quiz/generated-step";
import { cn } from "@/lib/cn";

/** Generic placeholder credits a photo source may stamp instead of a real name: not worth showing. */
const SUPPRESSED_CREDITS = new Set(["unsplash", "registry"]);

export interface OptionCardProps {
  option: ResolvedOption;
  /** The step's call-to-action text, shown on every card's "Elegir" button. */
  selectLabel: string;
  onChoose: (option: ResolvedOption) => void;
}

/**
 * One slide of `OptionCarousel`: photo + scrim + badges + title/description/
 * hashtags/credit, same as the old swipeable deck card, but purely
 * presentational — no drag, no `onClick` on the photo itself. The only way
 * to confirm this option is the full-width "Elegir" button at the bottom,
 * which shows a brief ring + "Elegido" pill confirm state once tapped.
 */
export const OptionCard = forwardRef<HTMLElement, OptionCardProps>(function OptionCard(
  { option, selectLabel, onChoose },
  ref,
) {
  const [chosen, setChosen] = useState(false);
  const showCredit = !SUPPRESSED_CREDITS.has(option.photo.credit.trim().toLowerCase());

  function handleChoose() {
    setChosen(true);
    onChoose(option);
  }

  return (
    <motion.article
      ref={ref}
      whileTap={chosen ? undefined : { scale: 0.98 }}
      className={cn(
        "relative aspect-[3/4] max-h-[460px] w-[86%] shrink-0 snap-center overflow-hidden rounded-xl bg-surface-container shadow-xl",
        chosen && "ring-[3px] ring-bougainvillea",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- resolved remote photo (Unsplash/Places), not a build-time asset */}
      <img
        src={option.photo.url}
        alt={option.photo.alt}
        loading="eager"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/45 to-transparent" />

      {chosen && (
        <div className="absolute inset-x-0 top-3.5 flex justify-center">
          <Pill tone="primary" icon="favorite" className="shadow-md">
            Elegido
          </Pill>
        </div>
      )}

      <div className="pointer-events-none absolute top-3.5 right-3.5 left-3.5 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/80 px-3 py-1 text-on-primary shadow-sm backdrop-blur-md">
          <Icon name="verified" filled size={15} className="text-secondary-fixed-dim" />
          <span className="font-label-sm text-label-sm font-bold tracking-wider uppercase">
            {option.badge}
          </span>
        </div>
        <Pill tone="tertiary" icon="auto_awesome" className="shadow-md">
          {option.matchLabel}
        </Pill>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 text-on-primary">
        {option.venue && (
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-surface-container-lowest/25 px-2.5 py-1 shadow-sm backdrop-blur-md">
            <Icon name="castle" size={14} className="text-tertiary-fixed-dim" />
            <span className="font-label-md text-label-md">Recomendado: {option.venue.name}</span>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile leading-tight text-on-primary">
            {option.title}
          </h2>
          <p className="line-clamp-2 font-body-sm text-body-sm text-surface-container-low">
            {option.description}
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {option.hashtags.map((hashtag, index) => (
              // Index, not the hashtag text: a generated option's hashtags
              // aren't guaranteed unique (the LLM occasionally repeats a
              // degenerate "#" for more than one of the three).
              <Chip key={index} tone="primary-container">
                {hashtag}
              </Chip>
            ))}
          </div>
          {showCredit && (
            <span className="font-label-sm text-label-sm text-on-primary/70">
              {option.photo.credit}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="primary"
          fullWidth
          disabled={chosen}
          aria-pressed={chosen}
          onClick={handleChoose}
          className="mt-1"
        >
          <Icon name="favorite" filled size={20} className="text-secondary-fixed-dim" />
          {selectLabel}
        </Button>
      </div>
    </motion.article>
  );
});
