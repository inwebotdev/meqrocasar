import { TranscriptSchema, type Transcript } from "@/domain/quiz/transcript";

export const TRANSCRIPT_STORAGE_KEY = "qro-romance:transcript:v1";

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

/** Persists the adaptive quiz transcript so a refresh or "Paso anterior" survives. */
export function saveTranscript(transcript: Transcript): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(transcript));
  } catch {
    // Private mode / quota exceeded: silently ignore, the transcript just
    // won't survive navigation.
  }
}

/** Reads and validates the stored transcript. `undefined` if missing or invalid. */
export function loadTranscript(): Transcript | undefined {
  const storage = getSessionStorage();

  if (!storage) {
    return undefined;
  }

  let raw: string | null;

  try {
    raw = storage.getItem(TRANSCRIPT_STORAGE_KEY);
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

  const parsed = TranscriptSchema.safeParse(json);

  return parsed.success ? parsed.data : undefined;
}

export function clearTranscript(): void {
  const storage = getSessionStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(TRANSCRIPT_STORAGE_KEY);
  } catch {
    // Private mode: nothing to clean up.
  }
}
