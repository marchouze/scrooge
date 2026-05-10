// platform/rms-registers/briefs-dispatches.ts
//
// RMS Phase 1 Slice 3 — Briefs / Dispatches register projection.
//
// Spec §6.6. One row per `AgentBriefIssued`, keyed by `briefId`. The status
// is *derived* from downstream events:
//
//   - "issued"     — `AgentBriefIssued` with no matching `AgentRunStarted`.
//   - "in-flight"  — at least one `AgentRunStarted` with `briefId`, no
//                    matching `AgentRunCompleted` yet.
//   - "delivered"  — latest matching `AgentRunCompleted` has
//                    `outcome === "delivered"`.
//   - "blocked"    — latest matching `AgentRunCompleted` has
//                    `outcome === "blocked"`.
//   - "withdrawn"  — latest matching `AgentRunCompleted` has
//                    `outcome === "withdrawn"`.
//   - "superseded" — a `BriefSuperseded` event named this briefId as
//                    `originalBriefId` (terminal — overrides any other
//                    status).
//
// The supersession chain is captured via `supersedingBriefId`; the new brief
// (`supersededBy` field on the AgentBriefIssued payload) gets recorded as the
// "issued" row pointing back via `supersedes`.
//
// Author: Anya (Data / analytics engineer, engineering)

import type {
  AgentBriefIssuedPayload,
  AgentRunCompletedPayload,
  AgentRunStartedPayload,
  BriefSupersededPayload,
  RmsAgentRef,
} from "../event-store/event-types";
import type { Event } from "../event-store/types";
import type { Projection } from "../projections/types";

export type BriefsRegisterStatus =
  | "issued"
  | "in-flight"
  | "delivered"
  | "blocked"
  | "withdrawn"
  | "superseded";

export interface BriefsRegisterRow {
  readonly briefId: string;
  readonly issuedTo: RmsAgentRef;
  readonly issuedBy: RmsAgentRef;
  readonly title: string;
  readonly directiveDocumentHash: string;
  readonly priority: AgentBriefIssuedPayload["priority"];
  readonly workstreamId: string | null;
  readonly scheduledFor: string | null;
  readonly supersedes: string | null;
  readonly supersedingBriefId: string | null;
  readonly status: BriefsRegisterStatus;
  readonly runId: string | null;
  readonly expectedOutputs: AgentBriefIssuedPayload["expectedOutputs"];
  readonly issuedAt: string;
  readonly issuedEventId: string;
  /** Reason captured by `BriefSuperseded` — null until superseded. */
  readonly supersessionReason: BriefSupersededPayload["reason"] | null;
}

export interface BriefsRegisterState {
  readonly rows: ReadonlyMap<string, BriefsRegisterRow>;
}

export const briefsRegisterInitial: BriefsRegisterState = { rows: new Map() };

const BRIEFS_TYPES = new Set([
  "AgentBriefIssued",
  "AgentRunStarted",
  "AgentRunCompleted",
  "BriefSuperseded",
]);

function isBriefEvent(event: { type: string }): boolean {
  return BRIEFS_TYPES.has(event.type);
}

function applyIssued(state: BriefsRegisterState, event: Event): BriefsRegisterState {
  const p = event.payload as AgentBriefIssuedPayload;
  const id = p.briefId;
  if (!id) return state;
  const next = new Map(state.rows);
  // Pre-existing row may exist if a downstream event arrived first
  // (out-of-order replay). Preserve its derived fields.
  const existing = state.rows.get(id);
  next.set(id, {
    briefId: id,
    issuedTo: p.issuedTo,
    issuedBy: p.issuedBy,
    title: p.title,
    directiveDocumentHash: p.directiveDocumentHash,
    priority: p.priority,
    workstreamId: p.workstreamId ?? null,
    scheduledFor: p.scheduledFor ?? null,
    supersedes: p.supersedes ?? null,
    supersedingBriefId: existing?.supersedingBriefId ?? null,
    status: existing?.status ?? "issued",
    runId: existing?.runId ?? null,
    expectedOutputs: p.expectedOutputs,
    issuedAt: event.as_of,
    issuedEventId: event.event_id,
    supersessionReason: existing?.supersessionReason ?? null,
  });
  return { rows: next };
}

function applyRunStarted(state: BriefsRegisterState, event: Event): BriefsRegisterState {
  const p = event.payload as AgentRunStartedPayload;
  const briefId = p.briefId;
  if (!briefId) return state;
  const existing = state.rows.get(briefId);
  const next = new Map(state.rows);
  if (existing) {
    if (existing.status === "superseded") return state; // terminal
    if (existing.status === "delivered" || existing.status === "blocked") {
      // A new run after delivery — keep the prior terminal status; record
      // runId if not yet set (caller can read the agent-runs register for
      // the full lifecycle).
      next.set(briefId, {
        ...existing,
        runId: existing.runId ?? p.runId,
      });
    } else {
      next.set(briefId, {
        ...existing,
        status: "in-flight",
        runId: p.runId,
      });
    }
  } else {
    // Out-of-order: AgentRunStarted before AgentBriefIssued. Materialise
    // a stub row that AgentBriefIssued will overwrite.
    next.set(briefId, {
      briefId,
      issuedTo: p.agent,
      issuedBy: p.agent,
      title: "(brief not yet seen)",
      directiveDocumentHash:
        "blake3:0000000000000000000000000000000000000000000000000000000000000000",
      priority: "now",
      workstreamId: null,
      scheduledFor: null,
      supersedes: null,
      supersedingBriefId: null,
      status: "in-flight",
      runId: p.runId,
      expectedOutputs: [{ kind: "deliverable-document", description: "(unknown)" }],
      issuedAt: event.as_of,
      issuedEventId: "",
      supersessionReason: null,
    });
  }
  return { rows: next };
}

function applyRunCompleted(state: BriefsRegisterState, event: Event): BriefsRegisterState {
  const p = event.payload as AgentRunCompletedPayload;
  const briefId = p.briefId;
  if (!briefId) return state;
  const existing = state.rows.get(briefId);
  const next = new Map(state.rows);
  const outcomeStatus: BriefsRegisterStatus =
    p.outcome === "delivered" ? "delivered" : p.outcome === "blocked" ? "blocked" : "withdrawn";

  if (existing) {
    if (existing.status === "superseded") return state; // terminal
    next.set(briefId, {
      ...existing,
      status: outcomeStatus,
      runId: existing.runId ?? p.runId,
    });
  } else {
    next.set(briefId, {
      briefId,
      issuedTo: p.agent,
      issuedBy: p.agent,
      title: "(brief not yet seen)",
      directiveDocumentHash:
        "blake3:0000000000000000000000000000000000000000000000000000000000000000",
      priority: "now",
      workstreamId: null,
      scheduledFor: null,
      supersedes: null,
      supersedingBriefId: null,
      status: outcomeStatus,
      runId: p.runId,
      expectedOutputs: [{ kind: "deliverable-document", description: "(unknown)" }],
      issuedAt: event.as_of,
      issuedEventId: "",
      supersessionReason: null,
    });
  }
  return { rows: next };
}

function applySuperseded(state: BriefsRegisterState, event: Event): BriefsRegisterState {
  const p = event.payload as BriefSupersededPayload;
  const id = p.originalBriefId;
  if (!id) return state;
  const existing = state.rows.get(id);
  const next = new Map(state.rows);
  if (existing) {
    next.set(id, {
      ...existing,
      status: "superseded",
      supersedingBriefId: p.supersededBy,
      supersessionReason: p.reason,
    });
  } else {
    // No prior row — record a placeholder so the chain is queryable.
    next.set(id, {
      briefId: id,
      issuedTo: p.authorisedBy,
      issuedBy: p.authorisedBy,
      title: "(superseded — original brief not seen)",
      directiveDocumentHash:
        "blake3:0000000000000000000000000000000000000000000000000000000000000000",
      priority: "now",
      workstreamId: null,
      scheduledFor: null,
      supersedes: null,
      supersedingBriefId: p.supersededBy,
      status: "superseded",
      runId: null,
      expectedOutputs: [{ kind: "deliverable-document", description: "(unknown)" }],
      issuedAt: event.as_of,
      issuedEventId: "",
      supersessionReason: p.reason,
    });
  }
  return { rows: next };
}

export const briefsRegisterProjection: Projection<BriefsRegisterState, Event> = {
  name: "rms.briefs-dispatches",
  initial: briefsRegisterInitial,
  accepts: (e): e is Event => isBriefEvent(e),
  reduce(state, event) {
    if (event.type === "AgentBriefIssued") return applyIssued(state, event);
    if (event.type === "AgentRunStarted") return applyRunStarted(state, event);
    if (event.type === "AgentRunCompleted") return applyRunCompleted(state, event);
    if (event.type === "BriefSuperseded") return applySuperseded(state, event);
    return state;
  },
  encodeSnapshot(state) {
    return JSON.stringify({ rows: Array.from(state.rows.entries()) });
  },
  decodeSnapshot(payload) {
    const parsed = JSON.parse(payload) as {
      rows: Array<[string, BriefsRegisterRow]>;
    };
    return { rows: new Map(parsed.rows) };
  },
};

export function briefsRegisterRows(state: BriefsRegisterState): BriefsRegisterRow[] {
  return Array.from(state.rows.values()).sort((a, b) =>
    a.issuedAt < b.issuedAt ? -1 : a.issuedAt > b.issuedAt ? 1 : 0,
  );
}
