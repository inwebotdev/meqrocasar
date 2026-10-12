import { loadKb } from "@/domain/kb/load";
import type { FacetKey, Facets } from "@/domain/kb/taxonomy";

import {
  GeneratedStepSchema,
  RawGeneratedStepSchema,
  type GeneratedOption,
  type GeneratedStep,
} from "./generated-step";

/**
 * Cleans up a raw (`RawGeneratedStepSchema`-shaped) step straight off the
 * LLM into something that satisfies the real, tight `GeneratedStepSchema`
 * — applied *before* that schema ever sees the data, so none of these
 * fixes cost a correction turn: trimming/collapsing whitespace, stripping
 * a hashtag-style leading "#" off titles, dropping and regenerating
 * degenerate hashtags, and smart-truncating over-long text at a word
 * boundary (never mid-word).
 *
 * The model no longer generates `badge`/`matchLabel` (option-level) or
 * `selectLabel` (step-level) at all — see `RawGeneratedStepSchema`'s doc
 * comment — so this module also *derives* all three deterministically
 * (not a "fix": always applied, never recorded in `fixes`) and fills them
 * onto the `GeneratedOption`/`GeneratedStep` the UI consumes: `badge`
 * from the option's dominant facet, `matchLabel` from a seeded hash of
 * the option id (stable across renders/prefetch), `selectLabel` from the
 * step's topic.
 *
 * The one thing this can't fix is non-Spanish text: `ok: false, reason:
 * "language"` tells the caller (`engine.ts`) to run one correction retry
 * with an explicit language instruction instead, since there's no honest
 * way to "normalise" Chinese/Cyrillic/Arabic text into Spanish.
 *
 * Pure TypeScript + Zod: no React, no Next.js, no `server-only`.
 */

export type NormaliseStepFailureReason = "shape" | "language" | "schema";

export interface NormaliseStepSuccess {
  ok: true;
  step: GeneratedStep;
  /** One entry per fix applied (e.g. `"truncated-description"`); `[]` when the raw step needed no cleanup at all. */
  fixes: string[];
}

export interface NormaliseStepFailure {
  ok: false;
  reason: NormaliseStepFailureReason;
}

export type NormaliseStepResult = NormaliseStepSuccess | NormaliseStepFailure;

// Hiragana/Katakana, CJK ideographs, Hangul, Cyrillic, Arabic: scripts that
// can never legitimately appear in Spanish (or in `photoQuery`'s English —
// both are Latin-script).
const NON_LATIN_PATTERN = /[぀-ヿ㐀-鿿가-힯Ѐ-ӿ؀-ۿ]/u;

/** The real (`GeneratedStepSchema`) maxima, mirrored here so normalisation truncates to exactly what will validate. */
const STEP_FIELD_MAX = {
  id: 40,
  topic: 24,
  question: 80,
  helper: 140,
  selectLabel: 32,
  doneReason: 120,
} as const;

const OPTION_FIELD_MAX = {
  title: 40,
  description: 160,
  photoQuery: 60,
  badge: 24,
  hashtag: 40,
} as const;

/** Used only when an option's facets object is somehow empty (defensive — the raw schema requires at least the facet(s) the option establishes). */
const DEFAULT_BADGE = "Sugerencia SECTUR";
const MIN_HASHTAG_WORD_LENGTH = 4;
/** `matchLabel`'s seeded range — see `matchLabelForId`. */
const MATCH_LABEL_MIN = 86;
const MATCH_LABEL_MAX = 97;
const MATCH_LABEL_RANGE = MATCH_LABEL_MAX - MATCH_LABEL_MIN + 1;

/** Deterministic (stable across calls/prefetch) string hash — FNV-1a-ish, no crypto needed. */
function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Seeds a `matchLabel` from the option id, so the same option always shows the same affinity (86-99%). */
function matchLabelForId(id: string): string {
  const percent = MATCH_LABEL_MIN + (hashString(id) % MATCH_LABEL_RANGE);
  return `${percent}% AFINIDAD`;
}

/** The facet keys a badge can be derived from, in priority order when an option sets more than one. */
const BADGE_FACET_PRIORITY: readonly FacetKey[] = [
  "setting",
  "experience",
  "zone",
  "scale",
  "budget",
  "season",
];

function badgeForZone(zoneId: string): string {
  const zone = loadKb().zones.find((candidate) => candidate.id === zoneId);
  return zone?.puebloMagico ? "Pueblo Mágico" : "Destino";
}

/** Derives an option's badge from the dominant facet it sets — see `BADGE_FACET_PRIORITY`. */
function badgeForFacets(facets: Facets): string {
  for (const key of BADGE_FACET_PRIORITY) {
    const value = facets[key];
    if (value === undefined) continue;

    switch (key) {
      case "setting":
        return "Momento ideal";
      case "experience":
        return "Experiencia SECTUR";
      case "zone":
        return badgeForZone(value);
      case "scale":
        return "Escala";
      case "budget":
        return "Presupuesto";
      case "season":
        return "Temporada";
    }
  }

  return DEFAULT_BADGE;
}

function cleanText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function hasNonLatinScript(value: string): boolean {
  return NON_LATIN_PATTERN.test(value);
}

/** Truncates `value` to at most `max` chars, backing off to the last word boundary before appending "…" — never mid-word. */
function smartTruncate(value: string, max: number): { value: string; truncated: boolean } {
  if (value.length <= max) {
    return { value, truncated: false };
  }

  const ellipsis = "…";
  const budget = Math.max(max - ellipsis.length, 1);
  let cut = value.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 0) {
    cut = cut.slice(0, lastSpace);
  }

  return { value: `${cut.trimEnd()}${ellipsis}`, truncated: true };
}

function truncateField(value: string, max: number, fixes: string[], label: string): string {
  const { value: truncated, truncated: didTruncate } = smartTruncate(value, max);
  if (didTruncate) {
    fixes.push(`truncated-${label}`);
  }
  return truncated;
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function capitalize(word: string): string {
  return word.length === 0 ? word : `${word[0]!.toUpperCase()}${word.slice(1).toLowerCase()}`;
}

function wordsFromText(text: string): string[] {
  return stripDiacritics(text)
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

/** Builds candidate CamelCase hashtags (e.g. "#CataEnCava") from a title/topic, for options missing real ones. */
function buildHashtagCandidates(title: string, topic: string): string[] {
  const titleWords = wordsFromText(title);
  const topicWords = wordsFromText(topic);
  const candidates: string[] = [];

  for (let i = 0; i + 1 < titleWords.length; i += 1) {
    candidates.push(`#${capitalize(titleWords[i]!)}${capitalize(titleWords[i + 1]!)}`);
  }
  if (titleWords[0] && topicWords[0]) {
    candidates.push(`#${capitalize(titleWords[0])}${capitalize(topicWords[0])}`);
  }
  if (titleWords[0]) {
    candidates.push(`#${capitalize(titleWords[0])}Queretano`);
  }
  candidates.push("#BodaQueretana", "#RomanceQueretano", "#SuenoDeBoda");

  return candidates;
}

function isUsableHashtag(raw: string): boolean {
  const withoutHash = raw.trim().replace(/^#+/, "");
  return withoutHash.length >= MIN_HASHTAG_WORD_LENGTH;
}

function toHashtag(raw: string): string {
  const withoutHash = cleanText(raw).replace(/^#+/, "").replace(/\s+/g, "");
  const tag = `#${withoutHash}`;
  return tag.length > OPTION_FIELD_MAX.hashtag ? tag.slice(0, OPTION_FIELD_MAX.hashtag) : tag;
}

/** Drops empty/"#"-only hashtags and regenerates missing ones from the title/topic so exactly 3 survive. */
function normaliseHashtags(
  rawHashtags: readonly string[],
  title: string,
  topic: string,
  fixes: string[],
): string[] {
  const kept = rawHashtags.filter(isUsableHashtag).map(toHashtag);

  if (kept.length < rawHashtags.length) {
    fixes.push("dropped-degenerate-hashtag");
  }

  const seen = new Set(kept.map((tag) => tag.toLowerCase()));
  const result = [...kept];

  if (result.length < 3) {
    for (const candidate of buildHashtagCandidates(title, topic)) {
      if (result.length >= 3) break;
      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(candidate);
      fixes.push("regenerated-hashtag");
    }
  }

  return result.slice(0, 3);
}

function stripped(value: string, fixes: string[]): string {
  const cleaned = cleanText(value);
  if (cleaned !== value) {
    fixes.push("collapsed-whitespace");
  }
  return cleaned;
}

function normaliseOption(
  raw: ReturnType<typeof RawGeneratedStepSchema.parse>["options"][number],
  topic: string,
  fixes: string[],
): GeneratedOption {
  let title = stripped(raw.title, fixes);
  if (title.startsWith("#")) {
    title = title.replace(/^#+/, "").trim();
    fixes.push("stripped-hashtag-title");
  }
  title = truncateField(title, OPTION_FIELD_MAX.title, fixes, "title");

  const description = truncateField(
    stripped(raw.description, fixes),
    OPTION_FIELD_MAX.description,
    fixes,
    "description",
  );
  const photoQuery = truncateField(
    stripped(raw.photoQuery, fixes),
    OPTION_FIELD_MAX.photoQuery,
    fixes,
    "photo-query",
  );

  // Derived, not fixed: the model never sends these (see the module doc
  // comment), so there's nothing to "repair" here — just compute them.
  const badge = truncateField(badgeForFacets(raw.facets), OPTION_FIELD_MAX.badge, [], "badge");
  const matchLabel = matchLabelForId(raw.id);

  const hashtags = normaliseHashtags(
    raw.hashtags.map((tag) => stripped(tag, fixes)),
    title,
    topic,
    fixes,
  );

  return {
    id: raw.id,
    title,
    description,
    hashtags,
    facets: raw.facets,
    refs: raw.refs,
    photoQuery,
    badge,
    matchLabel,
  };
}

function collectRawStrings(raw: ReturnType<typeof RawGeneratedStepSchema.parse>): string[] {
  return [
    raw.id,
    raw.topic,
    raw.question,
    raw.helper,
    raw.doneReason ?? "",
    ...raw.options.flatMap((option) => [
      option.title,
      option.description,
      option.photoQuery,
      ...option.hashtags,
    ]),
  ];
}

/**
 * The step's `selectLabel` — the model no longer sends one (see the module
 * doc comment). A fixed, grammatically invariant phrase rather than one
 * composed from the step's topic: "Elegir esta {topic}" broke gender
 * agreement for masculine topics (e.g. "Elegir esta entorno" instead of
 * "Elegir este entorno"), so this sidesteps the problem entirely instead
 * of trying to classify every topic's gender.
 */
const SELECT_LABEL = "Elegir esta opción";

/**
 * Normalises a raw LLM step (any `unknown` — typically `RawGeneratedStep`-
 * shaped JSON parsed straight from the model's response) into a step that
 * satisfies `GeneratedStepSchema`. See the module doc comment for the
 * fixes applied and why a language violation can't be fixed here.
 */
export function normaliseGeneratedStep(raw: unknown): NormaliseStepResult {
  const shape = RawGeneratedStepSchema.safeParse(raw);
  if (!shape.success) {
    return { ok: false, reason: "shape" };
  }

  const step = shape.data;

  if (collectRawStrings(step).some(hasNonLatinScript)) {
    return { ok: false, reason: "language" };
  }

  const fixes: string[] = [];

  const id = truncateField(stripped(step.id, fixes), STEP_FIELD_MAX.id, fixes, "id");
  const topic = truncateField(stripped(step.topic, fixes), STEP_FIELD_MAX.topic, fixes, "topic");
  const question = truncateField(
    stripped(step.question, fixes),
    STEP_FIELD_MAX.question,
    fixes,
    "question",
  );
  const helper = truncateField(
    stripped(step.helper, fixes),
    STEP_FIELD_MAX.helper,
    fixes,
    "helper",
  );

  const selectLabel = SELECT_LABEL;

  const doneReasonRaw =
    step.doneReason !== undefined ? stripped(step.doneReason, fixes) : undefined;
  const doneReason =
    doneReasonRaw !== undefined && doneReasonRaw.length > 0
      ? truncateField(doneReasonRaw, STEP_FIELD_MAX.doneReason, fixes, "done-reason")
      : undefined;

  const options = step.options.map((option) => normaliseOption(option, topic, fixes));

  const assembled = {
    id,
    topic,
    question,
    helper,
    selectLabel,
    options,
    done: step.done,
    ...(doneReason !== undefined ? { doneReason } : {}),
  };

  const validated = GeneratedStepSchema.safeParse(assembled);
  if (!validated.success) {
    return { ok: false, reason: "schema" };
  }

  return { ok: true, step: validated.data, fixes };
}
