import { describe, expect, it } from "vitest";

import { QUIZ_STEPS } from "@/domain/quiz/questions";
import { QuizAnswersSchema } from "@/domain/quiz/schema";

import {
  createInitialQuizFlowState,
  quizFlowReducer,
  type QuizFlowAction,
  type QuizFlowState,
} from "./useQuizFlow";

function run(state: QuizFlowState, ...actions: QuizFlowAction[]): QuizFlowState {
  return actions.reduce(quizFlowReducer, state);
}

describe("quizFlowReducer", () => {
  it("starts answering step 1 with no selection and activeOptionIndex 0", () => {
    const state = createInitialQuizFlowState();
    expect(state.stepIndex).toBe(0);
    expect(state.activeOptionIndex).toBe(0);
    expect(state.selections).toEqual({});
    expect(state.status).toBe("answering");
  });

  it("canContinue is false before any selection on the current step", () => {
    const state = createInitialQuizFlowState();
    const step = QUIZ_STEPS[state.stepIndex];
    expect(state.selections[step.id]).toBeUndefined();
  });

  it("next_option / prev_option cycle through the step's options", () => {
    const initial = createInitialQuizFlowState();
    const total = QUIZ_STEPS[0].options.length;

    let state = initial;
    for (let i = 0; i < total; i += 1) {
      state = quizFlowReducer(state, { type: "next_option" });
    }
    expect(state.activeOptionIndex).toBe(0); // wrapped all the way around

    state = quizFlowReducer(state, { type: "prev_option" });
    expect(state.activeOptionIndex).toBe(total - 1); // wrapped backwards past 0
  });

  it("select_active marks the active option as selected for the current step", () => {
    const state = run(
      createInitialQuizFlowState(),
      { type: "next_option" },
      { type: "select_active" },
    );
    const step = QUIZ_STEPS[state.stepIndex];
    expect(state.selections[step.id]).toBe(step.options[1].id);
  });

  it("select_option selects by id and moves the active index to match", () => {
    const step = QUIZ_STEPS[0];
    const target = step.options[2];

    const state = quizFlowReducer(createInitialQuizFlowState(), {
      type: "select_option",
      id: target.id,
    });

    expect(state.selections[step.id]).toBe(target.id);
    expect(state.activeOptionIndex).toBe(2);
  });

  it("selecting then changing step keeps the selection, and re-entering restores activeOptionIndex", () => {
    const step1Target = QUIZ_STEPS[0].options[2];

    let state = quizFlowReducer(createInitialQuizFlowState(), {
      type: "select_option",
      id: step1Target.id,
    });
    state = quizFlowReducer(state, { type: "next_step" });

    expect(state.stepIndex).toBe(1);
    expect(state.selections[QUIZ_STEPS[0].id]).toBe(step1Target.id);
    expect(state.activeOptionIndex).toBe(0); // step 2 has no selection yet

    state = quizFlowReducer(state, { type: "prev_step" });

    expect(state.stepIndex).toBe(0);
    expect(state.activeOptionIndex).toBe(2); // restored to the earlier selection
    expect(state.selections[QUIZ_STEPS[0].id]).toBe(step1Target.id);
  });

  it("walking through all 4 steps and selecting one option each yields valid QuizAnswers", () => {
    let state = createInitialQuizFlowState();

    for (let i = 0; i < QUIZ_STEPS.length; i += 1) {
      const step = QUIZ_STEPS[state.stepIndex];
      state = quizFlowReducer(state, { type: "select_option", id: step.options[0].id });

      if (i < QUIZ_STEPS.length - 1) {
        state = quizFlowReducer(state, { type: "next_step" });
      }
    }

    const parsed = QuizAnswersSchema.safeParse(state.selections);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    for (const step of QUIZ_STEPS) {
      expect(parsed.data[step.id]).toBe(step.options[0].id);
    }
  });

  it("next_step / prev_step clamp at the first and last step", () => {
    let state = createInitialQuizFlowState();
    state = quizFlowReducer(state, { type: "prev_step" });
    expect(state.stepIndex).toBe(0);

    for (let i = 0; i < 10; i += 1) {
      state = quizFlowReducer(state, { type: "next_step" });
    }
    expect(state.stepIndex).toBe(QUIZ_STEPS.length - 1);
  });

  it("submit_start / submit_error / reset manage status", () => {
    let state = createInitialQuizFlowState();
    state = quizFlowReducer(state, { type: "submit_start" });
    expect(state.status).toBe("submitting");

    state = quizFlowReducer(state, { type: "submit_error", message: "boom" });
    expect(state.status).toBe("error");
    expect(state.errorMessage).toBe("boom");

    state = quizFlowReducer(state, { type: "reset" });
    expect(state).toEqual(createInitialQuizFlowState());
  });

  it("go_to_option ignores out-of-range indexes", () => {
    const state = createInitialQuizFlowState();
    const outOfRange = quizFlowReducer(state, { type: "go_to_option", index: 999 });
    expect(outOfRange.activeOptionIndex).toBe(0);

    const inRange = quizFlowReducer(state, { type: "go_to_option", index: 1 });
    expect(inRange.activeOptionIndex).toBe(1);
  });
});
