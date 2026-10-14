/**
 * One-off manual verification script for the v3/quiz-coherence layer
 * (NOT part of the test suite — nothing under `src/` imports this).
 *
 * Plays two full adaptive-quiz conversations against a REAL running dev
 * server (`POST /api/quiz/next`, real OpenRouter calls), choosing a
 * vineyard option in Ezequiel Montes in one and a Centro Histórico option
 * in the other, with a ~4s "think time" between turns. For every step it
 * prints the question, the computed targetFacet (via the real
 * `knownFacets`/`chosenRefs`/`computeTargetFacet` — the same functions the
 * engine itself uses), and every option's title + refs, then checks the
 * coherence invariants (no zone question after a venue is chosen, no
 * option contradicting a known facet, the experience step cites
 * experiences not venues). Saves the final transcript to
 * `test/fixtures/demo/coherence-<name>.json`.
 *
 * Run inside the container: `yarn tsx scripts/quiz/replay-coherence.ts`
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { computeTargetFacet } from "../../src/domain/quiz/engine";
import type { ResolvedOption, ResolvedStep } from "../../src/domain/quiz/generated-step";
import { loadKb } from "../../src/domain/kb/load";
import type { FacetKey, ZoneValue } from "../../src/domain/kb/taxonomy";
import {
  chosenRefs,
  knownFacets,
  type Transcript,
  type TranscriptEntry,
} from "../../src/domain/quiz/transcript";

const BASE_URL = process.env.QUIZ_BASE_URL ?? "http://localhost:3000";
const THINK_TIME_MS = 4000;
const kb = loadKb();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ApiEnvelope {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

type QuizNextResult =
  | { done: true; meta: { source: string; fallbackUsed: boolean } }
  | { done: false; step: ResolvedStep; meta: { source: string; fallbackUsed: boolean } };

async function fetchNextStep(transcript: Transcript): Promise<QuizNextResult> {
  const response = await fetch(`${BASE_URL}/api/quiz/next`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript }),
  });

  const envelope = (await response.json()) as ApiEnvelope;
  if (!envelope.ok) {
    throw new Error(`quiz/next failed: ${JSON.stringify(envelope.error)}`);
  }

  return envelope.data as QuizNextResult;
}

function entryFromOption(step: ResolvedStep, option: ResolvedOption): TranscriptEntry {
  return {
    stepId: step.id,
    question: step.question,
    topic: step.topic,
    chosen: {
      id: option.id,
      title: option.title,
      summary: option.description,
      facets: option.facets,
      refs: option.refs,
    },
  };
}

/** Picks the option whose cited venue is in `preferredZone`, else whichever option cites any venue, else the first option. */
function pickOption(step: ResolvedStep, preferredZone: ZoneValue): ResolvedOption {
  const inZone = step.options.find((option) => option.venue?.zone === preferredZone);
  if (inZone) return inZone;

  const anyVenue = step.options.find((option) => option.refs.venueIds.length > 0);
  if (anyVenue) return anyVenue;

  return step.options[0]!;
}

interface StepReport {
  index: number;
  question: string;
  topic: string;
  targetFacet: string | "done";
  source: string;
  options: Array<{ id: string; title: string; facets: Record<string, string>; refs: unknown }>;
  chosenOptionId: string;
}

async function playConversation(name: string, preferredZone: ZoneValue): Promise<void> {
  console.log(`\n=== Conversation: ${name} (preferring zone: ${preferredZone}) ===`);

  const entries: TranscriptEntry[] = [];
  const reports: StepReport[] = [];
  let violations: string[] = [];
  let sawVenue = false;

  for (let turn = 0; turn < 8; turn += 1) {
    const transcript: Transcript = { entries };
    const known = knownFacets(entries, kb);
    const { venueIds } = chosenRefs(entries);
    const targetFacet = computeTargetFacet(known, venueIds);

    const result = await fetchNextStep(transcript);

    if (result.done) {
      console.log(`Step ${turn + 1}: DONE (no more unknown facets / maxSteps reached)`);
      break;
    }

    const { step } = result;
    console.log(
      `\nStep ${turn + 1} [${result.meta.source}${result.meta.fallbackUsed ? ", fallback" : ""}] targetFacet=${targetFacet ?? "done"}`,
    );
    console.log(`  Q: ${step.question}`);
    for (const option of step.options) {
      console.log(
        `   - ${option.id}: "${option.title}" facets=${JSON.stringify(option.facets)} refs=${JSON.stringify(option.refs)}`,
      );
    }

    // --- coherence checks --------------------------------------------------
    if (venueIds.length > 0) sawVenue = true;
    if (sawVenue && targetFacet === "zone") {
      violations.push(`step ${turn + 1}: asked zone again after a venue was already chosen`);
    }
    for (const option of step.options) {
      const contradicts = (Object.keys(option.facets) as FacetKey[]).some((key) => {
        const value = option.facets[key];
        const knownValue = known[key];
        return value !== undefined && knownValue !== undefined && value !== knownValue;
      });
      if (contradicts) {
        violations.push(
          `step ${turn + 1}: option "${option.id}" contradicts a known facet (facets=${JSON.stringify(option.facets)}, known=${JSON.stringify(known)})`,
        );
      }
      if (targetFacet === "experience" && option.refs.experienceIds.length === 0) {
        violations.push(
          `step ${turn + 1}: experience-target option "${option.id}" has no experience ref (only venues)`,
        );
      }
    }

    const chosen = pickOption(step, preferredZone);
    console.log(`  → chose: ${chosen.id} ("${chosen.title}")`);

    reports.push({
      index: turn + 1,
      question: step.question,
      topic: step.topic,
      targetFacet: targetFacet ?? "done",
      source: result.meta.source,
      options: step.options.map((option) => ({
        id: option.id,
        title: option.title,
        facets: option.facets as Record<string, string>,
        refs: option.refs,
      })),
      chosenOptionId: chosen.id,
    });

    entries.push(entryFromOption(step, chosen));

    await sleep(THINK_TIME_MS);
  }

  console.log(`\n--- ${name}: coherence check ---`);
  if (violations.length === 0) {
    console.log("CLEAN: no coherence violations detected.");
  } else {
    console.log(`VIOLATIONS (${violations.length}):`);
    for (const v of violations) console.log(`  - ${v}`);
  }

  const outPath = path.resolve(__dirname, `../../test/fixtures/demo/coherence-${name}.json`);
  writeFileSync(outPath, JSON.stringify({ entries }, null, 2) + "\n");
  console.log(`Saved transcript to ${outPath}`);

  const reportPath = path.resolve(
    __dirname,
    `../../test/fixtures/demo/coherence-${name}.report.json`,
  );
  writeFileSync(reportPath, JSON.stringify({ reports, violations }, null, 2) + "\n");
  console.log(`Saved report to ${reportPath}`);
}

/** `yarn tsx scripts/quiz/replay-coherence.ts [ezequiel-montes-vinedo|centro-historico]` — omit to run both. */
async function main(): Promise<void> {
  const only = process.argv[2];

  if (!only || only === "ezequiel-montes-vinedo") {
    await playConversation("ezequiel-montes-vinedo", "ezequiel_montes");
  }
  if (!only || only === "centro-historico") {
    await playConversation("centro-historico", "centro_historico");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
