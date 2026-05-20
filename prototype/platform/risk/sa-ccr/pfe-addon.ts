// platform/risk/sa-ccr/pfe-addon.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 4 — SA-CCR PFE add-on engine (v0).
//
// Per Credit Risk Policy §3 line 130 and BCBS d317 §149–§191 / CRE52
// §52.45–§52.52:
//
//   PFE = multiplier × AggregatedAddOn
//   AggregatedAddOn = Σ (asset-class add-on)
//   asset-class add-on = Σ (notional × supervisory-factor × maturity-factor)
//
// v0 simplifications (documented gaps, closure tracked under
// D-CREDIT-LIMIT-ENGINE-BUILD Phase 4 follow-ons):
//
//   1. Maturity factor — fixed at 1.0 (single-period assumption). The
//      BCBS d317 maturity-factor schedule (√min(M,1y)) is deferred to a
//      follow-on slice once the bank originates trades with M < 1y or
//      > 1y where the maturity-factor differentiation bites.
//
//   2. Multiplier — fixed at 1.0 (i.e. PFE = AggregatedAddOn). The BCBS
//      d317 multiplier = min(1, 0.05 + 0.95 × exp((V − C)/(2 × (1 − 0.05)
//      × AggregatedAddOn))) is deferred to a follow-on slice. v0 is
//      conservative (multiplier ≥ 1.0 is not possible under the BCBS
//      formula, so v0 over-estimates PFE — acceptable in the build phase).
//
//   3. Supervisory factors — covered at v0 for the asset classes the bank
//      trades:
//        ir       0.5 % — BCBS d317 Table 2 / CRE52 §52.46
//        fx       4.0 % — BCBS d317 Table 2 / CRE52 §52.47
//      The remaining BCBS Table 2 asset classes (`credit`, `equity`,
//      `commodity`) are declared in the `SaCcrAssetClass` union; their
//      supervisory factors are documented inline below as TODO entries
//      and will be wired up when the bank originates trades in those
//      products.
//
//   4. Hedging-set / netting within an asset class — v0 sums notionals
//      across all trades in an asset class without recognising offsetting
//      directions inside the asset class (the BCBS hedging-set / delta
//      adjustment is deferred). v0 is therefore conservative for a
//      directional book and worst-case for a hedged book.
//
// Pure function — no event emission, no side effects, no event-store
// reads.
//
// Citations:
//   BCBS d317 §149–§191 (SA-CCR PFE);
//   CRE52 §52.45–§52.52 (supervisory factors);
//   Policies/credit-risk-policy-v1.md §3 line 130 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD.
//
// Author: Rohan (Market risk quantitative engineer, engineering).

import { type Money, add, minor } from "../../core/money";
import type { Currency } from "../../core/types";
import type { AddOnComponent, SaCcrAssetClass, TradeSummary } from "./types";

// ---------------------------------------------------------------------------
// ALPHA_SA_CCR — BCBS d317 §10 regulatory multiplier for EAD = α × (RC + PFE).
// Exported for `ead.ts` and for caller-side audit.
// ---------------------------------------------------------------------------

export const ALPHA_SA_CCR = 1.4 as const;

// ---------------------------------------------------------------------------
// Supervisory-factor table — BCBS d317 Table 2 / CRE52 §52.45.
//
// Covered: ir, fx (the v0 asset classes the bank trades).
// TODO (follow-on slice — supervisory factors required when bank originates
//   credit / equity / commodity trades):
//     credit IG    0.46 %       — BCBS d317 Table 2 / CRE52 §52.48
//     credit non-IG 1.30 %      — BCBS d317 Table 2 / CRE52 §52.48
//     equity single name 32 %   — BCBS d317 Table 2 / CRE52 §52.50
//     equity index 20 %         — BCBS d317 Table 2 / CRE52 §52.50
//     commodity electricity 40% — BCBS d317 Table 2 / CRE52 §52.51
//     commodity other 18 %      — BCBS d317 Table 2 / CRE52 §52.51
// (Listed as code-comments per dispatch brief — not registered as
// `[citation: TBC]` tokens so as not to trip the citation-gate.)
// ---------------------------------------------------------------------------

const SUPERVISORY_FACTOR: Record<SaCcrAssetClass, number | null> = {
  ir: 0.005, // 0.5 %
  fx: 0.04, // 4.0 %
  credit: null, // TODO — see header comment.
  equity: null, // TODO — see header comment.
  commodity: null, // TODO — see header comment.
};

/**
 * `supervisoryFactor` — looks up the v0 supervisory factor for an asset
 * class. Throws when the asset class is declared in the union but has
 * no v0 factor wired (caller should not invoke the engine on those trade
 * types until the follow-on slice lands).
 */
export function supervisoryFactor(assetClass: SaCcrAssetClass): number {
  const sf = SUPERVISORY_FACTOR[assetClass];
  if (sf === null) {
    throw new Error(
      `SA-CCR PFE: supervisory factor for assetClass='${assetClass}' is not wired at v0 (BCBS d317 Table 2 lookup deferred)`,
    );
  }
  return sf;
}

// ---------------------------------------------------------------------------
// Maturity factor — v0 fixed at 1.0 (single-period). See header comment.
// ---------------------------------------------------------------------------

const MATURITY_FACTOR_V0 = 1.0;

// ---------------------------------------------------------------------------
// computeAddOn — pure aggregation of trade notionals by asset class into
// SA-CCR PFE add-on components.
//
// All trades passed in must share a single netting-set currency — callers
// upstream of the engine are responsible for FX conversion (a netting set
// is single-currency by Credit Risk Policy §3 line 132 / convention).
// Cross-currency input is rejected at runtime to keep money arithmetic
// honest (P5).
// ---------------------------------------------------------------------------

export function computeAddOn(trades: TradeSummary[]): AddOnComponent[] {
  if (trades.length === 0) return [];

  const ccy = String(trades[0].notional.currency) as Currency;
  for (const t of trades) {
    if (String(t.notional.currency) !== String(ccy)) {
      throw new Error(
        `SA-CCR PFE: cross-currency trade list — expected ${String(ccy)}, got ${String(t.notional.currency)} on tradeId=${t.tradeId ?? "<unset>"}`,
      );
    }
  }

  // Group notionals by asset class (sum in minor units to preserve BigInt
  // precision; supervisory factor is applied at the aggregate step).
  const notionalByAssetClass = new Map<SaCcrAssetClass, bigint>();
  for (const t of trades) {
    const prev = notionalByAssetClass.get(t.assetClass) ?? 0n;
    notionalByAssetClass.set(t.assetClass, prev + t.notional.amount);
  }

  // Stable iteration order — assetClass union order in the result.
  const order: SaCcrAssetClass[] = ["ir", "fx", "credit", "equity", "commodity"];
  const out: AddOnComponent[] = [];
  for (const ac of order) {
    const totalMinor = notionalByAssetClass.get(ac);
    if (totalMinor === undefined) continue;
    const sf = supervisoryFactor(ac);
    // add-on = notional × supervisoryFactor × maturityFactor.
    // Carry computation in BigInt where possible; round half-up at the
    // last step. Scale by 1e6 to preserve precision on small SFs.
    const scaledFactor = Math.round(sf * MATURITY_FACTOR_V0 * 1_000_000);
    const addOnMinor =
      (totalMinor * BigInt(scaledFactor) + 500_000n) / 1_000_000n;
    out.push({
      assetClass: ac,
      notional: minor(totalMinor, ccy),
      supervisoryFactor: sf,
      addOn: minor(addOnMinor, ccy),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// aggregatedAddOn — sum the per-asset-class add-ons into the single
// `AggregatedAddOn` figure used by the PFE multiplier (v0: multiplier =
// 1.0, so PFE = AggregatedAddOn). Internal helper consumed by `ead.ts`.
// ---------------------------------------------------------------------------

export function aggregatedAddOn(components: AddOnComponent[], currency: Currency): Money {
  let total: Money = minor(0n, currency);
  for (const c of components) {
    if (String(c.addOn.currency) !== String(currency)) {
      throw new Error(
        `SA-CCR PFE: cross-currency add-on component — expected ${String(currency)}, got ${String(c.addOn.currency)}`,
      );
    }
    total = add(total, c.addOn);
  }
  return total;
}
