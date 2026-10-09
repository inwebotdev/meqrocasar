import { Button, Card, Icon } from "@/components/ui";

export interface QuizErrorProps {
  message: string;
  onRetry: () => void;
}

export function QuizError({ message, onRetry }: QuizErrorProps) {
  return (
    <Card padding="lg" className="flex flex-col items-center gap-3 text-center">
      <Icon name="error" filled size={32} className="text-error" />
      <p className="font-body-md text-body-md text-on-surface-variant">{message}</p>
      <Button variant="primary" onClick={onRetry}>
        Intentar de nuevo
      </Button>
    </Card>
  );
}
