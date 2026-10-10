import { createHash } from "node:crypto";

import type { Transcript } from "./transcript";

/**
 * `hashTranscript` needs `node:crypto`, so it lives apart from
 * `transcript.ts` (which must stay importable from client components): any
 * module that imports this one is implicitly server-only.
 */

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([key, entryValue]) => [key, canonicalize(entryValue)]));
  }

  return value;
}

/**
 * A stable sha256 of the transcript's content: key order never affects the
 * hash, but any change to the entries (a new step, a different choice, a
 * different fact) does. Used to cache/key generated quiz steps by the
 * transcript that produced them.
 */
export function hashTranscript(transcript: Transcript): string {
  const canonical = JSON.stringify(canonicalize(transcript));
  return createHash("sha256").update(canonical).digest("hex");
}
