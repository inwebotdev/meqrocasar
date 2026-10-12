import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MoodboardTemplate, truncateTitle } from "./Template";
import type { MoodboardParams } from "./params";

const PARAMS: MoodboardParams = {
  title: "Atardecer Virreinal entre Patios de Cantera",
  zone: "Ezequiel Montes · Querétaro",
  tagline: "Romance Virreinal con Cata de Vinos",
  palette: [
    { hex: "#68182E", name: "Vino Tinto" },
    { hex: "#D4AF37", name: "Oro Cantera" },
    { hex: "#F5EDE0", name: "Lino Crudo" },
    { hex: "#2F4839", name: "Verde Musgo" },
  ],
  photos: [
    "https://images.unsplash.com/photo-1",
    "https://images.unsplash.com/photo-2",
    "https://images.unsplash.com/photo-3",
  ],
};

const DATA_URL_IMAGES: [string, string, string] = [
  "data:image/jpeg;base64,AAAA",
  "data:image/jpeg;base64,BBBB",
  "data:image/jpeg;base64,CCCC",
];

/**
 * Recursively walks a React *element* tree (not rendered DOM), rendering
 * any function component found along the way, and asserts that every
 * `div` element with 2+ element children declares `display: "flex"`.
 */
function assertFlexOnMultiChildDivs(node: unknown): void {
  if (node === null || node === undefined || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) assertFlexOnMultiChildDivs(child);
    return;
  }

  if (!React.isValidElement(node)) return;

  const { type, props } = node as React.ReactElement<{
    children?: unknown;
    style?: Record<string, unknown>;
  }>;

  if (typeof type === "function") {
    const rendered = (type as (p: unknown) => unknown)(props);
    assertFlexOnMultiChildDivs(rendered);
    return;
  }

  if (type === "div") {
    const elementChildren = React.Children.toArray(
      (props.children ?? []) as React.ReactNode,
    ).filter((child) => React.isValidElement(child));

    if (elementChildren.length >= 2) {
      expect(
        props.style?.display,
        `div with ${elementChildren.length} element children must set display: "flex"`,
      ).toBe("flex");
    }
  }

  React.Children.forEach(props.children as React.ReactNode, (child) =>
    assertFlexOnMultiChildDivs(child),
  );
}

describe("truncateTitle", () => {
  it("returns short titles unchanged", () => {
    expect(truncateTitle("Atardecer Virreinal")).toBe("Atardecer Virreinal");
  });

  it("truncates long titles to ~70 chars with an ellipsis", () => {
    const long = "A".repeat(100);
    const truncated = truncateTitle(long, 70);

    expect(truncated.length).toBe(70);
    expect(truncated.endsWith("…")).toBe(true);
    expect(truncated.startsWith("A".repeat(69))).toBe(true);
  });
});

describe("MoodboardTemplate", () => {
  it("renders the title, zone, all 4 hex labels, and the seal text", () => {
    const element = React.createElement(MoodboardTemplate, {
      params: PARAMS,
      images: DATA_URL_IMAGES,
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("Atardecer Virreinal entre Patios de Cantera");
    expect(markup).toContain("Ezequiel Montes · Querétaro");
    for (const color of PARAMS.palette) {
      expect(markup).toContain(color.hex.toUpperCase());
    }
    expect(markup).toContain("SECRETARÍA DE TURISMO · QUERÉTARO");
  });

  it("prefixes a non-Querétaro zone with 'PUEBLO MÁGICO ·'", () => {
    const element = React.createElement(MoodboardTemplate, {
      params: { ...PARAMS, zone: "Bernal" },
      images: DATA_URL_IMAGES,
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain("PUEBLO MÁGICO · Bernal");
  });

  it("renders a palette-color fallback block when an image isn't a data: URL", () => {
    const element = React.createElement(MoodboardTemplate, {
      params: PARAMS,
      images: ["", "", ""],
    });
    const markup = renderToStaticMarkup(element);

    expect(markup).not.toContain("<img");
    expect(markup).toContain(PARAMS.palette[0].hex);
    expect(markup).toContain(PARAMS.palette[1].hex);
    expect(markup).toContain(PARAMS.palette[2].hex);
  });

  it("every div with 2+ element children uses display: flex", () => {
    const element = React.createElement(MoodboardTemplate, {
      params: PARAMS,
      images: DATA_URL_IMAGES,
    });
    assertFlexOnMultiChildDivs(element);
  });

  it("still satisfies the flex structural rule when there is no tagline", () => {
    const element = React.createElement(MoodboardTemplate, {
      params: { ...PARAMS, tagline: undefined },
      images: DATA_URL_IMAGES,
    });
    assertFlexOnMultiChildDivs(element);
  });
});
