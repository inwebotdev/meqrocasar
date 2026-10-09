import type { ElementType, HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type CardPadding = "none" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  padding?: CardPadding;
  as?: ElementType;
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  md: "p-space-md",
  lg: "p-space-lg",
};

export function Card({ padding = "none", as, className, children, ...props }: CardProps) {
  const Component = as ?? "div";

  return (
    <Component
      className={cn(
        "rounded-xl bg-surface-container-lowest shadow-md",
        PADDING_CLASSES[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
