"use client";

import { useEffect, useState } from "react";

import { Icon, Skeleton } from "@/components/ui";

import { QUIZ_TIPS } from "./tips";

const TIP_ROTATION_MS = 2500;

/**
 * Replaces the card deck while the adaptive engine prepares the next step
 * (`status: "loading-step"`): a skeleton 3:4 card behind a glass pill with
 * a rotating planner tip, so the wait feels like progress instead of a
 * stall.
 */
export function StepLoading() {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (QUIZ_TIPS.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setTipIndex((index) => (index + 1) % QUIZ_TIPS.length);
    }, TIP_ROTATION_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex aspect-[3/4] max-h-[460px] w-full items-center justify-center">
      <Skeleton className="absolute inset-0 h-full w-full rounded-xl" />
      <div className="relative z-10 flex max-w-[85%] flex-col items-center gap-2 rounded-xl bg-primary/80 px-6 py-4 text-center text-on-primary shadow-lg backdrop-blur-md">
        <div className="inline-flex items-center gap-2">
          <Icon
            name="auto_awesome"
            filled
            size={20}
            className="animate-pulse motion-reduce:animate-none"
          />
          <p className="font-headline-sm text-headline-sm">Estamos analizando su respuesta…</p>
        </div>
        <p className="font-body-sm text-body-sm text-surface-container-low">
          Esto puede tardar unos segundos
        </p>
        {QUIZ_TIPS[tipIndex] && (
          <p className="font-body-sm text-body-sm text-surface-container-low">
            {QUIZ_TIPS[tipIndex]}
          </p>
        )}
      </div>
    </div>
  );
}
