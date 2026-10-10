/**
 * `kool run kb:ingest` — fetches real wedding-venue candidates from the
 * Google Places API (New) for every curated zone × category, and writes
 * the deduped/filtered/sorted result to `data/kb/places.raw.json`.
 *
 * Reads `GOOGLE_PLACES_API_KEY` straight from `process.env` (no
 * `src/lib/env.ts`, which pulls in `server-only` and throws outside
 * Next.js): `kool.yml`'s `kb:ingest` script runs this under
 * `docker compose run --env-file .env`, so the key is already in the
 * environment by the time this file executes.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { loadKb } from "../../src/domain/kb/load";
import { createPlacesClient } from "../../src/domain/places";
import { formatSummaryTable, runIngest } from "./ingest-lib";

const OUTPUT_PATH = path.resolve(process.cwd(), "data/kb/places.raw.json");

async function main(): Promise<void> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

  if (!apiKey) {
    console.error(
      "[kb:ingest] GOOGLE_PLACES_API_KEY is not set. Add it to .env (see .env.dist) and re-run `kool run kb:ingest`.",
    );
    process.exitCode = 1;
    return;
  }

  const { zones } = loadKb();
  const client = createPlacesClient({ apiKey });

  console.log(
    `[kb:ingest] Searching ${zones.length} zones × 6 categories (up to 2 pages each, ~5 req/s)…`,
  );

  const result = await runIngest(client, { zones });

  const snapshot = {
    fetchedAt: result.fetchedAt,
    queries: result.queries,
    places: result.places,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log("");
  console.log(formatSummaryTable(result.summary));
  console.log("");
  console.log(
    `[kb:ingest] Wrote ${result.places.length} places (${result.queries} queries) to ${path.relative(process.cwd(), OUTPUT_PATH)}.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[kb:ingest] Ingestion failed: ${message}`);
  process.exitCode = 1;
});
