// platform/agent-runtime/goal-loop.ts
//
// `AgentGoalLoopRunner` — the substrate-side goal-derivation wrapper.
//
// Spec: Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.2.
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
//
// Enforces the goal-loop contract uniformly across all persona run-handlers:
//   - Emits exactly one planning-trace event path per call (P1).
//   - Validates goal-shape: chosen goal must be in the persona's closed-set §9 row labels.
//   - Validates citation discipline: mandateCitations + procedureCitations non-empty (P2).
//   - Permission-gate pre-check: planned event types ⊆ agent's eventsEmitted allow-list.
//   - Escalation-class check (T-05): if chosen goal is in escalationClasses, reject and defer.
//   - Cadence-binding: refuse to derive if the prior iteration was more recent than allowed.
//   - Wraps deriver exceptions as `AgentGoalDeferred{ reason: "goal-deriver threw" }`.
//   - `null` is the safe default — a deriver returning null emits only `AgentGoalDeferred`.
//
// Author: Atlas (Core banking platform architect)

import { createHash } from "node:crypto";
import {
  makeAgentGoalDeferred,
  makeAgentGoalEvaluated,
  makeAgentGoalSelected,
} from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import type { AgentUrn } from "./registry";
import type { AgentSpec } from "./spec-parser";
import type { AgentRunSummary, WorldStateSnapshot } from "./world-state";

// ---------------------------------------------------------------------------
// Public types — re-exported for consumers (run.ts, per-persona goal derivers)
// ---------------------------------------------------------------------------

/** A typed citation to an authorising row in the agent's spec. */
export interface MandateCitation {
  /** Which spec section the row lives in. */
  readonly section: "9-decisions-in-scope" | "11-outputs" | "13-procedures-owned";
  /** The row's first-column value (decision name, output name, procedure path). */
  readonly rowKey: string;
  /** SHA-256 of the spec at parse time — pinned to the version the goal was derived against. */
  readonly specHash: string;
}

/** A typed citation to a procedure step. */
export interface ProcedureCitation {
  /** Procedure file path (repo-relative). */
  readonly procedurePath: string;
  /** Step identifier within the procedure (e.g. `kyc-onboarding:step-3`). */
  readonly stepId: string;
  /** SHA-256 of the procedure file at parse time. */
  readonly procedureHash: string;
}

export type GoalLabel = string;

export interface PlannedEventStub {
  readonly type: string;
  readonly payloadPreview?: Record<string, unknown>;
}

/** A goal the deriver has chosen — routes to `AgentGoalSelected`. */
export interface GoalDecision {
  readonly kind: "decision";
  readonly chosen: GoalLabel;
  readonly rationale: string;
  readonly mandateCitations: readonly MandateCitation[];
  readonly procedureCitations: readonly ProcedureCitation[];
  readonly plannedEvents: readonly PlannedEventStub[];
}

/** An escalation the deriver has concluded is necessary — routes to `AgentEscalation`. */
export interface GoalEscalation {
  readonly kind: "escalation";
  readonly question: string;
  readonly options: readonly string[];
  readonly escalationRationale: string;
  readonly mandateCitations: readonly MandateCitation[];
  readonly addressedTo: AgentUrn | "human:marc";
  readonly deadline: string;
}

/** `null` = no action justified (safe default). */
export type GoalLoopOutcome = GoalDecision | GoalEscalation | null;

/** Result shape returned by `AgentGoalLoopRunner.runWithGoal`. */
export interface GoalLoopResult {
  readonly outcome: GoalLoopOutcome;
  readonly eventsEmitted: number;
  readonly iterationId: string;
}

export interface RunWithGoalArgs {
  readonly agent: { readonly urn: AgentUrn; readonly publicKeyVersion: number };
  readonly spec: AgentSpec;
  readonly worldState: WorldStateSnapshot;
  readonly recentRuns: readonly AgentRunSummary[];
}

/** A goal-derivation function — cohort-1 implementations use a rule engine (no LLM calls). */
export type GoalDeriver = (args: RunWithGoalArgs) => Promise<GoalLoopOutcome>;

/** Candidate the deriver evaluated (for `AgentGoalEvaluated.candidateGoals`). */
export interface GoalCandidate {
  readonly label: string;
  readonly mandateRowKey: string;
  readonly weight?: number;
}

export interface AgentGoalLoopRunner {
  runWithGoal(
    args: RunWithGoalArgs,
    derive: GoalDeriver,
    candidates?: readonly GoalCandidate[],
  ): Promise<GoalLoopResult>;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function mintIterationId(): string {
  // Simple ULID-shaped ID (timestamp + random). We avoid a full ULID library
  // dependency and instead use a stable format: `iter:<ts>:<rand>`.
  const ts = Date.now().toString(36).padStart(10, "0");
  const rand = createHash("sha256")
    .update(`${ts}:${Math.random()}`, "utf8")
    .digest("hex")
    .slice(0, 12);
  return `iter:${ts}:${rand}`;
}

const GOAL_LOOP_CITATIONS: readonly string[] = [
  "D-AGENT-AUTONOMY-OPERATIONAL",
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-2-2024",
];

const GOAL_LOOP_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:goal-loop-runner",
};

const DEFAULT_ENTITY = "BANK-ZA-001";

// ---------------------------------------------------------------------------
// LocalAgentGoalLoopRunner — concrete implementation
// ---------------------------------------------------------------------------

export class LocalAgentGoalLoopRunner implements AgentGoalLoopRunner {
  private readonly eventStore: EventStore;
  private readonly entity: string;
  private readonly actor: Actor;

  constructor(opts: { eventStore: EventStore; entity?: string; actor?: Actor }) {
    this.eventStore = opts.eventStore;
    this.entity = opts.entity ?? DEFAULT_ENTITY;
    this.actor = opts.actor ?? GOAL_LOOP_ACTOR;
  }

  async runWithGoal(
    args: RunWithGoalArgs,
    derive: GoalDeriver,
    candidates: readonly GoalCandidate[] = [],
  ): Promise<GoalLoopResult> {
    const iterationId = mintIterationId();
    const asOf = new Date().toISOString();
    let eventsEmitted = 0;

    // ------------------------------------------------------------------
    // Cadence-binding check (T-12 mitigation).
    // If we already emitted an AgentGoalEvaluated for this agent in the
    // last 60 seconds, defer with a cadence-violation reason.
    // ------------------------------------------------------------------
    const CADENCE_FLOOR_MS = 60_000; // 1-minute floor for cohort-1
    const lastIterationMs = this.findLastGoalEvaluatedMs(args.agent.urn);
    if (lastIterationMs !== undefined && Date.now() - lastIterationMs < CADENCE_FLOOR_MS) {
      const deferredMs = CADENCE_FLOOR_MS - (Date.now() - lastIterationMs);
      const retryAfter = new Date(Date.now() + deferredMs).toISOString();
      this.emitGoalEvaluated(
        iterationId,
        asOf,
        args,
        candidates,
        undefined,
        "cadence: too soon since last iteration",
      );
      eventsEmitted++;
      this.emitGoalDeferred(
        iterationId,
        asOf,
        args,
        "cadence: too soon since last iteration",
        retryAfter,
        [],
      );
      eventsEmitted++;
      return { outcome: null, eventsEmitted, iterationId };
    }

    // ------------------------------------------------------------------
    // Invoke the deriver — catch exceptions, wrap as GoalDeferred.
    // ------------------------------------------------------------------
    let outcome: GoalLoopOutcome;
    try {
      outcome = await derive(args);
    } catch (err) {
      const reason = `goal-deriver threw: ${(err as Error).message ?? String(err)}`;
      this.emitGoalEvaluated(iterationId, asOf, args, candidates, undefined, reason);
      eventsEmitted++;
      this.emitGoalDeferred(iterationId, asOf, args, reason, undefined, []);
      eventsEmitted++;
      return { outcome: null, eventsEmitted, iterationId };
    }

    // ------------------------------------------------------------------
    // null outcome → safe default → GoalDeferred.
    // ------------------------------------------------------------------
    if (outcome === null) {
      this.emitGoalEvaluated(iterationId, asOf, args, candidates, undefined, "no action justified");
      eventsEmitted++;
      this.emitGoalDeferred(iterationId, asOf, args, "no action justified", undefined, []);
      eventsEmitted++;
      return { outcome: null, eventsEmitted, iterationId };
    }

    // ------------------------------------------------------------------
    // Escalation outcome → emit GoalEvaluated + AgentEscalation.
    // ------------------------------------------------------------------
    if (outcome.kind === "escalation") {
      this.emitGoalEvaluated(
        iterationId,
        asOf,
        args,
        candidates,
        undefined,
        `escalation: ${outcome.question}`,
      );
      eventsEmitted++;
      // AgentEscalation emission happens via the existing event type —
      // the wrapper records the intent; the handler wires the actual
      // AgentEscalation factory once the run-handler path is confirmed.
      // For now we emit GoalDeferred to preserve the pairing invariant
      // and surface the escalation intent in the trace.
      this.emitGoalDeferred(
        iterationId,
        asOf,
        args,
        `escalation-pending: ${outcome.question}`,
        undefined,
        [],
      );
      eventsEmitted++;
      return { outcome, eventsEmitted, iterationId };
    }

    // ------------------------------------------------------------------
    // Decision outcome — validate shape before emitting (T-NEW, T-05, P2).
    // ------------------------------------------------------------------
    const decision = outcome;

    // T-NEW: goal must be in the closed-set §9 / §11 / §13 row labels.
    const allowedLabels = new Set([
      ...args.spec.decisionsInScope,
      ...args.spec.eventsEmitted,
      ...args.spec.proceduresOwned,
    ]);
    if (!allowedLabels.has(decision.chosen)) {
      const reason = `goal-shape violation (T-NEW): chosen goal "${decision.chosen}" is not in spec's closed-set row labels`;
      this.emitGoalEvaluated(iterationId, asOf, args, candidates, decision.chosen, reason);
      eventsEmitted++;
      this.emitGoalDeferred(iterationId, asOf, args, reason, undefined, [
        { label: decision.chosen, rejectionReason: reason },
      ]);
      eventsEmitted++;
      return { outcome: null, eventsEmitted, iterationId };
    }

    // T-05: if chosen goal matches an escalation-class row, reject.
    if (args.spec.escalationClasses.includes(decision.chosen)) {
      const reason = `chosen goal class escalates per spec §10 (T-05): "${decision.chosen}"`;
      this.emitGoalEvaluated(iterationId, asOf, args, candidates, decision.chosen, reason);
      eventsEmitted++;
      this.emitGoalDeferred(iterationId, asOf, args, reason, undefined, [
        { label: decision.chosen, rejectionReason: reason },
      ]);
      eventsEmitted++;
      return { outcome: null, eventsEmitted, iterationId };
    }

    // P2: mandate citations must be non-empty.
    if (decision.mandateCitations.length === 0) {
      const reason = "P2 violation: AgentGoalSelected requires non-empty mandateCitations";
      this.emitGoalEvaluated(iterationId, asOf, args, candidates, decision.chosen, reason);
      eventsEmitted++;
      this.emitGoalDeferred(iterationId, asOf, args, reason, undefined, []);
      eventsEmitted++;
      return { outcome: null, eventsEmitted, iterationId };
    }

    // P2: procedure citations must be non-empty (or coverage-gap stepId must be present).
    if (decision.procedureCitations.length === 0) {
      const reason = "P2 violation: AgentGoalSelected requires non-empty procedureCitations";
      this.emitGoalEvaluated(iterationId, asOf, args, candidates, decision.chosen, reason);
      eventsEmitted++;
      this.emitGoalDeferred(iterationId, asOf, args, reason, undefined, []);
      eventsEmitted++;
      return { outcome: null, eventsEmitted, iterationId };
    }

    // Permission-gate pre-check: planned event types ⊆ agent's eventsEmitted allow-list.
    const allowedEventTypes = new Set(args.spec.eventsEmitted);
    const outOfAllowList = decision.plannedEvents
      .map((p) => p.type)
      .filter((t) => !allowedEventTypes.has(t));
    if (outOfAllowList.length > 0) {
      const reason = `planned event type(s) outside allow-list: ${outOfAllowList.join(", ")}`;
      this.emitGoalEvaluated(iterationId, asOf, args, candidates, decision.chosen, reason);
      eventsEmitted++;
      this.emitGoalDeferred(iterationId, asOf, args, reason, undefined, [
        { label: decision.chosen, rejectionReason: reason },
      ]);
      eventsEmitted++;
      return { outcome: null, eventsEmitted, iterationId };
    }

    // All checks passed — emit GoalEvaluated + GoalSelected.
    this.emitGoalEvaluated(
      iterationId,
      asOf,
      args,
      candidates,
      decision.chosen,
      decision.rationale,
    );
    eventsEmitted++;

    this.emitGoalSelected(iterationId, asOf, args, decision);
    eventsEmitted++;

    return { outcome: decision, eventsEmitted, iterationId };
  }

  // -------------------------------------------------------------------------
  // Private emitters
  // -------------------------------------------------------------------------

  private emitGoalEvaluated(
    iterationId: string,
    asOf: string,
    args: RunWithGoalArgs,
    candidates: readonly GoalCandidate[],
    chosen: string | undefined,
    reason: string,
  ): void {
    try {
      this.eventStore.append(
        makeAgentGoalEvaluated({
          asOf,
          entity: this.entity,
          actor: this.actor,
          citations: [...GOAL_LOOP_CITATIONS],
          payload: {
            agentUrn: args.agent.urn,
            iterationId,
            worldStateSnapshotHash: args.worldState.snapshotHash,
            recentRunCount: args.recentRuns.length,
            candidateGoals: candidates.map((c) => ({
              label: c.label,
              mandateRowKey: c.mandateRowKey,
              ...(c.weight !== undefined ? { weight: c.weight } : {}),
            })),
            ...(chosen !== undefined ? { chosen } : {}),
            reason: reason.slice(0, 2000),
          },
        }),
      );
    } catch (err) {
      // Non-fatal — log the failure but don't interrupt the run.
      console.warn(
        `[goal-loop] AgentGoalEvaluated append failed (non-fatal): ${(err as Error).message}`,
      );
    }
  }

  private emitGoalDeferred(
    iterationId: string,
    asOf: string,
    args: RunWithGoalArgs,
    reason: string,
    retryAfter: string | undefined,
    consideredAndRejected: readonly { label: string; rejectionReason: string }[],
  ): void {
    try {
      this.eventStore.append(
        makeAgentGoalDeferred({
          asOf,
          entity: this.entity,
          actor: this.actor,
          citations: [...GOAL_LOOP_CITATIONS],
          payload: {
            agentUrn: args.agent.urn,
            iterationId,
            reason: reason.slice(0, 2000),
            ...(retryAfter ? { retryAfter } : {}),
            ...(consideredAndRejected.length > 0
              ? {
                  consideredAndRejected: consideredAndRejected.map((x) => ({
                    label: x.label,
                    rejectionReason: x.rejectionReason,
                  })),
                }
              : {}),
          },
        }),
      );
    } catch (err) {
      console.warn(
        `[goal-loop] AgentGoalDeferred append failed (non-fatal): ${(err as Error).message}`,
      );
    }
  }

  private emitGoalSelected(
    iterationId: string,
    asOf: string,
    args: RunWithGoalArgs,
    decision: GoalDecision,
  ): void {
    try {
      this.eventStore.append(
        makeAgentGoalSelected({
          asOf,
          entity: this.entity,
          actor: this.actor,
          citations: [...GOAL_LOOP_CITATIONS],
          payload: {
            agentUrn: args.agent.urn,
            iterationId,
            goal: decision.chosen,
            mandateCitations: decision.mandateCitations.map((c) => ({
              section: c.section,
              rowKey: c.rowKey,
              specHash: c.specHash,
            })),
            procedureCitations: decision.procedureCitations.map((c) => ({
              procedurePath: c.procedurePath,
              stepId: c.stepId,
              procedureHash: c.procedureHash,
            })),
            plannedEvents: decision.plannedEvents.map((p) => ({
              type: p.type,
              ...(p.payloadPreview ? { payloadPreview: p.payloadPreview } : {}),
            })),
          },
        }),
      );
    } catch (err) {
      console.warn(
        `[goal-loop] AgentGoalSelected append failed (non-fatal): ${(err as Error).message}`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Cadence-binding helper
  // -------------------------------------------------------------------------

  private findLastGoalEvaluatedMs(agentUrn: AgentUrn): number | undefined {
    let latest: number | undefined;
    for (const e of this.eventStore.replay({ type: "AgentGoalEvaluated", entity: this.entity })) {
      const p = e.payload as Record<string, unknown>;
      if (String(p.agentUrn ?? "") !== agentUrn) continue;
      const t = new Date(e.as_of).getTime();
      if (!Number.isNaN(t) && (latest === undefined || t > latest)) {
        latest = t;
      }
    }
    return latest;
  }
}
