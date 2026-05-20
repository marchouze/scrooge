// platform/risk/sa-ccr/ead.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 — SA-CCR EAD composition (v1).
//
// Per Credit Risk Policy §3 line 131 and BCBS d317 §10:
//   EAD = α × (RC + PFE)   with α = 1.4
//   PFE = multiplier × AggregatedAddOn  (BCBS d317 §149 / CRE52 §52.5)
//
// v1 wires the BCBS multiplier formula — PFE is no longer = AggregatedAddOn.
// When the netting set is over-collateralised, the multiplier shrinks
// PFE towards its 5% floor, recognising the collateral cushion.
//
// Pure function — no event emission, no side effects.
//
// Citations:
//   BCBS d317 §10 (α multiplier for EAD), §149 (PFE multiplier);
//   CRE52 §52.5 (EAD = α × (RC + PFE)), §52.10–§52.13 (multiplier formula);
//   Policies/credit-risk-policy-v1.md §3 line 131 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD Phase 5.
//
// Author: Rohan (Market risk quantitative engineer, engineering).

import { minor } from "../../core/money";
import type { Currency } from "../../core/types";
import { utcNow } from "../../types/time";
import { ALPHA_SA_CCR, aggregatedAddOn, pfeMultiplier } from "./pfe-addon";
import type { AddOnComponent, EadComputation, ReplacementCost } from "./types";

// ---------------------------------------------------------------------------
// computeEad — compose RC + multiplier × Σ(AddOn) into the BCBS d317 EAD
// figure.
//
// `counterpartyId` is supplied by the caller. The multiplier is computed
// from the RC inputs (vMtm, collateralHeld) carried on the
// `ReplacementCost` result.
//
// Currency invariant: all add-on components and the RC must share the
// netting-set currency. Mismatch is a hard fail (matches the
// `pre-deal-check.getCurrentExposure` cross-currency skip behaviour).
// ---------------------------------------------------------------------------

export function computeEad(
  rc: ReplacementCost,
  addOns: AddOnComponent[],
  opts: {
    counterpartyId: string;
    asOf?: string;
  },
): EadComputation {
  const ccy = String(rc.rc.currency) as Currency;
  const aggAddOn = aggregatedAddOn(addOns, ccy);

  // BCBS d317 §149 / CRE52 §52.5 multiplier — shrinks PFE when V − C < 0
  // (over-collateralised). When AggAddOn = 0, multiplier degenerates to
  // 1.0 (no PFE to scale anyway).
  const multiplier = pfeMultiplier(rc.vMtm.amount, rc.collateralHeld.amount, aggAddOn.amount);

  // PFE = multiplier × AggAddOn. Carry through BigInt: scale multiplier
  // by 1e6 for half-up rounding precision.
  const multiplierScaled = BigInt(Math.round(multiplier * 1_000_000));
  const pfeMinor = (aggAddOn.amount * multiplierScaled + 500_000n) / 1_000_000n;
  const pfe = minor(pfeMinor, ccy);

  // EAD = α × (RC + PFE). Carry in BigInt — α = 1.4 scales by 10⁴ for
  // half-up rounding (1.4 → 14000 / 10000).
  const rcPlusPfeMinor = rc.rc.amount + pfe.amount;
  const alphaScaled = BigInt(Math.round(ALPHA_SA_CCR * 10_000));
  const eadMinor = (rcPlusPfeMinor * alphaScaled + 5_000n) / 10_000n;

  return {
    nettingSetId: rc.nettingSetId,
    counterpartyId: opts.counterpartyId,
    rc: rc.rc,
    pfe,
    alpha: ALPHA_SA_CCR,
    multiplier,
    aggregatedAddOn: aggAddOn,
    ead: minor(eadMinor, ccy),
    asOf: opts.asOf ?? utcNow(),
  };
}
