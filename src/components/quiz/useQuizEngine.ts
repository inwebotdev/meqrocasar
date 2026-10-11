"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";

import type { QuizEngineMeta } from "@/domain/quiz/engine";
import {
  entryFromResolvedOption,
  type ResolvedOption,
  type ResolvedStep,
} from "@/domain/quiz/generated-step";
import type { TranscriptEntry } from "@/domain/quiz/transcript";
import {
  ApiClientError,
  fetchNextStep,
  generateExperienceFromTranscript,
  prefetchNextSteps,
} from "@/lib/quiz-client";
import { saveResult } from "@/lib/results-store";
import { saveTranscript } from "@/lib/transcript-store";

/**
 * Drives the quiz as a conversation with the adaptive engine
 * (`POST /api/quiz/next`): fetches the curated step 1 on mount, and on
 * every `choose`/`back`/`retry` replays the transcript so far against the
 * engine (cached server-side, so `back` is instant). When the engine
 * reports `done: true`, generates the final experience and navigates to
 * `/resultados`. Once a step renders (`status: "answering"`), fires a
 * fire-and-forget `prefetchNextSteps` for it, so whichever option the
 * couple picks is already warm by the time `choose` re-requests it.
 */

export type QuizEngineStatus = "loading-step" | "answering" | "generating" | "error";

const SELECT_ANIMATION_MS = 350;
const GENERIC_STEP_ERROR = "No pudimos cargar la siguiente pregunta. Por favor intente de nuevo.";
const GENERIC_GENERATE_ERROR =
  "No pudimos generar su experiencia en este momento. Por favor intente de nuevo.";

export interface QuizEngineState {
  entries: TranscriptEntry[];
  step?: ResolvedStep;
  status: QuizEngineStatus;
  error?: string;
  activeOptionIndex: number;
  /** Set briefly between `choose()` and the ~350ms animation committing it. */
  selectedOptionId?: string;
  meta?: QuizEngineMeta;
}

type RetryKind = "step" | "generate";

interface InternalState extends QuizEngineState {
  retryKind?: RetryKind;
}

type Action =
  | { type: "loading_step"; entries: TranscriptEntry[] }
  | {
      type: "step_loaded";
      entries: TranscriptEntry[];
      step: ResolvedStep;
      meta: QuizEngineMeta;
      activeOptionIndex: number;
    }
  | { type: "generating" }
  | { type: "error"; message: string; retryKind: RetryKind }
  | { type: "select_option"; optionId: string }
  | { type: "next_option" }
  | { type: "prev_option" }
  | { type: "go_to_option"; index: number };

const initialState: InternalState = {
  entries: [],
  status: "loading-step",
  activeOptionIndex: 0,
};

/**
 * Pure reducer for the quiz engine's local state. Exported on its own so
 * it can be unit tested without rendering anything or mocking `fetch`.
 */
export function quizEngineReducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case "loading_step":
      return {
        ...state,
        status: "loading-step",
        entries: action.entries,
        error: undefined,
        selectedOptionId: undefined,
      };

    case "step_loaded":
      return {
        ...state,
        status: "answering",
        entries: action.entries,
        step: action.step,
        meta: action.meta,
        activeOptionIndex: action.activeOptionIndex,
        selectedOptionId: undefined,
        error: undefined,
        retryKind: undefined,
      };

    case "generating":
      return { ...state, status: "generating", error: undefined };

    case "error":
      return { ...state, status: "error", error: action.message, retryKind: action.retryKind };

    case "select_option":
      return { ...state, selectedOptionId: action.optionId };

    case "next_option": {
      if (!state.step) return state;
      const total = state.step.options.length;
      return { ...state, activeOptionIndex: (state.activeOptionIndex + 1) % total };
    }

    case "prev_option": {
      if (!state.step) return state;
      const total = state.step.options.length;
      return { ...state, activeOptionIndex: (state.activeOptionIndex - 1 + total) % total };
    }

    case "go_to_option": {
      if (!state.step || action.index < 0 || action.index >= state.step.options.length) {
        return state;
      }
      return { ...state, activeOptionIndex: action.index };
    }

    default:
      return state;
  }
}

export interface UseQuizEngineResult {
  state: QuizEngineState;
  step: ResolvedStep | undefined;
  activeOption: ResolvedOption | undefined;
  canGoBack: boolean;
  /** Confirms `option` as the current step's choice: ring/toast animation, then advances. */
  choose: (option: ResolvedOption) => void;
  /** Pops the last entry and re-requests that step (instant: the engine caches by transcript). */
  back: () => void;
  /** Re-requests whatever failed (the next step, or the final generation). */
  retry: () => void;
  nextOption: () => void;
  prevOption: () => void;
  goToOption: (index: number) => void;
}

export function useQuizEngine(): UseQuizEngineResult {
  const router = useRouter();
  const [state, dispatch] = useReducer(quizEngineReducer, initialState);
  const requestIdRef = useRef(0);
  const selectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runGenerate = useCallback(
    async (entries: TranscriptEntry[]) => {
      dispatch({ type: "generating" });

      try {
        const transcript = { entries };
        const result = await generateExperienceFromTranscript(transcript);
        saveResult(result);
        saveTranscript(transcript);
        router.push("/resultados");
      } catch (error) {
        const message = error instanceof ApiClientError ? error.message : GENERIC_GENERATE_ERROR;
        dispatch({ type: "error", message, retryKind: "generate" });
      }
    },
    [router],
  );

  const loadStep = useCallback(
    async (entries: TranscriptEntry[], restoreOptionId?: string) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      dispatch({ type: "loading_step", entries });

      try {
        const result = await fetchNextStep({ entries });
        if (requestIdRef.current !== requestId) return;

        if (result.done) {
          await runGenerate(entries);
          return;
        }

        const activeOptionIndex = restoreOptionId
          ? Math.max(
              0,
              result.step.options.findIndex((option) => option.id === restoreOptionId),
            )
          : 0;

        dispatch({
          type: "step_loaded",
          entries,
          step: result.step,
          meta: result.meta,
          activeOptionIndex,
        });
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        const message = error instanceof ApiClientError ? error.message : GENERIC_STEP_ERROR;
        dispatch({ type: "error", message, retryKind: "step" });
      }
    },
    [runGenerate],
  );

  useEffect(() => {
    void loadStep([]);
    // Mount-only: `loadStep` depends on stable callbacks (`router`), so this
    // never needs to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (selectTimeoutRef.current) {
        clearTimeout(selectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.status !== "answering" || !state.step) {
      return;
    }

    void prefetchNextSteps({ entries: state.entries }, state.step);
    // Fires exactly once per rendered step (keyed on the step object
    // itself, which only changes when a new step loads): `state.entries`
    // is the same array reference for the lifetime of that step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.step]);

  const choose = useCallback(
    (option: ResolvedOption) => {
      if (state.status !== "answering" || !state.step) {
        return;
      }

      const step = state.step;
      const baseEntries = state.entries;
      dispatch({ type: "select_option", optionId: option.id });

      if (selectTimeoutRef.current) {
        clearTimeout(selectTimeoutRef.current);
      }

      selectTimeoutRef.current = setTimeout(() => {
        const entry = entryFromResolvedOption(step, option);
        const nextEntries = [...baseEntries, entry];
        saveTranscript({ entries: nextEntries });
        void loadStep(nextEntries);
      }, SELECT_ANIMATION_MS);
    },
    [state.status, state.step, state.entries, loadStep],
  );

  const back = useCallback(() => {
    if (state.status !== "answering" || state.entries.length === 0) {
      return;
    }

    const poppedEntry = state.entries[state.entries.length - 1]!;
    const newEntries = state.entries.slice(0, -1);
    saveTranscript({ entries: newEntries });
    void loadStep(newEntries, poppedEntry.chosen.id);
  }, [state.status, state.entries, loadStep]);

  const retry = useCallback(() => {
    if (state.status !== "error") {
      return;
    }

    if (state.retryKind === "generate") {
      void runGenerate(state.entries);
    } else {
      void loadStep(state.entries);
    }
  }, [state.status, state.retryKind, state.entries, loadStep, runGenerate]);

  const nextOption = useCallback(() => dispatch({ type: "next_option" }), []);
  const prevOption = useCallback(() => dispatch({ type: "prev_option" }), []);
  const goToOption = useCallback((index: number) => dispatch({ type: "go_to_option", index }), []);

  return {
    state,
    step: state.step,
    activeOption: state.step?.options[state.activeOptionIndex],
    canGoBack: state.status === "answering" && state.entries.length > 0,
    choose,
    back,
    retry,
    nextOption,
    prevOption,
    goToOption,
  };
}
