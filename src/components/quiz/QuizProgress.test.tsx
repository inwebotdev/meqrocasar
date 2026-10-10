import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { QuizProgress } from "./QuizProgress";

function heartCounter(expected: string) {
  return (_content: string, element: Element | null) => element?.textContent === expected;
}

const step = {
  question: "¿Qué vibra define su historia?",
  topic: "Estilo",
  helper: "Desliza las postales o toca tu favorita.",
};

describe("QuizProgress", () => {
  it("renders the step 1 headline, topic label and heart counter out of 7", () => {
    render(<QuizProgress entriesCount={0} step={step} />);

    expect(screen.getByRole("heading", { name: step.question })).toBeInTheDocument();
    expect(screen.getByText("Paso 1: Estilo")).toBeInTheDocument();
    expect(screen.getByText(heartCounter("1 / 7"))).toBeInTheDocument();
    expect(screen.getByText(step.helper)).toBeInTheDocument();
  });

  it("renders step 3's topic label and heart counter when 2 entries are answered", () => {
    render(<QuizProgress entriesCount={2} step={{ ...step, topic: "Zona" }} />);

    expect(screen.getByText("Paso 3: Zona")).toBeInTheDocument();
    expect(screen.getByText(heartCounter("3 / 7"))).toBeInTheDocument();
  });
});
