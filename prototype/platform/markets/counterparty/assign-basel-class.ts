// platform/markets/counterparty/assign-basel-class.ts
//
// SUT-side Basel-class assignment from the external rating feed — M6
// (WS-FX-V2-SIMULATOR Phase 2).
//
// The BANK's OWN internal credit judgement: it reads the OUTSIDE WORLD's rating-
// agency feed (`ExternalCreditRatingReceived`, the simulator's external-party
// fact) and maps the latest-effective rating to an authoritative Basel
// standardised-approach counterparty class (CRE20), recorded as
// `CounterpartyBaselClassAssigned` (the SUT-internal event-of-record the RWA
// projection reads). The simulator↔SUT boundary gate forbids the simulator from
// emitting `CounterpartyBaselClassAssigned` — the mapping is the bank's act, the
// rating is the outside world's.
//
// FAIL-CLOSED (M6 design): a counterparty with NO rating on the feed, or a rating
// the mapping cannot resolve, is assigned the PRUDENT CONSERVATIVE class
// `corporate-non-ig` (100% risk weight — the same prudent interim
// `rwa-from-positions` falls back to), NEVER a silent investment-grade default.
// Over-stating capital is the safe direction; under-stating is forbidden.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-FX-COUNTERPARTY-BASEL-CLASSIFICATION; BCBS CRE20 (standardised credit
//   risk — counterparty class + external-rating buckets);
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed). Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type BaselCounterpartyClass,
  makeCounterpartyBaselClassAssigned,
} from "../../event-store/event-types/counterparty-credit-risk";
import type {
  ExternalCreditRatingReceivedPayload,
  LongTermRatingNotch,
  RatedCounterpartyType,
} from "../../event-store/event-types/external-credit-rating";
import type { EventStore } from "../../event-store/store";

const ENTITY = "LE-ZA-HOZ-BANK";
const SUT_ACTOR = { type: "service" as const, id: "agent:sut:counterparty-credit-classification" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST", "D-FX-COUNTERPARTY-BASEL-CLASSIFICATION"];

/** The prudent conservative fallback class (100% RW) — the fail-closed default. */
export const CONSERVATIVE_FALLBACK_CLASS: BaselCounterpartyClass = "corporate-non-ig";

export type CreditRatingBucket = "aaa-aa" | "a" | "bbb" | "bb" | "below-bb" | "unrated";

/**
 * Map an S&P/Fitch long-term issuer notch to the CRE20 rating bucket. The bucket
 * is the standardised-approach lookup key (CRE20 §20.x rating tables).
 */
export function ratingNotchToBucket(notch: LongTermRatingNotch): CreditRatingBucket {
  switch (notch) {
    case "AAA":
    case "AA+":
    case "AA":
    case "AA-":
      return "aaa-aa";
    case "A+":
    case "A":
    case "A-":
      return "a";
    case "BBB+":
    case "BBB":
    case "BBB-":
      return "bbb";
    case "BB+":
    case "BB":
    case "BB-":
      return "bb";
    default:
      // B+ and below (B/CCC/CC/C/D) — sub-investment-grade.
      return "below-bb";
  }
}

/**
 * Map (counterparty type, rating bucket) → Basel SA class (CRE20). The class is
 * a function of BOTH the supervisory type AND the rating: a BBB bank maps to
 * `bank`; a BBB corporate maps to `corporate-ig`; a BB corporate to
 * `corporate-non-ig`. Sovereign/MDB/PSE/bank types carry their type directly
 * (their risk weight is then resolved from the rating bucket downstream in the
 * RWA engine via `ratingBucket`). FAIL-CLOSED: an `unrated` corporate is
 * `corporate-non-ig` (the prudent interim).
 */
export function mapToBaselClass(
  counterpartyType: RatedCounterpartyType,
  bucket: CreditRatingBucket,
): BaselCounterpartyClass {
  switch (counterpartyType) {
    case "sovereign-domestic-currency":
      return "sovereign-domestic-currency";
    case "sovereign-foreign-currency":
      return "sovereign-foreign-currency";
    case "mdb-zero-weight":
      return "mdb-zero-weight";
    case "bank":
      return "bank";
    case "pse":
      return "pse";
    case "corporate":
      // Investment-grade = BBB- or better (CRE20 corporate IG threshold).
      return bucket === "aaa-aa" || bucket === "a" || bucket === "bbb"
        ? "corporate-ig"
        : "corporate-non-ig";
    default: {
      const exhaustive: never = counterpartyType;
      throw new Error(`assign-basel-class: unhandled counterparty type ${String(exhaustive)}`);
    }
  }
}

export interface AssignBaselClassResult {
  /** Whether a NEW assignment was emitted (false = no change / idempotent / no rating). */
  readonly assigned: boolean;
  /** The class assigned (or the existing one when unchanged). */
  readonly baselClass: BaselCounterpartyClass;
  /** True when the class is the fail-closed conservative fallback (no usable rating). */
  readonly usedFallback: boolean;
}

/**
 * Assign the bank's authoritative Basel class for `counterpartyId` from the
 * latest-effective external rating on the feed (as-of `asOf`). Reads the
 * `ExternalCreditRatingReceived` stream; the latest `ratedAt ≤ asOf` wins.
 *
 * FAIL-CLOSED: no rating ⇒ `corporate-non-ig` (prudent 100% interim) is assigned
 * so the RWA projection has a class-of-record (it never silently picks IG).
 *
 * IDEMPOTENT: if the latest assignment ALREADY carries the resolved class +
 * effectiveFrom, nothing is emitted. A new/changed rating emits a fresh
 * assignment (latest-effective-wins handles the supersession downstream).
 *
 * Returns the resolved class + whether a new assignment was emitted.
 */
export function assignBaselClassFromFeed(args: {
  readonly store: EventStore;
  readonly scenarioId: string;
  readonly counterpartyId: string;
  readonly asOf: string;
}): AssignBaselClassResult {
  const { store, scenarioId, counterpartyId, asOf } = args;

  // Latest-effective external rating for this counterparty (ratedAt ≤ asOf).
  let latestRating: ExternalCreditRatingReceivedPayload | undefined;
  let latestRatedAt = "";
  for (const ev of store.replay({ type: "ExternalCreditRatingReceived" })) {
    const p = ev.payload as unknown as ExternalCreditRatingReceivedPayload;
    if (p.counterpartyId !== counterpartyId) continue;
    if (p.ratedAt > asOf) continue; // not yet effective
    if (p.ratedAt >= latestRatedAt) {
      latestRating = p;
      latestRatedAt = p.ratedAt;
    }
  }

  // FAIL-CLOSED: no usable rating → the prudent conservative class.
  let baselClass: BaselCounterpartyClass;
  let ratingBucket: CreditRatingBucket;
  let rationale: string;
  let evidenceRef: string;
  let usedFallback: boolean;
  let effectiveFrom: string;
  if (!latestRating) {
    baselClass = CONSERVATIVE_FALLBACK_CLASS;
    ratingBucket = "unrated";
    rationale =
      "No external credit rating on the feed for this counterparty; fail-closed to the prudent conservative class (CRE20 unrated/100% interim).";
    evidenceRef = `${scenarioId}:${counterpartyId}:no-external-rating`;
    usedFallback = true;
    effectiveFrom = asOf;
  } else {
    ratingBucket = ratingNotchToBucket(latestRating.rating);
    baselClass = mapToBaselClass(latestRating.counterpartyType, ratingBucket);
    rationale = `External ${latestRating.agency} rating ${latestRating.rating} (${ratingBucket} bucket) for a ${latestRating.counterpartyType} counterparty maps to Basel SA class ${baselClass} (CRE20).`;
    evidenceRef = `${scenarioId}:${counterpartyId}:rating:${latestRating.agency}:${latestRating.rating}`;
    usedFallback = false;
    effectiveFrom = latestRating.ratedAt;
  }

  // Idempotency: the latest existing assignment already carries this class +
  // effectiveFrom ⇒ no-op.
  let existingClass: BaselCounterpartyClass | undefined;
  let existingEffectiveFrom = "";
  for (const ev of store.replay({ type: "CounterpartyBaselClassAssigned" })) {
    const p = ev.payload as {
      counterpartyId?: string;
      baselClass?: string;
      effectiveFrom?: string;
    };
    if (p.counterpartyId !== counterpartyId) continue;
    if ((p.effectiveFrom ?? "") >= existingEffectiveFrom) {
      existingClass = p.baselClass as BaselCounterpartyClass;
      existingEffectiveFrom = p.effectiveFrom ?? "";
    }
  }
  if (existingClass === baselClass && existingEffectiveFrom === effectiveFrom) {
    return { assigned: false, baselClass, usedFallback };
  }

  store.append(
    makeCounterpartyBaselClassAssigned({
      asOf,
      entity: ENTITY,
      actor: SUT_ACTOR,
      citations: CITATIONS,
      eventId: `${scenarioId}:${counterpartyId}:basel-class:${effectiveFrom}`,
      payload: {
        counterpartyId,
        baselClass,
        ratingBucket,
        assignedBy: "CRO",
        approverAuthority: "CRO",
        rationale,
        evidenceRef,
        effectiveFrom,
        assignedAt: asOf,
      },
    }),
  );
  return { assigned: true, baselClass, usedFallback };
}
