"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { KeyboardEvent } from "react";

import { Button, useToast } from "@/components/ui";
import type { ResolvedOption } from "@/domain/quiz/generated-step";

import { DeckDots } from "./DeckDots";
import { KnownFacetsStrip } from "./KnownFacetsStrip";
import { OptionCarousel } from "./OptionCarousel";
import { OptionList } from "./OptionList";
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

  /**
   * Only Backspace lives here: ArrowLeft/Right/Enter are the carousel's own
   * concern (handled inside `OptionCarousel`'s keyboard region) and bubble
   * up past this wrapper untouched.
   */
  function handleStageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (quiz.state.status !== "answering" || !quiz.canGoBack) {
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      quiz.back();
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

  return (
    <div className="flex flex-col gap-y-space-lg">
      <QuizProgress entriesCount={quiz.state.entries.length} step={step} />
      <KnownFacetsStrip entries={quiz.state.entries} />

      {quiz.canGoBack && (
        <Button
          variant="surface"
          size="md"
          icon="arrow_back"
          onClick={quiz.back}
          className="self-start"
        >
          Pregunta anterior
        </Button>
      )}

      {/*
        A single `motion.div` keyed by `step.id`, with the loading pill
        swapped in *inside* it (not as a sibling branch with its own key):
        `choose()`/`back()` keep `step` as the last-loaded step throughout
        "loading-step" (see `useQuizEngine`), so the key here only changes
        once a *new* step actually arrives — exactly one exit/enter cycle
        per transition. Giving the loading state its own outer key instead
        fires two AnimatePresence key changes back-to-back (old step →
        loading → new step), which can leave the old step's exit animation
        stuck mid-flight and the carousel frozen on stale content.
      */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          className="flex flex-col gap-y-space-lg"
          onKeyDown={handleStageKeyDown}
        >
          {quiz.state.status === "loading-step" ? (
            <StepLoading />
          ) : (
            <>
              <OptionCarousel
                options={step.options}
                activeIndex={quiz.state.activeOptionIndex}
                onActiveIndexChange={quiz.goToOption}
                onChoose={handleChoose}
                selectLabel={step.selectLabel}
              />
              <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
                {`Desliza para ver las ${step.options.length} opciones · toca Elegir para continuar`}
              </p>
              <DeckDots
                total={step.options.length}
                activeIndex={quiz.state.activeOptionIndex}
                onSelect={quiz.goToOption}
              />
              <OptionList
                options={step.options}
                activeIndex={quiz.state.activeOptionIndex}
                selectedId={quiz.state.selectedOptionId}
                onSelect={quiz.goToOption}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
