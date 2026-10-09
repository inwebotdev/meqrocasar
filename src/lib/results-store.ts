import { ExperienceResultSchema } from "@/domain/experience/schema";
import type { ExperienceResult } from "@/domain/experience/types";

export const RESULT_STORAGE_KEY = "qro-romance:result:v1";

function getSessionStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Persists the generated experience so `/resultados` can read it back. */
export function saveResult(result: ExperienceResult): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(RESULT_STORAGE_KEY, JSON.stringify(result));
  } catch {
    // Private mode / quota exceeded: silently ignore, the result just
    // won't survive navigation.
  }
}

/** Reads and validates the stored experience. `undefined` if missing or invalid. */
export function loadResult(): ExperienceResult | undefined {
  const storage = getSessionStorage();

  if (!storage) {
    return undefined;
  }

  let raw: string | null;

  try {
    raw = storage.getItem(RESULT_STORAGE_KEY);
  } catch {
    return undefined;
  }

  if (!raw) {
    return undefined;
  }

  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }

  const parsed = ExperienceResultSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

export function clearResult(): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(RESULT_STORAGE_KEY);
  } catch {
    // Private mode: nothing to clean up.
  }
}
