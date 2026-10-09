import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Pill, type PillTone } from "./Pill";

describe("Pill", () => {
  const TONE_EXPECTED_CLASSES: Record<PillTone, string> = {
    "primary-soft": "bg-primary/5",
    primary: "bg-primary",
    "glass-dark": "bg-primary/80",
    "glass-light": "bg-black/60",
    "secondary-soft": "bg-secondary-container/30",
    tertiary: "bg-secondary-fixed",
    gold: "bg-gold/15",
  };

  it.each(Object.entries(TONE_EXPECTED_CLASSES))(
    "renders the %s tone with its expected class",
    (tone, expectedClass) => {
      render(<Pill tone={tone as PillTone}>SECTUR Querétaro</Pill>);

      expect(screen.getByText("SECTUR Querétaro").parentElement).toHaveClass(expectedClass);
    },
  );

  it("renders a leading icon when icon is set", () => {
    render(<Pill icon="verified">SECTUR Querétaro</Pill>);

    expect(screen.getByText("verified")).toBeInTheDocument();
  });

  it("renders no icon when icon is not set", () => {
    render(<Pill>SECTUR Querétaro</Pill>);

    expect(screen.queryByText("verified")).not.toBeInTheDocument();
  });
});
