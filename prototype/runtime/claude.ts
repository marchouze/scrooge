// runtime/claude.ts
//
// Thin Anthropic SDK wrapper for the agent runtime. Closes the substrate
// gap Atlas surfaces in his weekly snapshot ("Claude API integration for
// agent-narrative output not yet wired") so agent handlers can produce
// substantive narrative on top of mechanical observations — recon
// summaries, regulatory-change deltas, dashboard interpretations.
//
// Design rules:
// - SDK over raw HTTP (TypeScript project).
// - Prompt caching is mandatory. Persona spec is the stable prefix
//   (cached); per-run inputs are appended after the cache breakpoint.
//   See `shared/prompt-caching.md`.
// - Default model: claude-opus-4-7. Adaptive thinking on by default
//   (off-by-default on 4.7 — opt in here for narrative quality).
// - Streaming for any narrative > short summary, so we don't hit SDK
//   HTTP timeouts on long outputs.
// - Typed exceptions, not message-string matching.
// - Optional / dry-run-safe: handlers can call `claudeAvailable()` and
//   degrade gracefully when ANTHROPIC_API_KEY is unset (e.g. on a fresh
//   GitHub Actions runner without the secret configured).
//
// Substrate boundary (M8): the SDK call works on any host with the API
// key and outbound HTTPS. Post-cloud-lift, the key moves to Azure Key
// Vault; the surface here doesn't change. Per Senna / Rashida: the key
// is loaded from env only — never logged, never written to events,
// never echoed in deliverables.
//
// Author: Atlas (substrate plumbing) · Senna (security review at next
// threat-model gate cycle).

import Anthropic from "@anthropic-ai/sdk";

import { clock, eventStore } from "../platform/composition";
import { makeTokenUsageRecorded } from "../platform/event-store/event-types/agent-ops";
import { logger } from "../platform/observability/logger";

const DEFAULT_MODEL = "claude-opus-4-7";
const DEFAULT_MAX_TOKENS_STREAMING = 64_000;
// CLAUDE_MODEL env override is intentional — Marc may want to dial down
// to claude-sonnet-4-6 or claude-haiku-4-5 for budget reasons (S6).
// Effort + thinking depth are the other levers.
const MODEL = process.env.BANK_CLAUDE_MODEL ?? DEFAULT_MODEL;

// GAP-OVERLOADED-VS-CREDIT-EXHAUSTED (Mira, 2026-05-22): haiku surfaces
// credit-balance-exhausted as `overloaded_error`, indistinguishable from
// a genuine capacity overload. After N consecutive overload failures with
// no successful intervening call, we silently probe a cheap call against
// a different model to disambiguate. Sonnet/opus correctly return a
// `billing_error` / "credit balance is too low" body, so a probe failure
// of that shape proves the account — not the model — is the problem.
const OVERLOAD_PROBE_THRESHOLD = 3;
const PROBE_MAX_TOKENS = 8;

// ---------------------------------------------------------------------------
// Model capability matrix
// ---------------------------------------------------------------------------
//
// Source of truth: https://docs.anthropic.com/en/docs/about-claude/models/overview
// Last reconciled with docs: 2026-05-22. The unit test in `claude.test.ts`
// pins this date and asserts the matrix shape; when Anthropic publishes new
// capability rows update both the matrix and the cutoff string together.
//
// Why this exists: PR #733 added an ad-hoc `/haiku/i` regex to drop the
// `thinking` + `output_config.effort` params when calling Haiku — Haiku
// models reject both with HTTP 400, but Opus/Sonnet accept them. The
// regex works for the single capability gap that pushed it in, but every
// new model release that supports/rejects a param needs another patch.
// The matrix gives every capability a typed cell so the runtime branches
// on data, not on string matching.
//
// `supportsThinking` here means "supports the `thinking: { type: 'adaptive' }`
// request parameter as currently used in `generateNarrative`". Per the
// 2026-05-22 docs, Adaptive thinking is a 4.6+ feature; Haiku 4.5 supports
// Extended thinking (`type: "enabled"`) but rejects Adaptive — so haiku
// rows are `false` here. If the runtime later adds an Extended-thinking
// code path it gets its own flag.
//
// `supportsEffort` reflects `output_config.effort`. Haiku 4.5 rejects this
// with a 400 (observed live during Mira's WS-ONTOLOGY-REG-EXTRACTION run
// on 2026-05-22; PR #733). Legacy models (Sonnet 4.5) predate the param
// and are conservatively `false`.

export interface ModelCapabilities {
  /** Supports `thinking: { type: "adaptive" }` as currently used by `generateNarrative`. */
  readonly supportsThinking: boolean;
  /** Supports `output_config: { effort: ... }`. */
  readonly supportsEffort: boolean;
  /** Max output tokens (synchronous Messages API; Batch API beta can extend). */
  readonly maxOutputTokens: number;
  /** Supports tool use / function calling. */
  readonly supportsToolUse: boolean;
  /** Supports image / vision input. */
  readonly supportsVision: boolean;
  /** USD per 1M input tokens (Claude API list price; ignores cache + batch). */
  readonly inputPer1M: number;
  /** USD per 1M output tokens. */
  readonly outputPer1M: number;
}

/** Date of last reconciliation against Anthropic's model docs. */
export const MODEL_CAPABILITIES_CUTOFF = "2026-05-22";

export const MODEL_CAPABILITIES = {
  "claude-opus-4-7": {
    supportsThinking: true,
    supportsEffort: true,
    maxOutputTokens: 128_000,
    supportsToolUse: true,
    supportsVision: true,
    inputPer1M: 5.0,
    outputPer1M: 25.0,
  },
  "claude-sonnet-4-6": {
    supportsThinking: true,
    supportsEffort: true,
    maxOutputTokens: 64_000,
    supportsToolUse: true,
    supportsVision: true,
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  // Legacy. Predates adaptive thinking + output_config.effort (both are 4.6+
  // features per the docs `Latest models comparison` table). Tool use and
  // vision were supported from the 4.x line onward.
  "claude-sonnet-4-5": {
    supportsThinking: false,
    supportsEffort: false,
    maxOutputTokens: 64_000,
    supportsToolUse: true,
    supportsVision: true,
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  "claude-haiku-4-5": {
    supportsThinking: false,
    supportsEffort: false,
    maxOutputTokens: 64_000,
    supportsToolUse: true,
    supportsVision: true,
    inputPer1M: 1.0,
    outputPer1M: 5.0,
  },
  // Haiku 4.6 is anticipated; not yet listed in Anthropic's model docs at
  // the 2026-05-22 cutoff. We pre-seed the row with the Haiku 4.5 capability
  // shape so callers that opt in via BANK_CLAUDE_MODEL don't 400 silently.
  // Refresh this row (and `MODEL_CAPABILITIES_CUTOFF`) once the model
  // appears in the docs `Latest models comparison` table.
  "claude-haiku-4-6": {
    supportsThinking: false,
    supportsEffort: false,
    maxOutputTokens: 64_000,
    supportsToolUse: true,
    supportsVision: true,
    inputPer1M: 1.0,
    outputPer1M: 5.0,
  },
} as const satisfies Record<string, ModelCapabilities>;

export type KnownModel = keyof typeof MODEL_CAPABILITIES;

// Conservative fallback when an unknown model id is configured (typo,
// preview model, future release). Drops every advanced param so the call
// at least succeeds; the runtime emits a debug log when this branch fires.
const FALLBACK_CAPABILITIES: ModelCapabilities = {
  supportsThinking: false,
  supportsEffort: false,
  maxOutputTokens: 64_000,
  supportsToolUse: true,
  supportsVision: true,
  inputPer1M: 5.0,
  outputPer1M: 25.0,
};

export function getModelCapabilities(model: string): ModelCapabilities {
  const cap = (MODEL_CAPABILITIES as Record<string, ModelCapabilities | undefined>)[model];
  if (cap) return cap;
  logger.debug({ model }, "model not in capability matrix; using conservative fallback");
  return FALLBACK_CAPABILITIES;
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const { inputPer1M, outputPer1M } = getModelCapabilities(model);
  return (inputTokens * inputPer1M + outputTokens * outputPer1M) / 1_000_000;
}

let cachedClient: Anthropic | null = null;

// Count of consecutive `overloaded_error` failures observed against the
// primary model with no successful intervening call. Reset on any
// successful generation or on a successful disambiguation probe.
let consecutiveOverloadCount = 0;

export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Raised when the Anthropic account's credit balance has been exhausted.
 * Distinguished from a genuine capacity overload so callers know to fail
 * fast rather than retry-with-backoff. Detected directly when the SDK
 * surfaces a `billing_error` / "credit balance is too low" body, or via
 * the disambiguation probe when the primary model is haiku and the body
 * arrives misclassified as `overloaded_error`.
 */
export class ClaudeCreditExhaustedError extends Error {
  override readonly name = "ClaudeCreditExhaustedError";
  readonly originalError: Error | undefined;
  constructor(message: string, originalError?: Error) {
    super(message);
    this.originalError = originalError;
  }
}

function disambiguateOverloadEnabled(): boolean {
  const v = process.env.BANK_CLAUDE_DISAMBIGUATE_OVERLOAD;
  if (v === undefined) return true;
  return v !== "false" && v !== "0";
}

function isOverloadError(e: unknown): boolean {
  if (!(e instanceof Anthropic.APIError)) return false;
  if (e.type === "overloaded_error") return true;
  return e.status === 529;
}

function isCreditExhaustedError(e: unknown): boolean {
  if (!(e instanceof Anthropic.APIError)) return false;
  if (e.type === "billing_error") return true;
  const msg = e.message ?? "";
  return /credit\s+balance\s+is\s+too\s+low/i.test(msg);
}

function pickProbeModel(primaryModel: string): string {
  // Pick a model on different infrastructure from the primary so the
  // probe genuinely disambiguates. Haiku is the model that misclassifies
  // billing as overload; sonnet/opus return the correct body.
  if (primaryModel.includes("haiku")) return "claude-sonnet-4-6";
  if (primaryModel.includes("sonnet")) return "claude-opus-4-7";
  return "claude-sonnet-4-6";
}

/**
 * Decide what to do with an error returned from a primary-model call.
 * Always throws; either re-throws the input, throws a typed
 * `ClaudeCreditExhaustedError`, or surfaces the original overload
 * after a probe.
 *
 * Exported for unit testing; production callers go via
 * `generateNarrative`.
 */
export async function _handleClaudeError(
  e: unknown,
  deps: {
    readonly probe: () => Promise<unknown>;
    readonly disambiguateEnabled?: boolean;
    readonly threshold?: number;
  },
): Promise<never> {
  if (isCreditExhaustedError(e)) {
    consecutiveOverloadCount = 0;
    throw new ClaudeCreditExhaustedError(
      `Anthropic credit balance exhausted: ${(e as Error).message}`,
      e as Error,
    );
  }

  if (!isOverloadError(e)) {
    throw e as Error;
  }

  consecutiveOverloadCount += 1;
  const threshold = deps.threshold ?? OVERLOAD_PROBE_THRESHOLD;
  const enabled = deps.disambiguateEnabled ?? disambiguateOverloadEnabled();
  if (consecutiveOverloadCount < threshold || !enabled) {
    throw e as Error;
  }

  let probeSucceeded = false;
  let probeError: unknown = null;
  try {
    await deps.probe();
    probeSucceeded = true;
  } catch (err) {
    probeError = err;
  }

  if (probeSucceeded) {
    // Reset so we don't probe on every subsequent overload — the next
    // probe requires another `threshold` consecutive failures.
    consecutiveOverloadCount = 0;
    throw e as Error;
  }

  if (isCreditExhaustedError(probeError)) {
    consecutiveOverloadCount = 0;
    throw new ClaudeCreditExhaustedError(
      `Anthropic credit balance exhausted (detected via probe after ${threshold} consecutive overload errors): ${(probeError as Error).message}`,
      probeError as Error,
    );
  }

  // Probe failed for an unrelated reason (e.g. probe model also overloaded,
  // network blip). Surface the original overload so caller retries.
  throw e as Error;
}

/** Test hook: reset the consecutive-overload counter. */
export function _resetOverloadCounterForTests(): void {
  consecutiveOverloadCount = 0;
}

/** Test hook: read the counter. */
export function _getOverloadCounterForTests(): number {
  return consecutiveOverloadCount;
}

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  if (!claudeAvailable()) {
    throw new Error(
      "ANTHROPIC_API_KEY not set; Claude API unavailable. Handlers should check claudeAvailable() first.",
    );
  }
  cachedClient = new Anthropic();
  return cachedClient;
}

export interface NarrativeRequest {
  /**
   * Stable prefix — typically the persona's voice + any frozen context.
   * This is cached aggressively (5-min TTL) so repeated runs of the same
   * agent reuse the prefix at ~10% of the input price.
   *
   * Keep this byte-stable across runs. No timestamps, no UUIDs, no
   * per-request IDs. Memory + persona file content is fine.
   *
   * Per `shared/prompt-caching.md`, the minimum cacheable prefix on
   * Opus 4.7 is 4096 tokens. Shorter prefixes silently won't cache.
   */
  readonly stableSystem: string;

  /**
   * Volatile per-run input — recon results, snapshot data, today's
   * deliverables, the question we want answered. Appended after the
   * cache breakpoint, so byte changes here don't invalidate the cache.
   */
  readonly userInput: string;

  /**
   * Maximum tokens to generate. Defaults to 64K (streaming default).
   * Set lower for short summaries; the model may stop earlier via
   * adaptive thinking even without a low cap.
   */
  readonly maxTokens?: number;

  /**
   * Effort level. `"high"` is the recommended minimum for intelligence-
   * sensitive work on Opus 4.7. `"medium"` for cost-sensitive runs.
   * Defaults to `"high"`.
   */
  readonly effort?: "low" | "medium" | "high" | "xhigh" | "max";

  /**
   * Whether to opt back into summarized thinking display (Opus 4.7 ships
   * thinking content as `omitted` by default). Default `false` — agent
   * runs don't currently surface thinking text. Set `true` if a
   * deliverable wants to show reasoning.
   */
  readonly displayThinking?: boolean;

  /**
   * When provided and dryRun is false, a TokenUsageRecorded event is appended
   * to the event store after the API call. Omit in scripts / dry-run paths.
   */
  readonly meta?: {
    readonly runId: string;
    readonly agent: string;
    readonly dryRun?: boolean;
  };
}

export interface NarrativeResponse {
  /** The generated narrative text (final assistant message). */
  readonly text: string;
  /** Token usage. Logged for cost tracking against S6. */
  readonly usage: {
    readonly inputTokens: number;
    readonly cacheCreationInputTokens: number;
    readonly cacheReadInputTokens: number;
    readonly outputTokens: number;
  };
  /** Why generation stopped — `end_turn` is normal. */
  readonly stopReason: string | null;
  /** Model used for the run. */
  readonly model: string;
}

/**
 * Generate a narrative response from Claude. Streams under the hood and
 * returns the final assembled message via `.finalMessage()`.
 *
 * Prompt-cache structure:
 *   tools (none) → system [cache_control on the last block] → messages
 *
 * The system prompt is split into stable + breakpoint; downstream byte
 * changes in `userInput` do not invalidate the cache.
 */
export async function generateNarrative(req: NarrativeRequest): Promise<NarrativeResponse> {
  const client = getClient();
  const maxTokens = req.maxTokens ?? DEFAULT_MAX_TOKENS_STREAMING;
  const effort = req.effort ?? "high";

  // Look up per-model capabilities (see `MODEL_CAPABILITIES` above) instead
  // of pattern-matching on the model name. Models that reject `thinking` or
  // `output_config.effort` with HTTP 400 (Haiku 4.5/4.6, legacy Sonnet 4.5)
  // have those params dropped silently with a debug log; callers don't have
  // to know which model is wired in.
  const capabilities = getModelCapabilities(MODEL);
  const thinking = capabilities.supportsThinking
    ? req.displayThinking
      ? { type: "adaptive" as const, display: "summarized" as const }
      : { type: "adaptive" as const }
    : undefined;
  const outputConfig = capabilities.supportsEffort ? { effort } : undefined;

  if (!capabilities.supportsThinking && req.displayThinking) {
    logger.debug({ model: MODEL }, "model does not support adaptive thinking; dropping param");
  }
  if (!capabilities.supportsEffort && req.effort !== undefined) {
    logger.debug({ model: MODEL }, "model does not support output_config.effort; dropping param");
  }

  let final: Anthropic.Message;
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      ...(outputConfig ? { output_config: outputConfig } : {}),
      ...(thinking ? { thinking } : {}),
      system: [
        {
          type: "text",
          text: req.stableSystem,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: req.userInput }],
    });
    final = await stream.finalMessage();
    consecutiveOverloadCount = 0;
  } catch (e) {
    await _handleClaudeError(e, {
      probe: async () => {
        await client.messages.create({
          model: pickProbeModel(MODEL),
          max_tokens: PROBE_MAX_TOKENS,
          messages: [{ role: "user", content: "ping" }],
        });
      },
    });
    // `_handleClaudeError` always throws; this line is unreachable but
    // satisfies the type checker on the catch branch.
    throw e as Error;
  }
  const textBlock = final.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const text = textBlock?.text ?? "";

  const usage = {
    inputTokens: final.usage.input_tokens ?? 0,
    cacheCreationInputTokens: final.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: final.usage.cache_read_input_tokens ?? 0,
    outputTokens: final.usage.output_tokens ?? 0,
  };

  if (req.meta?.runId && !req.meta?.dryRun) {
    const now = clock.now();
    try {
      eventStore.append(
        makeTokenUsageRecorded({
          asOf: now,
          entity: "bank:agent-ops",
          actor: { type: "system", id: req.meta.agent },
          citations: [],
          payload: {
            agent: req.meta.agent,
            runId: req.meta.runId,
            model: final.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.inputTokens + usage.outputTokens,
            estimatedCostUsd: estimateCost(final.model, usage.inputTokens, usage.outputTokens),
            recordedAt: now,
            source: "anthropic-api",
          },
        }),
      );
    } catch (err) {
      logger.warn(
        { runId: req.meta.runId, err: (err as Error).message },
        "token-usage record: append failed (non-fatal)",
      );
    }
  }

  logger.debug(
    {
      model: final.model,
      stopReason: final.stop_reason,
      ...usage,
    },
    "claude narrative generated",
  );

  return {
    text,
    usage,
    stopReason: final.stop_reason ?? null,
    model: final.model,
  };
}

/**
 * Convenience wrapper that catches the SDK's typed exceptions and returns
 * a structured `{ ok: false, error }` instead of throwing. Use this in
 * agent handlers where a Claude failure should not fail the whole run —
 * the mechanical content is valuable on its own; the narrative is icing.
 */
export async function tryGenerateNarrative(
  req: NarrativeRequest,
): Promise<
  { ok: true; result: NarrativeResponse } | { ok: false; error: string; retryable: boolean }
> {
  try {
    const result = await generateNarrative(req);
    return { ok: true, result };
  } catch (e) {
    if (e instanceof ClaudeCreditExhaustedError) {
      return { ok: false, error: `credit exhausted: ${e.message}`, retryable: false };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, error: `rate-limited: ${e.message}`, retryable: true };
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        error: `auth failed (check ANTHROPIC_API_KEY): ${e.message}`,
        retryable: false,
      };
    }
    if (e instanceof Anthropic.BadRequestError) {
      return { ok: false, error: `bad request: ${e.message}`, retryable: false };
    }
    if (e instanceof Anthropic.APIError) {
      const retryable = e.status !== undefined && e.status >= 500;
      return { ok: false, error: `api error ${e.status}: ${e.message}`, retryable };
    }
    return { ok: false, error: (e as Error).message, retryable: false };
  }
}
