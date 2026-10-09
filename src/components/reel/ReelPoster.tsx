"use client";

import { useState } from "react";

import {
  ReelBottomScrim,
  ReelPlayButton,
  ReelTopBar,
} from "@/components/results/ReelOverlayChrome";

export interface ReelPosterProps {
  title: string;
  trackName: string;
  posterUrl?: string;
}

const PLACEHOLDER_PROGRESS = 2 / 3;

/**
 * Static reel placeholder: a poster image with the same chrome as the
 * interactive player. Used both as `ReelCard`'s own default (no children)
 * and as the `ReelErrorBoundary` fallback when the Remotion player fails
 * to load or render.
 */
export function ReelPoster({ title, trackName, posterUrl }: ReelPosterProps) {
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
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
  );
}
