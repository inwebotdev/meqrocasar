import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("marks Quiz active on /", () => {
    usePathname.mockReturnValue("/");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /Quiz/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Moodboard/i })).not.toHaveAttribute("aria-current");
  });

  it("marks Moodboard active on /resultados", () => {
    usePathname.mockReturnValue("/resultados");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /Moodboard/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Quiz/i })).not.toHaveAttribute("aria-current");
  });

  it("marks Recintos active on /recintos", () => {
    usePathname.mockReturnValue("/recintos");
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /Recintos/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Quiz/i })).not.toHaveAttribute("aria-current");
  });
});
