// runtime/gemini.ts
//
// Google AI Studio (Gemini) narrative adapter — same request/response contract
// as runtime/claude.ts so callers stay provider-agnostic.
//
// Scope: currently used ONLY by the regulation-reader distillation endpoint
// (BANK_DISTILL_PROVIDER=gemini). All other narrative paths stay on Claude.
// Rationale: Gemini 2.5 Flash is ~10× cheaper per token than Sonnet for this
// high-volume, low-stakes clustering task, and AI Studio's free tier covers
// build-phase volumes. Distillation sends only PUBLISHED regulation text
// (Plane A reference data) — no client or bank-internal data.
//
// No SDK dependency — plain fetch against the generateContent REST API.
// Native JSON mode (responseMimeType: application/json) is requested so the
// caller's JSON.parse never sees markdown fences.
//
// Authority: D-REGULATORY-ARCHITECTURE-TWO-PLANE (distill flow, PR #1242);
// CEO build-phase engineering decision (Marc, session 2026-06-11).
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { NarrativeRequest, NarrativeResponse } from "./claude";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_MAX_TOKENS = 8192;

/** Resolved per call so tests can swap models via env. */
function geminiModel(): string {
  return process.env.BANK_GEMINI_MODEL || DEFAULT_MODEL;
}

/** True when a Google AI Studio key is configured. */
export function geminiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Minimal subset of the generateContent response we consume.
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

/** Injectable fetch for tests. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Build the generateContent request body from a NarrativeRequest.
 * Exported for unit tests (request-shaping assertions without a live call).
 */
export function buildGeminiRequestBody(req: NarrativeRequest): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: req.stableSystem }] },
    contents: [{ role: "user", parts: [{ text: req.userInput }] }],
    generationConfig: {
      maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      // Native JSON mode — the model returns a parseable JSON document with
      // no markdown fences. All current callers expect JSON output.
      responseMimeType: "application/json",
    },
  };
}

/** Backoff schedule for retryable failures (503 demand spikes, 429, network). */
const RETRY_DELAYS_MS = [2_000, 5_000];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Generate a narrative via Gemini. Same result envelope as
 * `tryGenerateNarrative` in runtime/claude.ts:
 *   { ok: true, result } | { ok: false, error, retryable }
 *
 * 401/403/400-API_KEY_INVALID → retryable:false (key problem);
 * 429/5xx/network → retryable:true, retried in-call with backoff
 * (AI Studio free tier sheds load with transient 503 "high demand"
 * responses — observed clearing within seconds).
 */
export async function tryGenerateNarrativeGemini(
  req: NarrativeRequest,
  fetchImpl: FetchLike = fetch,
  retryDelaysMs: readonly number[] = RETRY_DELAYS_MS,
): Promise<
  { ok: true; result: NarrativeResponse } | { ok: false; error: string; retryable: boolean }
> {
  let last = await tryGenerateNarrativeGeminiOnce(req, fetchImpl);
  for (const delay of retryDelaysMs) {
    if (last.ok || !last.retryable) return last;
    await sleep(delay);
    last = await tryGenerateNarrativeGeminiOnce(req, fetchImpl);
  }
  return last;
}

async function tryGenerateNarrativeGeminiOnce(
  req: NarrativeRequest,
  fetchImpl: FetchLike,
): Promise<
  { ok: true; result: NarrativeResponse } | { ok: false; error: string; retryable: boolean }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY not set; Gemini API unavailable", retryable: false };
  }

  const model = geminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let resp: Response;
  try {
    resp = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Key travels in a header, never in the URL — keeps it out of logs.
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(buildGeminiRequestBody(req)),
    });
  } catch (e) {
    return { ok: false, error: `network error: ${(e as Error).message}`, retryable: true };
  }

  if (!resp.ok) {
    const bodyText = await resp.text().catch(() => "");
    const authFailure =
      resp.status === 401 || resp.status === 403 || bodyText.includes("API_KEY_INVALID");
    if (authFailure) {
      return {
        ok: false,
        error: `auth failed (check GEMINI_API_KEY): ${resp.status} ${bodyText.slice(0, 300)}`,
        retryable: false,
      };
    }
    return {
      ok: false,
      error: `Gemini API error ${resp.status}: ${bodyText.slice(0, 300)}`,
      // 429 rate-limit and 5xx are transient; other 4xx are caller bugs but
      // surfaced the same way — the distill UI shows the message either way.
      retryable: resp.status === 429 || resp.status >= 500,
    };
  }

  let data: GeminiResponse;
  try {
    data = (await resp.json()) as GeminiResponse;
  } catch {
    return { ok: false, error: "Gemini returned non-JSON response body", retryable: true };
  }

  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (!text) {
    return {
      ok: false,
      error: `Gemini returned no text (finishReason: ${candidate?.finishReason ?? "unknown"})`,
      retryable: false,
    };
  }

  return {
    ok: true,
    result: {
      text,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      stopReason: candidate?.finishReason ?? null,
      model,
    },
  };
}
