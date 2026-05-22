// tests/preflight.test.ts
//
// Unit tests for `runtime/preflight.ts` — exercise the synthetic-input
// builder and the error-classification logic without hitting the live
// Anthropic API.
//
// The live-API integration is covered by `preflight.integration.test.ts`,
// which is gated on ANTHROPIC_API_KEY.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import Anthropic from "@anthropic-ai/sdk";

import {
  buildProbeInput,
  classifyPreflightError,
  formatPreflightFailure,
} from "../runtime/preflight";

// ---------------------------------------------------------------------------
// buildProbeInput — shapes synthetic input to roughly N tokens (≈4 c/t)
// ---------------------------------------------------------------------------

describe("buildProbeInput", () => {
  it("produces an input of roughly the target token size (±20% in chars)", () => {
    const target = 5_000;
    const text = buildProbeInput(target);
    const targetChars = target * 4;
    // The loop appends whole boilerplate blocks, so the actual length
    // slightly overshoots the target — that's intentional. Within +25%
    // (one block worth) is the expected envelope.
    expect(text.length).toBeGreaterThanOrEqual(targetChars);
    expect(text.length).toBeLessThanOrEqual(targetChars * 1.25);
  });

  it("ends with a short imperative so the model returns a short reply", () => {
    const text = buildProbeInput(1_000);
    expect(text).toContain("Reply with the single word: OK.");
  });

  it("enforces a non-trivial minimum length even for tiny targets", () => {
    const text = buildProbeInput(1);
    // 100 char floor so the probe is never absurdly small (which the
    // API may reject for a different reason than credit-exhaustion).
    expect(text.length).toBeGreaterThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// classifyPreflightError — map SDK exceptions to PreflightFailureReason
// ---------------------------------------------------------------------------

// Helper: build a Headers stand-in. The SDK accepts a real Headers object.
function emptyHeaders(): Headers {
  return new Headers();
}

describe("classifyPreflightError", () => {
  it("maps a credit-balance BadRequestError to credit_too_low", () => {
    // This is the exact error text Mira hit on 2026-05-22.
    const err = new Anthropic.BadRequestError(
      400,
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message:
            "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
        },
      },
      "Your credit balance is too low to access the Anthropic API.",
      emptyHeaders(),
    );
    const result = classifyPreflightError(err);
    expect(result.reason).toBe("credit_too_low");
    expect(result.detail).toContain("credit balance");
  });

  it("maps an AuthenticationError to auth_failed", () => {
    const err = new Anthropic.AuthenticationError(
      401,
      { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
      "invalid x-api-key",
      emptyHeaders(),
    );
    const result = classifyPreflightError(err);
    expect(result.reason).toBe("auth_failed");
    expect(result.detail).toContain("401");
  });

  it("maps a non-credit BadRequestError to other", () => {
    const err = new Anthropic.BadRequestError(
      400,
      { type: "error", error: { type: "invalid_request_error", message: "unknown model" } },
      "unknown model: foo",
      emptyHeaders(),
    );
    const result = classifyPreflightError(err);
    expect(result.reason).toBe("other");
    expect(result.detail).toContain("bad request");
  });

  it("maps a RateLimitError to overloaded", () => {
    const err = new Anthropic.RateLimitError(
      429,
      { type: "error", error: { type: "rate_limit_error", message: "rate limit" } },
      "rate limit exceeded",
      emptyHeaders(),
    );
    const result = classifyPreflightError(err);
    expect(result.reason).toBe("overloaded");
    expect(result.detail).toContain("429");
  });

  it("maps a 529 APIError to overloaded", () => {
    const err = new Anthropic.APIError(
      529,
      { type: "error", error: { type: "overloaded_error", message: "overloaded" } },
      "overloaded",
      emptyHeaders(),
      "overloaded_error",
    );
    const result = classifyPreflightError(err);
    expect(result.reason).toBe("overloaded");
  });

  it("maps an InternalServerError (500) without overloaded type to other", () => {
    const err = new Anthropic.InternalServerError(
      500,
      { type: "error", error: { type: "api_error", message: "internal error" } },
      "internal error",
      emptyHeaders(),
    );
    const result = classifyPreflightError(err);
    expect(result.reason).toBe("other");
    expect(result.detail).toContain("500");
  });

  it("falls back to other for non-SDK errors", () => {
    const result = classifyPreflightError(new Error("network down"));
    expect(result.reason).toBe("other");
    expect(result.detail).toContain("network down");
  });
});

// ---------------------------------------------------------------------------
// formatPreflightFailure — human-readable multi-line message
// ---------------------------------------------------------------------------

describe("formatPreflightFailure", () => {
  const opts = {
    model: "claude-haiku-4-5",
    estimatedInputTokens: 5_000,
    estimatedOutputTokens: 500,
    expectedCallCount: 60,
  };

  it("renders a credit_too_low result with all workload fields", () => {
    const msg = formatPreflightFailure(
      { ok: false, reason: "credit_too_low", detail: "credit balance too low" },
      opts,
    );
    expect(msg).toContain("Anthropic credit balance is too low");
    expect(msg).toContain("claude-haiku-4-5");
    expect(msg).toContain("5000");
    expect(msg).toContain("500");
    expect(msg).toContain("60");
    expect(msg).toContain("credit balance too low");
  });

  it("renders auth_failed with the auth-specific reason line", () => {
    const msg = formatPreflightFailure(
      { ok: false, reason: "auth_failed", detail: "401: invalid key" },
      opts,
    );
    expect(msg).toContain("authentication failed");
    expect(msg).toContain("ANTHROPIC_API_KEY");
  });

  it("renders overloaded with the transient hint", () => {
    const msg = formatPreflightFailure(
      { ok: false, reason: "overloaded", detail: "529: overloaded" },
      opts,
    );
    expect(msg).toContain("overloaded");
    expect(msg).toContain("retry later");
  });
});
