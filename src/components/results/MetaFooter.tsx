import { Icon, Pill } from "@/components/ui";
import { estimateCostUsd } from "@/domain/ai/pricing";
import type { ExperienceMeta } from "@/domain/experience/types";
import type { Transcript } from "@/domain/quiz/transcript";

export interface MetaFooterProps {
  meta: ExperienceMeta;
  /** When present, its entry count is shown as the number of adaptive-quiz steps ("{n} pasos"). */
  transcript?: Transcript;
}

function formatCostUsd(cost: number): string {
  return cost < 0.01 ? "< $0.01" : `$${cost.toFixed(2)}`;
}

export function MetaFooter({ meta, transcript }: MetaFooterProps) {
  const stepsPrefix = transcript ? `${transcript.entries.length} pasos · ` : "";
  const tokensSuffix = meta.usage
    ? ` · ${meta.usage.promptTokens + meta.usage.completionTokens} tokens`
    : "";
  const costSuffix = meta.usage
    ? ` · ≈ ${formatCostUsd(estimateCostUsd(meta.model, meta.usage))}`
    : "";

  return (
    <div className="flex flex-wrap items-center gap-space-xs pb-space-sm font-label-sm text-label-sm text-on-surface-variant">
      <Icon name="auto_awesome" size={14} />
      <span>
        {stepsPrefix}Generado con {meta.model} en {meta.durationMs} ms{tokensSuffix}
        {costSuffix}
      </span>
      {meta.fallbackUsed && <Pill tone="secondary-soft">Modo demo sin IA (fallback local)</Pill>}
    </div>
  );
}
