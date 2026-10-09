import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./Icon";

export type PillTone =
  | "primary-soft"
  | "primary"
  | "glass-dark"
  | "glass-light"
  | "secondary-soft"
  | "tertiary"
  | "gold";

export interface PillProps extends HTMLAttributes<HTMLDivElement> {
  tone?: PillTone;
  icon?: string;
}

const TONE_CLASSES: Record<PillTone, string> = {
  "primary-soft": "bg-primary/5 text-primary uppercase tracking-wider font-label-sm text-label-sm",
  primary: "bg-primary text-on-primary shadow-lg font-label-sm text-label-sm font-bold",
  "glass-dark":
    "bg-primary/80 backdrop-blur-md text-on-primary font-label-sm text-label-sm font-bold uppercase tracking-wider",
  "glass-light": "bg-black/60 backdrop-blur-md text-on-primary font-label-sm text-label-sm",
  "secondary-soft":
    "bg-secondary-container/30 text-on-secondary-container font-label-sm text-label-sm uppercase tracking-wider font-bold",
  tertiary: "bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold",
  gold: "bg-gold/15 text-gold font-label-sm text-label-sm font-bold uppercase tracking-wider",
};

export function Pill({ tone = "primary-soft", icon, className, children, ...props }: PillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-space-sm py-1",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={14} />}
      <span>{children}</span>
    </div>
  );
}
