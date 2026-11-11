import { cn } from "@/lib/cn";

import { Icon } from "./Icon";

export interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  icon?: string;
  className?: string;
  /** Heading level for `title`. Defaults to `"h2"`; use `"h1"` for a section header that is also the page's main heading. */
  level?: "h1" | "h2";
}

export function SectionHeader({
  eyebrow,
  title,
  icon,
  className,
  level = "h2",
}: SectionHeaderProps) {
  const Heading = level;

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="space-y-0.5">
        <span className="block font-label-sm text-label-sm font-bold tracking-wider text-secondary uppercase">
          {eyebrow}
        </span>
        <Heading className="font-headline-sm text-headline-sm font-bold text-tertiary">
          {title}
        </Heading>
      </div>
      {icon && <Icon name={icon} size={22} className="text-primary" />}
    </div>
  );
}
