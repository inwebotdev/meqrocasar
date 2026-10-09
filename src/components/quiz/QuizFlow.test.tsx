import type { PropsWithChildren, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui";
import { QUIZ_STEPS } from "@/domain/quiz/questions";
import type { ExperienceResult } from "@/domain/experience/types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { generateExperience } = vi.hoisted(() => ({ generateExperience: vi.fn() }));
vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, generateExperience };
});

const { saveResult } = vi.hoisted(() => ({ saveResult: vi.fn() }));
vi.mock("@/lib/results-store", () => ({ saveResult }));

type MotionStubProps = PropsWithChildren<Record<string, unknown>>;

function stripMotionProps({
  drag,
  dragConstraints,
  dragElastic,
  onDragEnd,
  whileTap,
  style,
  initial,
  animate,
  exit,
  mode,
  ...rest
}: MotionStubProps): Record<string, unknown> {
  void drag;
  void dragConstraints;
  void dragElastic;
  void onDragEnd;
  void whileTap;
  void style;
  void initial;
  void animate;
  void exit;
  void mode;
  return rest;
}

vi.mock("framer-motion", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  function makeStub(tag: "div" | "article") {
    return function MotionStub({ children, ...props }: MotionStubProps) {
      return React.createElement(tag, stripMotionProps(props), children);
    };
  }

  return {
    motion: { div: makeStub("div"), article: makeStub("article") },
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    useReducedMotion: () => true,
    useMotionValue: (initialValue: number) => ({
      get: () => initialValue,
      set: () => {},
      on: () => () => {},
    }),
    useTransform: () => 0,
  };
});

const { QuizFlow } = await import("./QuizFlow");

function renderQuiz() {
  return render(
    <ToastProvider>
      <QuizFlow />
    </ToastProvider>,
  );
}

const validResult: ExperienceResult = {
  conceptTitle: "Atardecer Dorado entre Viñedos",
  palette: [
    { hex: "#4B001A", name: "Vino Profundo" },
    { hex: "#944933", name: "Terracota" },
    { hex: "#E9A844", name: "Ámbar Bernal" },
    { hex: "#FCF9F3", name: "Lino" },
  ],
  narrative: "Una celebración íntima entre viñedos centenarios y atardeceres dorados.",
  reelTagline: "Su historia, entre viñedos y atardeceres.",
  searchQueries: ["boda viñedo querétaro"],
  venues: [],
  photos: [
    { url: "https://images.unsplash.com/photo-1", alt: "Viñedo", credit: "Autor A" },
    { url: "https://images.unsplash.com/photo-2", alt: "Atardecer", credit: "Autor B" },
    { url: "https://images.unsplash.com/photo-3", alt: "Cava", credit: "Autor C" },
  ],
  answers: {
    style: "colonial",
    setting: "sunset_garden",
    experience: "intimate_boutique",
    mustHave: "wine_tasting",
  },
  meta: {
    model: "test-model",
    fallbackUsed: false,
    durationMs: 1234,
    generatedAt: "2026-01-01T00:00:00.000Z",
  },
};

describe("QuizFlow", () => {
  it("renders step 1 with its topic, 4 dots, and a disabled Continuar button", () => {
    renderQuiz();

    expect(screen.getByText(`Paso 1: ${QUIZ_STEPS[0].topic}`)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Ir a opción/i })).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Continuar/i })).toBeDisabled();
  });

  it("selecting the active card shows a toast, enables Continuar, and marks the quick strip pressed", async () => {
    const user = userEvent.setup();
    renderQuiz();

    const firstOption = QUIZ_STEPS[0].options[0];
    await user.click(screen.getByRole("button", { name: `Elegir ${firstOption.title}` }));

    expect(await screen.findByText(`Guardado: ${firstOption.title}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: firstOption.label })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("clicking Continuar advances to step 2", async () => {
    const user = userEvent.setup();
    renderQuiz();

    const firstOption = QUIZ_STEPS[0].options[0];
    await user.click(screen.getByRole("button", { name: `Elegir ${firstOption.title}` }));
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    expect(screen.getByText(`Paso 2: ${QUIZ_STEPS[1].topic}`)).toBeInTheDocument();
  });

  it("next/prev buttons cycle the active option's title", async () => {
    const user = userEvent.setup();
    renderQuiz();

    const [first, second] = QUIZ_STEPS[0].options;

    expect(screen.getByRole("heading", { name: first.title })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Explorar siguiente opción" }));
    expect(screen.getByRole("heading", { name: second.title })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Opción anterior" }));
    expect(screen.getByRole("heading", { name: first.title })).toBeInTheDocument();
  });

  it("quick strip jumps the active option without selecting it", async () => {
    const user = userEvent.setup();
    renderQuiz();

    const target = QUIZ_STEPS[0].options[2];
    await user.click(screen.getByRole("button", { name: target.label }));

    expect(screen.getByRole("heading", { name: target.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/i })).toBeDisabled();
    expect(screen.queryByText(`Guardado: ${target.title}`)).not.toBeInTheDocument();
  });

  it("completing all 4 steps calls generateExperience with the exact answers, saves and redirects", async () => {
    generateExperience.mockResolvedValueOnce(validResult);
    const user = userEvent.setup();
    renderQuiz();

    const expectedAnswers = {
      style: QUIZ_STEPS[0].options[0].id,
      setting: QUIZ_STEPS[1].options[0].id,
      experience: QUIZ_STEPS[2].options[0].id,
      mustHave: QUIZ_STEPS[3].options[0].id,
    };

    for (let i = 0; i < QUIZ_STEPS.length; i += 1) {
      const option = QUIZ_STEPS[i].options[0];
      await user.click(screen.getByRole("button", { name: `Elegir ${option.title}` }));
      await user.click(screen.getByRole("button", { name: /Continuar|Crear mi experiencia/i }));
    }

    await waitFor(() => expect(generateExperience).toHaveBeenCalledWith(expectedAnswers));
    await waitFor(() => expect(saveResult).toHaveBeenCalledWith(validResult));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/resultados"));
  });

  it("shows QuizError on API failure, and retry calls generateExperience again", async () => {
    generateExperience.mockRejectedValueOnce(new Error("boom"));
    generateExperience.mockResolvedValueOnce(validResult);
    const user = userEvent.setup();
    renderQuiz();

    for (let i = 0; i < QUIZ_STEPS.length; i += 1) {
      const option = QUIZ_STEPS[i].options[0];
      await user.click(screen.getByRole("button", { name: `Elegir ${option.title}` }));
      await user.click(screen.getByRole("button", { name: /Continuar|Crear mi experiencia/i }));
    }

    expect(await screen.findByRole("button", { name: "Intentar de nuevo" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Intentar de nuevo" }));

    await waitFor(() => expect(generateExperience).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/resultados"));
  });
});
