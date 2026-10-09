import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/resultados") }));

vi.mock("next/navigation", () => ({ usePathname }));

import ErrorPage from "./error";

describe("ErrorPage", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("shows the error message and a link back to the quiz", () => {
    render(<ErrorPage error={new Error("boom")} reset={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Algo salió mal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver al quiz/i })).toHaveAttribute("href", "/");
  });

  it("calls reset when 'Intentar de nuevo' is clicked", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: /Intentar de nuevo/i }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error to the console for diagnostics", () => {
    const error = new Error("boom");
    render(<ErrorPage error={error} reset={vi.fn()} />);

    expect(consoleError).toHaveBeenCalledWith(error);
  });
});
