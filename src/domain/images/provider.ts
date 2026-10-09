import type { ExperiencePhoto } from "@/domain/experience/types";
import type { QuizAnswers } from "@/domain/quiz/schema";

/**
 * Resolves the 3 photos shown with a generated wedding experience. An
 * implementation must always resolve exactly 3 photos and never throw;
 * when it can't honor a query (missing key, HTTP error, timeout, empty
 * results), it falls back to another source for that slot instead.
 */
export interface ImageProvider {
  resolve(queries: string[], answers: QuizAnswers): Promise<ExperiencePhoto[]>;
}
