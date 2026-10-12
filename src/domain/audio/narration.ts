/**
 * Narration domain types and pure helpers shared by the ElevenLabs
 * provider (`elevenlabs.ts`), the disk cache (`store.ts`) and the
 * synthesis service (`service.ts`). Pure TypeScript: no React, no
 * Next.js, no `server-only`, no `node:*` imports (that's `narration-hash.ts`).
 */

/**
 * Per-character timing for a synthesized narration, as ElevenLabs'
 * `with-timestamps` endpoint returns it (mapped from snake_case — see
 * `elevenlabs.ts`): `chars[i]` was spoken between `startSec[i]` and
 * `endSec[i]`.
 */
export interface NarrationAlignment {
  chars: string[];
  startSec: number[];
  endSec: number[];
}

/** What a `NarrationProvider` resolves: raw audio bytes plus, when available, per-character timing. */
export interface NarrationAudio {
  audio: Uint8Array;
  contentType: "audio/mpeg";
  alignment?: NarrationAlignment;
}

/** Synthesizes a narration script into audio. An implementation never retries internally — that's the caller's job (see `service.ts`). */
export interface NarrationProvider {
  synthesize(text: string): Promise<NarrationAudio>;
}

/** One sentence's caption window, ready for synced captions. */
export interface NarrationSentence {
  text: string;
  startSec: number;
  endSec: number;
}

/** The last character's end time — the narration's total spoken duration. */
export function estimateDurationSec(alignment: NarrationAlignment): number {
  return alignment.endSec.at(-1) ?? 0;
}

interface SentenceSpan {
  text: string;
  /** Index of the span's first non-whitespace character in the original `text`. */
  startIndex: number;
  /** Index of the span's last character (its terminal punctuation, when it has one) in the original `text`. */
  endIndex: number;
}

/** Sentence-ending punctuation, only when followed by whitespace or the end of the string (so "3.5" or an ellipsis mid-sentence never splits). */
const SENTENCE_END = /[.!?…](?=\s|$)/g;

function firstNonWhitespaceIndex(text: string, from: number, upTo: number): number {
  let index = from;
  while (index <= upTo && /\s/.test(text[index] ?? "")) {
    index += 1;
  }
  return Math.min(index, upTo);
}

/** Splits `text` into sentence spans (text + the original string's character index range), tolerant of a trailing fragment with no terminal punctuation. */
function splitSentences(text: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  let cursor = 0;

  for (const match of text.matchAll(SENTENCE_END)) {
    const endIndex = match.index;
    const raw = text.slice(cursor, endIndex + 1);
    const trimmed = raw.trim();

    if (trimmed.length > 0) {
      spans.push({
        text: trimmed,
        startIndex: firstNonWhitespaceIndex(text, cursor, endIndex),
        endIndex,
      });
    }

    cursor = endIndex + 1;
  }

  const rest = text.slice(cursor).trim();
  if (rest.length > 0) {
    const lastIndex = Math.max(text.length - 1, 0);
    spans.push({
      text: rest,
      startIndex: firstNonWhitespaceIndex(text, cursor, lastIndex),
      endIndex: lastIndex,
    });
  }

  return spans;
}

/**
 * Splits `text` into per-sentence caption windows. With `alignment`, maps
 * each sentence's first/last character index onto `alignment`'s per-
 * character times; without one, divides `durationSec` evenly across the
 * sentences instead (`durationSec` is ignored when `alignment` is given —
 * its own last character's end time is used instead, see
 * `estimateDurationSec`).
 */
export function sentenceTimings(
  text: string,
  alignment: NarrationAlignment | undefined,
  durationSec: number,
): NarrationSentence[] {
  const spans = splitSentences(text);
  if (spans.length === 0) {
    return [];
  }

  if (!alignment || alignment.chars.length === 0) {
    const slice = durationSec / spans.length;
    return spans.map((span, index) => ({
      text: span.text,
      startSec: index * slice,
      endSec: (index + 1) * slice,
    }));
  }

  const lastIndex = alignment.chars.length - 1;
  const totalDuration = estimateDurationSec(alignment);

  return spans.map((span) => {
    const startIndex = Math.min(span.startIndex, lastIndex);
    const endIndex = Math.min(span.endIndex, lastIndex);
    return {
      text: span.text,
      startSec: alignment.startSec[startIndex] ?? 0,
      endSec: alignment.endSec[endIndex] ?? totalDuration,
    };
  });
}
