// platform/projections/performance/agent-performance-projection.ts
//
// Agent Performance Projection — folds AgentPerformanceEvaluated and
// AgentFeedbackIssued events into a per-agent state map.
//
// P1 — projection is a pure fold over the event log; no authoritative state here.
//
// Stub payload types are used here; will be superseded by
// event-types/performance.ts once Mira's PR lands.
//
// Author: Atlas (Core banking platform architect, engineering)

import type { Event } from "../../event-store/types";
import type { Projection } from "../types";

// ---------------------------------------------------------------------------
// Stub payload types — will be superseded by event-types/performance.ts
// once Mira's PR lands.
// ---------------------------------------------------------------------------

interface AgentPerformanceEvaluatedPayload {
  readonly agentId: string;
  readonly evaluationPeriod: string; // YYYY-MM-DD
  readonly evaluatedBy: string;
  readonly runMetrics: {
    runsStarted: number;
    runsDelivered: number;
    runsBlocked: number;
    runsFailed: number;
    deliveryRate: number;
  };
  readonly qualityMetrics: {
    auditFindingsRaised: number;
    auditFindingsResolved: number;
    ciViolations: number;
    worktreeViolations: number;
  };
  readonly strategicMetrics: {
    decisionsAdvanced: string[];
    workstreamsProgressed: string[];
    complianceArtifacts: number;
    prsMerged: number;
  };
  readonly scores: {
    delivery: number;
    quality: number;
    strategic: number;
    overall: number;
  };
  readonly tier: "exceeds" | "meets" | "needs-improvement" | "unsatisfactory";
  readonly narrative: {
    strengths: string[];
    areasForImprovement: string[];
    feedbackSummary: string;
  };
}

interface AgentFeedbackIssuedPayload {
  readonly agentId: string;
  readonly evaluationPeriod: string;
  readonly evaluationEventId: string;
  readonly deliveredVia: "memory-file" | "team-inbox" | "both";
  readonly artifactPath?: string;
  readonly feedbackText: string;
  readonly issuedBy: string;
}

// ---------------------------------------------------------------------------
// Projection state types
// ---------------------------------------------------------------------------

export interface AgentPerformanceHistoryEntry {
  readonly period: string;
  readonly overallScore: number;
  readonly tier: string;
  readonly scores: {
    delivery: number;
    quality: number;
    strategic: number;
    overall: number;
  };
  readonly runMetrics: {
    runsStarted: number;
    runsDelivered: number;
    deliveryRate: number;
  };
  readonly qualityMetrics: {
    auditFindingsRaised: number;
    ciViolations: number;
  };
  readonly strategicMetrics: {
    decisionsAdvanced: string[];
    prsMerged: number;
  };
}

export interface AgentPerformanceState {
  readonly agentId: string;
  // Latest evaluation
  readonly latestPeriod: string; // YYYY-MM-DD
  readonly latestOverallScore: number; // 0–1
  readonly latestTier: "exceeds" | "meets" | "needs-improvement" | "unsatisfactory";
  readonly latestScores: {
    delivery: number;
    quality: number;
    strategic: number;
    overall: number;
  };
  readonly latestNarrative: {
    strengths: string[];
    areasForImprovement: string[];
    feedbackSummary: string;
  };
  // History (all evaluations, newest first)
  readonly history: readonly AgentPerformanceHistoryEntry[];
  // Trend: "improving" | "stable" | "declining" | "insufficient-data"
  readonly trend: "improving" | "stable" | "declining" | "insufficient-data";
  readonly evaluationCount: number;
  readonly lastFeedbackPath?: string; // from AgentFeedbackIssued.artifactPath
}

export type AgentPerformanceProjectionState = ReadonlyMap<string, AgentPerformanceState>;

// ---------------------------------------------------------------------------
// Trend computation
// ---------------------------------------------------------------------------

function computeTrend(
  history: readonly AgentPerformanceHistoryEntry[],
): "improving" | "stable" | "declining" | "insufficient-data" {
  if (history.length < 2) return "insufficient-data";
  // history is newest-first; compare the most recent two
  const latest = history[0].overallScore;
  const previous = history[1].overallScore;
  const delta = latest - previous;
  if (delta > 0.05) return "improving";
  if (delta < -0.05) return "declining";
  return "stable";
}

// ---------------------------------------------------------------------------
// Accepted event types
// ---------------------------------------------------------------------------

const PERFORMANCE_EVENT_TYPES = new Set(["AgentPerformanceEvaluated", "AgentFeedbackIssued"]);

// ---------------------------------------------------------------------------
// Reduce helpers
// ---------------------------------------------------------------------------

function applyPerformanceEvaluated(
  state: AgentPerformanceProjectionState,
  event: Event,
): AgentPerformanceProjectionState {
  const p = event.payload as unknown as AgentPerformanceEvaluatedPayload;

  const historyEntry: AgentPerformanceHistoryEntry = {
    period: p.evaluationPeriod,
    overallScore: p.scores.overall,
    tier: p.tier,
    scores: { ...p.scores },
    runMetrics: {
      runsStarted: p.runMetrics.runsStarted,
      runsDelivered: p.runMetrics.runsDelivered,
      deliveryRate: p.runMetrics.deliveryRate,
    },
    qualityMetrics: {
      auditFindingsRaised: p.qualityMetrics.auditFindingsRaised,
      ciViolations: p.qualityMetrics.ciViolations,
    },
    strategicMetrics: {
      decisionsAdvanced: [...p.strategicMetrics.decisionsAdvanced],
      prsMerged: p.strategicMetrics.prsMerged,
    },
  };

  const existing = state.get(p.agentId);

  // Prepend new entry to history (newest-first)
  const newHistory: AgentPerformanceHistoryEntry[] = [historyEntry, ...(existing?.history ?? [])];

  const updated: AgentPerformanceState = {
    agentId: p.agentId,
    latestPeriod: p.evaluationPeriod,
    latestOverallScore: p.scores.overall,
    latestTier: p.tier,
    latestScores: { ...p.scores },
    latestNarrative: {
      strengths: [...p.narrative.strengths],
      areasForImprovement: [...p.narrative.areasForImprovement],
      feedbackSummary: p.narrative.feedbackSummary,
    },
    history: newHistory,
    trend: computeTrend(newHistory),
    evaluationCount: newHistory.length,
    lastFeedbackPath: existing?.lastFeedbackPath,
  };

  const next = new Map(state);
  next.set(p.agentId, updated);
  return next;
}

function applyFeedbackIssued(
  state: AgentPerformanceProjectionState,
  event: Event,
): AgentPerformanceProjectionState {
  const p = event.payload as unknown as AgentFeedbackIssuedPayload;
  const existing = state.get(p.agentId);
  if (!existing) {
    // Feedback before evaluation — drop.
    return state;
  }
  if (!p.artifactPath) {
    // No artifact path to record — no-op.
    return state;
  }
  const updated: AgentPerformanceState = {
    ...existing,
    lastFeedbackPath: p.artifactPath,
  };
  const next = new Map(state);
  next.set(p.agentId, updated);
  return next;
}

// ---------------------------------------------------------------------------
// Projection definition
// ---------------------------------------------------------------------------

/**
 * Agent Performance Projection.
 *
 * Folds AgentPerformanceEvaluated and AgentFeedbackIssued events into a
 * per-agent state map keyed by agentId. Downstream consumers (dashboard
 * performance page, Sade's AgentOps tile, Scrooge's dispatch engine) query
 * this projection for current tier, score history, trend, and feedback path.
 *
 * P1 — this is a derived cache; the event log is authoritative.
 */
export const agentPerformanceProjection: Projection<AgentPerformanceProjectionState> = {
  name: "agent-performance",
  initial: new Map<string, AgentPerformanceState>(),
  accepts(event: Event): event is Event {
    return PERFORMANCE_EVENT_TYPES.has(event.type);
  },
  reduce(
    state: AgentPerformanceProjectionState,
    event: Event,
  ): AgentPerformanceProjectionState {
    switch (event.type) {
      case "AgentPerformanceEvaluated":
        return applyPerformanceEvaluated(state, event);
      case "AgentFeedbackIssued":
        return applyFeedbackIssued(state, event);
      default:
        return state;
    }
  },
};
