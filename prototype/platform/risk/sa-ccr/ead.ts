// platform/risk/sa-ccr/ead.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 4 — SA-CCR EAD composition.
//
// Per Credit Risk Policy §3 line 131 and BCBS d317 §10:
//   EAD = α × (RC + PFE)   with α = 1.4
//
// PFE in v0 is the AggregatedAddOn (multiplier fixed at 1.0 — see
// `pfe-addon.ts` header for the deferred multiplier formula).
//
// Pure function — no event emission, no side effects.
//
// Citations:
//   BCBS d317 §10 (α multiplier for EAD);
//   CRE52 §52.5 (EAD = α × (RC + PFE));
//   Policies/credit-risk-policy-v1.md §3 line 131 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD.
//
// Author: Rohan (Market risk quantitative engineer, engineering).

import { minor } from "../../core/money";
import type { Currency } from "../../core/types";
import { utcNow } from "../../types/time";
import { ALPHA_SA_CCR, aggregatedAddOn } from "./pfe-addon";
import type { AddOnComponent, EadComputation, ReplacementCost } from "./types";

// ---------------------------------------------------------------------------
// computeEad — compose RC + Σ(AddOn) into the BCBS d317 EAD figure.
//
// `counterpartyId` is supplied by the caller (the engine resolves the
// counterparty for the netting set from the netting-set register; that
// resolution is the caller's concern, not this pure function's).
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
  const pfe = aggregatedAddOn(addOns, ccy);

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
    ead: minor(eadMinor, ccy),
    asOf: opts.asOf ?? utcNow(),
  };
}
