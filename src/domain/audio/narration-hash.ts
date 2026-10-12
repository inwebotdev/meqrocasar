import { createHash } from "node:crypto";

/**
 * The cache key for one narration: a given `(voiceId, modelId, text)`
 * triple always produces the same audio from a deterministic TTS
 * provider, so the hash doubles as the content-addressed `<hash>.mp3` /
 * `<hash>.json` filename (`store.ts`) and the public `/api/narration/<hash>`
 * path. Split into its own `node:crypto`-importing module so
 * `narration.ts` stays pure (importable from client code without pulling
 * in Node builtins).
 */
export interface NarrationHashInput {
  voiceId: string;
  modelId: string;
  text: string;
}

export function narrationHash({ voiceId, modelId, text }: NarrationHashInput): string {
  return createHash("sha256").update(`${voiceId}\u0000${modelId}\u0000${text}`).digest("hex");
}
