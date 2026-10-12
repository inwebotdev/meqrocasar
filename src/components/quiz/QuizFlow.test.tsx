import type { PropsWithChildren, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider } from "@/components/ui";
import type { ExperienceResult } from "@/domain/experience/types";
import { resolvedStepFromCurated, type ResolvedStep } from "@/domain/quiz/generated-step";
import { QUIZ_STEPS } from "@/domain/quiz/questions";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { fetchNextStep, generateExperienceFromTranscript, prefetchNextSteps, ApiClientErrorMock } =
  vi.hoisted(() => {
    class ApiClientErrorMock extends Error {
      code: string;
      status?: number;
      constructor(params: { code: string; status?: number; message: string }) {
        super(params.message);
        this.name = "ApiClientError";
        this.code = params.code;
        this.status = params.status;
      }
    }
    return {
      fetchNextStep: vi.fn(),
      generateExperienceFromTranscript: vi.fn(),
      prefetchNextSteps: vi.fn().mockResolvedValue(undefined),
      ApiClientErrorMock,
    };
  });
vi.mock("@/lib/quiz-client", () => ({
  fetchNextStep,
  generateExperienceFromTranscript,
  prefetchNextSteps,
  ApiClientError: ApiClientErrorMock,
}));

const { saveResult } = vi.hoisted(() => ({ saveResult: vi.fn() }));
vi.mock("@/lib/results-store", () => ({ saveResult }));

const { saveTranscript } = vi.hoisted(() => ({ saveTranscript: vi.fn() }));
vi.mock("@/lib/transcript-store", () => ({ saveTranscript }));

type MotionStubProps = PropsWithChildren<Record<string, unknown>>;

function stripMotionProps({
  whileTap,
  style,
  initial,
  animate,
  exit,
  mode,
  ...rest
}: MotionStubProps): Record<string, unknown> {
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

/**
 * The slide `<article>` for `title` — climbs from its heading, since every
 * slide renders its own `h2`. Async: awaits the heading first, so it's
 * safe to call right after `renderQuiz()` without a separate wait for the
 * step to finish loading.
 */
async function cardFor(title: string) {
  const heading = await screen.findByRole("heading", { name: title });
  return heading.closest("article")!;
}

/**
 * Chooses `option` regardless of whether it's already the active card: the
 * option list's button for it is clicked first (makes it active — a no-op
 * if it already is), then that card's "Elegir" button is confirmed.
 */
async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  option: { title: string },
  selectLabel: string,
) {
  await user.click(screen.getByRole("button", { name: option.title }));
  const card = await cardFor(option.title);
  await user.click(within(card).getByRole("button", { name: selectLabel }));
}

const curatedMeta = {
  model: "local-fallback",
  durationMs: 4,
  cached: false,
  fallbackUsed: false,
  source: "static" as const,
  attempts: 0,
  promptVersion: "quiz-engine-v2",
  normalisations: 0,
};

const llmMeta = { ...curatedMeta, model: "deepseek/deepseek-chat", source: "llm" as const };

const step1 = resolvedStepFromCurated(QUIZ_STEPS[0]!, 1);

const step2: ResolvedStep = {
  id: "setting-llm",
  topic: "Entorno",
  question: "¿En qué momento del día cobra vida su celebración?",
  helper: "Elige la luz y el entorno que mejor acompañan su boda.",
  selectLabel: "Elegir este Entorno",
  done: false,
  index: 2,
  source: "llm",
  options: [
    {
      id: "atardecer-vinedo",
      title: "Atardecer entre Viñedos",
      description: "Copas en mano mientras el sol se despide entre las vides.",
      hashtags: ["#AtardecerVinedo", "#ValleDeColon", "#LuzDorada"],
      facets: { setting: "day_vineyard" },
      refs: { venueIds: [], experienceIds: ["vendimia-la-redonda"] },
      photoQuery: "vineyard sunset wedding toast",
      badge: "Ruta del Vino",
      matchLabel: "95% AFINIDAD",
      photo: {
        url: "https://images.unsplash.com/photo-step2-a",
        alt: "Viñedo al atardecer",
        credit: "Fotógrafo B",
      },
    },
    {
      id: "noche-casona",
      title: "Noche de Casona",
      description: "Candiles y cantera iluminan la noche virreinal.",
      hashtags: ["#NocheDeCasona", "#CandilesDeCantera", "#CentroHistorico"],
      facets: { setting: "night_casona" },
      refs: { venueIds: [], experienceIds: [] },
      photoQuery: "candlelit courtyard night wedding",
      badge: "Noche Virreinal",
      matchLabel: "90% AFINIDAD",
      photo: {
        url: "https://images.unsplash.com/photo-step2-b",
        alt: "Patio nocturno",
        credit: "Fotógrafo C",
      },
    },
    {
      id: "dia-jardin",
      title: "Día de Jardín",
      description: "Brindis matutinos entre flores y luz natural.",
      hashtags: ["#DiaDeJardin", "#LuzNatural", "#Brindis"],
      facets: { setting: "sunset_garden" },
      refs: { venueIds: [], experienceIds: [] },
      photoQuery: "garden daytime wedding toast",
      badge: "Golden Hour SECTUR",
      matchLabel: "87% AFINIDAD",
      photo: {
        url: "https://images.unsplash.com/photo-step2-c",
        alt: "Jardín de día",
        credit: "Fotógrafo D",
      },
    },
  ],
};

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
  beforeEach(() => {
    fetchNextStep.mockReset();
    generateExperienceFromTranscript.mockReset();
    saveResult.mockReset();
    saveTranscript.mockReset();
    push.mockReset();
  });

  it("loads and renders the curated step 1 on mount, with no back button", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    renderQuiz();

    expect(await screen.findByText("Paso 1: Estilo")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Ir a opción/i })).toHaveLength(4);
    expect(fetchNextStep).toHaveBeenCalledWith({ entries: [] });
    expect(screen.queryByRole("button", { name: "Pregunta anterior" })).not.toBeInTheDocument();
  });

  it("shows the carousel caption with the option count", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    renderQuiz();

    expect(
      await screen.findByText("Desliza para ver las 4 opciones · toca Elegir para continuar"),
    ).toBeInTheDocument();
  });

  it("renders exactly one Elegir button per slide, scoped to that slide's card", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    renderQuiz();
    await screen.findByText("Paso 1: Estilo");

    for (const option of step1.options) {
      const card = await cardFor(option.title);
      expect(within(card).getAllByRole("button", { name: step1.selectLabel })).toHaveLength(1);
    }
  });

  it("choosing a card shows a toast, then StepLoading, then step 2 from the mock", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    // The second call is held open deliberately, so the test can assert the
    // `StepLoading` pill deterministically instead of racing a real timer.
    let resolveSecondCall: ((value: unknown) => void) | undefined;
    fetchNextStep.mockImplementationOnce(
      () => new Promise((resolve) => (resolveSecondCall = resolve)),
    );
    const user = userEvent.setup();
    renderQuiz();

    const first = step1.options[0]!;
    const card = await cardFor(first.title);
    const optionButton = within(card).getByRole("button", {
      name: step1.selectLabel,
    });
    await user.click(optionButton);

    expect(await screen.findByText(`Guardado: ${first.title}`)).toBeInTheDocument();
    expect(optionButton).toBeDisabled();

    expect(await screen.findByText("Estamos analizando su respuesta…")).toBeInTheDocument();
    expect(fetchNextStep).toHaveBeenNthCalledWith(2, {
      entries: [
        expect.objectContaining({
          stepId: "style",
          chosen: expect.objectContaining({ id: first.id }),
        }),
      ],
    });

    resolveSecondCall?.({ done: false, step: step2, meta: llmMeta });

    expect(await screen.findByText(step2.question)).toBeInTheDocument();
    expect(screen.getByText("Paso 2: Entorno")).toBeInTheDocument();
  });

  it("shows the known-facets strip with the labels of every answered facet", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step2, meta: llmMeta });
    const user = userEvent.setup();
    renderQuiz();

    await screen.findByText("Paso 1: Estilo");
    const rustic = step1.options.find((option) => option.id === "rustic_vineyard")!;
    await chooseOption(user, rustic, step1.selectLabel);

    expect(await screen.findByText(step2.question)).toBeInTheDocument();
    expect(screen.getByText("Rústico Viñedo")).toBeInTheDocument();
  });

  it("Pregunta anterior is hidden on step 1 and appears from step 2 onward", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step2, meta: llmMeta });
    const user = userEvent.setup();
    renderQuiz();

    await screen.findByText("Paso 1: Estilo");
    expect(screen.queryByRole("button", { name: "Pregunta anterior" })).not.toBeInTheDocument();

    const rustic = step1.options.find((option) => option.id === "rustic_vineyard")!;
    await chooseOption(user, rustic, step1.selectLabel);

    expect(await screen.findByText(step2.question)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pregunta anterior" })).toBeInTheDocument();
  });

  it("Pregunta anterior pops the last entry, re-requests that step, and restores the active option", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step2, meta: llmMeta });
    const user = userEvent.setup();
    renderQuiz();

    await screen.findByText("Paso 1: Estilo");
    const rustic = step1.options.find((option) => option.id === "rustic_vineyard")!;
    await chooseOption(user, rustic, step1.selectLabel);
    expect(await screen.findByText(step2.question)).toBeInTheDocument();

    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    await user.click(screen.getByRole("button", { name: "Pregunta anterior" }));

    expect(await screen.findByText("Paso 1: Estilo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: rustic.title })).toBeInTheDocument();
    expect(fetchNextStep).toHaveBeenNthCalledWith(3, { entries: [] });
  });

  it("generates the experience, saves it and redirects to /resultados when the engine is done", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    fetchNextStep.mockResolvedValueOnce({ done: true, meta: llmMeta });
    generateExperienceFromTranscript.mockResolvedValueOnce(validResult);
    const user = userEvent.setup();
    renderQuiz();

    const first = step1.options[0]!;
    const card = await cardFor(first.title);
    await user.click(within(card).getByRole("button", { name: step1.selectLabel }));

    expect(await screen.findByText("Estamos preparando su propuesta…")).toBeInTheDocument();
    await waitFor(() => expect(saveResult).toHaveBeenCalledWith(validResult));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/resultados"));
  });

  it("shows QuizError on a step-fetch failure, and retry re-requests the step", async () => {
    fetchNextStep.mockRejectedValueOnce(
      new ApiClientErrorMock({ code: "network", message: "Sin conexión" }),
    );
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    const user = userEvent.setup();
    renderQuiz();

    expect(await screen.findByText("Sin conexión")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Intentar de nuevo" });

    await user.click(retryButton);

    expect(await screen.findByText("Paso 1: Estilo")).toBeInTheDocument();
    expect(fetchNextStep).toHaveBeenCalledTimes(2);
  });

  it("ArrowRight then Enter on the carousel chooses the next option via the keyboard", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step2, meta: llmMeta });
    const user = userEvent.setup();
    renderQuiz();

    const second = step1.options[1]!;
    await screen.findByText("Paso 1: Estilo");

    const carousel = screen.getByRole("group", { name: "Opciones" });
    carousel.focus();
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    fireEvent.keyDown(carousel, { key: "Enter" });

    expect(await screen.findByText(`Guardado: ${second.title}`)).toBeInTheDocument();
    expect(await screen.findByText(step2.question)).toBeInTheDocument();
    void user;
  });

  it("Backspace on the stage goes back when a previous step exists", async () => {
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    fetchNextStep.mockResolvedValueOnce({ done: false, step: step2, meta: llmMeta });
    const user = userEvent.setup();
    renderQuiz();

    await screen.findByText("Paso 1: Estilo");
    const rustic = step1.options.find((option) => option.id === "rustic_vineyard")!;
    await chooseOption(user, rustic, step1.selectLabel);
    expect(await screen.findByText(step2.question)).toBeInTheDocument();

    fetchNextStep.mockResolvedValueOnce({ done: false, step: step1, meta: curatedMeta });
    const carousel = screen.getByRole("group", { name: "Opciones" });
    fireEvent.keyDown(carousel, { key: "Backspace" });

    expect(await screen.findByText("Paso 1: Estilo")).toBeInTheDocument();
  });
});
