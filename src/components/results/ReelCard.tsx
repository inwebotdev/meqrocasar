"use client";

import { useState, type ReactNode } from "react";

import { Icon } from "@/components/ui";

import { ReelBottomScrim, ReelPlayButton, ReelTopBar } from "./ReelOverlayChrome";

export interface ReelCardProps {
  title: string;
  trackName: string;
  durationLabel?: string;
  posterUrl?: string;
  children?: ReactNode;
}

const PLACEHOLDER_PROGRESS = 2 / 3;

export function ReelCard({
  title,
  trackName,
  durationLabel = "11 seg • HD",
  posterUrl,
  children,
}: ReelCardProps) {
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);

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
        {children ? (
          children
        ) : (
          <>
            {posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrl}
                alt="Reel preview"
                className="absolute inset-0 h-full w-full transform object-cover transition-transform duration-700 group-hover:scale-105"
              />
            )}
            <ReelTopBar
              timeLabel="00:11"
              muted={muted}
              onToggleMute={() => setMuted((value) => !value)}
            />
            <ReelPlayButton playing={playing} onToggle={() => setPlaying((value) => !value)} />
            <ReelBottomScrim title={title} trackName={trackName} progress={PLACEHOLDER_PROGRESS} />
          </>
        )}
      </div>
    </div>
  );
}
