"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Pill, Skeleton, useToast } from "@/components/ui";
import type { ExperienceResult } from "@/domain/experience/types";
import { clearResult, loadResult } from "@/lib/results-store";
import { clearTranscript } from "@/lib/transcript-store";

import { ResultsView } from "./ResultsView";
import { useNarration } from "./useNarration";

export function ResultsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [result, setResult] = useState<ExperienceResult | undefined | null>(null);
  const narratedResult = useNarration(result ?? undefined, undefined, undefined, () =>
    toast.show("Narración no disponible por ahora; el reel se reproduce sin voz", "info"),
  );

  useEffect(() => {
    const stored = loadResult();
    if (!stored) {
      toast.show("Primero completa el cuestionario", "info");
      router.replace("/");
      return;
    }
    setResult(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRestart() {
    clearResult();
    clearTranscript();
    router.push("/");
  }

  if (result === null) {
    return (
      <div className="flex flex-col gap-y-space-lg">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const effectiveResult = narratedResult ?? result;

  return (
    <div className="flex flex-col gap-y-space-lg">
      <div className="flex items-center justify-between pt-space-xs">
        <Pill tone="primary-soft" icon="bolt" className="bg-primary/10">
          Propuesta Swipe &amp; Play • Experiencia Gamificada
        </Pill>
        <button
          type="button"
          onClick={handleRestart}
          className="font-label-sm text-label-sm text-on-surface-variant hover:text-primary"
        >
          Volver a empezar
        </button>
      </div>
      <ResultsView result={effectiveResult} />
    </div>
  );
}
