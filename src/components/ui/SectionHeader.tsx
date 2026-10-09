import { cn } from "@/lib/cn";

import { Icon } from "./Icon";

export interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  icon?: string;
  className?: string;
}

export function SectionHeader({ eyebrow, title, icon, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="space-y-0.5">
        <span className="block font-label-sm text-label-sm font-bold tracking-wider text-secondary uppercase">
          {eyebrow}
        </span>
        <h2 className="font-headline-sm text-headline-sm font-bold text-primary">{title}</h2>
      </div>
      {icon && <Icon name={icon} size={22} className="text-primary" />}
    </div>
  );
}
