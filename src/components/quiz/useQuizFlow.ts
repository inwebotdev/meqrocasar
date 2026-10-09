"use client";

import { useMemo, useReducer } from "react";

import { QUIZ_STEPS } from "@/domain/quiz/questions";
import { QuizAnswersSchema, type QuizAnswers } from "@/domain/quiz/schema";
import type { QuizOption, QuizStep, QuizStepId } from "@/domain/quiz/types";

export type QuizFlowStatus = "answering" | "submitting" | "error";

export interface QuizFlowState {
  stepIndex: number;
  activeOptionIndex: number;
  selections: Partial<Record<QuizStepId, string>>;
  status: QuizFlowStatus;
  errorMessage?: string;
}

export type QuizFlowAction =
  | { type: "next_option" }
  | { type: "prev_option" }
  | { type: "go_to_option"; index: number }
  | { type: "select_active" }
  | { type: "select_option"; id: string }
  | { type: "next_step" }
  | { type: "prev_step" }
  | { type: "submit_start" }
  | { type: "submit_error"; message: string }
  | { type: "reset" };

const LAST_STEP_INDEX = QUIZ_STEPS.length - 1;

export function createInitialQuizFlowState(): QuizFlowState {
  return {
    stepIndex: 0,
    activeOptionIndex: 0,
    selections: {},
    status: "answering",
  };
}

/** Index of the option matching `selectedId` in `step`, or 0 when there is none. */
function activeIndexFor(step: QuizStep, selectedId: string | undefined): number {
  if (!selectedId) {
    return 0;
  }

  const index = step.options.findIndex((option) => option.id === selectedId);
  return index >= 0 ? index : 0;
}

/**
 * Pure reducer for the quiz flow. Exported on its own so it can be unit
 * tested without rendering anything.
 */
export function quizFlowReducer(state: QuizFlowState, action: QuizFlowAction): QuizFlowState {
  switch (action.type) {
    case "next_option": {
      const step = QUIZ_STEPS[state.stepIndex];
      const total = step.options.length;
      return { ...state, activeOptionIndex: (state.activeOptionIndex + 1) % total };
    }

    case "prev_option": {
      const step = QUIZ_STEPS[state.stepIndex];
      const total = step.options.length;
      return { ...state, activeOptionIndex: (state.activeOptionIndex - 1 + total) % total };
    }

    case "go_to_option": {
      const step = QUIZ_STEPS[state.stepIndex];
      if (action.index < 0 || action.index >= step.options.length) {
        return state;
      }
      return { ...state, activeOptionIndex: action.index };
    }

    case "select_active": {
      const step = QUIZ_STEPS[state.stepIndex];
      const option = step.options[state.activeOptionIndex];
      return {
        ...state,
        selections: { ...state.selections, [step.id]: option.id },
      };
    }

    case "select_option": {
      const step = QUIZ_STEPS[state.stepIndex];
      const index = step.options.findIndex((option) => option.id === action.id);
      return {
        ...state,
        activeOptionIndex: index >= 0 ? index : state.activeOptionIndex,
        selections: { ...state.selections, [step.id]: action.id },
      };
    }

    case "next_step": {
      const nextIndex = Math.min(state.stepIndex + 1, LAST_STEP_INDEX);
      const nextStepData = QUIZ_STEPS[nextIndex];
      return {
        ...state,
        stepIndex: nextIndex,
        activeOptionIndex: activeIndexFor(nextStepData, state.selections[nextStepData.id]),
        status: "answering",
        errorMessage: undefined,
      };
    }

    case "prev_step": {
      const prevIndex = Math.max(state.stepIndex - 1, 0);
      const prevStepData = QUIZ_STEPS[prevIndex];
      return {
        ...state,
        stepIndex: prevIndex,
        activeOptionIndex: activeIndexFor(prevStepData, state.selections[prevStepData.id]),
        status: "answering",
        errorMessage: undefined,
      };
    }

    case "submit_start":
      return { ...state, status: "submitting", errorMessage: undefined };

    case "submit_error":
      return { ...state, status: "error", errorMessage: action.message };

    case "reset":
      return createInitialQuizFlowState();

    default:
      return state;
  }
}

export interface UseQuizFlowResult {
  state: QuizFlowState;
  step: QuizStep;
  activeOption: QuizOption;
  selectedOptionId: string | undefined;
  canContinue: boolean;
  isLastStep: boolean;
  /** The validated answers, only present once all 4 steps have a selection. */
  answers: QuizAnswers | undefined;
  nextOption: () => void;
  prevOption: () => void;
  goToOption: (index: number) => void;
  selectActive: () => void;
  selectOption: (id: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  submitStart: () => void;
  submitError: (message: string) => void;
  reset: () => void;
}

export function useQuizFlow(): UseQuizFlowResult {
  const [state, dispatch] = useReducer(quizFlowReducer, undefined, createInitialQuizFlowState);

  const step = QUIZ_STEPS[state.stepIndex];
  const activeOption = step.options[state.activeOptionIndex];
  const selectedOptionId = state.selections[step.id];

  const answers = useMemo(() => {
    const parsed = QuizAnswersSchema.safeParse(state.selections);
    return parsed.success ? parsed.data : undefined;
  }, [state.selections]);

  return {
    state,
    step,
    activeOption,
    selectedOptionId,
    canContinue: selectedOptionId !== undefined,
    isLastStep: state.stepIndex === LAST_STEP_INDEX,
    answers,
    nextOption: () => dispatch({ type: "next_option" }),
    prevOption: () => dispatch({ type: "prev_option" }),
    goToOption: (index: number) => dispatch({ type: "go_to_option", index }),
    selectActive: () => dispatch({ type: "select_active" }),
    selectOption: (id: string) => dispatch({ type: "select_option", id }),
    nextStep: () => dispatch({ type: "next_step" }),
    prevStep: () => dispatch({ type: "prev_step" }),
    submitStart: () => dispatch({ type: "submit_start" }),
    submitError: (message: string) => dispatch({ type: "submit_error", message }),
    reset: () => dispatch({ type: "reset" }),
  };
}
