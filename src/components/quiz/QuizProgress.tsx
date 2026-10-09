import { Icon } from "@/components/ui";
import type { QuizStep } from "@/domain/quiz/types";
import { cn } from "@/lib/cn";

export interface QuizProgressProps {
  /** 0-based index of the current step. */
  stepIndex: number;
  total: number;
  step: QuizStep;
}

export function QuizProgress({ stepIndex, total, step }: QuizProgressProps) {
  const current = stepIndex + 1;

  return (
    <section className="flex flex-col gap-y-2.5 pt-1">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container/30 px-3 py-1 text-on-secondary-container">
          <Icon name="bolt" filled size={15} className="animate-pulse motion-reduce:animate-none" />
          <span className="font-label-sm text-label-sm font-bold tracking-wider uppercase">
            Modo Swipe Activo
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Icon name="favorite" filled size={16} className="text-primary" />
          <span className="font-label-md text-label-md font-bold text-primary">
            {current} <span className="font-normal text-on-surface-variant">/ {total}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 items-center gap-1.5">
        {Array.from({ length: total }, (_, index) => {
          const isDoneOrCurrent = index <= stepIndex;
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
          Paso {step.order}: {step.topic}
        </span>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant">{step.helper}</p>
    </section>
  );
}
