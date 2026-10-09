"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion";

import { Chip, Icon, Pill } from "@/components/ui";
import { getPhoto } from "@/domain/media/photos";
import type { QuizOption } from "@/domain/quiz/types";
import { cn } from "@/lib/cn";

const DRAG_OFFSET_THRESHOLD = 80;
const DRAG_VELOCITY_THRESHOLD = 500;

export interface OptionCardProps {
  option: QuizOption;
  selected: boolean;
  /** Drag-right / tap / Enter: marks this option as the step's selection. */
  onSelect: () => void;
  /** Drag-left: advances the deck to the next option. */
  onNext: () => void;
}

export function OptionCard({ option, selected, onSelect, onNext }: OptionCardProps) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const rawRotate = useTransform(x, [-200, 200], [-8, 8]);
  const likeOpacity = useTransform(x, [0, DRAG_OFFSET_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-DRAG_OFFSET_THRESHOLD, 0], [1, 0]);
  const photo = getPhoto(option.photoId);

  function handleDragEnd(_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.x <= -DRAG_OFFSET_THRESHOLD || info.velocity.x <= -DRAG_VELOCITY_THRESHOLD) {
      onNext();
      return;
    }

    if (info.offset.x >= DRAG_OFFSET_THRESHOLD || info.velocity.x >= DRAG_VELOCITY_THRESHOLD) {
      onSelect();
    }
  }

  return (
    <motion.article
      role="button"
      tabIndex={0}
      aria-label={`Elegir ${option.title}`}
      aria-pressed={selected}
      onClick={onSelect}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={reducedMotion ? 0 : 0.6}
      onDragEnd={handleDragEnd}
      whileTap={{ scale: 0.98 }}
      style={{ x, rotate: reducedMotion ? 0 : rawRotate }}
      className={cn(
        "absolute inset-0 h-full w-full cursor-grab overflow-hidden rounded-xl bg-surface-container shadow-xl outline-none active:cursor-grabbing",
        selected && "ring-[3px] ring-bougainvillea",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- curated remote photo, not a build-time asset */}
      <img
        src={photo.url}
        alt={photo.alt}
        loading="eager"
        draggable={false}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/45 to-transparent" />

      {selected && (
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

      <motion.div
        aria-hidden
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute top-1/3 right-6 rounded-lg bg-secondary-container px-4 py-1.5 font-headline-md text-headline-md text-on-secondary-container shadow-lg"
      >
        ¡SÍ, QUIERO! ❤️
      </motion.div>
      <motion.div
        aria-hidden
        style={{ opacity: passOpacity }}
        className="pointer-events-none absolute top-1/3 left-6 rounded-lg bg-surface-container-highest px-4 py-1.5 font-headline-md text-headline-md text-on-surface-variant shadow-lg"
      >
        PASAR ✖
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 text-on-primary">
        <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-surface-container-lowest/25 px-2.5 py-1 shadow-sm backdrop-blur-md">
          <Icon name="castle" size={14} className="text-tertiary-fixed-dim" />
          <span className="font-label-md text-label-md">Recomendado: {option.venueHint}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile leading-tight text-on-primary">
            {option.title}
          </h2>
          <p className="line-clamp-2 font-body-sm text-body-sm text-surface-container-low">
            {option.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {option.hashtags.map((hashtag) => (
            <Chip key={hashtag} tone="primary-container">
              {hashtag}
            </Chip>
          ))}
        </div>
      </div>
    </motion.article>
  );
}
