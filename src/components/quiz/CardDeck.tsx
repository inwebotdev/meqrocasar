import { OptionCard } from "./OptionCard";
import { PeekCard } from "./PeekCard";
import type { ResolvedOption } from "@/domain/quiz/generated-step";

export interface CardDeckProps {
  options: readonly ResolvedOption[];
  activeIndex: number;
  selectedId: string | undefined;
  onNext: () => void;
  onPrev: () => void;
  onSelect: () => void;
}

export function CardDeck({ options, activeIndex, selectedId, onNext, onSelect }: CardDeckProps) {
  const total = options.length;
  const nextIndex = (activeIndex + 1) % total;
  const backIndex = (activeIndex + 2) % total;

  return (
    <div className="relative flex aspect-[3/4] max-h-[460px] w-full items-center justify-center">
      <PeekCard option={options[backIndex]} variant="back" />
      <PeekCard option={options[nextIndex]} variant="next" onClick={onNext} />
      <OptionCard
        key={options[activeIndex].id}
        option={options[activeIndex]}
        selected={selectedId === options[activeIndex].id}
        onSelect={onSelect}
        onNext={onNext}
      />
    </div>
  );
}
