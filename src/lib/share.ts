import type { ExperienceResult } from "@/domain/experience/types";
import {
  buildMoodboardPath,
  moodboardParamsFromExperience,
  slugify,
} from "@/domain/moodboard/params";

export type ShareOutcome = "shared" | "copied" | "cancelled";

/** `undefined` when the experience has no valid photo to build a moodboard from. */
function absoluteMoodboardUrl(result: ExperienceResult): string | undefined {
  const params = moodboardParamsFromExperience(result);
  if (!params) return undefined;

  const path = buildMoodboardPath(params);
  return new URL(path, window.location.origin).toString();
}

async function fetchMoodboardFile(
  moodboardUrl: string,
  conceptTitle: string,
): Promise<File | undefined> {
  try {
    const response = await fetch(moodboardUrl);
    if (!response.ok) {
      return undefined;
    }
    const blob = await response.blob();
    return new File([blob], `${slugify(conceptTitle)}-moodboard.png`, {
      type: blob.type || "image/png",
    });
  } catch {
    return undefined;
  }
}

/**
 * Shares the experience via the Web Share API (with the moodboard PNG as a
 * file when the browser supports sharing files), falling back to copying
 * the absolute moodboard URL to the clipboard. Never throws: a user
 * cancelling the native share sheet resolves as `"cancelled"`, and any
 * other failure falls through to the clipboard.
 */
export async function shareExperience(result: ExperienceResult): Promise<ShareOutcome> {
  const moodboardUrl = absoluteMoodboardUrl(result);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const file = moodboardUrl
        ? await fetchMoodboardFile(moodboardUrl, result.conceptTitle)
        : undefined;
      const canShareFiles =
        file !== undefined &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      const shareData: ShareData = canShareFiles
        ? { title: result.conceptTitle, text: result.reelTagline, files: [file as File] }
        : { title: result.conceptTitle, text: result.reelTagline, url: window.location.href };

      await navigator.share(shareData);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
      // Fall through to the clipboard fallback below.
    }
  }

  // No valid moodboard (every photo was unavailable): fall back to the
  // page's own URL rather than a link that would 400.
  await navigator.clipboard.writeText(moodboardUrl ?? window.location.href);
  return "copied";
}
