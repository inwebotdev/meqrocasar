import { Button } from "@/components/ui";

export interface ContinueButtonProps {
  label: string;
  canContinue: boolean;
  loading: boolean;
  onClick: () => void;
}

export function ContinueButton({ label, canContinue, loading, onClick }: ContinueButtonProps) {
  return (
    <Button
      variant="primary"
      fullWidth
      trailingIcon="arrow_forward"
      disabled={!canContinue}
      loading={loading}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
