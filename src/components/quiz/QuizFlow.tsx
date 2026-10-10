"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { KeyboardEvent } from "react";

import { useToast } from "@/components/ui";
import type { ResolvedOption } from "@/domain/quiz/generated-step";

import { CardDeck } from "./CardDeck";
import { DeckActions } from "./DeckActions";
import { DeckDots } from "./DeckDots";
import { KnownFacetsStrip } from "./KnownFacetsStrip";
import { QuickStrip } from "./QuickStrip";
import { QuizError } from "./QuizError";
import { QuizLoading } from "./QuizLoading";
import { QuizProgress } from "./QuizProgress";
import { StepLoading } from "./StepLoading";
import { useQuizEngine } from "./useQuizEngine";

const GENERIC_ERROR_MESSAGE = "Algo salió mal. Por favor intente de nuevo.";

export function QuizFlow() {
  const quiz = useQuizEngine();
  const toast = useToast();

  function handleChoose(option: ResolvedOption) {
    toast.show(`Guardado: ${option.title}`);
    quiz.choose(option);
  }

  function handleStageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (quiz.state.status !== "answering") {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      quiz.nextOption();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      quiz.prevOption();
    } else if (event.key === "Enter" && quiz.activeOption) {
      event.preventDefault();
      handleChoose(quiz.activeOption);
    }
  }

  if (quiz.state.status === "error") {
    return (
      <div className="flex flex-col gap-y-space-lg">
        <QuizError message={quiz.state.error ?? GENERIC_ERROR_MESSAGE} onRetry={quiz.retry} />
      </div>
    );
  }

  if (quiz.state.status === "generating") {
    return (
      <div className="flex flex-col gap-y-space-lg">
        <QuizLoading />
      </div>
    );
  }

  const step = quiz.step;

  if (!step) {
    return (
      <div className="flex flex-col gap-y-space-lg">
        <StepLoading />
      </div>
    );
  }

  const activeOption = quiz.activeOption;

  return (
    <div className="flex flex-col gap-y-space-lg">
      <QuizProgress entriesCount={quiz.state.entries.length} step={step} />
      <KnownFacetsStrip entries={quiz.state.entries} />

      {/*
        A single `motion.div` keyed by `step.id`, with the loading pill
        swapped in *inside* it (not as a sibling branch with its own key):
        `choose()`/`back()` keep `step` as the last-loaded step throughout
        "loading-step" (see `useQuizEngine`), so the key here only changes
        once a *new* step actually arrives — exactly one exit/enter cycle
        per transition. Giving the loading state its own outer key instead
        fires two AnimatePresence key changes back-to-back (old step →
        loading → new step), which can leave the old step's exit animation
        stuck mid-flight and the card deck frozen on stale content.
      */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          className="flex flex-col gap-y-space-lg"
        >
          {quiz.state.status === "loading-step" ? (
            <StepLoading />
          ) : (
            <>
              <section
                className="flex flex-col items-center gap-y-3 overflow-hidden py-1 select-none"
                onKeyDown={handleStageKeyDown}
              >
                {activeOption && (
                  <span aria-live="polite" className="sr-only">
                    {`Opción ${quiz.state.activeOptionIndex + 1} de ${step.options.length}: ${activeOption.title}`}
                  </span>
                )}
                <CardDeck
                  options={step.options}
                  activeIndex={quiz.state.activeOptionIndex}
                  selectedId={quiz.state.selectedOptionId}
                  onNext={quiz.nextOption}
                  onPrev={quiz.prevOption}
                  onSelect={() => activeOption && handleChoose(activeOption)}
                />
                <DeckDots
                  total={step.options.length}
                  activeIndex={quiz.state.activeOptionIndex}
                  onSelect={quiz.goToOption}
                />
              </section>

              <DeckActions
                selectLabel={step.selectLabel}
                onPrev={quiz.prevOption}
                onNext={quiz.nextOption}
                onSelect={() => activeOption && handleChoose(activeOption)}
              />

              <QuickStrip
                options={step.options}
                activeIndex={quiz.state.activeOptionIndex}
                selectedId={quiz.state.selectedOptionId}
                onSelect={quiz.goToOption}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {quiz.canGoBack && (
        <button
          type="button"
          onClick={quiz.back}
          className="self-center font-label-sm text-label-sm text-on-surface-variant hover:text-primary"
        >
          ← Paso anterior
        </button>
      )}
    </div>
  );
}
