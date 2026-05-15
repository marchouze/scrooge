// platform/event-store/event-types/agent-ops.ts
//
// AgentOps event-payload schemas for Sade (AgentOps & Token Efficiency Engineer).
//
// Covers:
//   - TokenUsageRecorded          — per-run token consumption record; emitted by
//                                   Sade's token-usage-analysis handler on each
//                                   AgentRun completion.
//   - AgentEfficiencyAdvisoryIssued — efficiency advisory raised when an agent
//                                   shows a degrading token efficiency trend.
//   - AgentPromptOptimizationApplied — record of a bounded prompt/mandate
//                                   optimisation applied autonomously by Sade.
//
// Authority: Sade mandate (AgentOps & Token Efficiency Engineer, engineering).
// Author: Sade (AgentOps & Token Efficiency Engineer)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// TokenUsageRecorded
// ---------------------------------------------------------------------------

export const tokenUsageRecordedPayloadSchema = z.object({
  /** Bare agent name — e.g. "atlas", "mira". Matches AgentRegistered.agentId. */
  agent: z.string().min(1),

  /** Run identifier — links to AgentRunStarted / AgentRunCompleted event. */
  runId: z.string().min(1),

  /** Claude model identifier — e.g. "claude-sonnet-4-6". */
  model: z.string().min(1),

  /** Prompt / input token count for the run. */
  inputTokens: z.number().int().nonnegative(),

  /** Completion / output token count for the run. */
  outputTokens: z.number().int().nonnegative(),

  /** Total tokens (input + output). */
  totalTokens: z.number().int().nonnegative(),

  /** Estimated cost in USD based on model pricing at record time. */
  estimatedCostUsd: z.number().nonnegative(),

  /** ISO 8601 timestamp when the record was captured. */
  recordedAt: z.string().min(1),

  /**
   * How the token count was obtained:
   *   - "anthropic-api"  — extracted from the Anthropic API response headers / body.
   *   - "console-api"    — read from the Anthropic Console usage API (aggregate/periodic).
   *   - "self-reported"  — agent or harness reported its own estimate.
   */
  source: z.enum(["anthropic-api", "console-api", "self-reported"]),
});

export type TokenUsageRecordedPayload = z.infer<typeof tokenUsageRecordedPayloadSchema>;

export function makeTokenUsageRecorded(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TokenUsageRecordedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TokenUsageRecorded",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tokenUsageRecordedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentEfficiencyAdvisoryIssued
// ---------------------------------------------------------------------------

export const agentEfficiencyAdvisoryIssuedPayloadSchema = z.object({
  /** Unique advisory identifier — e.g. "ADV-ATLAS-20260515-A1". */
  advisoryId: z.string().min(1),

  /** Agent the advisory is addressed to. */
  agent: z.string().min(1),

  /** One-paragraph description of the efficiency finding. */
  finding: z.string().min(1),

  /** Recommended action to reduce token waste. */
  recommendation: z.string().min(1),

  /** Advisory severity — informs escalation routing. */
  severity: z.enum(["low", "medium", "high"]),

  /**
   * Expected token saving as a percentage (0–100) if the recommendation
   * is applied. Estimate, not a guarantee.
   */
  expectedSavingPct: z.number().min(0).max(100),

  /** ISO 8601 timestamp when the advisory was issued. */
  issuedAt: z.string().min(1),
});

export type AgentEfficiencyAdvisoryIssuedPayload = z.infer<
  typeof agentEfficiencyAdvisoryIssuedPayloadSchema
>;

export function makeAgentEfficiencyAdvisoryIssued(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentEfficiencyAdvisoryIssuedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentEfficiencyAdvisoryIssued",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentEfficiencyAdvisoryIssuedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// AgentPromptOptimizationApplied
// ---------------------------------------------------------------------------

export const agentPromptOptimizationAppliedPayloadSchema = z.object({
  /** Unique optimisation identifier — e.g. "OPT-ATLAS-20260515-B3". */
  optimisationId: z.string().min(1),

  /** Agent whose spec or prompt was optimised. */
  agent: z.string().min(1),

  /**
   * Type of change applied:
   *   - "prompt"       — wording change to a prompt or instruction.
   *   - "mandate"      — trim of verbose/redundant mandate clauses.
   *   - "cadence"      — cadence reduction for a low-signal handler.
   *   - "context-trim" — removal of stale or irrelevant context from a spec.
   */
  changeType: z.enum(["prompt", "mandate", "cadence", "context-trim"]),

  /** Human-readable summary of what was changed and why. */
  summary: z.string().min(1),

  /** advisory_id of the AgentEfficiencyAdvisoryIssued that motivated this change. */
  linkedAdvisoryId: z.string().min(1),

  /**
   * Expected token saving as a percentage (0–100) from this change alone.
   * May differ from the linked advisory's expectedSavingPct if only part
   * of the advisory recommendation was applied.
   */
  expectedSavingPct: z.number().min(0).max(100),

  /** ISO 8601 timestamp when the optimisation was applied. */
  appliedAt: z.string().min(1),
});

export type AgentPromptOptimizationAppliedPayload = z.infer<
  typeof agentPromptOptimizationAppliedPayloadSchema
>;

export function makeAgentPromptOptimizationApplied(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AgentPromptOptimizationAppliedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AgentPromptOptimizationApplied",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: agentPromptOptimizationAppliedPayloadSchema.parse(args.payload),
  });
}

export const AGENT_OPS_TYPED_EVENT_TYPES = [
  "TokenUsageRecorded",
  "AgentEfficiencyAdvisoryIssued",
  "AgentPromptOptimizationApplied",
] as const;
export type AgentOpsEventType = (typeof AGENT_OPS_TYPED_EVENT_TYPES)[number];
