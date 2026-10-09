import { z } from "zod";

import {
  EXPERIENCE_IDS,
  getOption,
  getStep,
  MUST_HAVE_IDS,
  SETTING_IDS,
  STYLE_IDS,
} from "./questions";
import type { QuizStepId } from "./types";

export const QuizAnswersSchema = z
  .object({
    style: z.enum(STYLE_IDS),
    setting: z.enum(SETTING_IDS),
    experience: z.enum(EXPERIENCE_IDS),
    mustHave: z.enum(MUST_HAVE_IDS),
  })
  .strict();

export type QuizAnswers = z.infer<typeof QuizAnswersSchema>;

const STEP_ORDER: readonly QuizStepId[] = ["style", "setting", "experience", "mustHave"];

/**
 * Renders the "User Input" block of the LLM prompt: one line per answer
 * with the Spanish topic label, the chosen option's title and its
 * `promptHint` sentence.
 */
export function describeAnswers(answers: QuizAnswers): string {
  return STEP_ORDER.map((stepId) => {
    const step = getStep(stepId);
    const option = getOption(stepId, answers[stepId]);
    return `- ${step.topic}: ${option.title}. ${option.promptHint}`;
  }).join("\n");
}
