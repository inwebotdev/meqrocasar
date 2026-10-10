import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The design system defines its type scale as `--text-<scale>` tokens, so classes like
// `text-label-lg` are font sizes. tailwind-merge does not know that and would treat them as
// text colors, dropping `text-on-primary` whenever both are present.
const TYPE_SCALE = [
  "display-hero",
  "display-hero-mobile",
  "headline-lg",
  "headline-lg-mobile",
  "headline-md",
  "headline-sm",
  "body-lg",
  "body-md",
  "body-sm",
  "label-lg",
  "label-md",
  "label-sm",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TYPE_SCALE }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
