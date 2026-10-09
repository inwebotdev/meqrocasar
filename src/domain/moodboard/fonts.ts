import { readFile } from "fs/promises";
import path from "path";

import "server-only";

/** Minimal shape of a Satori/`next/og` font entry, without reaching into Next's internal types. */
export interface SatoriFont {
  name: string;
  data: Buffer;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style?: "normal" | "italic";
}

interface FontFile {
  file: string;
  name: string;
  weight: SatoriFont["weight"];
}

const FONT_FILES: readonly FontFile[] = [
  { file: "PlayfairDisplay-SemiBold.ttf", name: "Playfair Display", weight: 600 },
  { file: "PlayfairDisplay-Bold.ttf", name: "Playfair Display", weight: 700 },
  { file: "PlusJakartaSans-Regular.ttf", name: "Plus Jakarta Sans", weight: 400 },
  { file: "PlusJakartaSans-Bold.ttf", name: "Plus Jakarta Sans", weight: 700 },
];

let fontsPromise: Promise<SatoriFont[]> | null = null;

async function readFonts(): Promise<SatoriFont[]> {
  return Promise.all(
    FONT_FILES.map(async ({ file, name, weight }) => {
      const data = await readFile(path.join(process.cwd(), "public", "fonts", file));
      return { name, data, weight, style: "normal" as const };
    }),
  );
}

/** Loads the 4 static TrueType fonts the moodboard template needs, memoised across calls. */
export function loadMoodboardFonts(): Promise<SatoriFont[]> {
  if (!fontsPromise) {
    fontsPromise = readFonts();
  }
  return fontsPromise;
}
