import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button, type ButtonVariant } from "./Button";

describe("Button", () => {
  const VARIANT_EXPECTED_CLASSES: Record<ButtonVariant, string> = {
    primary: "bg-primary",
    soft: "bg-primary/10",
    accent: "bg-gradient-to-r",
    surface: "bg-surface-container-high",
    circle: "bg-surface-container-high",
  };

  it.each(Object.entries(VARIANT_EXPECTED_CLASSES))(
    "renders the %s variant with its expected class",
    (variant, expectedClass) => {
      render(<Button variant={variant as ButtonVariant}>Continuar</Button>);

      expect(screen.getByRole("button", { name: "Continuar" })).toHaveClass(expectedClass);
    },
  );

  it("stays disabled while loading even when disabled is explicitly false", () => {
    render(
      <Button loading disabled={false}>
        Continuar
      </Button>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables the button and shows a spinner with aria-busy when loading", () => {
    render(<Button loading>Continuar</Button>);

    const button = screen.getByRole("button", { name: "Continuar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("span.animate-spin")).not.toBeNull();
  });

  it("adds the full width class when fullWidth is set", () => {
    render(<Button fullWidth>Continuar</Button>);

    expect(screen.getByRole("button", { name: "Continuar" })).toHaveClass("w-full");
  });

  it("fires onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continuar</Button>);

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
