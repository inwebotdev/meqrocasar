import sampleFixture from "../../test/fixtures/narration/sample.json";

import type { NarrationRef } from "@/domain/audio/service";

/**
 * Dev-only escape hatch for browser-checking the narrated reel without an
 * `ELEVENLABS_API_KEY`: when `NEXT_PUBLIC_NARRATION_FIXTURE=1`,
 * `useNarration` (`src/components/results/useNarration.ts`) always
 * overrides `result.narration` with `buildFixtureNarration()` below
 * instead of polling the real `/api/narration/<hash>/meta` route, so the
 * results page always renders the "ready" narrated-reel chrome (captions,
 * the "Narración · Querétaro Romance" pill) from
 * `test/fixtures/narration/sample.json`. Never set in production — see
 * README's "Narración del reel" section.
 */
export function isNarrationFixtureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_NARRATION_FIXTURE === "1";
}

interface NarrationFixtureSentence {
  text: string;
  startSec: number;
  endSec: number;
}

interface NarrationFixtureData {
  durationSec: number;
  sentences: NarrationFixtureSentence[];
}

const FIXTURE: NarrationFixtureData = sampleFixture;

/** 8-bit unsigned PCM silence. */
const SILENCE_BYTE = 0x80;
const SAMPLE_RATE = 8000;
const WAV_HEADER_BYTES = 44;

/**
 * A short silent WAV, as a `data:` URI sized to `durationSec` — built on
 * the fly (nothing binary committed to the repo, consistent with
 * `public/audio/README.md`'s "no binary audio assets in git" rule) so the
 * fixture narration has something `<Audio>`/`@remotion/player` can
 * actually load instead of 404ing against a path that was never
 * synthesized.
 */
function buildSilentWavDataUri(durationSec: number): string {
  const dataSize = Math.max(1, Math.ceil(durationSec * SAMPLE_RATE));
  const bytes = new Uint8Array(WAV_HEADER_BYTES + dataSize);
  const view = new DataView(bytes.buffer);

  function writeAscii(offset: number, text: string): void {
    for (let i = 0; i < text.length; i += 1) {
      bytes[offset + i] = text.charCodeAt(i);
    }
  }

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // subchunk1Size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true); // byteRate (1 byte/sample * 1 channel)
  view.setUint16(32, 1, true); // blockAlign
  view.setUint16(34, 8, true); // bitsPerSample
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);
  bytes.fill(SILENCE_BYTE, WAV_HEADER_BYTES);

  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 = typeof window !== "undefined" ? window.btoa(binary) : "";
  return `data:audio/wav;base64,${base64}`;
}

/** The fixture `NarrationRef` — always `"ready"`, built from `test/fixtures/narration/sample.json`. */
export function buildFixtureNarration(): NarrationRef {
  return {
    status: "ready",
    hash: "f".repeat(64),
    src: buildSilentWavDataUri(FIXTURE.durationSec),
    durationSec: FIXTURE.durationSec,
    sentences: FIXTURE.sentences,
  };
}
