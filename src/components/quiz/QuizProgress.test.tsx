import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { QUIZ_STEPS } from "@/domain/quiz/questions";

import { QuizProgress } from "./QuizProgress";

function heartCounter(expected: string) {
  return (_content: string, element: Element | null) => element?.textContent === expected;
}

describe("QuizProgress", () => {
  it("renders the step 1 headline, topic label and heart counter", () => {
    render(<QuizProgress stepIndex={0} total={QUIZ_STEPS.length} step={QUIZ_STEPS[0]} />);

    expect(screen.getByRole("heading", { name: QUIZ_STEPS[0].question })).toBeInTheDocument();
    expect(screen.getByText(`Paso 1: ${QUIZ_STEPS[0].topic}`)).toBeInTheDocument();
    expect(screen.getByText(heartCounter("1 / 4"))).toBeInTheDocument();
    expect(screen.getByText(QUIZ_STEPS[0].helper)).toBeInTheDocument();
  });

  it("renders step 3's topic label and heart counter when on step 3", () => {
    render(<QuizProgress stepIndex={2} total={QUIZ_STEPS.length} step={QUIZ_STEPS[2]} />);

    expect(screen.getByText(`Paso 3: ${QUIZ_STEPS[2].topic}`)).toBeInTheDocument();
    expect(screen.getByText(heartCounter("3 / 4"))).toBeInTheDocument();
  });
});
