import { Button, Icon } from "@/components/ui";

export interface DeckActionsProps {
  selectLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onSelect: () => void;
}

export function DeckActions({ selectLabel, onPrev, onNext, onSelect }: DeckActionsProps) {
  return (
    <section className="flex items-center justify-center gap-4 py-1">
      <Button variant="circle" icon="replay" aria-label="Opción anterior" onClick={onPrev} />
      <Button variant="primary" className="max-w-[220px] flex-1" onClick={onSelect}>
        <Icon name="favorite" filled size={20} className="text-secondary-fixed-dim" />
        {selectLabel}
      </Button>
      <Button
        variant="circle"
        icon="arrow_forward"
        aria-label="Explorar siguiente opción"
        onClick={onNext}
      />
    </section>
  );
}
