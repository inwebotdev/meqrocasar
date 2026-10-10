import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("keeps a text color alongside a design-system text size", () => {
    expect(cn("text-on-primary text-label-lg")).toBe("text-on-primary text-label-lg");
    expect(cn("bg-primary text-on-primary font-label-sm text-label-sm")).toContain(
      "text-on-primary",
    );
  });

  it("still merges conflicting sizes and colors", () => {
    expect(cn("text-label-sm text-label-lg")).toBe("text-label-lg");
    expect(cn("text-primary text-on-primary")).toBe("text-on-primary");
  });
});
