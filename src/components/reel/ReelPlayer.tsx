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
  // The narration is played by a plain <audio> element kept in sync with the
  // player (play/pause/seek/mute) instead of a Remotion <Audio> inside the
  // composition: the Player's pooled audio tags never picked the track up.
  const narrationRef = useRef<HTMLAudioElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  // The composition fades its first scene in from black; show the first photo as a
  // poster until playback starts so the card looks like the design at rest.
  const [hasStarted, setHasStarted] = useState(false);

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

    const syncNarration = (frame: number, forceSeek = false) => {
      const audio = narrationRef.current;
      if (!audio) return;
      const expected = frame / FPS;
      if (forceSeek || Math.abs(audio.currentTime - expected) > 0.35) {
        audio.currentTime = expected;
      }
    };
    const handleFrameUpdate = ({ detail }: { detail: { frame: number } }) => {
      setCurrentFrame(detail.frame);
      const audio = narrationRef.current;
      if (audio && !audio.paused) syncNarration(detail.frame);
    };
    const handlePlay = () => {
      setPlaying(true);
      setHasStarted(true);
      const audio = narrationRef.current;
      if (audio) {
        syncNarration(player.getCurrentFrame(), true);
        void audio.play().catch(() => undefined);
      }
    };
    const handlePause = () => {
      setPlaying(false);
      narrationRef.current?.pause();
    };
    const handleEnded = () => {
      setPlaying(false);
      const audio = narrationRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };

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
      if (narrationRef.current) narrationRef.current.muted = false;
    } else {
      player.mute();
      setMuted(true);
      if (narrationRef.current) narrationRef.current.muted = true;
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
        acknowledgeRemotionLicense
      />
      {!hasStarted && result.photos[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.photos[0].url}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}
      {narration && (
        <audio
          ref={narrationRef}
          src={narration.src}
          preload="auto"
          playsInline
          aria-hidden="true"
          className="hidden"
        />
      )}

      <ReelTopBar
        timeLabel={formatTime(currentFrame)}
        muted={muted}
        onToggleMute={handleToggleMute}
      />
      <ReelPlayButton playing={playing} onToggle={handleTogglePlay} />
      {/* No `title`: the `WeddingReel` composition already renders it in its own bottom text block. */}
      <ReelBottomScrim trackName={resolvedTrackName} progress={currentFrame / durationInFrames} />
    </div>
  );
}
