// platform/rms-registers/workstreams.ts
//
// RMS Phase 1 Slice 3 — Workstreams register projection.
//
// Spec §6.7. A workstream is the logical grouping `AgentBriefIssued.workstreamId`.
// The projection folds:
//
//   - `AgentBriefIssued` → adds the brief's `briefId` to the workstream;
//     records the first-activity timestamp and the workstream's title (the
//     first-issued brief's title).
//   - `AgentRunStarted` / `AgentRunCompleted` → adds the run-id; threads the
//     deliverable hashes; updates `lastActivityAt`.
//   - `DecisionRequested` → adds the decisionId IF the requesting event names
//     a brief / run that belongs to a tracked workstream. (Slice 3 keeps this
//     loose — Phase 2 wires `DecisionRequested.workstreamId` once briefs
//     start emitting it directly.)
//   - `BriefSuperseded` → if all known briefs in the workstream are
//     superseded, status flips to "complete" or "blocked" depending on the
//     superseding brief's outcome (Slice 4 dashboard render concern).
//
// Status taxonomy (derived):
//   - "active"   — at least one brief in the workstream is `issued` or
//                  `in-flight`.
//   - "complete" — every brief is `delivered` or `superseded`.
//   - "blocked"  — every brief is terminal but at least one is `blocked`.
//
// Author: Anya (Data / analytics engineer, engineering)

import { z } from "zod";
import type {
  AgentBriefIssuedPayload,
  AgentRunCompletedPayload,
  AgentRunStartedPayload,
  BriefSupersededPayload,
} from "../event-store/event-types";
import type { Event } from "../event-store/types";
import type { Projection } from "../projections/types";

export type WorkstreamsStatus = "active" | "complete" | "blocked";

interface BriefStatusBucket {
  /** Per-brief outcome tracked inside the workstream. */
  readonly briefId: string;
  readonly outcome: "issued" | "in-flight" | "delivered" | "blocked" | "withdrawn" | "superseded";
}

export interface WorkstreamsRegisterRow {
  readonly workstreamId: string;
  readonly title: string;
  readonly briefIds: readonly string[];
  readonly runIds: readonly string[];
  readonly decisionIds: readonly string[];
  readonly documentHashes: readonly string[];
  readonly status: WorkstreamsStatus;
  readonly firstActivityAt: string;
  readonly lastActivityAt: string;
  /** Internal — per-brief outcome tracker, used to derive the status. */
  readonly briefOutcomes: ReadonlyArray<BriefStatusBucket>;
}

export interface WorkstreamsRegisterState {
  readonly rows: ReadonlyMap<string, WorkstreamsRegisterRow>;
  /** Reverse index: briefId → workstreamId, populated by AgentBriefIssued. */
  readonly briefToWorkstream: ReadonlyMap<string, string>;
  /** Reverse index: runId → workstreamId, populated by AgentRunStarted. */
  readonly runToWorkstream: ReadonlyMap<string, string>;
}

export const workstreamsRegisterInitial: WorkstreamsRegisterState = {
  rows: new Map(),
  briefToWorkstream: new Map(),
  runToWorkstream: new Map(),
};

const WORKSTREAM_TYPES = new Set([
  "AgentBriefIssued",
  "AgentRunStarted",
  "AgentRunCompleted",
  "BriefSuperseded",
]);

function isWorkstreamEvent(event: { type: string }): boolean {
  return WORKSTREAM_TYPES.has(event.type);
}

function deriveStatus(briefs: readonly BriefStatusBucket[]): WorkstreamsStatus {
  if (briefs.length === 0) return "active";
  let hasOpen = false;
  let hasBlocked = false;
  for (const b of briefs) {
    if (b.outcome === "issued" || b.outcome === "in-flight") hasOpen = true;
    if (b.outcome === "blocked") hasBlocked = true;
  }
  if (hasOpen) return "active";
  if (hasBlocked) return "blocked";
  return "complete";
}

function setBriefOutcome(
  buckets: readonly BriefStatusBucket[],
  briefId: string,
  outcome: BriefStatusBucket["outcome"],
): BriefStatusBucket[] {
  const next = buckets.filter((b) => b.briefId !== briefId);
  next.push({ briefId, outcome });
  return next;
}

function applyIssued(state: WorkstreamsRegisterState, event: Event): WorkstreamsRegisterState {
  const p = event.payload as AgentBriefIssuedPayload;
  const wsId = p.workstreamId;
  if (!wsId) return state;
  const briefId = p.briefId;
  const briefToWs = new Map(state.briefToWorkstream);
  briefToWs.set(briefId, wsId);

  const existing = state.rows.get(wsId);
  const briefIds = existing ? [...existing.briefIds] : [];
  if (!briefIds.includes(briefId)) briefIds.push(briefId);
  const buckets = existing
    ? setBriefOutcome(existing.briefOutcomes, briefId, "issued")
    : [{ briefId, outcome: "issued" as const }];

  const next = new Map(state.rows);
  next.set(wsId, {
    workstreamId: wsId,
    title: existing?.title ?? p.title,
    briefIds,
    runIds: existing?.runIds ?? [],
    decisionIds: existing?.decisionIds ?? [],
    documentHashes: existing?.documentHashes ?? [],
    status: deriveStatus(buckets),
    firstActivityAt: existing?.firstActivityAt ?? event.as_of,
    lastActivityAt: event.as_of,
    briefOutcomes: buckets,
  });
  return {
    rows: next,
    briefToWorkstream: briefToWs,
    runToWorkstream: state.runToWorkstream,
  };
}

function applyRunStarted(state: WorkstreamsRegisterState, event: Event): WorkstreamsRegisterState {
  const p = event.payload as AgentRunStartedPayload;
  const wsId = state.briefToWorkstream.get(p.briefId);
  if (!wsId) return state;
  const existing = state.rows.get(wsId);
  if (!existing) return state;

  const runToWs = new Map(state.runToWorkstream);
  runToWs.set(p.runId, wsId);

  const runIds = existing.runIds.includes(p.runId)
    ? [...existing.runIds]
    : [...existing.runIds, p.runId];
  const buckets = setBriefOutcome(existing.briefOutcomes, p.briefId, "in-flight");

  const next = new Map(state.rows);
  next.set(wsId, {
    ...existing,
    runIds,
    status: deriveStatus(buckets),
    lastActivityAt: event.as_of,
    briefOutcomes: buckets,
  });
  return { rows: next, briefToWorkstream: state.briefToWorkstream, runToWorkstream: runToWs };
}

function applyRunCompleted(
  state: WorkstreamsRegisterState,
  event: Event,
): WorkstreamsRegisterState {
  const p = event.payload as AgentRunCompletedPayload;
  const wsId = state.briefToWorkstream.get(p.briefId) ?? state.runToWorkstream.get(p.runId);
  if (!wsId) return state;
  const existing = state.rows.get(wsId);
  if (!existing) return state;

  const runIds = existing.runIds.includes(p.runId)
    ? [...existing.runIds]
    : [...existing.runIds, p.runId];

  // Merge deliverable hashes (de-duplicated).
  const hashSet = new Set(existing.documentHashes);
  for (const h of p.deliverableDocumentHashes) hashSet.add(h);
  const documentHashes = Array.from(hashSet);

  const briefOutcome: BriefStatusBucket["outcome"] =
    p.outcome === "delivered" ? "delivered" : p.outcome === "blocked" ? "blocked" : "withdrawn";
  const buckets = setBriefOutcome(existing.briefOutcomes, p.briefId, briefOutcome);

  // Decision fan-out via followOnRoutes.
  const decisionIds = [...existing.decisionIds];
  for (const route of p.followOnRoutes) {
    if (route.kind === "decision" && !decisionIds.includes(route.target)) {
      decisionIds.push(route.target);
    }
  }

  const next = new Map(state.rows);
  next.set(wsId, {
    ...existing,
    runIds,
    documentHashes,
    decisionIds,
    status: deriveStatus(buckets),
    lastActivityAt: event.as_of,
    briefOutcomes: buckets,
  });
  return {
    rows: next,
    briefToWorkstream: state.briefToWorkstream,
    runToWorkstream: state.runToWorkstream,
  };
}

function applySuperseded(state: WorkstreamsRegisterState, event: Event): WorkstreamsRegisterState {
  const p = event.payload as BriefSupersededPayload;
  const wsId = state.briefToWorkstream.get(p.originalBriefId);
  if (!wsId) return state;
  const existing = state.rows.get(wsId);
  if (!existing) return state;
  const buckets = setBriefOutcome(existing.briefOutcomes, p.originalBriefId, "superseded");
  const next = new Map(state.rows);
  next.set(wsId, {
    ...existing,
    status: deriveStatus(buckets),
    lastActivityAt: event.as_of,
    briefOutcomes: buckets,
  });
  return {
    rows: next,
    briefToWorkstream: state.briefToWorkstream,
    runToWorkstream: state.runToWorkstream,
  };
}

export const workstreamsRegisterProjection: Projection<WorkstreamsRegisterState, Event> = {
  name: "rms.workstreams",
  initial: workstreamsRegisterInitial,
  accepts: (e): e is Event => isWorkstreamEvent(e),
  reduce(state, event) {
    if (event.type === "AgentBriefIssued") return applyIssued(state, event);
    if (event.type === "AgentRunStarted") return applyRunStarted(state, event);
    if (event.type === "AgentRunCompleted") return applyRunCompleted(state, event);
    if (event.type === "BriefSuperseded") return applySuperseded(state, event);
    return state;
  },
  encodeSnapshot(state) {
    return JSON.stringify({
      rows: Array.from(state.rows.entries()),
      briefToWorkstream: Array.from(state.briefToWorkstream.entries()),
      runToWorkstream: Array.from(state.runToWorkstream.entries()),
    });
  },
  decodeSnapshot(payload) {
    const SnapshotSchema = z.object({
      rows: z.array(z.tuple([z.string(), z.record(z.unknown())])),
      briefToWorkstream: z.array(z.tuple([z.string(), z.string()])),
      runToWorkstream: z.array(z.tuple([z.string(), z.string()])),
    });
    let raw: unknown;
    try {
      raw = JSON.parse(payload);
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "bank-prototype",
          pipeline: "rms.workstreams",
          msg: "decodeSnapshot: JSON.parse failed — degrading to empty state (F-007)",
          error: String(err),
        }),
      );
      return workstreamsRegisterInitial;
    }
    const result = SnapshotSchema.safeParse(raw);
    if (!result.success) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "bank-prototype",
          pipeline: "rms.workstreams",
          msg: "decodeSnapshot: Zod validation failed — degrading to empty state (F-007)",
          error: result.error.message,
        }),
      );
      return workstreamsRegisterInitial;
    }
    const parsed = result.data as unknown as {
      rows: Array<[string, WorkstreamsRegisterRow]>;
      briefToWorkstream: Array<[string, string]>;
      runToWorkstream: Array<[string, string]>;
    };
    return {
      rows: new Map(parsed.rows),
      briefToWorkstream: new Map(parsed.briefToWorkstream),
      runToWorkstream: new Map(parsed.runToWorkstream),
    };
  },
};

export function workstreamsRegisterRows(state: WorkstreamsRegisterState): WorkstreamsRegisterRow[] {
  return Array.from(state.rows.values()).sort((a, b) =>
    a.firstActivityAt < b.firstActivityAt ? -1 : a.firstActivityAt > b.firstActivityAt ? 1 : 0,
  );
}
