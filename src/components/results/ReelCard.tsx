import type { ReactNode } from "react";

import { Icon, Pill } from "@/components/ui";
import { ReelPoster } from "@/components/reel/ReelPoster";
import type { NarrationRef } from "@/domain/audio/narration-ref";
import { cn } from "@/lib/cn";

export interface ReelCardProps {
  title: string;
  trackName: string;
  durationLabel?: string;
  posterUrl?: string;
  /**
   * The reel's narration ref, when the experience has one. Drives both the
   * pill below and whether `children` (the interactive player) renders at
   * all: while `"pending"`, the poster shows instead with its play button
   * disabled, regardless of `children`.
   */
  narration?: NarrationRef;
  children?: ReactNode;
}

/** A small status pill for the narration track — `undefined`/`"disabled"` renders nothing. */
function NarrationPill({ narration }: { narration?: NarrationRef }) {
  if (!narration || narration.status === "disabled") {
    return null;
  }

  if (narration.status === "pending") {
    return (
      <Pill tone="secondary-soft" icon="hourglass_top">
        Preparando narración…
      </Pill>
    );
  }

  return (
    <Pill tone="secondary-soft" icon="record_voice_over">
      Narración · Querétaro Romance
    </Pill>
  );
}

export function ReelCard({
  title,
  trackName,
  durationLabel = "11 seg",
  posterUrl,
  narration,
  children,
}: ReelCardProps) {
  const isPending = narration?.status === "pending";

  return (
    <div className="space-y-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <Icon name="movie_filter" size={20} className="text-primary" />
          <h3 className="font-headline-sm text-headline-sm font-bold text-tertiary">
            Video Reel de Inspiración
          </h3>
        </div>
        <span className="font-label-sm text-label-sm font-bold tracking-wider text-secondary uppercase">
          {durationLabel}
        </span>
      </div>
      <div
        className={cn(
          "group relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-inverse-surface shadow-xl",
          isPending ? "cursor-default" : "cursor-pointer",
        )}
      >
        {isPending ? (
          <ReelPoster title={title} trackName={trackName} posterUrl={posterUrl} disablePlay />
        ) : (
          (children ?? <ReelPoster title={title} trackName={trackName} posterUrl={posterUrl} />)
        )}
      </div>
      <NarrationPill narration={narration} />
    </div>
  );
}
