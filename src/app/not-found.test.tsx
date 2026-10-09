import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/ruta-inexistente") }));

vi.mock("next/navigation", () => ({ usePathname }));

import NotFound from "./not-found";

describe("NotFound", () => {
  it("shows the not-found message with a link back to the quiz", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Esta ruta no existe" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver al quiz/i })).toHaveAttribute("href", "/");
  });
});
