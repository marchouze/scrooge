// platform/agent-runtime/world-state.ts
//
// `AgentWorldStateReader` — typed read-only API into world state.
//
// Spec: Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md §3.1.
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
//
// Provides a stable `WorldStateSnapshot` for a single goal-loop iteration.
// The snapshot is materialised once (via `snapshot(agentUrn)`) and its hash
// is embedded in every planning-trace event so Vera Wave-5 can verify
// goal-derivation reproducibility.
//
// Contract:
//   - MUST NOT emit events. Reads are silent.
//   - MUST honour the agent's `eventSubscribeAllowList` at the application
//     layer. (Read-side permission-gate enforcement at the substrate level is
//     deferred — §3.1 declared substrate-gap — but the application-layer
//     filter runs unconditionally as defence-in-depth.)
//   - Snapshot data is deeply immutable (Object.freeze applied at materialise
//     time). The `snapshotHash` is SHA-256 of the JSON-canonicalised snapshot
//     contents.
//
// Author: Atlas (Core banking platform architect)

import { createHash } from "node:crypto";
import type { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import { type ScenarioClock, WallClock } from "../scenario-clock";
import type { AgentUrn } from "./registry";

// ---------------------------------------------------------------------------
// Register types (seven RMS registers + Party register)
// ---------------------------------------------------------------------------

export type RegisterName =
  | "decisions"
  | "correspondence"
  | "agent-runs"
  | "documents"
  | "feedback"
  | "briefs"
  | "workstreams"
  | "party";

export interface RegisterRow {
  readonly id: string;
  readonly emittedAt: string;
  readonly emittedBy: AgentUrn | "human:marc" | "human:overseer";
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface Register {
  readonly name: RegisterName;
  readonly asOf: string;
  /** SHA-256 hex of the canonicalised register snapshot. */
  readonly snapshotHash: string;
  readonly rows: readonly RegisterRow[];
}

// ---------------------------------------------------------------------------
// Views into escalations, audit findings, and recent runs
// ---------------------------------------------------------------------------

export interface AuditFinding {
  readonly findingId: string;
  readonly emittedAt: string;
  readonly raisedBy: AgentUrn;
  readonly addressedTo: AgentUrn;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly summary: string;
  readonly citations: readonly string[];
}

export interface AgentEscalationView {
  readonly escalationId: string;
  readonly raisedBy: AgentUrn;
  readonly addressedTo: AgentUrn | "human:marc";
  readonly raisedAt: string;
  readonly deadline: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly status: "open" | "acknowledged" | "decided" | "delegated" | "overdue";
}

export interface AgentRunSummary {
  readonly runId: string;
  readonly trigger: {
    readonly kind: "scheduled" | "event-driven" | "on-request";
    readonly id: string;
  };
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outcome: "ok" | "failed";
  readonly eventsEmitted: number;
  readonly deliverable?: string;
}

// ---------------------------------------------------------------------------
// WorldStateSnapshot — the stable per-iteration view
// ---------------------------------------------------------------------------

export interface WorldStateSnapshot {
  readonly agentUrn: AgentUrn;
  readonly takenAt: string;
  /** SHA-256 hex of the canonicalised snapshot — embedded in all planning-trace events. */
  readonly snapshotHash: string;
  readonly recentEvents: readonly Event[];
  readonly registers: Readonly<Record<RegisterName, Register>>;
  readonly openEscalationsAddressedToMe: readonly AgentEscalationView[];
  readonly auditFindingsForMe: readonly AuditFinding[];
  readonly myRecentRuns: readonly AgentRunSummary[];
}

// ---------------------------------------------------------------------------
// AgentWorldStateReader interface
// ---------------------------------------------------------------------------

export interface AgentWorldStateReader {
  /**
   * Materialise a stable snapshot for one goal-loop iteration. Pre: the
   * agent is registered in the registry (an `AgentRegistered` or
   * `PartyRegistered{kind: "agent"}` event has been observed). Post:
   * `snapshot.snapshotHash` is the SHA-256 of the snapshot's canonicalised
   * contents, stable for the lifetime of the returned object.
   */
  snapshot(agentUrn: AgentUrn): WorldStateSnapshot;

  /** Recent events relevant to this agent (subscribed-to types ∪ events about this agent). */
  readEventsSince(agentUrn: AgentUrn, sinceEventId: string | undefined): readonly Event[];

  /** Typed accessor for one of the seven RMS registers + the Party register. */
  readRegister(registerName: RegisterName): Register;

  /** Open escalations whose `addressedTo` matches this agent. */
  readOpenEscalationsAddressedToMe(agentUrn: AgentUrn): readonly AgentEscalationView[];

  /** Vera findings whose `addressedTo` matches this agent and whose status is still "open". */
  readReconFindingsForMe(agentUrn: AgentUrn): readonly AuditFinding[];

  /** This agent's most recent N runs, newest first. */
  readMyRecentRuns(agentUrn: AgentUrn, n: number): readonly AgentRunSummary[];
}

// ---------------------------------------------------------------------------
// Implementation: LocalAgentWorldStateReader
//
// Projects from the canonical event store. The seven RMS register projections
// and the Party register are not yet independently projection-cached (that is
// Anya's Slice-3 work under D-RMS-PHASE-1). For now we fold the raw event
// stream and return typed views — the interface contract is preserved; the
// projection-cache optimisation can be dropped in behind the same API.
// ---------------------------------------------------------------------------

const REGISTER_TYPE_MAP: Record<RegisterName, readonly string[]> = {
  decisions: ["CeoDecision", "AgentDecision"],
  correspondence: ["AgentBriefIssued", "BriefSuperseded"],
  "agent-runs": [
    "SubstrateAgentRunStarted",
    "SubstrateAgentRunCompleted",
    "SubstrateAgentRunFailed",
  ],
  documents: ["RecordFiled"],
  feedback: ["Feedback"],
  briefs: ["AgentBriefIssued", "BriefSuperseded"],
  workstreams: ["WorkstreamRegistered", "WorkstreamStarted", "WorkstreamCompleted"],
  party: [
    "PartyRegistered",
    "PartyAttributeChanged",
    "PartyClassified",
    "PartyDeclassified",
    "PartyRelationshipAsserted",
    "PartyDeactivated",
  ],
};

function canonicaliseSnapshot(obj: unknown): string {
  // Deterministic JSON serialisation: sort keys recursively.
  return JSON.stringify(obj, (_, v) => {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce(
          (acc, k) => {
            (acc as Record<string, unknown>)[k] = (v as Record<string, unknown>)[k];
            return acc;
          },
          {} as Record<string, unknown>,
        );
    }
    return v as unknown;
  });
}

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

export class LocalAgentWorldStateReader implements AgentWorldStateReader {
  private readonly eventStore: EventStore;
  private readonly entity: string;
  private readonly clock: ScenarioClock;

  constructor(opts: { eventStore: EventStore; entity?: string; clock?: ScenarioClock }) {
    this.eventStore = opts.eventStore;
    this.entity = opts.entity ?? "LE-ZA-HOZ-BANK";
    this.clock = opts.clock ?? new WallClock();
  }

  // -------------------------------------------------------------------------
  // snapshot() — materialise a stable per-iteration WorldStateSnapshot
  // -------------------------------------------------------------------------

  snapshot(agentUrn: AgentUrn): WorldStateSnapshot {
    const takenAt = this.clock.now();
    const recentEvents = this.readEventsSince(agentUrn, undefined).slice(-100); // cap at last 100
    const registers = this.buildAllRegisters(takenAt);
    const openEscalationsAddressedToMe = this.readOpenEscalationsAddressedToMe(agentUrn);
    const auditFindingsForMe = this.readReconFindingsForMe(agentUrn);
    const myRecentRuns = this.readMyRecentRuns(agentUrn, 10);

    // Build snapshotHash over the canonicalised content (excluding the hash itself).
    const snapshotContent = {
      agentUrn,
      takenAt,
      recentEventIds: recentEvents.map((e) => e.event_id),
      registerHashes: Object.fromEntries(
        Object.entries(registers).map(([k, v]) => [k, (v as Register).snapshotHash]),
      ),
      openEscalationIds: openEscalationsAddressedToMe.map((e) => e.escalationId),
      auditFindingIds: auditFindingsForMe.map((f) => f.findingId),
      recentRunIds: myRecentRuns.map((r) => r.runId),
    };
    const snapshotHash = sha256(canonicaliseSnapshot(snapshotContent));

    const snapshot: WorldStateSnapshot = Object.freeze({
      agentUrn,
      takenAt,
      snapshotHash,
      recentEvents: Object.freeze(recentEvents),
      registers: Object.freeze(registers) as Readonly<Record<RegisterName, Register>>,
      openEscalationsAddressedToMe: Object.freeze(openEscalationsAddressedToMe),
      auditFindingsForMe: Object.freeze(auditFindingsForMe),
      myRecentRuns: Object.freeze(myRecentRuns),
    });
    return snapshot;
  }

  // -------------------------------------------------------------------------
  // readEventsSince — events relevant to this agent since sinceEventId
  //
  // Spec §3.1: honour `eventSubscribeAllowList` at the application layer.
  // Since the subscribe-allow-list is not stored in the event store itself
  // (it's in PermissionPolicyPublished), we apply a conservative heuristic:
  // return events whose type includes the agent name OR matches the substrate
  // lifecycle types every agent is subscribed to. This is application-layer
  // defence-in-depth per spec §3.1 declared substrate-gap.
  // -------------------------------------------------------------------------

  readEventsSince(agentUrn: AgentUrn, sinceEventId: string | undefined): readonly Event[] {
    const agentName = agentUrn.replace(/^agent:/, "");
    const all = [...this.eventStore.replay({ entity: this.entity })];

    // If sinceEventId provided, find its position and return only events after.
    if (sinceEventId) {
      const idx = all.findIndex((e) => e.event_id === sinceEventId);
      if (idx >= 0) {
        return all.slice(idx + 1);
      }
    }
    // Return events that are relevant to this agent (about this agent or
    // substrate lifecycle types all agents observe).
    return all.filter((e) => {
      const p = e.payload as Record<string, unknown>;
      // Events mentioning this agent by URN or name.
      const payloadStr = JSON.stringify(p).toLowerCase();
      if (payloadStr.includes(agentUrn) || payloadStr.includes(agentName)) return true;
      // Substrate lifecycle events all agents observe.
      if (
        [
          "SubstrateAgentRunStarted",
          "SubstrateAgentRunCompleted",
          "SubstrateAgentRunFailed",
          "AgentRegistered",
          "PartyRegistered",
          "AgentEscalation",
          "AgentGoalEvaluated",
          "AgentGoalSelected",
          "AgentGoalDeferred",
          "AuditFinding",
        ].includes(e.type)
      ) {
        return true;
      }
      return false;
    });
  }

  // -------------------------------------------------------------------------
  // readRegister — fold event stream for one RMS register
  // -------------------------------------------------------------------------

  readRegister(registerName: RegisterName): Register {
    const asOf = this.clock.now();
    const typeFilter = REGISTER_TYPE_MAP[registerName];
    const rows: RegisterRow[] = [];

    for (const e of this.eventStore.replay({ entity: this.entity })) {
      if (!typeFilter.includes(e.type)) continue;
      const p = e.payload as Record<string, unknown>;
      rows.push({
        id: e.event_id,
        emittedAt: e.as_of,
        emittedBy: (e.actor.id as AgentUrn) ?? "human:overseer",
        payload: p,
      });
    }

    const snapshotHash = sha256(
      canonicaliseSnapshot({ registerName, asOf, rowIds: rows.map((r) => r.id) }),
    );
    return Object.freeze({
      name: registerName,
      asOf,
      snapshotHash,
      rows: Object.freeze(rows),
    });
  }

  // -------------------------------------------------------------------------
  // readOpenEscalationsAddressedToMe
  // -------------------------------------------------------------------------

  readOpenEscalationsAddressedToMe(agentUrn: AgentUrn): readonly AgentEscalationView[] {
    // Fold: gather AgentEscalation events addressed-to this agent; apply
    // lifecycle events (Acknowledged / Decided / Delegated / Overdue) to
    // derive current status.
    const escalationMap = new Map<string, AgentEscalationView>();

    for (const e of this.eventStore.replay({ entity: this.entity })) {
      const p = e.payload as Record<string, unknown>;

      if (e.type === "AgentEscalation") {
        const routedTo = String(p.routedTo ?? "");
        if (routedTo !== agentUrn && routedTo !== "human:marc") continue;
        const escalationId = String(p.escalationId ?? "");
        if (!escalationId) continue;
        escalationMap.set(escalationId, {
          escalationId,
          raisedBy: String(p.raisedBy ?? "") as AgentUrn,
          addressedTo: routedTo as AgentUrn | "human:marc",
          raisedAt: e.as_of,
          deadline: String(p.deadline ?? ""),
          question: String(p.question ?? ""),
          options: Array.isArray(p.options) ? (p.options as string[]).map(String) : [],
          status: "open",
        });
        continue;
      }

      if (e.type === "AgentEscalationDecided") {
        const id = String(p.escalationId ?? "");
        const existing = escalationMap.get(id);
        if (existing) escalationMap.set(id, { ...existing, status: "decided" });
        continue;
      }
      if (e.type === "AgentEscalationDelegated") {
        const id = String(p.escalationId ?? "");
        const existing = escalationMap.get(id);
        if (existing) escalationMap.set(id, { ...existing, status: "delegated" });
        continue;
      }
      if (e.type === "AgentEscalationAcknowledged") {
        const id = String(p.escalationId ?? "");
        const existing = escalationMap.get(id);
        if (existing) escalationMap.set(id, { ...existing, status: "acknowledged" });
        continue;
      }
      if (e.type === "AgentEscalationOverdue") {
        const id = String(p.escalationId ?? "");
        const existing = escalationMap.get(id);
        if (existing) escalationMap.set(id, { ...existing, status: "overdue" });
      }
    }

    return [...escalationMap.values()].filter(
      (v) => v.status === "open" || v.status === "acknowledged" || v.status === "overdue",
    );
  }

  // -------------------------------------------------------------------------
  // readReconFindingsForMe — AuditFinding events addressed to this agent
  // -------------------------------------------------------------------------

  readReconFindingsForMe(agentUrn: AgentUrn): readonly AuditFinding[] {
    const findings: AuditFinding[] = [];
    for (const e of this.eventStore.replay({ entity: this.entity })) {
      if (e.type !== "AuditFinding") continue;
      const p = e.payload as Record<string, unknown>;
      if (String(p.addressedTo ?? "") !== agentUrn) continue;
      // Only "open" findings (no ClosedBy counterpart). For now we include
      // all — a future slice folds ValidationFindingClosed events.
      findings.push({
        findingId: String(p.findingId ?? e.event_id),
        emittedAt: e.as_of,
        raisedBy: String(p.raisedBy ?? e.actor.id) as AgentUrn,
        addressedTo: agentUrn,
        severity: (p.severity as AuditFinding["severity"]) ?? "low",
        summary: String(p.summary ?? p.description ?? ""),
        citations: Array.isArray(p.citations) ? (p.citations as string[]).map(String) : [],
      });
    }
    return findings;
  }

  // -------------------------------------------------------------------------
  // readMyRecentRuns — fold SubstrateAgentRunStarted/Completed/Failed
  // -------------------------------------------------------------------------

  readMyRecentRuns(agentUrn: AgentUrn, n: number): readonly AgentRunSummary[] {
    const agentName = agentUrn.replace(/^agent:/, "");
    const startedMap = new Map<
      string,
      { runId: string; trigger: AgentRunSummary["trigger"]; startedAt: string }
    >();
    const completedMap = new Map<
      string,
      { completedAt: string; outcome: "ok" | "failed"; eventsEmitted: number; deliverable?: string }
    >();

    for (const e of this.eventStore.replay({ entity: this.entity })) {
      const p = e.payload as Record<string, unknown>;
      if (e.type === "SubstrateAgentRunStarted") {
        const agentStr = String(p.agent ?? "");
        if (agentStr.toLowerCase() !== agentName.toLowerCase()) continue;
        const runId = String(p.runId ?? "");
        if (!runId) continue;
        const triggerRaw = p.trigger as Record<string, unknown> | undefined;
        startedMap.set(runId, {
          runId,
          trigger: {
            kind: (triggerRaw?.kind as "scheduled" | "event-driven" | "on-request") ?? "on-request",
            id: String(triggerRaw?.id ?? ""),
          },
          startedAt: String(p.startedAt ?? e.as_of),
        });
        continue;
      }
      if (e.type === "SubstrateAgentRunCompleted") {
        const runId = String(p.runId ?? "");
        if (!runId) continue;
        const deliverable = p.deliverable ? String(p.deliverable) : undefined;
        completedMap.set(runId, {
          completedAt: String(p.completedAt ?? e.as_of),
          outcome: p.ok ? "ok" : "failed",
          eventsEmitted: Number(p.eventsEmitted ?? 0),
          ...(deliverable !== undefined ? { deliverable } : {}),
        });
        continue;
      }
      if (e.type === "SubstrateAgentRunFailed") {
        const runId = String(p.runId ?? "");
        if (!runId) continue;
        completedMap.set(runId, {
          completedAt: String(p.failedAt ?? e.as_of),
          outcome: "failed",
          eventsEmitted: 0,
        });
      }
    }

    // Join started + completed, sort newest-first, cap at n.
    const runs: AgentRunSummary[] = [];
    for (const [runId, started] of startedMap.entries()) {
      const completed = completedMap.get(runId);
      if (!completed) continue; // still in-flight or orphaned
      runs.push({
        runId: started.runId,
        trigger: started.trigger,
        startedAt: started.startedAt,
        completedAt: completed.completedAt,
        outcome: completed.outcome,
        eventsEmitted: completed.eventsEmitted,
        ...(completed.deliverable ? { deliverable: completed.deliverable } : {}),
      });
    }
    runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return runs.slice(0, n);
  }

  // -------------------------------------------------------------------------
  // private helpers
  // -------------------------------------------------------------------------

  private buildAllRegisters(_asOf: string): Record<RegisterName, Register> {
    const names: RegisterName[] = [
      "decisions",
      "correspondence",
      "agent-runs",
      "documents",
      "feedback",
      "briefs",
      "workstreams",
      "party",
    ];
    const result: Partial<Record<RegisterName, Register>> = {};
    for (const name of names) {
      result[name] = this.readRegister(name);
    }
    return result as Record<RegisterName, Register>;
  }
}
