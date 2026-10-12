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
  /** Disables the play button — used while a narration is still `"pending"`. */
  disablePlay?: boolean;
}

const PLACEHOLDER_PROGRESS = 2 / 3;

/**
 * Static reel placeholder: a poster image with the same chrome as the
 * interactive player. Used as `ReelCard`'s own default (no children), as
 * the `ReelErrorBoundary` fallback when the Remotion player fails to load
 * or render, and (with `disablePlay`) while a narration is `"pending"`.
 */
export function ReelPoster({ title, trackName, posterUrl, disablePlay = false }: ReelPosterProps) {
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
      <ReelPlayButton
        playing={playing}
        onToggle={() => setPlaying((value) => !value)}
        disabled={disablePlay}
      />
      <ReelBottomScrim title={title} trackName={trackName} progress={PLACEHOLDER_PROGRESS} />
    </>
  );
}
