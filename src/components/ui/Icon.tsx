import { cn } from "@/lib/cn";

export interface IconProps {
  name: string;
  filled?: boolean;
  size?: number;
  className?: string;
  label?: string;
}

export function Icon({ name, filled = false, size = 20, className, label }: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined leading-none select-none", className)}
      style={{ fontSize: size, fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {name}
    </span>
  );
}
