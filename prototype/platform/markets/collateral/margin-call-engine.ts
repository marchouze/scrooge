// platform/markets/collateral/margin-call-engine.ts
//
// SUT-side variation-margin engine — M8 (WS-FX-V2-SIMULATOR Phase 2).
//
// The BANK's OWN margin acts under a CSA. Two SUT steps, both reading the
// scenario store, both fail-closed:
//
//   issueMarginCall      — at the day's close, compute the netting set's
//     uncollateralised exposure (V − C) and, where it exceeds the CSA threshold
//     by at least the MTA, ISSUE a variation-margin call for the shortfall
//     (`MarginCallIssued`). No call below threshold + MTA (CSA mechanics).
//
//   recordMarginResponse — read the counterparty's external response
//     (`MarginCallResponded`, the simulator's fact) for an open call and record
//     the SUT outcome: on `post`, `CollateralPosted` (haircut-adjusted) +
//     `MarginCallSettled{met}`; on `dispute`/`fail`, `MarginCallSettled`
//     {disputed|failed} with NO collateral (the call is unmet → RC is not
//     reduced, fail-closed).
//
// These are SUT-internal (NOT in the simulator package — the boundary gate forbids
// the simulator from emitting MarginCallIssued / CollateralPosted /
// MarginCallSettled). The posted collateral feeds back into SA-CCR RC
// (RC = max(V − C, …)) via the M7 cadence job's collateral resolution.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20); ISDA CSA;
//   BCBS d317 §136 / CRE52 §52.10 (collateral in RC). Principle 1; fail-closed.
// Author: Atlas (Core banking platform architect, engineering).

import type { MarginCallRespondedPayload } from "../../event-store/event-types/margin-call-response";
import {
  makeCollateralPosted,
  makeMarginCallIssued,
  makeMarginCallSettled,
} from "../../event-store/event-types/margin-collateral";
import type { EventStore } from "../../event-store/store";

const ENTITY = "LE-ZA-HOZ-BANK";
const SUT_ACTOR = { type: "service" as const, id: "agent:sut:margin-engine" };
const CITATIONS = ["D-FX-V2-SIMULATOR-FIRST", "D-CREDIT-LIMIT-ENGINE-BUILD"];

/** The CSA terms the SUT margin engine applies (subset of ScenarioCsaTerms). */
export interface SutCsaTerms {
  readonly thresholdMajor: number;
  readonly mtaMajor: number;
  readonly haircut: number;
}

/** Net posted collateral (MAJOR units) held against a netting set as-of `asOf`. */
export function postedCollateralMajor(
  store: EventStore,
  nettingSetId: string,
  asOf: string,
): number {
  let net = 0;
  for (const e of store.replay({ type: "CollateralPosted" })) {
    const p = e.payload as { nettingSetId?: string; amountMajor?: number; postedAt?: string };
    if (p.nettingSetId !== nettingSetId) continue;
    if (p.postedAt && p.postedAt > asOf) continue;
    net += Math.abs(p.amountMajor ?? 0);
  }
  for (const e of store.replay({ type: "CollateralReturned" })) {
    const p = e.payload as { nettingSetId?: string; amountMajor?: number; returnedAt?: string };
    if (p.nettingSetId !== nettingSetId) continue;
    if (p.returnedAt && p.returnedAt > asOf) continue;
    net -= Math.abs(p.amountMajor ?? 0);
  }
  return Math.max(0, net);
}

export interface IssueMarginCallResult {
  /** Whether a call was issued (false = exposure within threshold/MTA). */
  readonly issued: boolean;
  /** The call id (when issued). */
  readonly marginCallId?: string;
  /** The called amount (MAJOR units). */
  readonly callAmountMajor: number;
}

/**
 * SUT — issue a variation-margin call for a netting set at the day's close.
 * `vMtmMajor` is the netting set's current net mark (the bank's exposure, signed;
 * a positive value is the bank's claim on the counterparty). The uncollateralised
 * exposure is `V − C`; a call is made for `max(V − C − threshold, 0)` only when
 * that delta ≥ MTA. Idempotent per (nettingSet, computationDate).
 */
export function issueMarginCall(args: {
  readonly store: EventStore;
  readonly nettingSetId: string;
  readonly counterpartyId: string;
  readonly reporting: string;
  readonly asOf: string;
  readonly computationDate: string;
  readonly vMtmMajor: number;
  readonly csa: SutCsaTerms;
}): IssueMarginCallResult {
  const { store, nettingSetId, counterpartyId, reporting, asOf, computationDate, vMtmMajor, csa } =
    args;

  const marginCallId = `MC-${nettingSetId}-${computationDate}`;

  // Idempotency: a call for this (netting set, date) already exists.
  const already = [...store.replay({ type: "MarginCallIssued" })].some(
    (e) => (e.payload as { marginCallId?: string }).marginCallId === marginCallId,
  );
  if (already) return { issued: false, callAmountMajor: 0 };

  const collateralMajor = postedCollateralMajor(store, nettingSetId, asOf);
  const uncollateralised = vMtmMajor - collateralMajor;
  const overThreshold = uncollateralised - csa.thresholdMajor;

  // No call when the over-threshold shortfall is below the MTA (CSA mechanics).
  if (overThreshold < csa.mtaMajor || overThreshold <= 0) {
    return { issued: false, callAmountMajor: 0 };
  }

  const callAmountMajor = overThreshold;
  store.append(
    makeMarginCallIssued({
      asOf,
      entity: ENTITY,
      actor: SUT_ACTOR,
      citations: CITATIONS,
      eventId: `${nettingSetId}:${computationDate}:margin-call`,
      payload: {
        marginCallId,
        nettingSetId,
        counterpartyId,
        callAmountMajor,
        exposureMajor: uncollateralised,
        thresholdMajor: csa.thresholdMajor,
        mtaMajor: csa.mtaMajor,
        currency: reporting,
        computationDate,
        issuedAt: asOf,
      },
    }),
  );
  return { issued: true, marginCallId, callAmountMajor };
}

export interface RecordMarginResponseResult {
  readonly outcome: "met" | "disputed" | "failed" | "no-response";
  readonly collateralPostedMajor: number;
}

/**
 * SUT — record the outcome of a margin call from the counterparty's external
 * response (`MarginCallResponded`). On `post`: emit `CollateralPosted`
 * (haircut-adjusted, fail-closed: the post-haircut value enters RC, not the
 * gross) + `MarginCallSettled{met}`. On `dispute`/`fail`: emit
 * `MarginCallSettled{disputed|failed}` with NO collateral. Idempotent per call.
 */
export function recordMarginResponse(args: {
  readonly store: EventStore;
  readonly marginCallId: string;
  readonly reporting: string;
  readonly asOf: string;
  readonly csa: SutCsaTerms;
}): RecordMarginResponseResult {
  const { store, marginCallId, reporting, asOf, csa } = args;

  // Already settled?
  const settled = [...store.replay({ type: "MarginCallSettled" })].some(
    (e) => (e.payload as { marginCallId?: string }).marginCallId === marginCallId,
  );
  if (settled) return { outcome: "no-response", collateralPostedMajor: 0 };

  const response = [...store.replay({ type: "MarginCallResponded" })].find(
    (e) => (e.payload as { marginCallId?: string }).marginCallId === marginCallId,
  );
  if (!response) return { outcome: "no-response", collateralPostedMajor: 0 };
  const r = response.payload as unknown as MarginCallRespondedPayload;

  if (r.response === "post") {
    // Haircut-adjusted collateral enters the netting set (post-haircut value).
    const postedMajor = r.postedAmountMajor * (1 - csa.haircut);
    store.append(
      makeCollateralPosted({
        asOf,
        entity: ENTITY,
        actor: SUT_ACTOR,
        citations: CITATIONS,
        eventId: `${marginCallId}:collateral-posted`,
        payload: {
          marginCallId,
          nettingSetId: r.nettingSetId,
          counterpartyId: r.counterpartyId,
          amountMajor: postedMajor,
          collateralKind: r.collateralKind,
          haircut: csa.haircut,
          currency: reporting,
          postedAt: asOf,
        },
      }),
    );
    store.append(
      makeMarginCallSettled({
        asOf,
        entity: ENTITY,
        actor: SUT_ACTOR,
        citations: CITATIONS,
        eventId: `${marginCallId}:settled`,
        payload: {
          marginCallId,
          nettingSetId: r.nettingSetId,
          counterpartyId: r.counterpartyId,
          outcome: "met",
          collateralPostedMajor: postedMajor,
          currency: reporting,
          settledAt: asOf,
        },
      }),
    );
    return { outcome: "met", collateralPostedMajor: postedMajor };
  }

  // Dispute / fail — the call is UNMET. No collateral; RC is not reduced.
  const outcome = r.response === "dispute" ? "disputed" : "failed";
  store.append(
    makeMarginCallSettled({
      asOf,
      entity: ENTITY,
      actor: SUT_ACTOR,
      citations: CITATIONS,
      eventId: `${marginCallId}:settled`,
      payload: {
        marginCallId,
        nettingSetId: r.nettingSetId,
        counterpartyId: r.counterpartyId,
        outcome,
        collateralPostedMajor: 0,
        currency: reporting,
        settledAt: asOf,
      },
    }),
  );
  return { outcome, collateralPostedMajor: 0 };
}
