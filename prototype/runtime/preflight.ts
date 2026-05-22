// runtime/preflight.ts
//
// Realistic credit-balance preflight probe for Claude API workloads.
//
// Closes GAP-PREFLIGHT-PROBE-SIZE from Mira's WS-ONTOLOGY-REG-EXTRACTION
// Phase 1 outcome card (2026-05-22). Phase 1 used a 1-token preflight
// ping; that passes whenever the account has any non-zero credit, so it
// gave false confidence — the first real ~5k-input/~500-output call then
// failed with `credit balance too low`. We discovered this empirically
// after burning ~10 min of wall-clock on retries.
//
// `preflightForWorkload` sends one synthetic call sized roughly like the
// actual workload (typical-call input + typical-call max-output) and
// reports back a typed result so callers can exit cleanly with a useful
// error before the bulk run starts.
//
// The probe is intentionally a *real* API call: only a live call exposes
// the credit-balance error (the SDK has no balance endpoint). The
// synthetic input is opaque regulatory-style filler so the response is
// short and predictable; we don't keep the model output.
//
// Author: Atlas (Core banking platform architect, engineering).
// Origin: GAP-PREFLIGHT-PROBE-SIZE — Mira's outcome card (close event
// 2d4becd6-8ab2-4eff-bc17-47229ed956ab).

import Anthropic from "@anthropic-ai/sdk";

import { logger } from "../platform/observability/logger";
import { claudeAvailable } from "./claude";

const DEFAULT_PROBE_MODEL = "claude-haiku-4-5";

export type PreflightFailureReason =
  | "credit_too_low"
  | "auth_failed"
  | "overloaded"
  | "key_missing"
  | "other";

export type PreflightResult =
  | { ok: true; model: string; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; reason: PreflightFailureReason; detail: string };

export interface PreflightWorkloadOpts {
  /**
   * Model the bulk workload will run against. Use the *same* model here:
   * credit pricing differs per model, and an Opus probe succeeding does
   * not guarantee a Haiku run will (or vice versa, since Opus calls
   * burn ~20× the credits).
   */
  readonly model: string;

  /**
   * Roughly how many input tokens a typical call in the workload sends.
   * The probe shapes its synthetic input to match (±20%).
   */
  readonly estimatedInputTokens: number;

  /**
   * Roughly how many output tokens a typical call generates. Passed as
   * `max_tokens` on the probe so the response budget is the same shape
   * as the real workload — the credit gate fires on `input + max_output`.
   */
  readonly estimatedOutputTokens: number;

  /**
   * How many calls the bulk run plans to make. Not used to gate the
   * probe (one probe call is sufficient signal), but echoed back in
   * detail strings so the caller can log a budget estimate alongside.
   */
  readonly expectedCallCount: number;
}

// Roughly 4 chars per token is the rule-of-thumb the SDK uses for
// English text. Regulatory boilerplate skews slightly higher density
// (~3.8 c/t) but 4 is fine for sizing — the probe is not a precise
// token counter, just a workload-shape simulator.
const CHARS_PER_TOKEN = 4;

// A ~250-token block of generic regulatory-style boilerplate. Repeated
// to fill the probe input. Deliberately content-free so the probe never
// nudges the model toward a long completion — we want short, deterministic
// output that exercises the credit gate, not interesting reasoning.
const BOILERPLATE_PARAGRAPH = [
  "In accordance with the provisions set forth herein, the responsible",
  "authority shall ensure that all material obligations imposed by the",
  "relevant statutory framework, including but not limited to the",
  "regulations, board notices, conduct standards, joint standards, and",
  "any guidance notices issued by the supervisory body from time to time,",
  "are observed, recorded, and reconciled against the institution's",
  "policy register at intervals not exceeding those prescribed by the",
  "applicable directive. For the avoidance of doubt, nothing in this",
  "section shall be construed so as to derogate from the obligations",
  "arising under any other enactment binding upon the institution, nor",
  "shall the institution rely on this section to discharge an obligation",
  "that is more onerous under such other enactment. Where a conflict",
  "appears between this section and a higher-ranking instrument, the",
  "higher-ranking instrument prevails; the institution shall record the",
  "conflict in its obligations register and notify the supervisory body",
  "of the resolution adopted, together with any reasons therefor.",
].join(" ");

/**
 * Build synthetic input text approximating `estimatedInputTokens`. The
 * shape is what matters — content is opaque boilerplate.
 */
export function buildProbeInput(estimatedInputTokens: number): string {
  const targetChars = Math.max(100, estimatedInputTokens * CHARS_PER_TOKEN);
  const blocks: string[] = [];
  let chars = 0;
  while (chars < targetChars) {
    blocks.push(BOILERPLATE_PARAGRAPH);
    chars += BOILERPLATE_PARAGRAPH.length + 2;
  }
  // Short instruction at the end so the model has something to respond
  // to. Keeping the requested output trivial limits the probe's own
  // credit cost on success.
  return `${blocks.join("\n\n")}\n\nReply with the single word: OK.`;
}

/**
 * Classify a thrown SDK error into a `PreflightFailureReason`.
 * Exported so the unit tests can exercise the mapping without a live API.
 */
export function classifyPreflightError(err: unknown): {
  reason: PreflightFailureReason;
  detail: string;
} {
  if (err instanceof Anthropic.AuthenticationError) {
    return { reason: "auth_failed", detail: `auth failed (401): ${err.message}` };
  }

  // Credit-balance-too-low is returned as a 400 BadRequestError. The
  // SDK does not expose a typed code for it; match on the message body
  // (the only stable signal the API gives). This is the canonical text
  // Mira hit on 2026-05-22.
  if (err instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(err.message)) {
      return {
        reason: "credit_too_low",
        detail: `credit balance too low: ${err.message}`,
      };
    }
    return { reason: "other", detail: `bad request (400): ${err.message}` };
  }

  // Overloaded — Anthropic returns either 529 (Overloaded) or sets
  // `error.type === "overloaded_error"` on the body. Both paths arrive
  // as an APIError subclass without a dedicated SDK class. Treat 529 +
  // type match as overloaded; everything else 5xx is generic "other".
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    const errType = err.type;
    if (status === 529 || errType === "overloaded_error") {
      return {
        reason: "overloaded",
        detail: `overloaded (${status ?? "?"}): ${err.message}`,
      };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { reason: "overloaded", detail: `rate limited (429): ${err.message}` };
    }
    return {
      reason: "other",
      detail: `api error ${status ?? "?"}: ${err.message}`,
    };
  }

  return { reason: "other", detail: (err as Error)?.message ?? String(err) };
}

/**
 * Probe the Claude API with a single call sized to roughly the workload's
 * typical-call shape. On success returns `{ ok: true }`. On failure returns
 * `{ ok: false, reason, detail }` so the caller can exit with a useful
 * message — no exceptions cross the boundary.
 *
 * The probe is real (it consumes ~`estimatedInputTokens` of credit). The
 * cost trade-off is intentional: a 5k-token Haiku preflight is ~$0.004,
 * which is the right price to pay to avoid 11 instruments × N sections of
 * failed extraction work.
 *
 * Choose a model that matches the bulk workload. Probing Opus when the
 * workload runs on Haiku tells you nothing about the credit gate (Opus
 * is ~20× more expensive per token).
 */
export async function preflightForWorkload(opts: PreflightWorkloadOpts): Promise<PreflightResult> {
  if (!claudeAvailable()) {
    return {
      ok: false,
      reason: "key_missing",
      detail: "ANTHROPIC_API_KEY not set; cannot probe.",
    };
  }

  const model = opts.model || DEFAULT_PROBE_MODEL;
  const probeInput = buildProbeInput(opts.estimatedInputTokens);
  // Bound the probe's output budget to the workload's typical output
  // size; never below 16 (the API requires a non-trivial floor) and
  // never above 1024 (probes should not burn budget on long completions).
  const maxTokens = Math.max(16, Math.min(opts.estimatedOutputTokens, 1024));

  // The probe creates its own client rather than reusing claude.ts's
  // cached one, so that test seams can mock Anthropic at the SDK level
  // without poisoning the shared client. The cost is one extra ctor
  // per workload — negligible.
  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: probeInput }],
    });

    logger.debug(
      {
        model: response.model,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        expectedCallCount: opts.expectedCallCount,
      },
      "preflight probe succeeded",
    );

    return {
      ok: true,
      model: response.model,
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (err) {
    const classified = classifyPreflightError(err);
    logger.warn(
      {
        reason: classified.reason,
        detail: classified.detail,
        model,
        expectedCallCount: opts.expectedCallCount,
      },
      "preflight probe failed",
    );
    return { ok: false, reason: classified.reason, detail: classified.detail };
  }
}

/**
 * Convenience: format a `PreflightResult` failure as a multi-line message
 * suitable for `console.error`. Pipeline scripts use this to exit cleanly
 * with a useful operator-facing error.
 */
export function formatPreflightFailure(
  result: Extract<PreflightResult, { ok: false }>,
  opts: PreflightWorkloadOpts,
): string {
  const reasonLine = (() => {
    switch (result.reason) {
      case "credit_too_low":
        return "Anthropic credit balance is too low for the planned workload.";
      case "auth_failed":
        return "Anthropic API authentication failed (check ANTHROPIC_API_KEY).";
      case "overloaded":
        return "Anthropic API is overloaded; retry later.";
      case "key_missing":
        return "ANTHROPIC_API_KEY is not set on this runner.";
      case "other":
        return "Anthropic preflight probe failed (see detail).";
    }
  })();
  return [
    `Preflight FAILED — ${reasonLine}`,
    `  Model:               ${opts.model}`,
    `  Est. input tokens:   ${opts.estimatedInputTokens}/call`,
    `  Est. output tokens:  ${opts.estimatedOutputTokens}/call`,
    `  Expected call count: ${opts.expectedCallCount}`,
    `  Detail:              ${result.detail}`,
    "  Aborting bulk work before any budget is spent.",
  ].join("\n");
}
