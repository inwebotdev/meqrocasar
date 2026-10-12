"use client";

import { useEffect, useRef, useState } from "react";

import type { ExperienceResult } from "@/domain/experience/types";
import { fetchNarrationMeta } from "@/lib/narration-client";
import { saveResult } from "@/lib/results-store";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

/**
 * While `result.narration` is `"pending"`, polls `GET /api/narration/<hash>/meta`
 * every `pollIntervalMs` (default 2s) for up to `pollTimeoutMs` (default
 * 60s). Once the narration becomes ready, persists the updated result
 * (`saveResult`) and returns it so `ResultsScreen` re-renders with the
 * ready narration ref — a no-op (just echoes `result` back) whenever
 * there's no result, or its narration isn't `"pending"`.
 */
export function useNarration(
  result: ExperienceResult | undefined,
  pollIntervalMs: number = POLL_INTERVAL_MS,
  pollTimeoutMs: number = POLL_TIMEOUT_MS,
): ExperienceResult | undefined {
  const [current, setCurrent] = useState(result);
  const resultRef = useRef(result);

  useEffect(() => {
    resultRef.current = result;
    setCurrent(result);
  }, [result]);

  const pendingHash = result?.narration?.status === "pending" ? result.narration.hash : undefined;

  useEffect(() => {
    if (!pendingHash) {
      return;
    }

    let cancelled = false;
    const start = Date.now();

    async function poll(): Promise<void> {
      if (cancelled) return;

      const meta = await fetchNarrationMeta(pendingHash!);
      if (cancelled) return;

      if (meta?.status === "ready" && meta.durationSec !== undefined && meta.sentences) {
        const base = resultRef.current;
        if (!base) return;

        const updated: ExperienceResult = {
          ...base,
          narration: {
            status: "ready",
            hash: pendingHash!,
            src: `/api/narration/${pendingHash}`,
            durationSec: meta.durationSec,
            sentences: meta.sentences,
          },
        };

        saveResult(updated);
        resultRef.current = updated;
        setCurrent(updated);
        return;
      }

      if (Date.now() - start >= pollTimeoutMs) {
        return;
      }

      timer = setTimeout(() => void poll(), pollIntervalMs);
    }

    let timer: ReturnType<typeof setTimeout> = setTimeout(() => void poll(), pollIntervalMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pendingHash, pollIntervalMs, pollTimeoutMs]);

  return current;
}
