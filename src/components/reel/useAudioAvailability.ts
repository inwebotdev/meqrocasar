"use client";

import { useEffect, useState } from "react";

export type AudioAvailability =
  { status: "checking" } | { status: "available"; src: string } | { status: "missing" };

const DEFAULT_AUDIO_SRC = "/audio/wedding-theme.mp3";

/**
 * Probes whether a background-audio file exists under `public/` via a HEAD
 * request, without ever triggering playback. Treats a non-2xx response, a
 * non-audio content type, or a network error as "missing" so the reel can
 * fall back to a silent composition.
 */
export function useAudioAvailability(src: string = DEFAULT_AUDIO_SRC): AudioAvailability {
  const [availability, setAvailability] = useState<AudioAvailability>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    setAvailability({ status: "checking" });

    async function check() {
      try {
        const response = await fetch(src, { method: "HEAD" });
        if (cancelled) return;

        const contentType = response.headers.get("content-type") ?? "";
        if (response.ok && contentType.startsWith("audio/")) {
          setAvailability({ status: "available", src });
        } else {
          setAvailability({ status: "missing" });
        }
      } catch {
        if (!cancelled) setAvailability({ status: "missing" });
      }
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [src]);

  return availability;
}
