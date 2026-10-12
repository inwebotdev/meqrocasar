import { Icon } from "@/components/ui";
import type { ResolvedOption } from "@/domain/quiz/generated-step";
import { cn } from "@/lib/cn";

import { iconForOption } from "./facet-icon";

export interface OptionListProps {
  options: readonly ResolvedOption[];
  activeIndex: number;
  selectedId: string | undefined;
  /** Only navigates the carousel to this option's index — never chooses it. */
  onSelect: (index: number) => void;
}

/**
 * Grid of every option in the current step, titled with the exact count so
 * it reads as "browse", not "advance" — the only way to advance is the
 * carousel's "Elegir" button.
 */
export function OptionList({ options, activeIndex, selectedId, onSelect }: OptionListProps) {
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-label-md text-label-md font-bold tracking-wider text-on-surface-variant uppercase">
          Opciones de esta pregunta
        </span>
        <span className="font-label-sm text-label-sm font-bold text-secondary">
          {options.length} opciones
        </span>
      </div>
      <div className={cn("grid gap-2", options.length === 3 ? "grid-cols-3" : "grid-cols-4")}>
        {options.map((option, index) => {
          const isActiveOrSelected = index === activeIndex || option.id === selectedId;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === selectedId}
              onClick={() => onSelect(index)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-bernal/60",
                isActiveOrSelected
                  ? "bg-surface-container-lowest font-bold text-primary shadow-sm"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              <Icon
                name={iconForOption(option)}
                filled={isActiveOrSelected}
                size={20}
                className={isActiveOrSelected ? "text-primary" : "text-secondary"}
              />
              <span className="w-full truncate font-label-sm text-label-sm">{option.title}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
