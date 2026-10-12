import { Icon } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * The adaptive engine doesn't expose a fixed step count (`maxSteps` is a
 * server-side detail), so the progress bar always shows a fixed 7-segment
 * budget and fills `entriesCount + 1` of them — an approximation, not an
 * exact countdown.
 */
export const QUIZ_PROGRESS_SEGMENTS = 7;

export interface QuizProgressStep {
  question: string;
  topic: string;
  helper: string;
}

export interface QuizProgressProps {
  /** Number of answered transcript entries so far (0 for the first step). */
  entriesCount: number;
  step: QuizProgressStep;
}

export function QuizProgress({ entriesCount, step }: QuizProgressProps) {
  const current = entriesCount + 1;

  return (
    <section className="flex flex-col gap-y-2.5 pt-1">
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1">
          <Icon name="favorite" filled size={16} className="text-primary" />
          <span className="font-label-md text-label-md font-bold text-primary">
            {current}{" "}
            <span className="font-normal text-on-surface-variant">/ {QUIZ_PROGRESS_SEGMENTS}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 items-center gap-1.5">
        {Array.from({ length: QUIZ_PROGRESS_SEGMENTS }, (_, index) => {
          const isDoneOrCurrent = index < current;
          return (
            <div
              key={index}
              className={cn(
                "rounded-full",
                isDoneOrCurrent
                  ? "relative h-2 overflow-hidden bg-primary"
                  : "h-1.5 bg-surface-container-highest",
              )}
            >
              {isDoneOrCurrent && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary-container opacity-80" />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between pt-0.5">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile tracking-tight text-primary">
          {step.question}
        </h1>
        <span className="ml-2 shrink-0 font-label-sm text-label-sm font-bold tracking-wider text-secondary uppercase">
          Paso {current}: {step.topic}
        </span>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant">{step.helper}</p>
    </section>
  );
}
