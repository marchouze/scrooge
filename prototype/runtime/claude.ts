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

import { logger } from "../platform/observability/logger";
import { makeTokenUsageRecorded } from "../platform/event-store/event-types/agent-ops";
import { eventStore } from "../platform/composition";

const DEFAULT_MODEL = "claude-opus-4-7";
const DEFAULT_MAX_TOKENS_STREAMING = 64_000;
// CLAUDE_MODEL env override is intentional — Marc may want to dial down
// to claude-sonnet-4-6 or claude-haiku-4-5 for budget reasons (S6).
// Effort + thinking depth are the other levers.
const MODEL = process.env.BANK_CLAUDE_MODEL ?? DEFAULT_MODEL;

// USD per 1M tokens — 2026-05-15. Update when Anthropic reprices.
const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "claude-opus-4-7":   { inputPer1M: 15.00, outputPer1M: 75.00 },
  "claude-sonnet-4-6": { inputPer1M:  3.00, outputPer1M: 15.00 },
  "claude-haiku-4-5":  { inputPer1M:  0.80, outputPer1M:  4.00 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { inputPer1M: 15.00, outputPer1M: 75.00 };
  return (inputTokens * pricing.inputPer1M + outputTokens * pricing.outputPer1M) / 1_000_000;
}

let cachedClient: Anthropic | null = null;

export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
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

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { effort },
    thinking: req.displayThinking
      ? { type: "adaptive", display: "summarized" }
      : { type: "adaptive" },
    system: [
      {
        type: "text",
        text: req.stableSystem,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: req.userInput }],
  });

  const final = await stream.finalMessage();
  const textBlock = final.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const text = textBlock?.text ?? "";

  const usage = {
    inputTokens: final.usage.input_tokens ?? 0,
    cacheCreationInputTokens: final.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: final.usage.cache_read_input_tokens ?? 0,
    outputTokens: final.usage.output_tokens ?? 0,
  };

  if (req.meta?.runId && !req.meta?.dryRun) {
    const now = new Date().toISOString();
    try {
      eventStore.append(
        makeTokenUsageRecorded({
          asOf: now,
          entity: "bank:agent-ops",
          actor: { kind: "agent", id: req.meta.agent },
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
