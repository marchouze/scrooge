// v2-core/context-pack/builder.ts
//
// Per-seat context pack builder — pure projection over the event store.
// `buildContextPack(seatId, events, asOf)` produces a `ContextPack` that
// captures what the seat "knew" at `asOf`:
//
//   1. Posture slice      — PostureRegistered events where `proposedBy` starts
//                           with the seat name (case-insensitive).
//   2. Applicable obligs  — ApplicabilityAssessmentConcluded{verdict:"applies",
//                           subjectKind:"obligation"} conclusions (entity-level;
//                           all seats share the same applicable-obligation set
//                           since obligations bind the entity, not individual
//                           seats; the count is the same across all seats).
//   3. Open queue         — ApplicabilityAssessmentRequested events that have no
//                           matching Concluded (any subjectKind).
//   4. Re-opened          — Concluded assessments whose subjectRef has a newer
//                           ApplicabilityAssessmentRequested (verbatimHash drift
//                           re-opens the queue; the Slice-C adopt-route emits a
//                           fresh Requested in that case).
//   5. Decision-impact    — DecisionImpactAssessed findings where at least one
//                           impacted artefact refs a posture in this seat's
//                           posture slice.
//
// PACKAGE BOUNDARY: no v1 imports.
// Authority: D-W8-PARAMETRIC-TRAINING-POSITION; D-W8-EXAM-GOVERNANCE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import type { ContextPackBuiltPayload } from "./events";

// ---------------------------------------------------------------------------
// Minimal raw event shapes the builder reads
// (typed lightly — no v1 EventStore import permitted)
// ---------------------------------------------------------------------------

export interface RawEvent {
  readonly type: string;
  readonly as_of?: string;
  // biome-ignore lint/suspicious/noExplicitAny: raw payload from event store
  readonly payload: any;
}

// ---------------------------------------------------------------------------
// ContextPack — the built artefact
// ---------------------------------------------------------------------------

export interface PostureEntry {
  readonly postureId: string;
  readonly postureClass: string;
  readonly description: string;
  readonly proposedBy: string;
}

export interface ApplicableObligation {
  readonly assessmentId: string;
  readonly subjectRef: string;
  readonly verdict: string;
  readonly appliesToContexts: readonly string[];
}

export interface OpenQueueEntry {
  readonly assessmentId: string;
  readonly subjectRef: string;
  readonly subjectKind: string;
  readonly requestedBy: string;
}

export interface DecisionImpactEntry {
  readonly sweepId: string;
  readonly decisionId: string;
  readonly matchedArtefactRefs: readonly string[];
  readonly recommendedActions: readonly string[];
}

export interface ContextPack {
  readonly seatId: string;
  readonly asOf: string;
  /** Postures proposed by this seat. */
  readonly postures: readonly PostureEntry[];
  /** Obligation assessments concluded with verdict "applies". */
  readonly applicableObligations: readonly ApplicableObligation[];
  /** Assessment requests not yet concluded. */
  readonly openQueue: readonly OpenQueueEntry[];
  /** Impact sweeps where at least one impacted artefact is in this seat's posture slice. */
  readonly decisionImpactItems: readonly DecisionImpactEntry[];
}

// ---------------------------------------------------------------------------
// Seat name matching helper
// ---------------------------------------------------------------------------

/**
 * Returns true if `proposedBy` string starts with `seatId` (case-insensitive).
 * Seat names are stored like "Helena (Chief Risk Officer, governance)";
 * seatId is the lowercase first-word of that string (e.g. "helena").
 */
function proposedBySeat(proposedBy: string, seatId: string): boolean {
  return proposedBy.toLowerCase().startsWith(seatId.toLowerCase());
}

// ---------------------------------------------------------------------------
// Hash helper — SHA-256 via Web Crypto (available in Bun without v1 deps)
// ---------------------------------------------------------------------------

export async function hashPack(pack: ContextPack): Promise<string> {
  const text = JSON.stringify(pack);
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build a context pack for `seatId` from a flat array of raw events, filtered
 * to those with `as_of <= asOf`. Returns a `ContextPack` (pure — no side
 * effects, no event writes).
 */
export function buildContextPack(
  seatId: string,
  events: readonly RawEvent[],
  asOf: string,
): ContextPack {
  // Filter to events on or before asOf.
  const relevant = events.filter((e) => !e.as_of || e.as_of.slice(0, 10) <= asOf);

  // ---------------------------------------------------------------------------
  // 1. Posture slice — PostureRegistered where proposedBy starts with seatId
  // ---------------------------------------------------------------------------
  const postureMap = new Map<string, PostureEntry>();
  for (const ev of relevant) {
    if (ev.type !== "PostureRegistered") continue;
    const p = ev.payload;
    if (!p?.postureId || !p?.proposedBy) continue;
    if (!proposedBySeat(String(p.proposedBy), seatId)) continue;
    postureMap.set(String(p.postureId), {
      postureId: String(p.postureId),
      postureClass: String(p.postureClass ?? ""),
      description: String(p.description ?? ""),
      proposedBy: String(p.proposedBy),
    });
  }
  const postures = Array.from(postureMap.values());
  const seatPostureIds = new Set(postures.map((p) => p.postureId));

  // ---------------------------------------------------------------------------
  // 2 & 3 & 4. Assessment events — fold by assessmentId
  // ---------------------------------------------------------------------------
  const requestedByAssessmentId = new Map<
    string,
    { subjectRef: string; subjectKind: string; requestedBy: string; requestedAt: string }
  >();
  const concludedByAssessmentId = new Map<
    string,
    {
      verdict: string;
      appliesToContexts: readonly string[];
      subjectKind: string;
      subjectRef: string;
    }
  >();

  for (const ev of relevant) {
    const p = ev.payload;
    if (!p?.assessmentId) continue;
    const id = String(p.assessmentId);

    if (ev.type === "ApplicabilityAssessmentRequested") {
      // Latest-wins for re-opened assessments (new Requested replaces old for same id).
      requestedByAssessmentId.set(id, {
        subjectRef: String(p.subjectRef ?? ""),
        subjectKind: String(p.subjectKind ?? ""),
        requestedBy: String(p.requestedBy ?? ""),
        requestedAt: String(ev.as_of ?? ""),
      });
    } else if (ev.type === "ApplicabilityAssessmentConcluded") {
      concludedByAssessmentId.set(id, {
        verdict: String(p.verdict ?? ""),
        appliesToContexts: Array.isArray(p.appliesToContexts) ? p.appliesToContexts : [],
        subjectKind: String(p.subjectKind ?? (requestedByAssessmentId.get(id)?.subjectKind ?? "")),
        subjectRef: String(p.subjectRef ?? (requestedByAssessmentId.get(id)?.subjectRef ?? "")),
      });
    }
  }

  // Applicable obligations — concluded with verdict "applies" and subjectKind from Requested
  const applicableObligations: ApplicableObligation[] = [];
  for (const [assessmentId, concluded] of concludedByAssessmentId) {
    if (concluded.verdict !== "applies") continue;
    // Determine subjectKind from the Requested (the Concluded doesn't carry it directly in payload)
    const req = requestedByAssessmentId.get(assessmentId);
    const subjectKind = req?.subjectKind ?? concluded.subjectKind;
    if (subjectKind !== "obligation") continue;
    const subjectRef = req?.subjectRef ?? concluded.subjectRef;
    applicableObligations.push({
      assessmentId,
      subjectRef,
      verdict: concluded.verdict,
      appliesToContexts: concluded.appliesToContexts,
    });
  }

  // Open queue — Requested with no Concluded
  const openQueue: OpenQueueEntry[] = [];
  for (const [assessmentId, req] of requestedByAssessmentId) {
    if (concludedByAssessmentId.has(assessmentId)) continue;
    openQueue.push({
      assessmentId,
      subjectRef: req.subjectRef,
      subjectKind: req.subjectKind,
      requestedBy: req.requestedBy,
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Decision-impact items — DecisionImpactAssessed whose impacted artefacts
  //    include at least one posture in this seat's posture slice
  // ---------------------------------------------------------------------------
  const decisionImpactItems: DecisionImpactEntry[] = [];
  // Collect latest DecisionImpactAssessed per sweepId
  const latestSweep = new Map<
    string,
    {
      sweepId: string;
      decisionId: string;
      impacted: Array<{ artefactKind: string; artefactRef: string }>;
      recommendedActions: string[];
    }
  >();
  for (const ev of relevant) {
    if (ev.type !== "DecisionImpactAssessed") continue;
    const p = ev.payload;
    if (!p?.sweepId) continue;
    latestSweep.set(String(p.sweepId), {
      sweepId: String(p.sweepId),
      decisionId: String(p.decisionId ?? ""),
      impacted: Array.isArray(p.impacted) ? p.impacted : [],
      recommendedActions: Array.isArray(p.recommendedActions) ? p.recommendedActions : [],
    });
  }
  for (const sweep of latestSweep.values()) {
    const matchedRefs = sweep.impacted
      .filter(
        (a) =>
          (a.artefactKind === "posture" && seatPostureIds.has(a.artefactRef)) ||
          // Also include non-trivial impacts on obligations in scope if no postures —
          // for seats with no postures, surface decision impacts on any impacted artefact.
          (seatPostureIds.size === 0 && a.artefactKind !== "procedure"),
      )
      .map((a) => a.artefactRef);
    if (matchedRefs.length === 0) continue;
    decisionImpactItems.push({
      sweepId: sweep.sweepId,
      decisionId: sweep.decisionId,
      matchedArtefactRefs: matchedRefs,
      recommendedActions: sweep.recommendedActions,
    });
  }

  return {
    seatId,
    asOf,
    postures,
    applicableObligations,
    openQueue,
    decisionImpactItems,
  };
}

/**
 * Derive the `ContextPackBuiltPayload` metadata from a built pack and its hash.
 * The payload is suitable for emitting as a `ContextPackBuilt` event.
 */
export function packToEventPayload(
  pack: ContextPack,
  packHash: string,
): ContextPackBuiltPayload {
  return {
    seatId: pack.seatId,
    packVersion: packHash.slice(0, 16),
    asOf: pack.asOf,
    postureCount: pack.postures.length,
    applicableObligationCount: pack.applicableObligations.length,
    openQueueCount: pack.openQueue.length,
    decisionImpactItemCount: pack.decisionImpactItems.length,
    packHash,
  };
}
