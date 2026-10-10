import { describe, expect, it } from "vitest";

import { transcriptFromLegacyAnswers } from "./transcript";
import { hashTranscript } from "./transcript-hash";
import type { QuizAnswers } from "./schema";

const answers: QuizAnswers = {
  style: "colonial",
  setting: "night_casona",
  experience: "grand_traditional",
  mustHave: "fireworks",
};

describe("hashTranscript", () => {
  it("is stable across calls for the same transcript content", () => {
    const transcript = transcriptFromLegacyAnswers(answers);
    expect(hashTranscript(transcript)).toBe(hashTranscript(transcript));
  });

  it("is stable across structurally-equal transcripts built independently", () => {
    const first = transcriptFromLegacyAnswers(answers);
    const second = transcriptFromLegacyAnswers({ ...answers });
    expect(hashTranscript(first)).toBe(hashTranscript(second));
  });

  it("changes when the transcript content changes", () => {
    const first = transcriptFromLegacyAnswers(answers);
    const second = transcriptFromLegacyAnswers({ ...answers, mustHave: "callejoneada" });
    expect(hashTranscript(first)).not.toBe(hashTranscript(second));
  });

  it("looks like a sha256 hex digest", () => {
    const transcript = transcriptFromLegacyAnswers(answers);
    expect(hashTranscript(transcript)).toMatch(/^[0-9a-f]{64}$/);
  });
});
