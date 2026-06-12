// runtime/gemini.test.ts
//
// Request-shaping + error-mapping coverage for the Gemini adapter.
// No live API call — fetch is injected. CI stays green with no GEMINI_API_KEY.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { buildGeminiRequestBody, geminiAvailable, tryGenerateNarrativeGemini } from "./gemini";

const REQ = {
  stableSystem: "You are a regulatory distiller.",
  userInput: "Cluster these provisions.",
  maxTokens: 1024,
} as const;

let savedKey: string | undefined;
let savedModel: string | undefined;

beforeEach(() => {
  savedKey = process.env.GEMINI_API_KEY;
  savedModel = process.env.BANK_GEMINI_MODEL;
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = savedKey;
  if (savedModel === undefined) delete process.env.BANK_GEMINI_MODEL;
  else process.env.BANK_GEMINI_MODEL = savedModel;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("geminiAvailable", () => {
  it("reflects GEMINI_API_KEY presence", () => {
    delete process.env.GEMINI_API_KEY;
    expect(geminiAvailable()).toBe(false);
    process.env.GEMINI_API_KEY = "AIza-test";
    expect(geminiAvailable()).toBe(true);
  });
});

describe("buildGeminiRequestBody", () => {
  it("places system text in systemInstruction and user text in contents, with JSON mode", () => {
    const body = buildGeminiRequestBody(REQ) as {
      systemInstruction: { parts: Array<{ text: string }> };
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      generationConfig: { maxOutputTokens: number; responseMimeType: string };
    };
    expect(body.systemInstruction.parts[0]?.text).toBe(REQ.stableSystem);
    expect(body.contents[0]?.role).toBe("user");
    expect(body.contents[0]?.parts[0]?.text).toBe(REQ.userInput);
    expect(body.generationConfig.maxOutputTokens).toBe(1024);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });
});

describe("tryGenerateNarrativeGemini", () => {
  it("fails non-retryable when no key is set", async () => {
    delete process.env.GEMINI_API_KEY;
    const r = await tryGenerateNarrativeGemini(REQ);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryable).toBe(false);
      expect(r.error).toContain("GEMINI_API_KEY");
    }
  });

  it("sends the key in the x-goog-api-key header, never the URL", async () => {
    process.env.GEMINI_API_KEY = "AIza-test-key";
    let seenUrl = "";
    let seenHeaders: Record<string, string> = {};
    const r = await tryGenerateNarrativeGemini(REQ, async (url, init) => {
      seenUrl = url;
      seenHeaders = init.headers as Record<string, string>;
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: "[]" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 },
      });
    });
    expect(r.ok).toBe(true);
    expect(seenUrl).not.toContain("AIza-test-key");
    expect(seenHeaders["x-goog-api-key"]).toBe("AIza-test-key");
  });

  it("maps a successful response to the NarrativeResponse shape", async () => {
    process.env.GEMINI_API_KEY = "AIza-test-key";
    process.env.BANK_GEMINI_MODEL = "gemini-2.5-flash-lite";
    const r = await tryGenerateNarrativeGemini(REQ, async () =>
      jsonResponse({
        candidates: [
          { content: { parts: [{ text: '[{"a":' }, { text: "1}]" }] }, finishReason: "STOP" },
        ],
        usageMetadata: { promptTokenCount: 42, candidatesTokenCount: 7 },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.text).toBe('[{"a":1}]');
      expect(r.result.usage.inputTokens).toBe(42);
      expect(r.result.usage.outputTokens).toBe(7);
      expect(r.result.stopReason).toBe("STOP");
      expect(r.result.model).toBe("gemini-2.5-flash-lite");
    }
  });

  it("maps 400 API_KEY_INVALID and 403 to non-retryable auth failures", async () => {
    process.env.GEMINI_API_KEY = "AIza-bad";
    const r400 = await tryGenerateNarrativeGemini(
      REQ,
      async () =>
        new Response(
          JSON.stringify({ error: { status: "INVALID_ARGUMENT", message: "API_KEY_INVALID" } }),
          {
            status: 400,
          },
        ),
    );
    expect(r400.ok).toBe(false);
    if (!r400.ok) {
      expect(r400.retryable).toBe(false);
      expect(r400.error).toContain("GEMINI_API_KEY");
    }

    const r403 = await tryGenerateNarrativeGemini(
      REQ,
      async () => new Response("forbidden", { status: 403 }),
    );
    expect(r403.ok).toBe(false);
    if (!r403.ok) expect(r403.retryable).toBe(false);
  });

  it("maps 429 and 5xx to retryable failures", async () => {
    process.env.GEMINI_API_KEY = "AIza-test-key";
    const r429 = await tryGenerateNarrativeGemini(
      REQ,
      async () => new Response("rate limited", { status: 429 }),
    );
    expect(r429.ok).toBe(false);
    if (!r429.ok) expect(r429.retryable).toBe(true);

    const r503 = await tryGenerateNarrativeGemini(
      REQ,
      async () => new Response("overloaded", { status: 503 }),
    );
    expect(r503.ok).toBe(false);
    if (!r503.ok) expect(r503.retryable).toBe(true);
  });

  it("fails non-retryable when the model returns no text (e.g. SAFETY stop)", async () => {
    process.env.GEMINI_API_KEY = "AIza-test-key";
    const r = await tryGenerateNarrativeGemini(REQ, async () =>
      jsonResponse({ candidates: [{ finishReason: "SAFETY" }] }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryable).toBe(false);
      expect(r.error).toContain("SAFETY");
    }
  });
});
