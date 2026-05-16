// platform/rms-registers/decisions.ts
//
// RMS Phase 1 Slice 3 — Decisions register projection.
//
// Spec §6.1. Folds `DecisionRequested` events into open rows; resolves them
// when a matching `CeoDecision` lands (pair-coupled by `decisionId`).
//
// Status taxonomy:
//   - `open`        — `DecisionRequested` with no matching `CeoDecision`.
//   - `resolved`    — `CeoDecision` whose `action` is `approve`, `defer`, or
//                     `modify` (terminal — the decision is closed).
//   - `revision-requested` — latest `CeoDecision.action === "request-revision"`;
//                     the row reverts to "needs further work" (still surfaces
//                     in the open-decisions queue per the existing dashboard
//                     convention; spec §6.1 leaves this as derived).
//   - `superseded`  — a later `CeoDecision` for the same `decisionId` exists
//                     (latest-wins-per-key replay rule, registry §GOVERNANCE).
//
// Idempotency / determinism: replay produces the same set of rows regardless
// of event interleaving, because both reducer branches are commutative under
// the latest-wins rule (CeoDecision tracks `latestAsOf` per decisionId).
//
// Author: Anya (Data / analytics engineer, engineering)

import { z } from "zod";
import type { DecisionRequestedPayload } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import type { Projection } from "../projections/types";

export type DecisionsRegisterStatus = "open" | "resolved" | "revision-requested" | "superseded";

/** The CeoDecision payload fields the register surfaces. */
export interface DecisionsRegisterResolution {
  readonly eventId: string;
  readonly action: "approve" | "defer" | "modify" | "request-revision";
  readonly outcome: string;
  readonly comment?: string;
  readonly recordedVia: string;
  readonly resolvedAt: string;
  readonly actorId: string;
}

export interface DecisionsRegisterRow {
  /** Stable decision identifier from the source `DecisionRequested`. */
  readonly decisionId: string;
  /** EventId of the `DecisionRequested` (audit pin). */
  readonly requestEventId: string;
  readonly title: string;
  readonly category: DecisionRequestedPayload["category"];
  readonly owner: DecisionRequestedPayload["owner"];
  readonly forActor: DecisionRequestedPayload["forActor"];
  readonly decisionForActor: string;
  readonly recommendation: DecisionRequestedPayload["recommendation"];
  readonly sourceDocumentHashes: readonly string[];
  readonly decisionCitations: readonly string[];
  readonly options: DecisionRequestedPayload["options"];
  readonly deadline: string | null;
  readonly requestedAt: string;
  readonly status: DecisionsRegisterStatus;
  /** Set when status === "resolved" or "revision-requested". */
  readonly resolution: DecisionsRegisterResolution | null;
  readonly resolvedAt: string | null;
}

export interface DecisionsRegisterState {
  readonly rows: ReadonlyMap<string, DecisionsRegisterRow>;
}

export const decisionsRegisterInitial: DecisionsRegisterState = { rows: new Map() };

function isDecisionsRegisterEvent(event: { type: string }): boolean {
  return (
    event.type === "DecisionRequested" || event.type === "CeoDecision" || event.type === "Decision" // D-DECISIONS-FRAMEWORK-REDESIGN Slice C unified type
  );
}

function applyDecisionRequested(
  state: DecisionsRegisterState,
  event: Event,
): DecisionsRegisterState {
  const p = event.payload as DecisionRequestedPayload;
  const decisionId = String(p.decisionId);
  if (!decisionId) return state;

  // If a CeoDecision already arrived for this decisionId (out-of-order
  // replay is theoretically possible because the projector folds in
  // event-store sequence order, not per-key sequence order), preserve
  // the resolution while filling in the request-side fields.
  const existing = state.rows.get(decisionId);
  const next = new Map(state.rows);
  next.set(decisionId, {
    decisionId,
    requestEventId: event.event_id,
    title: p.title,
    category: p.category,
    owner: p.owner,
    forActor: p.forActor,
    decisionForActor: p.decisionForActor,
    recommendation: p.recommendation,
    sourceDocumentHashes: [...p.sourceDocumentHashes],
    decisionCitations: [...p.citations],
    options: p.options,
    deadline: p.deadline ?? null,
    requestedAt: event.as_of,
    status: existing?.status ?? "open",
    resolution: existing?.resolution ?? null,
    resolvedAt: existing?.resolvedAt ?? null,
  });
  return { rows: next };
}

function applyCeoDecision(state: DecisionsRegisterState, event: Event): DecisionsRegisterState {
  const p = event.payload as Record<string, unknown>;
  const decisionId = typeof p.decisionId === "string" ? p.decisionId : "";
  if (!decisionId) return state;
  const action = String(p.action ?? "approve");
  if (
    action !== "approve" &&
    action !== "defer" &&
    action !== "modify" &&
    action !== "request-revision"
  ) {
    return state;
  }
  const existing = state.rows.get(decisionId);

  // Latest-wins-per-key (registry §GOVERNANCE replay rule). If we already
  // have a more-recent CeoDecision for this decisionId, mark the existing
  // resolution superseded and adopt the new one — but only when ordering
  // by event.as_of. The reducer is fed events in event-store sequence
  // order; for safety we compare timestamps.
  const newResolution: DecisionsRegisterResolution = {
    eventId: event.event_id,
    action,
    outcome: typeof p.outcome === "string" ? p.outcome : "",
    ...(typeof p.comment === "string" ? { comment: p.comment } : {}),
    recordedVia: typeof p.recordedVia === "string" ? p.recordedVia : "unknown",
    resolvedAt: event.as_of,
    actorId: event.actor.id,
  };

  let status: DecisionsRegisterStatus;
  if (action === "request-revision") status = "revision-requested";
  else status = "resolved";

  // If existing already has a later-as-of resolution, the new one is
  // superseded — keep the later one. Two CeoDecisions for the same
  // decisionId at the same as_of: prefer the later event_id (sequence
  // order) which is the one we are processing now, by definition.
  if (existing?.resolution && existing.resolvedAt && existing.resolvedAt > event.as_of) {
    // The existing resolution is more recent — record this one as superseded
    // by leaving the existing resolution intact; status unchanged.
    const next = new Map(state.rows);
    next.set(decisionId, {
      ...existing,
      status: "superseded",
    });
    return { rows: next };
  }

  // The new resolution wins.
  const next = new Map(state.rows);
  if (existing) {
    next.set(decisionId, {
      ...existing,
      status,
      resolution: newResolution,
      resolvedAt: event.as_of,
    });
  } else {
    // CeoDecision before DecisionRequested (out-of-order replay or
    // legacy CEO decisions that pre-date RMS). Materialise a stub row.
    next.set(decisionId, {
      decisionId,
      requestEventId: "",
      title: typeof p.title === "string" ? p.title : decisionId,
      category: "near-term",
      owner: { name: "unknown", position: "unknown" },
      forActor: "CEO",
      decisionForActor: "",
      recommendation: { stance: "", reasoning: "" },
      sourceDocumentHashes: [],
      decisionCitations: [],
      options: undefined,
      deadline: null,
      requestedAt: event.as_of,
      status,
      resolution: newResolution,
      resolvedAt: event.as_of,
    });
  }
  return { rows: next };
}

/**
 * Apply a unified `Decision` event (D-DECISIONS-FRAMEWORK-REDESIGN Slice C).
 * Maps the `phase` field onto the legacy `action` vocabulary the register uses,
 * then delegates to the same resolution logic as `applyCeoDecision`.
 */
function applyDecision(state: DecisionsRegisterState, event: Event): DecisionsRegisterState {
  const p = event.payload as Record<string, unknown>;
  const decisionId = typeof p.decisionId === "string" ? p.decisionId : "";
  if (!decisionId) return state;
  const phase = String(p.phase ?? "");
  // Only terminal phases close a decision row.
  if (phase === "requested") return state; // still open
  // Map Decision.phase → legacy action for the resolution record.
  const actionMap: Record<string, DecisionsRegisterResolution["action"]> = {
    approved: "approve",
    rejected: "approve", // rejection is a terminal close; surface as "approve" pending Phase 2 richer action set
    deferred: "defer",
    superseded: "modify",
    withdrawn: "modify",
  };
  const action: DecisionsRegisterResolution["action"] = actionMap[phase] ?? "approve";
  const existing = state.rows.get(decisionId);
  if (existing?.resolution && existing.resolvedAt && existing.resolvedAt > event.as_of) {
    const next = new Map(state.rows);
    next.set(decisionId, { ...existing, status: "superseded" });
    return { rows: next };
  }
  const newResolution: DecisionsRegisterResolution = {
    eventId: event.event_id,
    action,
    outcome: typeof p.recommendation === "string" ? p.recommendation : "",
    ...(typeof p.rationale === "string" ? { comment: p.rationale } : {}),
    recordedVia: typeof p.recordedVia === "string" ? p.recordedVia : "unknown",
    resolvedAt: event.as_of,
    actorId: event.actor.id,
  };
  const next = new Map(state.rows);
  if (existing) {
    next.set(decisionId, {
      ...existing,
      status: "resolved",
      resolution: newResolution,
      resolvedAt: event.as_of,
    });
  } else {
    // Decision event before DecisionRequested (legacy backfill or direct approval).
    // Materialise a stub row so the decision is visible in the register.
    next.set(decisionId, {
      decisionId,
      requestEventId: "",
      title: typeof p.title === "string" ? p.title : decisionId,
      category: "near-term",
      owner: { name: "unknown", position: "unknown" },
      forActor: "CEO",
      decisionForActor: "",
      recommendation: { stance: "", reasoning: "" },
      sourceDocumentHashes: [],
      decisionCitations: [],
      options: undefined,
      deadline: null,
      requestedAt: event.as_of,
      status: "resolved",
      resolution: newResolution,
      resolvedAt: event.as_of,
    });
  }
  return { rows: next };
}

export const decisionsRegisterProjection: Projection<DecisionsRegisterState, Event> = {
  name: "rms.decisions",
  initial: decisionsRegisterInitial,
  accepts: (e): e is Event => isDecisionsRegisterEvent(e),
  reduce(state, event) {
    if (event.type === "DecisionRequested") return applyDecisionRequested(state, event);
    if (event.type === "CeoDecision") return applyCeoDecision(state, event);
    if (event.type === "Decision") return applyDecision(state, event);
    return state;
  },
  encodeSnapshot(state) {
    return JSON.stringify({
      rows: Array.from(state.rows.entries()),
    });
  },
  decodeSnapshot(payload) {
    const SnapshotSchema = z.object({
      rows: z.array(z.tuple([z.string(), z.record(z.unknown())])),
    });
    let raw: unknown;
    try {
      raw = JSON.parse(payload);
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "bank-prototype",
          pipeline: "rms.decisions",
          msg: "decodeSnapshot: JSON.parse failed — degrading to empty state (F-007)",
          error: String(err),
        }),
      );
      return decisionsRegisterInitial;
    }
    const result = SnapshotSchema.safeParse(raw);
    if (!result.success) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "bank-prototype",
          pipeline: "rms.decisions",
          msg: "decodeSnapshot: Zod validation failed — degrading to empty state (F-007)",
          error: result.error.message,
        }),
      );
      return decisionsRegisterInitial;
    }
    const parsed = result.data as unknown as { rows: Array<[string, DecisionsRegisterRow]> };
    return { rows: new Map(parsed.rows) };
  },
};

/** Convenience: rows as a stable-ordered array (by `requestedAt` ascending). */
export function decisionsRegisterRows(state: DecisionsRegisterState): DecisionsRegisterRow[] {
  return Array.from(state.rows.values()).sort((a, b) =>
    a.requestedAt < b.requestedAt ? -1 : a.requestedAt > b.requestedAt ? 1 : 0,
  );
}

/** Convenience: rows filtered by `forActor` (e.g. the Decisions Desk). */
export function decisionsRegisterByActor(
  state: DecisionsRegisterState,
  forActor: DecisionRequestedPayload["forActor"],
  status?: DecisionsRegisterStatus,
): DecisionsRegisterRow[] {
  return decisionsRegisterRows(state).filter(
    (r) => r.forActor === forActor && (status === undefined || r.status === status),
  );
}
