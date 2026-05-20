// platform/markets/netting-sets/projection.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 — Netting-set register projection over
// `ISDACSAAssessmentCompleted`. Pure fold over the event store
// (Principle 1 — events-are-truth; the register is a query, not stored
// state).
//
// Fold rule (v0):
//   - One netting set per counterparty, ID = `NS-<counterpartyId>-<ccy>`.
//   - Each new `ISDACSAAssessmentCompleted` for the same counterparty
//     supersedes the prior row (status: `superseded`), and the new row
//     is registered as `active`.
//   - `csaPresent` is derived from the assessment payload as follows:
//       `isdaStatus = "executed"` AND (`csaThreshold > 0` OR `mta > 0`)
//         → `csaPresent = true` (margined RC branch in SA-CCR);
//       `isdaStatus = "executed"` AND `csaThreshold = 0` AND `mta = 0`
//         → `csaPresent = false` (ISDA Master executed, no CSA in place;
//         unmargined RC branch). This is the FX-spot-only controlled-
//         launch posture per Imani (Chief Legal Counsel, governance)'s
//         G-9 decision (record `record:documents:imani:g9-isda-vs-
//         bilateral-fx-master-for-spot:2026-05-20`) — ISDA 2002 in force,
//         no CSA at controlled-launch because FX-spot T+2 does not
//         generate continuing MTM exposure;
//       `isdaStatus ∈ {"in-negotiation", "absent"}` → `csaPresent = false`
//         regardless of threshold / MTA.
//     Threshold + MTA are recorded in every case (the event payload
//     carries them), but the SA-CCR engine only consults them when
//     `csaPresent = true` (margined branch).
//
// Substrate gap (queued under D-CREDIT-LIMIT-ENGINE-BUILD):
//   - `NettingAgreementValidated` / `NettingAgreementLapsed` events do
//     not yet exist. Once registered, this projection should also fold
//     them — `Validated` to refresh `lastValidatedAt` + opinion ref
//     without superseding, and `Lapsed` to mark a row as `lapsed`.
//   - Cross-currency netting sets (one per counterparty rather than
//     per-counterparty-per-currency) require a CSA-amendment event
//     schema; v0 deliberately collapses to the assessment-event
//     currency.
//
// Citations:
//   BCBS d317 §136 (netting-set granularity);
//   ISDA Master Agreement (2002);
//   Policies/credit-risk-policy-v1.md §3 line 121 (SA-CCR methodology) +
//     §3 line 137 (CSA terms);
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md.
//
// Author: Imani (Legal-as-code engineer, engineering).

import { eventStore } from "../../composition";
import { type Money, minor } from "../../core/money";
import type { Currency } from "../../core/types";
import type { ISDACSAAssessmentCompletedPayload } from "../../event-store/event-types/credit-limit";
import type { Event } from "../../event-store/types";
import type { NettingSet, NettingSetRegistryEntry } from "./types";

// ---------------------------------------------------------------------------
// Event types this projection folds. Listed as a const tuple so future
// additions (NettingAgreementValidated / Lapsed) are explicit.
// ---------------------------------------------------------------------------

export const NETTING_SET_LIFECYCLE_TYPES = ["ISDACSAAssessmentCompleted"] as const;

// ---------------------------------------------------------------------------
// nettingSetIdFor — canonical netting-set ID derivation. Centralised so
// every caller (this projection, the SA-CCR engine, tests, dashboards)
// agrees on the convention.
// ---------------------------------------------------------------------------

export function nettingSetIdFor(counterpartyId: string, currency: string): string {
  return `NS-${counterpartyId}-${currency}`;
}

// ---------------------------------------------------------------------------
// Internal: project a single ISDACSAAssessmentCompleted event into a
// registry entry (always `active` at construction; supersession is
// applied at fold-time by the orchestrator below).
// ---------------------------------------------------------------------------

function entryFromAssessment(event: Event): NettingSetRegistryEntry {
  const p = event.payload as ISDACSAAssessmentCompletedPayload;
  const currency = p.currency;
  const threshold: Money = minor(BigInt(p.csaThreshold), currency as Currency);
  const mta: Money = minor(BigInt(p.mta), currency as Currency);
  // CSA present iff ISDA executed AND a non-zero threshold or MTA is on file.
  // Zero-threshold AND zero-MTA under an executed ISDA encodes the
  // "ISDA in force, no CSA at this stage" posture per Imani G-9 (FX-spot
  // controlled-launch). See module header for the full fold rule.
  const csaPresent = p.isdaStatus === "executed" && (p.csaThreshold > 0 || p.mta > 0);

  const out: NettingSetRegistryEntry = {
    nettingSetId: nettingSetIdFor(p.counterpartyId, currency),
    counterpartyId: p.counterpartyId,
    csaPresent,
    threshold,
    mta,
    currency,
    nettingEnforceable: p.nettingEnforceable,
    lastValidatedAt: p.assessedAt,
    effectiveFrom: p.assessedAt,
    status: "active",
  };
  if (p.jurisdictionOpinionRef !== undefined) {
    out.jurisdictionOpinionRef = p.jurisdictionOpinionRef;
  }
  return out;
}

// ---------------------------------------------------------------------------
// foldAll — replay every netting-set lifecycle event and build the full
// register (active + superseded rows). Returns rows keyed by
// nettingSetId, with all prior rows for the same key flipped to
// `superseded`. Order: event-store sequence (chronological per as_of).
// ---------------------------------------------------------------------------

function foldAll(asOf?: string): NettingSetRegistryEntry[] {
  const allEvents: Event[] = [];
  for (const type of NETTING_SET_LIFECYCLE_TYPES) {
    for (const event of eventStore.replay(asOf !== undefined ? { type, asOf } : { type })) {
      allEvents.push(event);
    }
  }
  // Stable chronological sort — assessments are typed with assessedAt,
  // but the canonical sequence is the event's as_of.
  allEvents.sort((a, b) => (a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0));

  const rows: NettingSetRegistryEntry[] = [];
  const activeIndexByNsId = new Map<string, number>();

  for (const event of allEvents) {
    const entry = entryFromAssessment(event);
    const priorIdx = activeIndexByNsId.get(entry.nettingSetId);
    if (priorIdx !== undefined) {
      // Demote prior active row to superseded.
      rows[priorIdx] = { ...(rows[priorIdx] as NettingSetRegistryEntry), status: "superseded" };
    }
    rows.push(entry);
    activeIndexByNsId.set(entry.nettingSetId, rows.length - 1);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// asNettingSet — narrow a registry entry to the engine-facing shape.
// ---------------------------------------------------------------------------

function asNettingSet(entry: NettingSetRegistryEntry): NettingSet {
  const out: NettingSet = {
    nettingSetId: entry.nettingSetId,
    counterpartyId: entry.counterpartyId,
    csaPresent: entry.csaPresent,
    threshold: entry.threshold,
    mta: entry.mta,
    currency: entry.currency,
    nettingEnforceable: entry.nettingEnforceable,
  };
  if (entry.jurisdictionOpinionRef !== undefined) {
    out.jurisdictionOpinionRef = entry.jurisdictionOpinionRef;
  }
  if (entry.lastValidatedAt !== undefined) {
    out.lastValidatedAt = entry.lastValidatedAt;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public projection API
// ---------------------------------------------------------------------------

/**
 * Returns the latest active netting set for `nettingSetId`, or `null`
 * if no `ISDACSAAssessmentCompleted` has ever materialised this ID.
 */
export function getNettingSet(nettingSetId: string, asOf?: string): NettingSet | null {
  const rows = foldAll(asOf);
  for (const row of rows) {
    if (row.nettingSetId === nettingSetId && row.status === "active") {
      return asNettingSet(row);
    }
  }
  return null;
}

/**
 * Returns all active netting sets governing trades with `counterpartyId`.
 * At v0 there is at most one (one netting set per counterparty per
 * currency, currency collapsed to assessment-event ccy); the array
 * shape preserves headroom for the cross-currency follow-on slice.
 */
export function getNettingSetsByCounterparty(counterpartyId: string, asOf?: string): NettingSet[] {
  const rows = foldAll(asOf);
  const out: NettingSet[] = [];
  for (const row of rows) {
    if (row.counterpartyId === counterpartyId && row.status === "active") {
      out.push(asNettingSet(row));
    }
  }
  return out;
}

/**
 * Returns all active netting sets across all counterparties. Sorted by
 * nettingSetId for stable rendering.
 */
export function listActiveNettingSets(asOf?: string): NettingSet[] {
  const rows = foldAll(asOf);
  const out: NettingSet[] = [];
  for (const row of rows) {
    if (row.status === "active") out.push(asNettingSet(row));
  }
  out.sort((a, b) => (a.nettingSetId < b.nettingSetId ? -1 : 1));
  return out;
}

/**
 * Returns the full registry (active + superseded), in chronological
 * order. Used by audit + Vera recon symmetry checks (active count must
 * equal distinct-counterparty count when the register is healthy).
 */
export function listAllNettingSetEntries(asOf?: string): readonly NettingSetRegistryEntry[] {
  return foldAll(asOf);
}

/**
 * Resolve a netting set by counterpartyId + currency. Returns `null` if
 * no active assessment exists. Convenience helper for the SA-CCR engine
 * and other callers that hold the (counterpartyId, currency) pair
 * rather than the synthesised ID.
 */
export function resolveNettingSet(
  counterpartyId: string,
  currency: string,
  asOf?: string,
): NettingSet | null {
  return getNettingSet(nettingSetIdFor(counterpartyId, currency), asOf);
}
