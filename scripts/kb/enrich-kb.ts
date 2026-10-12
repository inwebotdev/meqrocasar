/**
 * `kool run kb:enrich` — classifies and writes es-MX copy for every
 * places-sourced venue in `data/kb/venues.json` that's still below the
 * confidence threshold (or missing `whyWeddings`), via a structured
 * OpenRouter call per batch of 8. Re-running is safe: a venue whose
 * enriched `confidence` already clears the threshold isn't re-selected
 * (see `selectVenuesForEnrichment`).
 *
 * Flags: `--all` also enriches curated seeds (only filling their empty
 * fields); `--batch-size=<n>` overrides the batch size (default `8`) —
 * useful if a model is slow/unreliable on the schema's full array size,
 * since a smaller batch means a smaller constrained-JSON response.
 *
 * Reads OpenRouter env vars straight from `process.env` (no
 * `src/lib/env.ts`, which pulls in `server-only` and throws outside
 * Next.js): `kool.yml`'s `kb:enrich` script runs this under
 * `docker compose run --env-from-file .env`, so the keys are already in
 * the environment by the time this file executes.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { createStructuredClient, type OpenRouterConfig } from "../../src/domain/ai/structured";
import { KbVenueSchema } from "../../src/domain/kb/types";
import { PlaceSchema } from "../../src/domain/places";
import { ENRICHMENT_JSON_SCHEMA, EnrichmentResponseSchema, runEnrichment } from "./enrich-lib";

const VENUES_PATH = path.resolve(process.cwd(), "data/kb/venues.json");
const PLACES_RAW_PATH = path.resolve(process.cwd(), "data/kb/places.raw.json");

const PlacesSnapshotSchema = z.object({
  fetchedAt: z.string(),
  queries: z.number().int().nonnegative(),
  places: z.array(PlaceSchema),
});

async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

/**
 * Enrichment is a one-off batch job, not an interactive request, so it
 * uses its own (longer) timeout rather than `OPENROUTER_TIMEOUT_MS`
 * (tuned for the ≤3s quiz-step budget): a batch of 8 venues asks the
 * model for a sizeable JSON array, which routinely takes longer than 8s.
 */
const ENRICH_TIMEOUT_MS = 30_000;

/** A batch of 8 venues' worth of structured JSON output needs more room than the 1500-token default. */
const ENRICH_MAX_TOKENS = 4000;

function buildConfig(): OpenRouterConfig | undefined {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return undefined;
  }

  return {
    apiKey,
    primaryModel: process.env.OPENROUTER_MODEL_PRIMARY?.trim() || "qwen/qwen-2.5-72b-instruct",
    fallbackModel: process.env.OPENROUTER_MODEL_FALLBACK?.trim() || "deepseek/deepseek-chat",
    timeoutMs: ENRICH_TIMEOUT_MS,
    appUrl: process.env.APP_URL?.trim() || "http://localhost:3000",
    appTitle: "Querétaro Romance",
  };
}

async function main(): Promise<void> {
  const config = buildConfig();

  if (!config) {
    console.error(
      "[kb:enrich] OPENROUTER_API_KEY is not set. Add it to .env (see .env.dist) and re-run `kool run kb:enrich`.",
    );
    process.exitCode = 1;
    return;
  }

  const all = process.argv.includes("--all");
  const batchSizeArg = process.argv.find((arg) => arg.startsWith("--batch-size="));
  const parsedBatchSize = batchSizeArg ? Number(batchSizeArg.split("=")[1]) : NaN;
  const batchSize =
    Number.isFinite(parsedBatchSize) && parsedBatchSize > 0 ? parsedBatchSize : undefined;

  const [venuesRaw, snapshotRaw] = await Promise.all([
    readJson(VENUES_PATH),
    readJson(PLACES_RAW_PATH),
  ]);

  const venues = z.array(KbVenueSchema).parse(venuesRaw);
  const snapshot = PlacesSnapshotSchema.parse(snapshotRaw);

  const client = createStructuredClient({
    config,
    schema: EnrichmentResponseSchema,
    jsonSchema: ENRICHMENT_JSON_SCHEMA,
    name: "kb_venue_enrichment",
    temperature: 0.3,
    maxTokens: ENRICH_MAX_TOKENS,
  });

  console.log(
    `[kb:enrich] Enriching venues below confidence 0.9${all ? " (including curated seeds)" : ""}…`,
  );

  const result = await runEnrichment({ venues, places: snapshot.places, client, all, batchSize });

  // Validate before writing: catch a mapping bug here, not at `loadKb()` time.
  const validated = z.array(KbVenueSchema).parse(result.venues);

  await writeFile(VENUES_PATH, `${JSON.stringify(validated, null, 2)}\n`, "utf8");

  const totalTokens = Object.values(result.usageByModel).reduce(
    (sum, usage) => sum + usage.promptTokens + usage.completionTokens,
    0,
  );

  console.log(
    `[kb:enrich] Selected ${result.selectedCount} venue(s), skipped ${result.skippedCount} (already enriched or curated).`,
  );
  console.log(
    `[kb:enrich] Enriched ${result.enrichedIds.length}, dropped ${result.droppedIds.length} (not a wedding venue or low confidence).`,
  );
  if (result.droppedIds.length > 0) {
    console.log(`[kb:enrich] Dropped: ${result.droppedIds.join(", ")}`);
  }
  for (const [model, usage] of Object.entries(result.usageByModel)) {
    console.log(
      `[kb:enrich] ${model}: ${usage.promptTokens} prompt + ${usage.completionTokens} completion tokens.`,
    );
  }
  console.log(
    `[kb:enrich] Total tokens: ${totalTokens}. Estimated cost: $${result.estimatedCostUsd.toFixed(4)} USD.`,
  );
  console.log(`[kb:enrich] Wrote ${path.relative(process.cwd(), VENUES_PATH)}.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[kb:enrich] Failed: ${message}`);
  process.exitCode = 1;
});
