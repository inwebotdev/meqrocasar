"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { KeyboardEvent } from "react";

import { useToast } from "@/components/ui";
import { continueLabel, QUIZ_STEPS } from "@/domain/quiz/questions";
import { ApiClientError, generateExperience } from "@/lib/api-client";
import { saveResult } from "@/lib/results-store";

import { CardDeck } from "./CardDeck";
import { ContinueButton } from "./ContinueButton";
import { DeckActions } from "./DeckActions";
import { DeckDots } from "./DeckDots";
import { QuickStrip } from "./QuickStrip";
import { QuizError } from "./QuizError";
import { QuizLoading } from "./QuizLoading";
import { QuizProgress } from "./QuizProgress";
import { useQuizFlow } from "./useQuizFlow";

const GENERIC_ERROR_MESSAGE =
  "No pudimos generar su experiencia en este momento. Por favor intente de nuevo.";

export function QuizFlow() {
  const quiz = useQuizFlow();
  const router = useRouter();
  const toast = useToast();
  const isSubmitting = quiz.state.status === "submitting";

  async function submit() {
    if (!quiz.answers) {
      return;
    }

    quiz.submitStart();

    try {
      const result = await generateExperience(quiz.answers);
      saveResult(result);
      router.push("/resultados");
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : GENERIC_ERROR_MESSAGE;
      quiz.submitError(message);
    }
  }

  function handleContinue() {
    if (quiz.isLastStep) {
      void submit();
      return;
    }
    quiz.nextStep();
  }

  function handleSelectActive() {
    const title = quiz.activeOption.title;
    quiz.selectActive();
    toast.show(`Guardado: ${title}`);
  }

  function handleSelectOption(index: number) {
    const option = quiz.step.options[index];
    quiz.selectOption(option.id);
    toast.show(`Guardado: ${option.title}`);
  }

  function handleStageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      quiz.nextOption();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      quiz.prevOption();
    } else if (event.key === "Enter") {
      event.preventDefault();
      handleSelectActive();
    }
  }

  return (
    <div className="flex flex-col gap-y-space-lg">
      <QuizProgress stepIndex={quiz.state.stepIndex} total={QUIZ_STEPS.length} step={quiz.step} />

      {quiz.state.status === "error" ? (
        <QuizError
          message={quiz.state.errorMessage ?? GENERIC_ERROR_MESSAGE}
          onRetry={() => void submit()}
        />
      ) : (
        <>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={quiz.step.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              className="flex flex-col gap-y-space-lg"
            >
              {quiz.state.status === "submitting" ? (
                <QuizLoading />
              ) : (
                <>
                  <section
                    className="flex flex-col items-center gap-y-3 overflow-hidden py-1 select-none"
                    onKeyDown={handleStageKeyDown}
                  >
                    <CardDeck
                      options={quiz.step.options}
                      activeIndex={quiz.state.activeOptionIndex}
                      selectedId={quiz.selectedOptionId}
                      onNext={quiz.nextOption}
                      onPrev={quiz.prevOption}
                      onSelect={handleSelectActive}
                    />
                    <DeckDots
                      total={quiz.step.options.length}
                      activeIndex={quiz.state.activeOptionIndex}
                      onSelect={quiz.goToOption}
                    />
                  </section>

                  <DeckActions
                    selectLabel={quiz.step.selectLabel}
                    onPrev={quiz.prevOption}
                    onNext={quiz.nextOption}
                    onSelect={handleSelectActive}
                  />

                  <QuickStrip
                    options={quiz.step.options}
                    activeIndex={quiz.state.activeOptionIndex}
                    selectedId={quiz.selectedOptionId}
                    onSelect={handleSelectOption}
                  />
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <footer className="mt-1 flex flex-col gap-2">
            <ContinueButton
              label={continueLabel(quiz.step)}
              canContinue={quiz.canContinue}
              loading={isSubmitting}
              onClick={handleContinue}
            />
            {quiz.state.stepIndex > 0 && (
              <button
                type="button"
                onClick={quiz.prevStep}
                className="self-center font-label-sm text-label-sm text-on-surface-variant hover:text-primary"
              >
                ← Paso anterior
              </button>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
