"use client";

import { useSearchParams } from "next/navigation";

import { estimateCostUsd } from "@/domain/ai/pricing";
import type { ExperienceMeta } from "@/domain/experience/types";

export interface MetaFooterDebugLineProps {
  meta: ExperienceMeta;
}

function formatCostUsd(cost: number): string {
  return cost < 0.01 ? "< $0.01" : `$${cost.toFixed(2)}`;
}

/**
 * Technical detail line (the model that answered, the duration, token usage
 * and estimated cost) — only ever rendered behind `?debug=1`, never part of
 * the default `/resultados` copy. `useSearchParams` requires a `Suspense`
 * boundary in the App Router, so this lives in its own "use client" module
 * and `MetaFooter` wraps it in one; `searchParams` is `null` outside of a
 * router context (e.g. in tests that don't mock `next/navigation`), which
 * is treated the same as `debug` being absent.
 */
export function MetaFooterDebugLine({ meta }: MetaFooterDebugLineProps) {
  const searchParams = useSearchParams();
  if (searchParams?.get("debug") !== "1") {
    return null;
  }

  const usageSuffix = meta.usage
    ? ` · ${meta.usage.promptTokens + meta.usage.completionTokens} tokens` // copy-audit-ignore (debug-only technical detail, never shown by default)
    : "";
  const costSuffix = meta.usage
    ? ` · ≈ ${formatCostUsd(estimateCostUsd(meta.model, meta.usage))}`
    : "";

  return (
    <span data-testid="meta-footer-debug">
      {meta.model} en {meta.durationMs} ms{usageSuffix}
      {costSuffix}
    </span>
  );
}
