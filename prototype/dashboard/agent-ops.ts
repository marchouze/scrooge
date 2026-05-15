// dashboard/agent-ops.ts
//
// AgentOps projection handler — builds the AgentOpsState slice of DashboardState.
//
// Folds three event types emitted by Sade (AgentOps & Token Efficiency Engineer):
//   - TokenUsageRecorded          — per-run token consumption records
//   - AgentEfficiencyAdvisoryIssued — efficiency advisories issued to agents
//   - AgentPromptOptimizationApplied — bounded prompt/mandate optimisations applied
//
// The resulting AgentOpsState is injected into DashboardState.agentOps by
// the dashboard server and by deriveState() when opts.agentOps is supplied.
//
// Authority: Sade mandate (AgentOps & Token Efficiency Engineer, engineering).
//            D-AGENT-AUTONOMY-OPERATIONAL (Principle 6 — autonomous by default).
// Author: Sade (AgentOps & Token Efficiency Engineer)

import { nowUtc } from "../platform/core/types";
import type {
  AgentEfficiencyAdvisoryIssuedPayload,
  AgentPromptOptimizationAppliedPayload,
  TokenUsageRecordedPayload,
} from "../platform/event-store/event-types/agent-ops";
import type { Event } from "../platform/event-store/types";
import type {
  AgentEfficiencyAdvisorySummary,
  AgentOpsState,
  AgentTokenSummary,
  PromptOptimisationSummary,
} from "./types";

// ---------------------------------------------------------------------------
// Internal accumulator shape — mutable during fold, frozen on export
// ---------------------------------------------------------------------------

interface AgentTokenAccumulator {
  tokens7d: number;
  tokens30d: number;
  estimatedCost7d: number;
  estimatedCost30d: number;
  // Rolling window records for trend calculation (last 14 days, two 7d windows)
  records: Array<{ recordedAt: string; totalTokens: number }>;
  lastAdvisoryId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when `recordedAt` is within the last `days` calendar days
 *  relative to `now` (ISO 8601 strings). */
function withinDays(recordedAt: string, now: string, days: number): boolean {
  try {
    const msNow = new Date(now).getTime();
    const msRecord = new Date(recordedAt).getTime();
    return msNow - msRecord <= days * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Derive a trend label from two consecutive 7-day windows.
 *
 * Compares the agent's total tokens in the most recent 7 days against the
 * prior 7 days. A decrease of ≥5% is "improving"; an increase of ≥5% is
 * "degrading"; otherwise "stable".
 */
function deriveTrend(
  records: Array<{ recordedAt: string; totalTokens: number }>,
  now: string,
): "improving" | "stable" | "degrading" {
  const recent = records
    .filter((r) => withinDays(r.recordedAt, now, 7))
    .reduce((s, r) => s + r.totalTokens, 0);

  const prior = records
    .filter((r) => withinDays(r.recordedAt, now, 14) && !withinDays(r.recordedAt, now, 7))
    .reduce((s, r) => s + r.totalTokens, 0);

  if (prior === 0) return "stable";

  const change = (recent - prior) / prior;
  if (change <= -0.05) return "improving";
  if (change >= 0.05) return "degrading";
  return "stable";
}

/** Aggregate fleet-level trend from per-agent trends. */
function aggregateFleetTrend(byAgent: AgentTokenSummary[]): "improving" | "stable" | "degrading" {
  if (byAgent.length === 0) return "stable";
  const degrading = byAgent.filter((a) => a.trend === "degrading").length;
  const improving = byAgent.filter((a) => a.trend === "improving").length;
  if (degrading > improving && degrading / byAgent.length > 0.3) return "degrading";
  if (improving > degrading && improving / byAgent.length > 0.3) return "improving";
  return "stable";
}

// ---------------------------------------------------------------------------
// AgentOps projection state
// ---------------------------------------------------------------------------

export interface AgentOpsProjectionState {
  readonly byAgent: ReadonlyMap<string, AgentTokenAccumulator>;
  readonly recentAdvisories: AgentEfficiencyAdvisorySummary[];
  readonly recentOptimisations: PromptOptimisationSummary[];
  readonly lastUpdated: string;
}

const initialState: AgentOpsProjectionState = {
  byAgent: new Map(),
  recentAdvisories: [],
  recentOptimisations: [],
  lastUpdated: "2026-05-15T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Event type guards
// ---------------------------------------------------------------------------

function isTokenUsageRecorded(e: Event): e is Event & { payload: TokenUsageRecordedPayload } {
  return e.type === "TokenUsageRecorded";
}

function isAgentEfficiencyAdvisoryIssued(
  e: Event,
): e is Event & { payload: AgentEfficiencyAdvisoryIssuedPayload } {
  return e.type === "AgentEfficiencyAdvisoryIssued";
}

function isAgentPromptOptimizationApplied(
  e: Event,
): e is Event & { payload: AgentPromptOptimizationAppliedPayload } {
  return e.type === "AgentPromptOptimizationApplied";
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reduceAgentOps(state: AgentOpsProjectionState, event: Event): AgentOpsProjectionState {
  if (isTokenUsageRecorded(event)) {
    const p = event.payload;
    const mutableMap = new Map(state.byAgent);
    const existing: AgentTokenAccumulator = mutableMap.get(p.agent) ?? {
      tokens7d: 0,
      tokens30d: 0,
      estimatedCost7d: 0,
      estimatedCost30d: 0,
      records: [],
      lastAdvisoryId: null,
    };
    // Append the record for trend calculation. Keep only 14 days of history
    // to bound memory; older records do not affect the two-window trend.
    const now = p.recordedAt;
    const updatedRecords = [
      ...existing.records.filter((r) => withinDays(r.recordedAt, now, 14)),
      { recordedAt: p.recordedAt, totalTokens: p.totalTokens },
    ];
    const updated7d = existing.tokens7d + (withinDays(p.recordedAt, now, 7) ? p.totalTokens : 0);
    const updated30d = existing.tokens30d + (withinDays(p.recordedAt, now, 30) ? p.totalTokens : 0);
    const updatedCost7d =
      existing.estimatedCost7d + (withinDays(p.recordedAt, now, 7) ? p.estimatedCostUsd : 0);
    const updatedCost30d =
      existing.estimatedCost30d + (withinDays(p.recordedAt, now, 30) ? p.estimatedCostUsd : 0);
    mutableMap.set(p.agent, {
      ...existing,
      tokens7d: updated7d,
      tokens30d: updated30d,
      estimatedCost7d: updatedCost7d,
      estimatedCost30d: updatedCost30d,
      records: updatedRecords,
    });
    return {
      ...state,
      byAgent: mutableMap,
      lastUpdated: event.as_of,
    };
  }

  if (isAgentEfficiencyAdvisoryIssued(event)) {
    const p = event.payload;
    const summary: AgentEfficiencyAdvisorySummary = {
      advisoryId: p.advisoryId,
      agent: p.agent,
      finding: p.finding,
      severity: p.severity,
      issuedAt: p.issuedAt,
    };
    // Update lastAdvisoryId for the relevant agent
    const mutableMap = new Map(state.byAgent);
    const existing = mutableMap.get(p.agent);
    if (existing) {
      mutableMap.set(p.agent, { ...existing, lastAdvisoryId: p.advisoryId });
    }
    // Keep the 10 most recent advisories
    const updated = [summary, ...state.recentAdvisories].slice(0, 10);
    return {
      ...state,
      byAgent: mutableMap,
      recentAdvisories: updated,
      lastUpdated: event.as_of,
    };
  }

  if (isAgentPromptOptimizationApplied(event)) {
    const p = event.payload;
    const summary: PromptOptimisationSummary = {
      optimisationId: p.optimisationId,
      agent: p.agent,
      summary: p.summary,
      changeType: p.changeType,
      appliedAt: p.appliedAt,
    };
    // Keep the 10 most recent optimisations
    const updated = [summary, ...state.recentOptimisations].slice(0, 10);
    return {
      ...state,
      recentOptimisations: updated,
      lastUpdated: event.as_of,
    };
  }

  return state;
}

// ---------------------------------------------------------------------------
// Build helper — materialises projection state into AgentOpsState
// ---------------------------------------------------------------------------

/**
 * Fold the provided events into an AgentOpsState tile suitable for injection
 * into DashboardState.agentOps.
 *
 * Events should be pre-filtered to the three AgentOps types; passing
 * unrelated events is safe (they are ignored by the reducer) but wasteful.
 */
export function buildAgentOpsState(events: readonly Event[]): AgentOpsState {
  const now = nowUtc();

  // Fold events into projection state
  let state: AgentOpsProjectionState = initialState;
  for (const event of events) {
    state = reduceAgentOps(state, event);
  }

  // Materialise per-agent summaries
  const byAgent: AgentTokenSummary[] = [];
  let totalTokens7d = 0;
  let totalTokens30d = 0;
  let estimatedCost7d = 0;
  let estimatedCost30d = 0;

  for (const [agent, acc] of state.byAgent) {
    const trend = deriveTrend(acc.records, now);
    byAgent.push({
      agent,
      tokens7d: acc.tokens7d,
      tokens30d: acc.tokens30d,
      estimatedCost7d: acc.estimatedCost7d,
      estimatedCost30d: acc.estimatedCost30d,
      trend,
      lastAdvisoryId: acc.lastAdvisoryId,
    });
    totalTokens7d += acc.tokens7d;
    totalTokens30d += acc.tokens30d;
    estimatedCost7d += acc.estimatedCost7d;
    estimatedCost30d += acc.estimatedCost30d;
  }

  // Sort by 7-day tokens descending (highest consumers first)
  byAgent.sort((a, b) => b.tokens7d - a.tokens7d);

  return {
    totalTokens7d,
    totalTokens30d,
    estimatedCost7d,
    estimatedCost30d,
    byAgent,
    recentAdvisories: state.recentAdvisories,
    recentOptimisations: state.recentOptimisations,
    efficiencyTrend: aggregateFleetTrend(byAgent),
    lastUpdated: state.lastUpdated,
  };
}
