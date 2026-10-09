import { cn } from "@/lib/cn";

export interface DeckDotsProps {
  total: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function DeckDots({ total, activeIndex, onSelect }: DeckDotsProps) {
  return (
    <div className="mt-3 flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={index}
            type="button"
            aria-label={`Ir a opción ${index + 1}`}
            aria-pressed={active}
            onClick={() => onSelect(index)}
            className={cn(
              "h-2 rounded-full transition-all",
              active ? "w-6 bg-primary" : "w-2 bg-surface-variant hover:bg-secondary",
            )}
          />
        );
      })}
    </div>
  );
}
