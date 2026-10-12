import { Suspense } from "react";

import { Icon, Pill } from "@/components/ui";
import type { ExperienceMeta } from "@/domain/experience/types";
import type { Transcript } from "@/domain/quiz/transcript";

import { MetaFooterDebugLine } from "./MetaFooterDebugLine";

export interface MetaFooterProps {
  meta: ExperienceMeta;
  /** When present, its entry count is shown as the number of answers ("{n} respuestas"). */
  transcript?: Transcript;
}

/** Shown when no transcript is available (legacy 4-answer flow). */
const FALLBACK_ANSWER_COUNT = 4;

export function MetaFooter({ meta, transcript }: MetaFooterProps) {
  const answerCount = transcript?.entries.length ?? FALLBACK_ANSWER_COUNT;
  const seconds = (meta.durationMs / 1000).toFixed(1);

  return (
    <div className="flex flex-wrap items-center gap-space-xs pb-space-sm font-label-sm text-label-sm text-on-surface-variant">
      <Icon name="auto_awesome" size={14} />
      <span>
        Propuesta generada en {seconds} s · {answerCount} respuestas
      </span>
      <Suspense fallback={null}>
        <MetaFooterDebugLine meta={meta} />
      </Suspense>
      {meta.fallbackUsed && <Pill tone="secondary-soft">Modo demo sin conexión</Pill>}
    </div>
  );
}
