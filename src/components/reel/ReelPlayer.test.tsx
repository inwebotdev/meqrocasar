import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// React's `act` warns unless this is set; RTL normally sets it for us, but
// we drive the mock player's emitter directly (outside RTL's own event
// helpers), so the environment flag needs setting explicitly here.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { buildFallbackExperience } from "@/domain/experience/fallback";
import type { ExperienceResult } from "@/domain/experience/types";
import type { QuizAnswers } from "@/domain/quiz/schema";

// --- mock @remotion/player --------------------------------------------------

interface EmittedEvent {
  detail?: unknown;
}

type Listener = (event: EmittedEvent) => void;

const playerMock = vi.hoisted(() => {
  class Emitter {
    private listeners: Record<string, Listener[]> = {};

    addEventListener(name: string, callback: Listener) {
      (this.listeners[name] ??= []).push(callback);
    }

    removeEventListener(name: string, callback: Listener) {
      this.listeners[name] = (this.listeners[name] ?? []).filter((fn) => fn !== callback);
    }

    emit(name: string, detail?: unknown) {
      for (const fn of this.listeners[name] ?? []) fn({ detail });
    }
  }

  const emitter = new Emitter();
  let muted = false;

  return {
    emitter,
    toggle: vi.fn(),
    play: vi.fn(() => emitter.emit("play")),
    pause: vi.fn(() => emitter.emit("pause")),
    mute: vi.fn(() => {
      muted = true;
    }),
    unmute: vi.fn(() => {
      muted = false;
    }),
    isMuted: vi.fn(() => muted),
    getCurrentFrame: vi.fn(() => 0),
  };
});

vi.mock("@remotion/player", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const Player = React.forwardRef(function MockPlayer(_props: unknown, ref: unknown) {
    React.useImperativeHandle(ref as never, () => ({
      toggle: playerMock.toggle,
      play: playerMock.play,
      pause: playerMock.pause,
      mute: playerMock.mute,
      unmute: playerMock.unmute,
      isMuted: playerMock.isMuted,
      getCurrentFrame: playerMock.getCurrentFrame,
      addEventListener: playerMock.emitter.addEventListener.bind(playerMock.emitter),
      removeEventListener: playerMock.emitter.removeEventListener.bind(playerMock.emitter),
    }));
    return React.createElement("div", { "data-testid": "remotion-player" });
  });

  return { Player };
});

// --- mock useAudioAvailability -----------------------------------------------

const { useAudioAvailabilityMock } = vi.hoisted(() => ({ useAudioAvailabilityMock: vi.fn() }));
vi.mock("./useAudioAvailability", () => ({
  useAudioAvailability: useAudioAvailabilityMock,
}));

const { ReelPlayer } = await import("./ReelPlayer");

const ANSWERS: QuizAnswers = {
  style: "colonial",
  setting: "night_casona",
  experience: "grand_traditional",
  mustHave: "fireworks",
};

function buildResult(): ExperienceResult {
  return {
    ...buildFallbackExperience(ANSWERS),
    meta: {
      model: "fallback",
      fallbackUsed: true,
      durationMs: 0,
      generatedAt: new Date(0).toISOString(),
    },
  };
}

describe("ReelPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAudioAvailabilityMock.mockReturnValue({
      status: "available",
      src: "/audio/wedding-theme.mp3",
    });
  });

  it("renders the chrome with 00:00 as the initial time label", () => {
    render(<ReelPlayer result={buildResult()} />);

    expect(screen.getByTestId("remotion-player")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("clicking play calls toggle and shows the pause state once play is emitted", () => {
    render(<ReelPlayer result={buildResult()} />);

    const playButton = screen.getByRole("button", { name: "Reproducir reel" });
    fireEvent.click(playButton);

    expect(playerMock.toggle).toHaveBeenCalledTimes(1);

    act(() => {
      playerMock.emitter.emit("play");
    });

    expect(screen.getByRole("button", { name: "Pausar reel" })).toBeInTheDocument();
  });

  it("updates the time label and progress bar on frameupdate", () => {
    render(<ReelPlayer result={buildResult()} />);

    act(() => {
      playerMock.emitter.emit("frameupdate", { frame: 165 });
    });

    expect(screen.getByText("00:05")).toBeInTheDocument();

    const progressBar = document.querySelector('[style*="width"]');
    expect(progressBar).toHaveStyle({ width: "50%" });
  });

  it("toggles mute and unmute", () => {
    render(<ReelPlayer result={buildResult()} />);

    const muteButton = screen.getByRole("button", { name: "Audio mute/unmute" });

    fireEvent.click(muteButton);
    expect(playerMock.mute).toHaveBeenCalledTimes(1);

    fireEvent.click(muteButton);
    expect(playerMock.unmute).toHaveBeenCalledTimes(1);
  });

  it('shows the "Sin audio" label when useAudioAvailability reports missing', () => {
    useAudioAvailabilityMock.mockReturnValue({ status: "missing" });

    render(<ReelPlayer result={buildResult()} />);

    expect(screen.getByText(/Sin audio/)).toBeInTheDocument();
  });
});
