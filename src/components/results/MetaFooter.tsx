import { Icon, Pill } from "@/components/ui";
import type { ExperienceMeta } from "@/domain/experience/types";

export interface MetaFooterProps {
  meta: ExperienceMeta;
}

export function MetaFooter({ meta }: MetaFooterProps) {
  const tokensSuffix = meta.usage
    ? ` · ${meta.usage.promptTokens + meta.usage.completionTokens} tokens`
    : "";

  return (
    <div className="flex flex-wrap items-center gap-space-xs pb-space-sm font-label-sm text-label-sm text-on-surface-variant">
      <Icon name="auto_awesome" size={14} />
      <span>
        Generado con {meta.model} en {meta.durationMs} ms{tokensSuffix}
      </span>
      {meta.fallbackUsed && <Pill tone="secondary-soft">Modo demo sin IA (fallback local)</Pill>}
    </div>
  );
}
