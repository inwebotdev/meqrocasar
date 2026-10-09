import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/") }));

vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/components/quiz/QuizFlow", () => ({
  QuizFlow: () => <div data-testid="quiz-flow" />,
}));

import Home from "./page";

describe("Home", () => {
  it("renders the quiz flow inside the page shell", () => {
    render(<Home />);

    expect(screen.getByText("Quiz Swipe & Play")).toBeInTheDocument();
    expect(screen.getByTestId("quiz-flow")).toBeInTheDocument();
  });
});
