import "server-only";

import { z } from "zod";

const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  OPENROUTER_API_KEY: optionalSecret,
  OPENROUTER_MODEL_PRIMARY: z.string().default("qwen/qwen-2.5-72b-instruct"),
  OPENROUTER_MODEL_FALLBACK: z.string().default("deepseek/deepseek-chat"),
  OPENROUTER_TIMEOUT_MS: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive().default(8000),
  ),
  UNSPLASH_ACCESS_KEY: optionalSecret,
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv();
  }

  return cachedEnv;
}
