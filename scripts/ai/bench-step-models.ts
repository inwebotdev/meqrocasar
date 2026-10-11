/**
 * `kool run ai:bench` (`yarn ai:bench`) — benchmarks candidate OpenRouter
 * models for the quiz engine's fast per-step generation (the model
 * `OPENROUTER_MODEL_FAST`/`OPENROUTER_MODEL_FAST_FALLBACK` in
 * `src/lib/env.ts` actually use). For 3 realistic transcripts x 3 runs
 * each, calls the real engine prompt (`buildStepMessages`) through
 * `createStructuredClient` and reports, per model: p50/p95 latency,
 * schema-valid-on-first-attempt %, Spanish-only % (any CJK/Cyrillic/Arabic
 * char fails it), truncation % (any field within 2 chars of its max),
 * average tokens, and estimated cost per step.
 *
 * Verifies each hard-coded candidate against `GET /api/v1/models` first
 * (skipping — and printing why — any that don't exist there any more),
 * and adds up to 4 more recent Qwen/DeepSeek/GLM/Kimi "flash"/"turbo"/
 * "mini" models the endpoint returns that aren't already candidates.
 *
 * Reads `OPENROUTER_API_KEY` straight from `process.env` (not
 * `src/lib/env.ts`, which pulls in `server-only`): `kool.yml`'s `ai:bench`
 * script runs this under `docker compose run --env-from-file .env`, so
 * the key is already in the environment by the time this file executes.
 */
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createStructuredClient } from "../../src/domain/ai/structured";
import { estimateCostUsd } from "../../src/domain/ai/pricing";
import { buildDigest } from "../../src/domain/kb/digest";
import { buildStepMessages } from "../../src/domain/quiz/engine-prompt";
import {
  GeneratedStepSchema,
  LLM_STEP_JSON_SCHEMA,
  type GeneratedStep,
} from "../../src/domain/quiz/generated-step";
import { getOption, QUIZ_STEPS } from "../../src/domain/quiz/questions";
import {
  entryFromCuratedOption,
  foldFacets,
  type Transcript,
} from "../../src/domain/quiz/transcript";

const MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const ENDPOINTS_ENDPOINT = (modelId: string) =>
  `https://openrouter.ai/api/v1/models/${modelId}/endpoints`;
const APP_URL = process.env.APP_URL?.trim() || "http://localhost:3000";
const APP_TITLE = "Querétaro Romance AI";
const MAX_STEPS = 7;
const RUNS_PER_TRANSCRIPT = 3;
/** Generous for benchmarking: production uses `QUIZ_STEP_TIMEOUT_MS` (6s); we want to see slow models fail honestly, not get cut off right at the edge. */
const TIMEOUT_MS = 20_000;
/** Benchmark calls one model at a time (`fallbackModel` = itself), so a "fallback" never masks the primary model's real behavior. */
const TEMPERATURE = 0.8;
const MAX_TOKENS = 900;
/** Caps total wall time / API load: this many (model, transcript) pairs run concurrently (each pair still runs its 3 repeats sequentially). */
const TASK_CONCURRENCY = 6;

const BASE_CANDIDATES = [
  "qwen/qwen-2.5-7b-instruct",
  "qwen/qwen-2.5-72b-instruct",
  "qwen/qwen3-30b-a3b",
  "qwen/qwen3-235b-a22b",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-v3.2",
  "z-ai/glm-4.5-air",
  "moonshotai/kimi-k2",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4.1-mini",
  "mistralai/mistral-small-3.2-24b-instruct",
] as const;

const EXTRA_FAMILY_PREFIXES = ["qwen/", "deepseek/", "z-ai/glm", "moonshotai/kimi"];
const EXTRA_KEYWORDS = ["flash", "turbo", "mini"];
const MAX_EXTRA_CANDIDATES = 4;

/**
 * `--providers=Cerebras,Groq,SambaNova`: when given, also benchmarks these
 * candidate models through that provider order (`provider: { order,
 * allow_fallbacks: true }`, same as `OPENROUTER_PROVIDER_ORDER` in
 * `src/lib/env.ts`), each against the default (unordered) routing, so the
 * speed gain (or lack of one) from pinning fast providers is visible
 * before it's set as the default. Availability is verified per model via
 * `GET /api/v1/models/{id}/endpoints` before any calls are made to it.
 */
const PROVIDER_BENCH_CANDIDATES = [
  "qwen/qwen-2.5-7b-instruct",
  "qwen/qwen3-32b",
  "meta-llama/llama-3.3-70b-instruct",
  "openai/gpt-oss-120b",
] as const;

/** Fewer repeats than the base benchmark (`RUNS_PER_TRANSCRIPT`): this section already doubles calls (default vs. ordered routing) across 4 models. */
const PROVIDER_BENCH_RUNS_PER_TRANSCRIPT = 2;

function parseProvidersFlag(argv: readonly string[]): string[] | undefined {
  const flag = argv.find((arg) => arg.startsWith("--providers="));
  if (!flag) return undefined;

  const value = flag.slice("--providers=".length).trim();
  if (!value) return undefined;

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

// The real `GeneratedStepSchema` maxima — "truncated" means a field landed
// within 2 chars of one of these.
const FIELD_MAX = {
  id: 40,
  topic: 24,
  question: 80,
  helper: 140,
  selectLabel: 32,
  title: 40,
  description: 160,
  hashtag: 40,
  photoQuery: 60,
  badge: 24,
  matchLabel: 16,
} as const;

// Hiragana/Katakana, CJK ideographs, Hangul, Cyrillic, Arabic.
const NON_LATIN_PATTERN = /[぀-ヿ㐀-鿿가-힯Ѐ-ӿ؀-ۿ]/u;

interface OpenRouterModelListing {
  id: string;
}

async function fetchAvailableModelIds(): Promise<Set<string>> {
  const response = await fetch(MODELS_ENDPOINT);
  if (!response.ok) {
    throw new Error(`GET ${MODELS_ENDPOINT} returned ${response.status}`);
  }
  const body = (await response.json()) as { data?: OpenRouterModelListing[] };
  return new Set((body.data ?? []).map((model) => model.id));
}

/**
 * Pulls the provider names actually serving `modelId`, from `GET
 * /api/v1/models/{id}/endpoints`. Defensive about the exact response
 * shape (not pinned down anywhere authoritative): scans every endpoint
 * object for whichever plausible "provider name" field is present.
 * Returns `[]` (never throws) on any HTTP/shape failure, so a bad
 * endpoint id just means "no providers matched" rather than aborting the
 * whole run.
 */
async function fetchModelProviders(modelId: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(ENDPOINTS_ENDPOINT(modelId), { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return [];

    const body = (await response.json()) as {
      data?: { endpoints?: Record<string, unknown>[] };
    };
    const endpoints = body.data?.endpoints ?? [];

    const names: string[] = [];
    for (const endpoint of endpoints) {
      const candidate = ["provider_name", "provider", "tag", "name"]
        .map((key) => endpoint[key])
        .find((value): value is string => typeof value === "string" && value.length > 0);
      if (candidate) names.push(candidate);
    }
    return names;
  } catch {
    return [];
  }
}

/** Case-insensitive intersection of `requested` (as given on `--providers=`) with `available`, preserving `requested`'s order. */
function matchRequestedProviders(
  requested: readonly string[],
  available: readonly string[],
): string[] {
  const availableLower = new Map(available.map((name) => [name.toLowerCase(), name] as const));
  return requested
    .map((name) => availableLower.get(name.toLowerCase()))
    .filter((name): name is string => name !== undefined);
}

function pickExtraCandidates(
  availableIds: ReadonlySet<string>,
  exclude: ReadonlySet<string>,
): string[] {
  const matches = [...availableIds]
    .filter((id) => !exclude.has(id))
    .filter((id) => !id.includes(":")) // skip :batch/:free variants of a model already covered
    .filter((id) => !id.startsWith("~")) // OpenRouter's own "deprecated/aliased" marker
    .filter((id) => EXTRA_FAMILY_PREFIXES.some((prefix) => id.toLowerCase().startsWith(prefix)))
    .filter((id) => EXTRA_KEYWORDS.some((keyword) => id.toLowerCase().includes(keyword)));

  return [...new Set(matches)].sort().slice(0, MAX_EXTRA_CANDIDATES);
}

// --- transcripts -----------------------------------------------------------

interface NamedTranscript {
  label: string;
  transcript: Transcript;
}

function buildTranscripts(): NamedTranscript[] {
  const e1 = entryFromCuratedOption(QUIZ_STEPS[0]!, getOption("style", "colonial"));
  const e2 = entryFromCuratedOption(QUIZ_STEPS[1]!, getOption("setting", "sunset_garden"));
  const e3 = entryFromCuratedOption(QUIZ_STEPS[2]!, getOption("experience", "grand_traditional"));
  const e4 = entryFromCuratedOption(QUIZ_STEPS[3]!, getOption("mustHave", "wine_tasting"));

  return [
    { label: "style-only (1 entry)", transcript: { entries: [e1] } },
    { label: "style+setting (2 entries)", transcript: { entries: [e1, e2] } },
    { label: "full curated deck (4 entries)", transcript: { entries: [e1, e2, e3, e4] } },
  ];
}

// --- per-run measurement -----------------------------------------------

interface RunResult {
  durationMs: number;
  ok: boolean;
  schemaValidFirstAttempt: boolean;
  spanishOnly: boolean;
  truncated: boolean;
  promptTokens?: number;
  completionTokens?: number;
}

function collectStrings(step: GeneratedStep): string[] {
  return [
    step.topic,
    step.question,
    step.helper,
    step.selectLabel,
    step.doneReason ?? "",
    ...step.options.flatMap((option) => [
      option.title,
      option.description,
      option.photoQuery,
      option.badge,
      option.matchLabel,
      ...option.hashtags,
    ]),
  ];
}

function isTruncated(step: GeneratedStep): boolean {
  const checks: Array<[string, number]> = [
    [step.id, FIELD_MAX.id],
    [step.topic, FIELD_MAX.topic],
    [step.question, FIELD_MAX.question],
    [step.helper, FIELD_MAX.helper],
    [step.selectLabel, FIELD_MAX.selectLabel],
  ];

  for (const option of step.options) {
    checks.push([option.title, FIELD_MAX.title]);
    checks.push([option.description, FIELD_MAX.description]);
    checks.push([option.photoQuery, FIELD_MAX.photoQuery]);
    checks.push([option.badge, FIELD_MAX.badge]);
    checks.push([option.matchLabel, FIELD_MAX.matchLabel]);
    for (const tag of option.hashtags) checks.push([tag, FIELD_MAX.hashtag]);
  }

  return checks.some(([value, max]) => value.length >= max - 2);
}

async function runOnce(
  apiKey: string,
  model: string,
  transcript: Transcript,
  providerOrder?: string[],
): Promise<RunResult> {
  const facets = foldFacets(transcript.entries);
  const digest = buildDigest(facets, { maxVenues: 20, maxExperiences: 10, maxChars: 4500 });
  const messages = buildStepMessages({
    transcript,
    facets,
    digest,
    stepIndex: transcript.entries.length + 1,
    maxSteps: MAX_STEPS,
  });

  const client = createStructuredClient({
    config: {
      apiKey,
      primaryModel: model,
      fallbackModel: model,
      timeoutMs: TIMEOUT_MS,
      appUrl: APP_URL,
      appTitle: APP_TITLE,
      providerOrder,
    },
    schema: GeneratedStepSchema,
    jsonSchema: LLM_STEP_JSON_SCHEMA,
    name: "quiz_step",
    temperature: TEMPERATURE,
    maxTokens: MAX_TOKENS,
  });

  const start = Date.now();
  const result = await client.generate(messages);
  const durationMs = Date.now() - start;

  if (!result.ok) {
    return {
      durationMs,
      ok: false,
      schemaValidFirstAttempt: false,
      spanishOnly: false,
      truncated: false,
    };
  }

  const schemaValidFirstAttempt =
    result.attempts.length === 1 && result.attempts[0]?.outcome === "ok";
  const spanishOnly = !collectStrings(result.value).some((text) => NON_LATIN_PATTERN.test(text));
  const truncated = isTruncated(result.value);

  return {
    durationMs,
    ok: true,
    schemaValidFirstAttempt,
    spanishOnly,
    truncated,
    promptTokens: result.usage?.promptTokens,
    completionTokens: result.usage?.completionTokens,
  };
}

// --- aggregation --------------------------------------------------------

interface ModelReport {
  model: string;
  p50Ms: number;
  p95Ms: number;
  schemaValidFirstAttemptPct: number;
  spanishOnlyPct: number;
  truncationPct: number;
  avgTokens: number;
  costPerStepUsd: number;
  okCount: number;
  totalCount: number;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

function aggregate(model: string, runs: readonly RunResult[]): ModelReport {
  const durations = runs.map((run) => run.durationMs).sort((a, b) => a - b);
  const okRuns = runs.filter((run) => run.ok);

  const avgTokens =
    okRuns.length > 0
      ? okRuns.reduce(
          (sum, run) => sum + (run.promptTokens ?? 0) + (run.completionTokens ?? 0),
          0,
        ) / okRuns.length
      : 0;

  const avgPromptTokens =
    okRuns.length > 0
      ? okRuns.reduce((sum, run) => sum + (run.promptTokens ?? 0), 0) / okRuns.length
      : 0;
  const avgCompletionTokens =
    okRuns.length > 0
      ? okRuns.reduce((sum, run) => sum + (run.completionTokens ?? 0), 0) / okRuns.length
      : 0;

  return {
    model,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    schemaValidFirstAttemptPct:
      (runs.filter((run) => run.schemaValidFirstAttempt).length / runs.length) * 100,
    spanishOnlyPct:
      okRuns.length > 0
        ? (okRuns.filter((run) => run.spanishOnly).length / okRuns.length) * 100
        : 0,
    truncationPct:
      okRuns.length > 0 ? (okRuns.filter((run) => run.truncated).length / okRuns.length) * 100 : 0,
    avgTokens,
    costPerStepUsd: estimateCostUsd(model, {
      promptTokens: avgPromptTokens,
      completionTokens: avgCompletionTokens,
    }),
    okCount: okRuns.length,
    totalCount: runs.length,
  };
}

// --- concurrency helper ---------------------------------------------------

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// --- reporting ------------------------------------------------------------

function formatRow(report: ModelReport): string {
  return `| ${report.model} | ${report.p50Ms} | ${report.p95Ms} | ${report.schemaValidFirstAttemptPct.toFixed(0)}% | ${report.spanishOnlyPct.toFixed(0)}% | ${report.truncationPct.toFixed(0)}% | ${Math.round(report.avgTokens)} | $${report.costPerStepUsd.toFixed(5)} | ${report.okCount}/${report.totalCount} |`;
}

const TABLE_HEADER = `| Model | p50 (ms) | p95 (ms) | Schema-valid 1st try | Spanish-only | Truncation | Avg tokens | Cost/step | ok/total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |`;

// --- provider benchmark (`--providers=...`) --------------------------------

interface ProviderBenchReport {
  model: string;
  condition: "default" | "ordered";
  providerOrder?: string[];
  report: ModelReport;
}

interface ProviderTask {
  model: string;
  condition: "default" | "ordered";
  providerOrder?: string[];
}

/**
 * Benchmarks `PROVIDER_BENCH_CANDIDATES` through `requestedProviders`
 * (`provider: { order, allow_fallbacks: true }`), each against the
 * model's default (unordered) routing for comparison. Skips a candidate
 * entirely (with a logged reason) when none of `requestedProviders`
 * actually serve it per `GET /api/v1/models/{id}/endpoints`.
 */
async function runProviderBenchmark(
  apiKey: string,
  requestedProviders: readonly string[],
  transcripts: readonly NamedTranscript[],
): Promise<ProviderBenchReport[]> {
  const tasks: ProviderTask[] = [];

  for (const model of PROVIDER_BENCH_CANDIDATES) {
    console.log(`[ai:bench] Checking endpoints for "${model}"…`);
    const availableProviders = await fetchModelProviders(model);
    const matched = matchRequestedProviders(requestedProviders, availableProviders);

    if (matched.length === 0) {
      console.log(
        `[ai:bench] Skipping provider benchmark for "${model}": none of [${requestedProviders.join(", ")}] serve it` +
          (availableProviders.length > 0
            ? ` (available: ${availableProviders.join(", ")}).`
            : " (no endpoints found for this model id)."),
      );
      continue;
    }

    tasks.push({ model, condition: "default" });
    tasks.push({ model, condition: "ordered", providerOrder: matched });
  }

  const perTask = await mapWithConcurrency(tasks, TASK_CONCURRENCY, async (task) => {
    const runs: RunResult[] = [];
    for (const { transcript } of transcripts) {
      for (let i = 0; i < PROVIDER_BENCH_RUNS_PER_TRANSCRIPT; i += 1) {
        runs.push(await runOnce(apiKey, task.model, transcript, task.providerOrder));
      }
    }
    return { task, runs };
  });

  // `aggregate` is keyed by the real model id (so `estimateCostUsd` still
  // resolves real pricing) — the condition/providerOrder are carried
  // alongside for `formatProviderRow` to render, not folded into the id.
  return perTask.map(({ task, runs }) => ({
    model: task.model,
    condition: task.condition,
    providerOrder: task.providerOrder,
    report: aggregate(task.model, runs),
  }));
}

function formatProviderRow(entry: ProviderBenchReport): string {
  const routing =
    entry.condition === "ordered" && entry.providerOrder
      ? `ordered: ${entry.providerOrder.join(" > ")}`
      : "default";
  return `| ${entry.model} | ${routing} | ${entry.report.p50Ms} | ${entry.report.p95Ms} | ${entry.report.schemaValidFirstAttemptPct.toFixed(0)}% | ${entry.report.spanishOnlyPct.toFixed(0)}% | ${entry.report.okCount}/${entry.report.totalCount} |`;
}

const PROVIDER_TABLE_HEADER = `| Model | Routing | p50 (ms) | p95 (ms) | Schema-valid 1st try | Spanish-only | ok/total |
| --- | --- | --- | --- | --- | --- | --- |`;

/**
 * `--providers=...` entry point: runs only the provider-routing
 * benchmark (not the full base benchmark, which would be far more than
 * the handful of calls this needs) and *appends* a dated section to
 * `docs/ai-step-benchmark.md` rather than overwriting the file, so the
 * base benchmark's own decision section is preserved.
 */
async function runProviderBenchmarkMain(
  apiKey: string,
  requestedProviders: string[],
): Promise<void> {
  const transcripts = buildTranscripts();
  const callCount =
    PROVIDER_BENCH_CANDIDATES.length * 2 * transcripts.length * PROVIDER_BENCH_RUNS_PER_TRANSCRIPT;
  console.log(
    `[ai:bench] Provider benchmark: [${requestedProviders.join(", ")}] against ${PROVIDER_BENCH_CANDIDATES.length} candidate model(s), up to ${callCount} calls…`,
  );

  const results = await runProviderBenchmark(apiKey, requestedProviders, transcripts);

  console.log("");
  console.log(PROVIDER_TABLE_HEADER);
  for (const entry of results) {
    console.log(formatProviderRow(entry));
  }

  const totalCost = results.reduce(
    (sum, entry) => sum + entry.report.costPerStepUsd * entry.report.okCount,
    0,
  );
  console.log("");
  console.log(
    `[ai:bench] Estimated total cost of this provider run: $${totalCost.toFixed(4)} USD.`,
  );

  const date = new Date().toISOString().slice(0, 10);
  const docPath = path.resolve(process.cwd(), "docs/ai-step-benchmark.md");
  const section = `\n## Provider benchmark (\`--providers=${requestedProviders.join(",")}\`)

Generated ${date} by \`scripts/ai/bench-step-models.ts --providers=${requestedProviders.join(",")}\`:
${PROVIDER_BENCH_CANDIDATES.length} candidate model(s) x up to 2 routing conditions (default vs.
\`provider: { order: [${requestedProviders.join(", ")}], allow_fallbacks: true }\`) x
${transcripts.length} transcripts x ${PROVIDER_BENCH_RUNS_PER_TRANSCRIPT} runs each, through the
real engine prompt. A candidate is skipped when none of the requested providers serve it per
\`GET /api/v1/models/{id}/endpoints\`.

${PROVIDER_TABLE_HEADER}
${results.map(formatProviderRow).join("\n")}

Total estimated cost of this run: $${totalCost.toFixed(4)} USD.
`;

  await mkdir(path.dirname(docPath), { recursive: true });
  await appendFile(docPath, section, "utf8");
  console.log(
    `[ai:bench] Appended the provider benchmark section to ${path.relative(process.cwd(), docPath)}.`,
  );
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "[ai:bench] OPENROUTER_API_KEY is not set. Add it to .env (see .env.dist) and re-run `kool run ai:bench`.",
    );
    process.exitCode = 1;
    return;
  }

  const providersFlag = parseProvidersFlag(process.argv.slice(2));
  if (providersFlag) {
    await runProviderBenchmarkMain(apiKey, providersFlag);
    return;
  }

  console.log("[ai:bench] Fetching the OpenRouter model catalog…");
  const availableIds = await fetchAvailableModelIds();

  const verifiedBase: string[] = [];
  for (const candidate of BASE_CANDIDATES) {
    if (availableIds.has(candidate)) {
      verifiedBase.push(candidate);
    } else {
      console.log(`[ai:bench] Skipping "${candidate}": not found in the OpenRouter model catalog.`);
    }
  }

  const extras = pickExtraCandidates(availableIds, new Set(BASE_CANDIDATES));
  if (extras.length > 0) {
    console.log(
      `[ai:bench] Added ${extras.length} newer flash/turbo/mini candidate(s): ${extras.join(", ")}`,
    );
  }

  const models = [...verifiedBase, ...extras];
  const transcripts = buildTranscripts();

  console.log(
    `[ai:bench] Benchmarking ${models.length} model(s) x ${transcripts.length} transcript(s) x ${RUNS_PER_TRANSCRIPT} run(s) = ${models.length * transcripts.length * RUNS_PER_TRANSCRIPT} calls…`,
  );

  type Task = { model: string; transcript: Transcript };
  const tasks: Task[] = models.flatMap((model) =>
    transcripts.map(({ transcript }) => ({ model, transcript })),
  );

  const perTaskRuns = await mapWithConcurrency(tasks, TASK_CONCURRENCY, async (task) => {
    const runs: RunResult[] = [];
    for (let i = 0; i < RUNS_PER_TRANSCRIPT; i += 1) {
      runs.push(await runOnce(apiKey, task.model, task.transcript));
    }
    return { model: task.model, runs };
  });

  const runsByModel = new Map<string, RunResult[]>();
  for (const { model, runs } of perTaskRuns) {
    const existing = runsByModel.get(model) ?? [];
    runsByModel.set(model, [...existing, ...runs]);
  }

  const reports = models.map((model) => aggregate(model, runsByModel.get(model) ?? []));

  console.log("");
  console.log(TABLE_HEADER);
  for (const report of reports) {
    console.log(formatRow(report));
  }

  const totalCost = reports.reduce(
    (sum, report) => sum + report.costPerStepUsd * report.okCount,
    0,
  );
  console.log("");
  console.log(`[ai:bench] Estimated total cost of this run: $${totalCost.toFixed(4)} USD.`);

  const date = new Date().toISOString().slice(0, 10);
  const docPath = path.resolve(process.cwd(), "docs/ai-step-benchmark.md");
  const doc = `# Quiz step model benchmark

Generated ${date} by \`scripts/ai/bench-step-models.ts\` (\`kool run ai:bench\`): 3 realistic
transcripts (style-only, style+setting, the full 4-entry curated deck) x 3
runs each, through the real engine prompt (\`buildStepMessages\`) and the
\`GeneratedStepSchema\`/\`LLM_STEP_JSON_SCHEMA\` in effect at benchmark time.

${TABLE_HEADER}
${reports.map(formatRow).join("\n")}

Total estimated cost of this run: $${totalCost.toFixed(4)} USD.

Selection rule: Spanish 100%, schema-valid ≥ 90% first attempt, p50 ≤ 2.5s,
cost ≤ $0.002/step; prefer a Chinese-origin model when within 20% of the
best on quality/latency (PRD cost preference), otherwise take the best.
`;

  await mkdir(path.dirname(docPath), { recursive: true });
  await writeFile(docPath, doc, "utf8");
  console.log(`[ai:bench] Wrote ${path.relative(process.cwd(), docPath)}.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ai:bench] Failed: ${message}`);
  process.exitCode = 1;
});
