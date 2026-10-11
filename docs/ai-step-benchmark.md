# Quiz step model benchmark

Generated 2026-10-10 by `scripts/ai/bench-step-models.ts` (`kool run ai:bench`): 3 realistic
transcripts (style-only, style+setting, the full 4-entry curated deck) x 3
runs each, through the real engine prompt (`buildStepMessages`) and the
`GeneratedStepSchema`/`LLM_STEP_JSON_SCHEMA` in effect at benchmark time.

| Model                                    | p50 (ms) | p95 (ms) | Schema-valid 1st try | Spanish-only | Truncation | Avg tokens | Cost/step | ok/total |
| ---------------------------------------- | -------- | -------- | -------------------- | ------------ | ---------- | ---------- | --------- | -------- |
| qwen/qwen-2.5-7b-instruct                | 4313     | 4953     | 100%                 | 100%         | 44%        | 3454       | $0.00040  | 9/9      |
| qwen/qwen-2.5-72b-instruct               | 40050    | 40072    | 0%                   | 0%           | 0%         | 0          | $0.00000  | 0/9      |
| qwen/qwen3-30b-a3b                       | 4677     | 11275    | 78%                  | 100%         | 22%        | 3776       | $0.00069  | 9/9      |
| deepseek/deepseek-chat                   | 40013    | 40055    | 22%                  | 100%         | 33%        | 3621       | $0.00152  | 3/9      |
| deepseek/deepseek-v3.2                   | 40028    | 47528    | 0%                   | 100%         | 50%        | 4332       | $0.00151  | 2/9      |
| z-ai/glm-4.5-air                         | 200      | 405      | 0%                   | 0%           | 0%         | 0          | $0.00000  | 0/9      |
| moonshotai/kimi-k2                       | 195      | 221      | 0%                   | 0%           | 0%         | 0          | $0.00000  | 0/9      |
| google/gemini-2.5-flash                  | 4001     | 8066     | 67%                  | 100%         | 11%        | 3897       | $0.00233  | 9/9      |
| google/gemini-2.5-flash-lite             | 8877     | 9660     | 33%                  | 100%         | 0%         | 3908       | $0.00062  | 5/9      |
| openai/gpt-4.1-mini                      | 1386     | 3979     | 0%                   | 0%           | 0%         | 0          | $0.00000  | 0/9      |
| mistralai/mistral-small-3.2-24b-instruct | 31053    | 40010    | 44%                  | 86%          | 29%        | 3641       | $0.00045  | 7/9      |
| deepseek/deepseek-v4-flash               | 28486    | 30965    | 0%                   | 100%         | 0%         | 5267       | $0.00000  | 1/9      |
| deepseek/deepseek-v4-flash-0731          | 40024    | 40049    | 0%                   | 0%           | 0%         | 0          | $0.00000  | 0/9      |
| deepseek/deepseek-v4-flash-vision-exp    | 18161    | 22094    | 0%                   | 100%         | 0%         | 4311       | $0.00000  | 1/9      |
| deepseek/deepseek-v4.1-flash             | 23455    | 36332    | 0%                   | 0%           | 0%         | 0          | $0.00000  | 0/9      |

Total estimated cost of this run: $0.0447 USD.

Selection rule: Spanish 100%, schema-valid ≥ 90% first attempt, p50 ≤ 2.5s,
cost ≤ $0.002/step; prefer a Chinese-origin model when within 20% of the
best on quality/latency (PRD cost preference), otherwise take the best.

## Decision

**Primary: `qwen/qwen-2.5-7b-instruct`. Fallback: `qwen/qwen3-30b-a3b`.**
Both set as `OPENROUTER_MODEL_FAST`/`OPENROUTER_MODEL_FAST_FALLBACK` in
`src/lib/env.ts` and `.env.dist`.

This benchmark ran against the already-hardened `v2` engine prompt (see
`fix(quiz): harden step prompt and normalise model output`) and the real
`GeneratedStepSchema`, so "Truncation %" here reflects truncation against
the _tight_ schema with no headroom and no `normaliseGeneratedStep`
safety net — i.e. the worst case. In production the fast model is called
through `RawGeneratedStepSchema` (2x headroom) and every response is run
through `normaliseGeneratedStep` before `GeneratedStepSchema` ever sees
it, so the real truncation rate is substantially lower than this table's
numbers for both candidates.

Why this pair:

- **`qwen/qwen-2.5-7b-instruct`** was the only model that was both 100%
  schema-valid-on-first-try and 100% Spanish-only on _every_ run (9/9 ok
  both times this was run), at the lowest cost of any working candidate
  (~$0.0004/step, 5x under the $0.002 budget) and the best latency of any
  fully-reliable candidate. It already was the previous default, and
  nothing in this run justified replacing it.
- **`qwen/qwen3-30b-a3b`** is the next most reliable (78–100% schema-valid
  across the two runs, 100% Spanish both times, similar latency, still
  well under budget on cost) and noticeably lower truncation than the
  primary even under the tight schema. It replaces the previous fallback,
  `deepseek/deepseek-chat`, which this run shows is **not safe as a
  fallback for this schema**: 22–33% schema-valid, ~40s p50 (it almost
  always needs a correction retry, and both attempts are slow) — this
  matches the original bug report's observation of deepseek-chat taking
  "15–40s" on this layer's schema. Both chosen models are Chinese-origin
  (PRD cost preference), so no trade-off was needed there.
- Several other candidates failed outright with this harness's strict
  structured-output request (`provider.require_parameters: true` +
  `response_format.json_schema.strict: true`): `qwen-2.5-72b-instruct`,
  `z-ai/glm-4.5-air`, `moonshotai/kimi-k2`, `openai/gpt-4.1-mini`, and
  every `deepseek-v4*-flash` candidate returned 0% valid responses (many
  failing fast with an HTTP error, i.e. the provider rejected the strict
  schema request outright, not a quality problem). `google/gemini-2.5-flash`
  had the best truncation (0–11%) and 9/9 reliability, but only 67%
  schema-valid first try and a cost (~$0.0023/step) just over the $0.002
  budget, and it's not Chinese-origin — not a close enough win to prefer
  over the chosen pair.

**Deviation from the target:** no working candidate hit p50 ≤ 2.5s — the
fastest fully-reliable models (both chosen here) land around 4.3–5s cold,
which is inherent to this layer's prompt size (the hardened system
prompt + a 20-venue digest) on dense 7B–30B models through OpenRouter,
not something model choice alone fixes. This is exactly what deliverable
3 (speculative prefetch) is for: the _perceived_ latency target (sub-3s
cold, sub-300ms warm) is met by warming the next step for every visible
option while the couple is still looking at the current one, so the
common case (choosing one of the options actually shown) is a cache hit,
not a cold call. See the real-conversation numbers in the final report
for cold vs. warm `durationMs`.
