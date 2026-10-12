import { HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { mockOpenRouterChat } from "../../../test/msw/handlers";
import { server } from "../../../test/msw/server";
import { createStructuredClient, type ChatMessage, type OpenRouterConfig } from "./structured";

const TestSchema = z
  .object({
    id: z.string().min(1),
    score: z.number().min(0).max(1),
  })
  .strict();

const TEST_JSON_SCHEMA = z.toJSONSchema(TestSchema) as Record<string, unknown>;

const PRIMARY_MODEL = "qwen/qwen-2.5-72b-instruct";
const FALLBACK_MODEL = "deepseek/deepseek-chat";

function baseConfig(overrides: Partial<OpenRouterConfig> = {}): OpenRouterConfig {
  return {
    apiKey: "test-key",
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    timeoutMs: 8000,
    appUrl: "http://localhost:3000",
    appTitle: "Querétaro Romance",
    ...overrides,
  };
}

const messages: ChatMessage[] = [
  { role: "system", content: "You are a test." },
  { role: "user", content: "Return the test object." },
];

function chatCompletion(content: string) {
  return HttpResponse.json({ choices: [{ message: { content } }] });
}

function buildClient(overrides: Partial<OpenRouterConfig> = {}) {
  return createStructuredClient({
    config: baseConfig(overrides),
    schema: TestSchema,
    jsonSchema: TEST_JSON_SCHEMA,
    name: "test_object",
  });
}

describe("createStructuredClient", () => {
  it("happy path: succeeds on the primary model with the configured request shape", async () => {
    let capturedBody: Record<string, unknown> | undefined;

    server.use(
      mockOpenRouterChat(({ body }) => {
        capturedBody = body;
        return chatCompletion(JSON.stringify({ id: "v_1", score: 0.9 }));
      }),
    );

    const client = buildClient();
    const result = await client.generate(messages);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.model).toBe(PRIMARY_MODEL);
    expect(result.value).toEqual({ id: "v_1", score: 0.9 });
    expect(result.attempts).toEqual([
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "ok", status: 200 }),
    ]);

    expect(capturedBody?.model).toBe(PRIMARY_MODEL);
    expect(capturedBody?.temperature).toBe(0.3);
    expect(capturedBody?.max_tokens).toBe(1500);
    expect(capturedBody?.response_format).toEqual({
      type: "json_schema",
      json_schema: expect.objectContaining({ name: "test_object", strict: true }),
    });
  });

  it("respects custom temperature and maxTokens", async () => {
    let capturedBody: Record<string, unknown> | undefined;

    server.use(
      mockOpenRouterChat(({ body }) => {
        capturedBody = body;
        return chatCompletion(JSON.stringify({ id: "v_1", score: 0.5 }));
      }),
    );

    const client = createStructuredClient({
      config: baseConfig(),
      schema: TestSchema,
      jsonSchema: TEST_JSON_SCHEMA,
      name: "test_object",
      temperature: 0.1,
      maxTokens: 400,
    });

    const result = await client.generate(messages);
    expect(result.ok).toBe(true);
    expect(capturedBody?.temperature).toBe(0.1);
    expect(capturedBody?.max_tokens).toBe(400);
  });

  it("retries the primary model with a correction turn after a schema failure, then succeeds", async () => {
    const bodies: Record<string, unknown>[] = [];

    server.use(
      mockOpenRouterChat(({ body, callIndex }) => {
        bodies.push(body);
        if (callIndex === 1) {
          return chatCompletion(JSON.stringify({ id: "v_1", score: 5 })); // out of range: schema failure
        }
        return chatCompletion(JSON.stringify({ id: "v_1", score: 0.7 }));
      }),
    );

    const client = buildClient();
    const result = await client.generate(messages);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.model).toBe(PRIMARY_MODEL);
    expect(result.value).toEqual({ id: "v_1", score: 0.7 });
    expect(result.attempts).toEqual([
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "schema" }),
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "ok" }),
    ]);

    expect(bodies).toHaveLength(2);
    const correctionMessages = bodies[1]?.messages as Array<{ role: string; content: string }>;
    expect(correctionMessages).toHaveLength(messages.length + 2);
    expect(correctionMessages.at(-2)?.role).toBe("assistant");
    expect(correctionMessages.at(-1)?.role).toBe("user");
    expect(correctionMessages.at(-1)?.content).toContain(
      "Tu respuesta anterior no cumplió el esquema",
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
        return chatCompletion(JSON.stringify({ id: "v_2", score: 0.3 }));
      }),
    );

    const client = buildClient();
    const result = await client.generate(messages);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.model).toBe(FALLBACK_MODEL);
    expect(result.value).toEqual({ id: "v_2", score: 0.3 });
    expect(result.attempts).toEqual([
      expect.objectContaining({ model: PRIMARY_MODEL, outcome: "http-error", status: 500 }),
      expect.objectContaining({ model: FALLBACK_MODEL, outcome: "ok" }),
    ]);
  });

  it("returns ok: false with every attempt when the whole ladder fails", async () => {
    server.use(
      mockOpenRouterChat(({ callIndex }) => {
        if (callIndex === 1) {
          return chatCompletion(JSON.stringify({ id: "v_1", score: 5 })); // schema failure
        }
        if (callIndex === 2) {
          return chatCompletion("not json at all, truncated"); // no-json
        }
        return HttpResponse.json({ error: "server error" }, { status: 503 });
      }),
    );

    const client = buildClient();
    const result = await client.generate(messages);

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
});
