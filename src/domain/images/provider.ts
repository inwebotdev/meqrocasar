import type { ExperiencePhoto } from "@/domain/experience/types";
import type { Facets } from "@/domain/kb/taxonomy";
import type { QuizAnswers } from "@/domain/quiz/schema";

/**
 * Resolves the photos shown with a generated wedding experience or quiz
 * step. An implementation must never throw; when it can't honor a query
 * (missing key, HTTP error, timeout, empty results), it falls back to
 * another source instead.
 */
export interface ImageProvider {
  /** Always resolves exactly `queries.length` photos (the final-generation path, keyed by the legacy `QuizAnswers`). */
  resolve(queries: string[], answers: QuizAnswers): Promise<ExperiencePhoto[]>;
  /** Resolves a single photo for one quiz-engine option, keyed by the known `Facets` instead of the legacy answers. */
  resolveOne(query: string, facets: Facets): Promise<ExperiencePhoto>;
}
