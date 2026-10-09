import { describe, expect, it } from "vitest";

import { getOption } from "@/domain/quiz/questions";
import type { QuizAnswers } from "@/domain/quiz/schema";
import { VENUES } from "@/domain/venues/catalog";

import { buildMessages, SYSTEM_PROMPT_VERSION } from "./prompt";

const answers: QuizAnswers = {
  style: "rustic_vineyard",
  setting: "day_vineyard",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
};

describe("buildMessages", () => {
  const messages = buildMessages(answers);

  it("returns a system message followed by a user message", () => {
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("user");
  });

  it("mentions the word JSON in the system prompt", () => {
    expect(messages[0]?.content).toMatch(/JSON/);
  });

  it("includes every catalog venue name in the system prompt", () => {
    const systemContent = messages[0]?.content ?? "";
    for (const venue of VENUES) {
      expect(systemContent).toContain(venue.name);
    }
  });

  it("does not require any venue outside the catalog (every venue line maps to a catalog zone)", () => {
    const systemContent = messages[0]?.content ?? "";
    const catalogLines = VENUES.map(
      (venue) => `- ${venue.name} (${venue.zone}) — tags: ${venue.tags.join(", ")}`,
    );
    for (const line of catalogLines) {
      expect(systemContent).toContain(line);
    }
  });

  it("includes the chosen option's labels/titles for every answer", () => {
    const userContent = messages[1]?.content ?? "";
    for (const stepId of ["style", "setting", "experience", "mustHave"] as const) {
      const option = getOption(stepId, answers[stepId]);
      expect(userContent).toContain(option.title);
    }
  });

  it("asks for a JSON object in the user message", () => {
    expect(messages[1]?.content).toMatch(/JSON/);
  });

  it("exports a stable prompt version string", () => {
    expect(SYSTEM_PROMPT_VERSION).toBe("2026-10-09.1");
  });
});
