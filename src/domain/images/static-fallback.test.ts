import { HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { QuizAnswers } from "@/domain/quiz/schema";

import { mockUnsplashSearch } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { createStaticImageProvider } from "./static-fallback";

const answers: QuizAnswers = {
  style: "colonial",
  setting: "night_casona",
  experience: "grand_traditional",
  mustHave: "callejoneada",
};

describe("createStaticImageProvider", () => {
  it("always resolves exactly 3 photos, ignoring the queries", async () => {
    const provider = createStaticImageProvider();
    const photos = await provider.resolve(["anything", "goes", "here"], answers);
    expect(photos).toHaveLength(3);
  });

  it("never calls the network (no key configured)", async () => {
    let calls = 0;
    server.use(
      mockUnsplashSearch(() => {
        calls += 1;
        return HttpResponse.json({ results: [] });
      }),
    );

    const provider = createStaticImageProvider();
    await provider.resolve(["colonial courtyard"], answers);

    expect(calls).toBe(0);
  });
});
