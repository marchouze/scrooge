// dashboard/performance-view.ts
//
// Read-side view for the agent performance management substrate.
// Wired as:
//   GET /api/performance            — fleet summary
//   GET /api/performance/:agentId   — per-agent detail
//
// Author: Atlas (Core banking platform architect, engineering)

import { nowUtc } from "../platform/core/types";
import type { EventStore } from "../platform/event-store/store";
import { LocalProjector } from "../platform/projections";
import {
  type AgentPerformanceState,
  agentPerformanceProjection,
} from "../platform/projections/performance";

// ---------------------------------------------------------------------------
// Fleet summary view
// ---------------------------------------------------------------------------

export interface PerformanceViewSummary {
  readonly asOf: string;
  readonly fleetSize: number;
  readonly evaluatedToday: number;
  readonly avgOverallScore: number; // fleet average of latestOverallScore
  readonly tierCounts: {
    readonly exceeds: number;
    readonly meets: number;
    readonly needsImprovement: number;
    readonly unsatisfactory: number;
    /** Agents with substrateStatus === "limited" — not yet dispatched by the autonomous scheduler. */
    readonly substrateLimited: number;
  };
  readonly topPerformers: readonly AgentPerformanceState[]; // top 3 by latestOverallScore
  /** Agents in "needs-improvement" or "unsatisfactory" tier — substrate-limited agents excluded. */
  readonly attentionNeeded: readonly AgentPerformanceState[];
  readonly decliningAgents: readonly AgentPerformanceState[]; // trend === "declining"
  readonly allAgents: readonly AgentPerformanceState[]; // sorted by latestOverallScore desc
}

/**
 * Build the full performance fleet summary from the projection.
 */
export function buildPerformanceView(store: Pick<EventStore, "replay">): PerformanceViewSummary {
  const projector = new LocalProjector(store as EventStore);
  const stateMap = projector.build(agentPerformanceProjection);
  const agents = [...stateMap.values()];

  const today = nowUtc().slice(0, 10); // YYYY-MM-DD

  const evaluatedToday = agents.filter((a) => a.latestPeriod === today).length;

  const avgOverallScore =
    agents.length > 0 ? agents.reduce((s, a) => s + a.latestOverallScore, 0) / agents.length : 0;

  // Agents whose displayTier (or latestTier for legacy events) is "substrate-limited".
  // These are not failing — the autonomous scheduler simply hasn't dispatched them yet.
  const isSubstrateLimited = (a: AgentPerformanceState): boolean =>
    a.displayTier === "substrate-limited" || a.substrateStatus === "limited";

  const tierCounts = {
    exceeds: agents.filter((a) => a.latestTier === "exceeds").length,
    meets: agents.filter((a) => a.latestTier === "meets").length,
    needsImprovement: agents.filter((a) => a.latestTier === "needs-improvement").length,
    unsatisfactory: agents.filter((a) => a.latestTier === "unsatisfactory").length,
    substrateLimited: agents.filter(isSubstrateLimited).length,
  };

  const sorted = [...agents].sort((a, b) => b.latestOverallScore - a.latestOverallScore);

  const topPerformers = sorted.slice(0, 3);

  // Exclude substrate-limited agents from attentionNeeded — their "unsatisfactory" score
  // is an artefact of the scheduler not existing yet, not a real performance failure.
  const attentionNeeded = agents.filter(
    (a) =>
      !isSubstrateLimited(a) &&
      (a.latestTier === "needs-improvement" || a.latestTier === "unsatisfactory"),
  );

  const decliningAgents = agents.filter((a) => a.trend === "declining");

  return {
    asOf: nowUtc(),
    fleetSize: agents.length,
    evaluatedToday,
    avgOverallScore,
    tierCounts,
    topPerformers,
    attentionNeeded,
    decliningAgents,
    allAgents: sorted,
  };
}

/**
 * Get the full performance state for a single agent.
 */
export function getAgentPerformanceState(
  store: Pick<EventStore, "replay">,
  agentId: string,
): AgentPerformanceState | undefined {
  const projector = new LocalProjector(store as EventStore);
  const stateMap = projector.build(agentPerformanceProjection);
  return stateMap.get(agentId);
}
