import type { ReactNode } from "react";

import { Icon, Pill } from "@/components/ui";
import { ReelPoster } from "@/components/reel/ReelPoster";
import type { NarrationRef } from "@/domain/audio/service";

export interface ReelCardProps {
  title: string;
  trackName: string;
  durationLabel?: string;
  posterUrl?: string;
  /** The reel's narration ref, when the experience has one — only its status drives the pill below; the player itself is wired in a later layer. */
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
  durationLabel = "11 seg • HD",
  posterUrl,
  narration,
  children,
}: ReelCardProps) {
  return (
    <div className="space-y-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <Icon name="movie_filter" size={20} className="text-primary" />
          <h3 className="font-label-lg text-label-lg font-bold text-primary">
            Video Reel de Inspiración
          </h3>
        </div>
        <span className="font-label-sm text-label-sm font-bold tracking-wider text-secondary uppercase">
          {durationLabel}
        </span>
      </div>
      <div className="group relative aspect-[9/16] w-full cursor-pointer overflow-hidden rounded-xl bg-inverse-surface shadow-xl">
        {children ?? <ReelPoster title={title} trackName={trackName} posterUrl={posterUrl} />}
      </div>
      <NarrationPill narration={narration} />
    </div>
  );
}
