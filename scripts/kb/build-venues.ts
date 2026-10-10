/**
 * `kool run kb:build` — merges `data/kb/places.raw.json` (written by
 * `kb:ingest`) into `data/kb/venues.json`: a Places result matching a
 * curated venue by name/alias enriches it in place (rating, counts,
 * links, extra photos); every unmatched place is appended as a new,
 * low-confidence venue. Re-running is safe: a place already merged in a
 * previous run matches by name again and is just re-enriched, not
 * duplicated.
 *
 * Pure Node (`fs`), no `server-only` import, so it runs fine under `tsx`
 * outside Next.js.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { mergeSnapshotIntoKb, type PlacesSnapshot } from "../../src/domain/kb/from-places";
import { KbVenueSchema, KbZoneSchema } from "../../src/domain/kb/types";
import { PlaceSchema } from "../../src/domain/places";

const VENUES_PATH = path.resolve(process.cwd(), "data/kb/venues.json");
const ZONES_PATH = path.resolve(process.cwd(), "data/kb/zones.json");
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

async function main(): Promise<void> {
  const [seedVenuesRaw, zonesRaw, snapshotRaw] = await Promise.all([
    readJson(VENUES_PATH),
    readJson(ZONES_PATH),
    readJson(PLACES_RAW_PATH),
  ]);

  const seedVenues = z.array(KbVenueSchema).parse(seedVenuesRaw);
  const zones = z.array(KbZoneSchema).parse(zonesRaw);
  const snapshot: PlacesSnapshot = PlacesSnapshotSchema.parse(snapshotRaw);

  const before = {
    total: seedVenues.length,
    curated: seedVenues.filter((venue) => venue.source === "curated").length,
    places: seedVenues.filter((venue) => venue.source === "places").length,
  };

  const merged = mergeSnapshotIntoKb(seedVenues, snapshot, zones);

  // Validate before writing: catch a mapping bug here, not at `loadKb()` time.
  const validated = z.array(KbVenueSchema).parse(merged);

  await writeFile(VENUES_PATH, `${JSON.stringify(validated, null, 2)}\n`, "utf8");

  const after = {
    total: validated.length,
    curated: validated.filter((venue) => venue.source === "curated").length,
    places: validated.filter((venue) => venue.source === "places").length,
  };
  const enriched = seedVenues.filter((seed) => {
    const match = validated.find((venue) => venue.id === seed.id);
    return match !== undefined && match.placeId !== undefined && seed.placeId === undefined;
  }).length;

  console.log(
    `[kb:build] ${before.total} seed venues (${before.curated} curated, ${before.places} places) -> ` +
      `${after.total} venues (${after.curated} curated, ${after.places} places). ${enriched} seed(s) newly enriched with Places data.`,
  );
  console.log(`[kb:build] Wrote ${path.relative(process.cwd(), VENUES_PATH)}.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[kb:build] Failed: ${message}`);
  process.exitCode = 1;
});
