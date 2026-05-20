// platform/risk/sa-ccr/replacement-cost.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 4 — SA-CCR Replacement Cost (RC) computation.
//
// Per Credit Risk Policy §3 line 129 (IN FORCE 2026-05-13):
//   Margined   : RC = max(V − C, MTA + TH, 0)
//   Unmargined : RC = max(V, 0)
//
// where V is the current mark-to-market of the netting set and C is the
// market value of net collateral held (positive when collateral favours
// the bank). MTA is the minimum transfer amount and TH is the CSA
// threshold.
//
// Pure function — no event emission, no side effects, no event-store
// reads. All inputs threaded by caller; the only event-emitting boundary
// of the engine is `compute-and-emit.ts`.
//
// Citations:
//   BCBS d317 §136 (SA-CCR Replacement Cost, March 2014 rev. 2017);
//   CRE52 §52.10–52.18 (RC formula);
//   Policies/credit-risk-policy-v1.md §3 line 129 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD.
//
// Author: Rohan (Market risk quantitative engineer, engineering).

import { type Money, minor, sub } from "../../core/money";
import type { Currency } from "../../core/types";
import { utcNow } from "../../types/time";
import type { NettingSet, ReplacementCost } from "./types";

// ---------------------------------------------------------------------------
// Internal helper — guard against currency drift between the netting-set
// config and the live vMtm / collateral values. SA-CCR is a per-currency
// computation (cross-currency RC is not recognised at v0; matches the
// downstream `pre-deal-check.getCurrentExposure` cross-currency skip).
// ---------------------------------------------------------------------------

function assertCurrency(label: string, expected: string, actual: Money | undefined): void {
  if (actual !== undefined && String(actual.currency) !== expected) {
    throw new Error(
      `SA-CCR RC currency mismatch on ${label}: expected ${expected}, got ${String(actual.currency)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// computeReplacementCost — pure per-netting-set RC computation.
//
// Caller responsibilities:
//   - resolve `vMtm` from the netting-set's MTM source (Bea's MTM engine /
//     forward-obligations projection / market-data store).
//   - resolve `collateralHeld` from `@platform/collateral` (net of CSA
//     haircuts), already in the netting-set currency.
//   - resolve the `NettingSet` config from the netting-set register —
//     when `csaPresent = true`, both `threshold` and `mta` must be
//     supplied. When `csaPresent = false`, both are ignored.
// ---------------------------------------------------------------------------

export function computeReplacementCost(
  nettingSet: NettingSet,
  vMtm: Money,
  collateralHeld: Money,
  asOf?: string,
): ReplacementCost {
  // Currency invariants — RC is single-currency at v0.
  assertCurrency("vMtm", nettingSet.currency, vMtm);
  assertCurrency("collateralHeld", nettingSet.currency, collateralHeld);
  if (collateralHeld.amount < 0n) {
    throw new Error(
      `SA-CCR RC: collateralHeld must be non-negative, got ${collateralHeld.amount.toString()}`,
    );
  }

  const ccy = nettingSet.currency as Currency;

  // V − C (signed — may be negative when collateral exceeds MTM).
  const vMinusC = sub(vMtm, collateralHeld);

  let rcMinor: bigint;
  if (nettingSet.csaPresent) {
    // Margined: RC = max(V − C, MTA + TH, 0).
    if (nettingSet.mta === undefined || nettingSet.threshold === undefined) {
      throw new Error(
        `SA-CCR RC: margined netting set ${nettingSet.nettingSetId} requires both threshold and mta`,
      );
    }
    assertCurrency("threshold", nettingSet.currency, nettingSet.threshold);
    assertCurrency("mta", nettingSet.currency, nettingSet.mta);

    const mtaPlusTh = nettingSet.mta.amount + nettingSet.threshold.amount;
    // max of three values, floored at 0.
    rcMinor = bigMax3(vMinusC.amount, mtaPlusTh, 0n);
  } else {
    // Unmargined: RC = max(V, 0).
    rcMinor = bigMax3(vMtm.amount, 0n, 0n);
  }

  return {
    nettingSetId: nettingSet.nettingSetId,
    rc: minor(rcMinor, ccy),
    vMtm,
    collateralHeld,
    computedAt: asOf ?? utcNow(),
  };
}

function bigMax3(a: bigint, b: bigint, c: bigint): bigint {
  let m = a;
  if (b > m) m = b;
  if (c > m) m = c;
  return m;
}
