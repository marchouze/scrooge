// platform/risk/counterparty-classification.ts
//
// Resolve a counterparty's authoritative Basel class (CRE20 taxonomy) from the
// `CounterpartyBaselClassAssigned` event-of-record. This is the single reader
// the RWA projection (and any other risk-weight consumer) calls instead of
// hard-coding a class in mapping code — the class is a CRO credit judgement,
// held as an event, not a constant buried in a projection.
//
// Resolution: latest-effective-wins per counterparty. Among assignments whose
// `effectiveFrom` ≤ `asOf`, the one with the greatest `effectiveFrom` wins
// (ties broken by event order — last write wins). A counterparty with no
// in-effect assignment resolves to `null`; the caller applies its own prudent
// fallback (`rwa-from-positions` uses `corporate-non-ig`, 100%).
//
// Authority: D-FX-COUNTERPARTY-BASEL-CLASSIFICATION; BCBS CRE20;
//   Policies/credit-risk-policy-v1.md §3.
// Author: Rohan (Market risk quantitative engineer) · Scrooge-coordinated session.

import type { CounterpartyBaselClassAssignedPayload } from "../event-store/event-types/counterparty-credit-risk";
import type { EventStore } from "../event-store/store";
import type { CounterpartyType, CreditRatingBucket, ResidualMaturityBucket } from "./rwa-engine";

// Compile-time lock-step: the event-store `baselClass` enum MUST be assignable
// to the risk-layer `CounterpartyType` taxonomy. If CRE20 classes diverge
// between the two modules this assignment fails to type-check.
type _AssertBaselClassMatchesCounterpartyType =
  CounterpartyBaselClassAssignedPayload["baselClass"] extends CounterpartyType ? true : never;
const _baselClassLockStep: _AssertBaselClassMatchesCounterpartyType = true;
void _baselClassLockStep;

export interface ResolvedCounterpartyClass {
  readonly counterpartyId: string;
  readonly baselClass: CounterpartyType;
  readonly ratingBucket?: CreditRatingBucket;
  readonly residualMaturity?: ResidualMaturityBucket;
  /** event_id of the winning assignment — provenance for the RWA note / recon. */
  readonly sourceEventId: string;
  readonly effectiveFrom: string;
}

/**
 * Build the latest-effective Basel class per counterparty as of `asOf`.
 * Single pass over the `CounterpartyBaselClassAssigned` stream.
 */
export function resolveAllCounterpartyClasses(
  eventStore: Pick<EventStore, "replay">,
  asOf?: string,
): Map<string, ResolvedCounterpartyClass> {
  const latest = new Map<string, ResolvedCounterpartyClass>();
  const replayOpts = asOf
    ? { type: "CounterpartyBaselClassAssigned" as const, asOf }
    : { type: "CounterpartyBaselClassAssigned" as const };
  for (const ev of eventStore.replay(replayOpts)) {
    const p = ev.payload as unknown as CounterpartyBaselClassAssignedPayload;
    if (!p.counterpartyId) continue;
    if (asOf && p.effectiveFrom > asOf) continue; // not yet in effect
    const prev = latest.get(p.counterpartyId);
    // Greatest effectiveFrom wins; equal effectiveFrom → later event wins (we
    // iterate in append order, so a plain overwrite gives last-write-wins).
    if (prev && prev.effectiveFrom > p.effectiveFrom) continue;
    latest.set(p.counterpartyId, {
      counterpartyId: p.counterpartyId,
      baselClass: p.baselClass,
      ...(p.ratingBucket ? { ratingBucket: p.ratingBucket } : {}),
      ...(p.residualMaturity ? { residualMaturity: p.residualMaturity } : {}),
      sourceEventId: ev.event_id,
      effectiveFrom: p.effectiveFrom,
    });
  }
  return latest;
}

/**
 * Resolve one counterparty's authoritative Basel class as of `asOf`, or `null`
 * when no in-effect assignment exists (caller applies its prudent fallback).
 */
export function resolveCounterpartyBaselClass(
  eventStore: Pick<EventStore, "replay">,
  counterpartyId: string,
  asOf?: string,
): ResolvedCounterpartyClass | null {
  return resolveAllCounterpartyClasses(eventStore, asOf).get(counterpartyId) ?? null;
}
