"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";

import {
  ReelBottomScrim,
  ReelPlayButton,
  ReelTopBar,
} from "@/components/results/ReelOverlayChrome";
import type { ExperienceResult } from "@/domain/experience/types";
import { WeddingReel } from "@/remotion/Reel";
import { reelPropsFromExperience } from "@/remotion/schema";
import { formatTime, FPS, HEIGHT, reelDurationInFrames, WIDTH } from "@/remotion/timing";

import { useAudioAvailability } from "./useAudioAvailability";

export interface ReelPlayerProps {
  result: ExperienceResult;
  audioSrc?: string;
  trackName?: string;
}

const MISSING_AUDIO_LABEL = "Sin audio";
const NARRATION_TRACK_LABEL = "Narración · Querétaro Romance";

export function ReelPlayer({ result, audioSrc, trackName }: ReelPlayerProps) {
  const playerRef = useRef<PlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const audioAvailability = useAudioAvailability(audioSrc);
  const effectiveAudioSrc =
    audioAvailability.status === "available" ? audioAvailability.src : undefined;

  const narration = result.narration?.status === "ready" ? result.narration : undefined;

  const durationInFrames = useMemo(
    () =>
      reelDurationInFrames({
        narrationDurationSec: narration?.durationSec,
        photoCount: result.photos.length,
      }),
    [narration?.durationSec, result.photos.length],
  );

  const reelProps = useMemo(
    () =>
      reelPropsFromExperience(result, {
        audioSrc: effectiveAudioSrc,
        trackName,
        origin: typeof window !== "undefined" ? window.location.origin : undefined,
      }),
    [result, effectiveAudioSrc, trackName],
  );

  const resolvedTrackName = narration
    ? NARRATION_TRACK_LABEL
    : audioAvailability.status === "missing"
      ? MISSING_AUDIO_LABEL
      : reelProps.trackName;

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleFrameUpdate = ({ detail }: { detail: { frame: number } }) => {
      setCurrentFrame(detail.frame);
    };
    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    const handleEnded = () => setPlaying(false);

    player.addEventListener("frameupdate", handleFrameUpdate);
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("ended", handleEnded);

    return () => {
      player.removeEventListener("frameupdate", handleFrameUpdate);
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("ended", handleEnded);
    };
  }, []);

  function handleTogglePlay() {
    playerRef.current?.toggle();
  }

  function handleToggleMute() {
    const player = playerRef.current;
    if (!player) return;

    if (player.isMuted()) {
      player.unmute();
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
  }

  return (
    <div className="absolute inset-0">
      <Player
        ref={playerRef}
        component={WeddingReel}
        inputProps={reelProps}
        durationInFrames={durationInFrames}
        fps={FPS}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        style={{ width: "100%", height: "100%" }}
        controls={false}
        clickToPlay={false}
        loop
        autoPlay={false}
        initiallyMuted={false}
      />

      <ReelTopBar
        timeLabel={formatTime(currentFrame)}
        muted={muted}
        onToggleMute={handleToggleMute}
      />
      <ReelPlayButton playing={playing} onToggle={handleTogglePlay} />
      <ReelBottomScrim
        title={result.conceptTitle}
        trackName={resolvedTrackName}
        progress={currentFrame / durationInFrames}
      />
    </div>
  );
}
