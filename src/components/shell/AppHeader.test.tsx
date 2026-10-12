import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname }));

const { AppHeader } = await import("./AppHeader");

describe("AppHeader", () => {
  it("shows the title and the SECTUR pill", () => {
    usePathname.mockReturnValue("/");
    render(<AppHeader title="Resultados Moodboard" />);

    expect(screen.getByText("Resultados Moodboard")).toBeInTheDocument();
    expect(screen.getByText("SECTUR Querétaro")).toBeInTheDocument();
  });

  it("keeps the long title in a single truncated element so the header stays one line", () => {
    usePathname.mockReturnValue("/");
    render(<AppHeader title="Resultados Moodboard" />);

    const title = screen.getByText("Resultados Moodboard");
    expect(title.tagName).toBe("SPAN");
    expect(title.textContent).toBe("Resultados Moodboard");
    expect(title).toHaveClass("truncate");

    const eyebrow = screen.getByText("Querétaro Romance");
    expect(eyebrow).toHaveClass("truncate");
  });

  it("gives the left column min-w-0 flex-1 so it can shrink and the title can truncate", () => {
    usePathname.mockReturnValue("/");
    render(<AppHeader title="Resultados Moodboard" />);

    const title = screen.getByText("Resultados Moodboard");
    const leftColumn = title.closest("a");
    expect(leftColumn).toHaveClass("min-w-0", "flex-1");
  });

  it("marks the SECTUR pill accessible by name even though its text hides below sm", () => {
    usePathname.mockReturnValue("/");
    render(<AppHeader title="Resultados Moodboard" />);

    expect(screen.getByLabelText("SECTUR Querétaro")).toBeInTheDocument();
  });

  it("shows a Recintos link pointing at /recintos on every page except Recintos itself", () => {
    usePathname.mockReturnValue("/");
    render(<AppHeader title="Quiz" />);

    const link = screen.getByRole("link", { name: "Recintos" });
    expect(link).toHaveAttribute("href", "/recintos");
  });

  it("shows a Quiz link pointing at / on the Recintos page", () => {
    usePathname.mockReturnValue("/recintos");
    render(<AppHeader title="Recintos" />);

    const link = screen.getByRole("link", { name: "Quiz" });
    expect(link).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Recintos" })).not.toBeInTheDocument();
  });
});
