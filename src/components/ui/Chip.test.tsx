import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Chip, type ChipTone } from "./Chip";

describe("Chip", () => {
  const TONE_EXPECTED_CLASSES: Record<ChipTone, string> = {
    surface: "bg-surface-container",
    "primary-container": "bg-primary-container/80",
  };

  it.each(Object.entries(TONE_EXPECTED_CLASSES))(
    "renders the %s tone with its expected class",
    (tone, expectedClass) => {
      render(<Chip tone={tone as ChipTone}>#CanteraRosa</Chip>);

      expect(screen.getByText("#CanteraRosa")).toHaveClass(expectedClass);
    },
  );
});
