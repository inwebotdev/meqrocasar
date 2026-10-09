import { readFileSync } from "node:fs";
import path from "node:path";

import { delay, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { QuizAnswers } from "@/domain/quiz/schema";

import { mockOpenRouterChat } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { createOpenRouterClient, type OpenRouterConfig } from "./openrouter";

function fixture(name: string): string {
  return readFileSync(path.resolve(__dirname, "../../../test/fixtures/llm", name), "utf-8");
}

const answers: QuizAnswers = {
  style: "rustic_vineyard",
  setting: "day_vineyard",
  experience: "intimate_boutique",
  mustHave: "wine_tasting",
};

const PRIMARY_MODEL = "qwen/qwen-2.5-72b-instruct";
const FALLBACK_MODEL = "deepseek/deepseek-chat";

function baseConfig(overrides: Partial<OpenRouterConfig> = {}): OpenRouterConfig {
  return {
    apiKey: "test-key",
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    timeoutMs: 8000,
    appUrl: "http://localhost:3000",
    appTitle: "Querétaro Romance AI",
    ...overrides,
  };
}

function chatCompletion(
  content: string,
  usage?: { prompt_tokens: number; completion_tokens: number },
) {
  return HttpResponse.json({
    choices: [{ message: { content } }],
    ...(usage ? { usage } : {}),
  });
}

describe("createOpenRouterClient", () => {
  it("happy path: succeeds on the primary model, sends the expected request, captures usage", async () => {
    let capturedAuth: string | null = null;
    let capturedReferer: string | null = null;
    let capturedTitle: string | null = null;
    let capturedOpenRouterTitle: string | null = null;
    let capturedBody: Record<string, unknown> | undefined;

    server.use(
      mockOpenRouterChat(({ request, body }) => {
        capturedAuth = request.headers.get("Authorization");
        capturedReferer = request.headers.get("HTTP-Referer");
        capturedTitle = request.headers.get("X-Title");
        capturedOpenRouterTitle = request.headers.get("X-OpenRouter-Title");
        capturedBody = body;
        return chatCompletion(fixture("valid.json"), {
          prompt_tokens: 111,
          completion_tokens: 222,
        });
      }),
    );

    const client = createOpenRouterClient(baseConfig());
    const result = await client.generate(answers);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.model).toBe(PRIMARY_MODEL);
    expect(result.attempts).toEqual([
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "ok", status: 200 }),
    ]);
    expect(result.usage).toEqual({ promptTokens: 111, completionTokens: 222 });
    expect(result.value.conceptTitle).toBe("Atardecer Dorado entre Viñedos de Ezequiel Montes");

    expect(capturedAuth).toBe("Bearer test-key");
    expect(capturedReferer).toBe("http://localhost:3000");
    expect(capturedTitle).toBe("Querétaro Romance AI");
    expect(capturedOpenRouterTitle).toBe("Querétaro Romance AI");

    expect(capturedBody).toBeDefined();
    expect(capturedBody?.model).toBe(PRIMARY_MODEL);
    expect(capturedBody?.temperature).toBe(0.7);
    expect(capturedBody?.max_tokens).toBe(1200);
    expect(Array.isArray(capturedBody?.messages)).toBe(true);
    expect(capturedBody?.response_format).toEqual({
      type: "json_schema",
      json_schema: expect.objectContaining({ name: "wedding_experience", strict: true }),
    });
    expect(capturedBody?.provider).toEqual({ require_parameters: true });
  });

  it("parses a ```json fenced response (with surrounding prose) as a success", async () => {
    server.use(mockOpenRouterChat(() => chatCompletion(fixture("fenced.txt"))));

    const client = createOpenRouterClient(baseConfig());
    const result = await client.generate(answers);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conceptTitle).toBe("Noche Virreinal en Casona de Cantera");
    expect(result.attempts).toHaveLength(1);
  });

  it("retries the primary model with a correction turn after a schema failure, then succeeds", async () => {
    const bodies: Record<string, unknown>[] = [];

    server.use(
      mockOpenRouterChat(({ body, callIndex }) => {
        bodies.push(body);
        if (callIndex === 1) {
          return chatCompletion(fixture("wrong-shape.json"));
        }
        return chatCompletion(fixture("valid.json"));
      }),
    );

    const client = createOpenRouterClient(baseConfig());
    const result = await client.generate(answers);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.model).toBe(PRIMARY_MODEL);
    expect(result.attempts).toEqual([
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "schema" }),
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "ok" }),
    ]);

    expect(bodies).toHaveLength(2);
    const correctionMessages = bodies[1]?.messages as Array<{ role: string; content: string }>;
    const originalMessages = bodies[0]?.messages as Array<{ role: string; content: string }>;

    expect(correctionMessages).toHaveLength(originalMessages.length + 2);
    expect(correctionMessages.at(-2)).toEqual({
      role: "assistant",
      content: fixture("wrong-shape.json"),
    });
    expect(correctionMessages.at(-1)?.role).toBe("user");
    expect(correctionMessages.at(-1)?.content).toContain(
      "Tu respuesta anterior no cumplió el esquema",
    );
    expect(correctionMessages.at(-1)?.content).toContain(
      "Devuelve únicamente el objeto JSON corregido",
    );
  });

  it("falls back to the fallback model when the primary returns an HTTP error", async () => {
    server.use(
      mockOpenRouterChat(({ body, callIndex }) => {
        if (callIndex === 1) {
          expect(body.model).toBe(PRIMARY_MODEL);
          return HttpResponse.json({ error: "server error" }, { status: 500 });
        }
        expect(body.model).toBe(FALLBACK_MODEL);
        return chatCompletion(fixture("valid.json"));
      }),
    );

    const client = createOpenRouterClient(baseConfig());
    const result = await client.generate(answers);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.model).toBe(FALLBACK_MODEL);
    expect(result.attempts).toEqual([
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "http-error", status: 500 }),
      expect.objectContaining({ model: FALLBACK_MODEL, outcome: "ok" }),
    ]);
  });

  it("falls back to the fallback model when the primary times out", async () => {
    server.use(
      mockOpenRouterChat(async ({ body, callIndex }) => {
        if (callIndex === 1) {
          expect(body.model).toBe(PRIMARY_MODEL);
          await delay(300);
          return chatCompletion(fixture("valid.json"));
        }
        expect(body.model).toBe(FALLBACK_MODEL);
        return chatCompletion(fixture("valid.json"));
      }),
    );

    const client = createOpenRouterClient(baseConfig({ timeoutMs: 50 }));
    const result = await client.generate(answers);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.model).toBe(FALLBACK_MODEL);
    expect(result.attempts).toEqual([
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "timeout" }),
      expect.objectContaining({ model: FALLBACK_MODEL, outcome: "ok" }),
    ]);
  });

  it("returns ok: false with every attempt when the whole ladder fails", async () => {
    server.use(
      mockOpenRouterChat(({ callIndex }) => {
        if (callIndex === 1) {
          // Primary, first try: schema failure (correctable).
          return chatCompletion(fixture("wrong-shape.json"));
        }
        if (callIndex === 2) {
          // Primary, correction retry: still broken (truncated JSON).
          return chatCompletion(fixture("malformed.txt"));
        }
        // Fallback: HTTP error.
        return HttpResponse.json({ error: "server error" }, { status: 503 });
      }),
    );

    const client = createOpenRouterClient(baseConfig());
    const result = await client.generate(answers);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0]).toEqual(
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "schema" }),
    );
    expect(result.attempts[1]).toEqual(
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "no-json" }),
    );
    expect(result.attempts[2]).toEqual(
      expect.objectContaining({ model: FALLBACK_MODEL, outcome: "http-error", status: 503 }),
    );
  });

  it("joins an array-of-parts message content into a single string", async () => {
    const content = fixture("valid.json");

    server.use(
      mockOpenRouterChat(() =>
        HttpResponse.json({
          choices: [
            {
              message: {
                content: [
                  { type: "text", text: content.slice(0, 20) },
                  { type: "text", text: content.slice(20) },
                ],
              },
            },
          ],
        }),
      ),
    );

    const client = createOpenRouterClient(baseConfig());
    const result = await client.generate(answers);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conceptTitle).toBe("Atardecer Dorado entre Viñedos de Ezequiel Montes");
  });
});
