import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ChipTone = "surface" | "primary-container";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
}

const TONE_CLASSES: Record<ChipTone, string> = {
  surface:
    "bg-surface-container text-on-surface px-space-xs py-1 rounded-md font-label-sm text-label-sm",
  "primary-container":
    "bg-primary-container/80 text-on-primary-container rounded-full px-2 py-0.5 font-label-sm text-label-sm",
};

export function Chip({ tone = "surface", className, children, ...props }: ChipProps) {
  return (
    <span className={cn(TONE_CLASSES[tone], className)} {...props}>
      {children}
    </span>
  );
}
