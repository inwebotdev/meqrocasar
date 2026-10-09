import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { ToastProvider, useToast } from "./Toast";

function TriggerButton() {
  const { show } = useToast();
  return <button onClick={() => show("Guardado: Colonial Imperial & Casonas")}>Trigger</button>;
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the toast on show() and dismisses it after the timeout", () => {
    render(
      <ToastProvider>
        <TriggerButton />
      </ToastProvider>,
    );

    act(() => {
      screen.getByRole("button", { name: "Trigger" }).click();
    });

    expect(screen.getByText("Guardado: Colonial Imperial & Casonas")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.queryByText("Guardado: Colonial Imperial & Casonas")).not.toBeInTheDocument();
  });
});
