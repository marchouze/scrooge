// platform/rms-registers/agent-runs.ts
//
// RMS Phase 1 Slice 3 — Records-of-agent-runs register projection.
//
// Spec §6.3. Pair-couples `AgentRunStarted` + `AgentRunCompleted` by `runId`:
//
//   - `AgentRunStarted` opens a row with `outcome: "in-flight"`,
//     `completedAt: null`, and the start-side metadata (substrate, worktree).
//   - `AgentRunCompleted` closes the row with `outcome` (delivered / blocked
//     / withdrawn), `completedAt`, deliverable hashes, substrate gaps, and
//     follow-on routes.
//   - A `BriefSuperseded` event flags any in-flight run on the original brief
//     (the run is *not* terminated — the agent may still close it; the flag
//     surfaces the supersession so the dashboard can render it).
//
// Out-of-order completion (Completed arrives before Started) is supported:
// the row is materialised as if Started had landed first, with start-side
// fields backfilled to "unknown".
//
// Author: Anya (Data / analytics engineer, engineering)

import type { Event } from "../event-store/types";
import type {
  AgentRunCompletedPayload,
  AgentRunStartedPayload,
  BriefSupersededPayload,
  RmsAgentRef,
} from "../event-store/event-types";
import type { Projection } from "../projections/types";

export type AgentRunsOutcome =
  | "in-flight"
  | "delivered"
  | "blocked"
  | "withdrawn";

export interface AgentRunsRegisterRow {
  readonly runId: string;
  readonly briefId: string;
  readonly agent: RmsAgentRef;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly outcome: AgentRunsOutcome;
  readonly substrate: AgentRunStartedPayload["substrate"] | "unknown";
  readonly worktree: string | null;
  readonly deliverableHashes: readonly string[];
  readonly substrateGapsSurfaced: readonly string[];
  readonly deliverableCitations: readonly string[];
  readonly followOnRoutes: AgentRunCompletedPayload["followOnRoutes"];
  readonly startedEventId: string | null;
  readonly completedEventId: string | null;
  /** True iff a `BriefSuperseded` event landed citing this run's brief. */
  readonly briefSuperseded: boolean;
}

export interface AgentRunsRegisterState {
  readonly rows: ReadonlyMap<string, AgentRunsRegisterRow>;
}

export const agentRunsRegisterInitial: AgentRunsRegisterState = { rows: new Map() };

function isAgentRunsEvent(event: { type: string }): boolean {
  return (
    event.type === "AgentRunStarted" ||
    event.type === "AgentRunCompleted" ||
    event.type === "BriefSuperseded"
  );
}

function applyStarted(state: AgentRunsRegisterState, event: Event): AgentRunsRegisterState {
  const p = event.payload as AgentRunStartedPayload;
  const id = p.runId;
  if (!id) return state;
  const existing = state.rows.get(id);
  const next = new Map(state.rows);
  next.set(id, {
    runId: id,
    briefId: p.briefId,
    agent: p.agent,
    startedAt: p.startedAt,
    completedAt: existing?.completedAt ?? null,
    outcome: existing?.outcome ?? "in-flight",
    substrate: p.substrate,
    worktree: p.worktree ?? null,
    deliverableHashes: existing?.deliverableHashes ?? [],
    substrateGapsSurfaced: existing?.substrateGapsSurfaced ?? [],
    deliverableCitations: existing?.deliverableCitations ?? [],
    followOnRoutes: existing?.followOnRoutes ?? [],
    startedEventId: event.event_id,
    completedEventId: existing?.completedEventId ?? null,
    briefSuperseded: existing?.briefSuperseded ?? false,
  });
  return { rows: next };
}

function applyCompleted(state: AgentRunsRegisterState, event: Event): AgentRunsRegisterState {
  const p = event.payload as AgentRunCompletedPayload;
  const id = p.runId;
  if (!id) return state;
  const existing = state.rows.get(id);
  const next = new Map(state.rows);
  next.set(id, {
    runId: id,
    briefId: p.briefId,
    agent: p.agent,
    startedAt: existing?.startedAt ?? null,
    completedAt: p.completedAt,
    outcome: p.outcome,
    substrate: existing?.substrate ?? "unknown",
    worktree: existing?.worktree ?? null,
    deliverableHashes: [...p.deliverableDocumentHashes],
    substrateGapsSurfaced: [...p.substrateGapsSurfaced],
    deliverableCitations: [...p.citations],
    followOnRoutes: [...p.followOnRoutes],
    startedEventId: existing?.startedEventId ?? null,
    completedEventId: event.event_id,
    briefSuperseded: existing?.briefSuperseded ?? false,
  });
  return { rows: next };
}

function applyBriefSuperseded(
  state: AgentRunsRegisterState,
  event: Event,
): AgentRunsRegisterState {
  const p = event.payload as BriefSupersededPayload;
  const briefId = p.originalBriefId;
  let mutated = false;
  const next = new Map(state.rows);
  for (const [runId, row] of state.rows) {
    if (row.briefId === briefId && !row.briefSuperseded) {
      next.set(runId, { ...row, briefSuperseded: true });
      mutated = true;
    }
  }
  return mutated ? { rows: next } : state;
}

export const agentRunsRegisterProjection: Projection<AgentRunsRegisterState, Event> = {
  name: "rms.agent-runs",
  initial: agentRunsRegisterInitial,
  accepts: (e): e is Event => isAgentRunsEvent(e),
  reduce(state, event) {
    if (event.type === "AgentRunStarted") return applyStarted(state, event);
    if (event.type === "AgentRunCompleted") return applyCompleted(state, event);
    if (event.type === "BriefSuperseded") return applyBriefSuperseded(state, event);
    return state;
  },
  encodeSnapshot(state) {
    return JSON.stringify({ rows: Array.from(state.rows.entries()) });
  },
  decodeSnapshot(payload) {
    const parsed = JSON.parse(payload) as {
      rows: Array<[string, AgentRunsRegisterRow]>;
    };
    return { rows: new Map(parsed.rows) };
  },
};

export function agentRunsRegisterRows(state: AgentRunsRegisterState): AgentRunsRegisterRow[] {
  return Array.from(state.rows.values()).sort((a, b) => {
    const aKey = a.startedAt ?? a.completedAt ?? "";
    const bKey = b.startedAt ?? b.completedAt ?? "";
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
}
