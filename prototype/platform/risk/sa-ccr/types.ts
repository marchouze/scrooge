// platform/risk/sa-ccr/types.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 4 — SA-CCR Replacement Cost + add-on engine.
// Pure type shapes; no event emission, no projection state. Producer-side
// shapes for the engine that emits `CcrReplacementCostComputed` events
// (registered in PR #612 under counterparty-credit-risk.ts).
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20),
//   Phase 4 — SA-CCR engine closure of the EAD substrate gap left in
//   PR #614's `pre-deal-check.ts::getCurrentExposure` notional fallback.
//
// Citations:
//   Banks Act 94 of 1990 §73 (single-counterparty large exposure);
//   Regulations Relating to Banks (RRB) Regulation 23 (LEX);
//   BCBS d317 / CRE52 — Standardised Approach for Counterparty Credit Risk
//     (SA-CCR), March 2014, rev. 2017 + applicable CRE52 §52.45–52.52
//     supervisory factor schedule;
//   ISDA Master Agreement 2002 + Credit Support Annex (CSA);
//   Policies/credit-risk-policy-v1.md §3 (IN FORCE 2026-05-13);
//   ORG-PR-16 (counterparty credit exposure managed; netting under
//     enforceable ISDA/GMRA);
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Rohan (Market risk quantitative engineer, engineering).

import type { Money } from "../../core/money";

// ---------------------------------------------------------------------------
// NettingSet — config shape for a single legally-enforceable netting set
// (ISDA Master + CSA pair, or GMRA for repo). One netting set per
// counterparty per product family per currency at v0 (Credit Risk Policy
// §3 line 132 — cross-product netting is not recognised at v0).
//
// `csaPresent` flips the RC formula between the margined and unmargined
// branch (Credit Risk Policy §3 line 129). When `csaPresent = true`,
// `threshold` (TH) and `mta` (MTA) are the CSA values that floor RC.
// ---------------------------------------------------------------------------

export interface NettingSet {
  /** Convention: `NS-<counterpartyId>-<ccy>` (mirrors RC event shape). */
  nettingSetId: string;

  /** Party register ID of the counterparty. */
  counterpartyId: string;

  /**
   * `true` when the netting set is governed by a live CSA (or GMRA for
   * repo). Drives the RC branch:
   *   margined   : RC = max(V − C, MTA + TH, 0)
   *   unmargined : RC = max(V, 0)
   */
  csaPresent: boolean;

  /** CSA threshold (TH). Money in `currency`. Only required when
   * `csaPresent = true`; semantically `minor(0)` is permitted (zero-
   * threshold CSA, common for IG counterparties — Credit Risk Policy
   * §3 line 137). */
  threshold?: Money;

  /** Minimum transfer amount (MTA). Money in `currency`. Only required
   * when `csaPresent = true`. */
  mta?: Money;

  /** ISO 4217 currency of the netting set's monetary values. Must match
   * the currency of the vMtm + collateralHeld + threshold + mta. */
  currency: string;
}

// ---------------------------------------------------------------------------
// ReplacementCost — the RC component of EAD for a single netting set.
// Result shape of `computeReplacementCost`.
//
// Per BCBS d317 §136 the RC is floored at zero; we preserve `vMtm` and
// `collateralHeld` on the result for audit and downstream recon (Vera
// asserts RC ≥ max(vMtm − collateralHeld, 0)).
// ---------------------------------------------------------------------------

export interface ReplacementCost {
  nettingSetId: string;
  /** RC = max(...). Money in the netting set's `currency`. Non-negative. */
  rc: Money;
  /** Net mark-to-market of the netting set as at `computedAt`. Signed —
   * negative when net adverse to the bank. */
  vMtm: Money;
  /** Net collateral held against the netting set; non-negative. */
  collateralHeld: Money;
  /** ISO 8601 — the as-of timestamp of the RC computation. */
  computedAt: string;
}

// ---------------------------------------------------------------------------
// AddOnComponent — the PFE add-on for a single asset class within a
// netting set. Result shape of `computeAddOn` (one row per asset class
// observed in the trade list).
//
// At v0 the bank trades IRS / FRA / FX-spot / FX-forward, so the live
// asset classes are `ir` and `fx`. The remaining BCBS d317 Table 2 asset
// classes (`credit`, `equity`, `commodity`) are declared in the union so
// the engine carries them forward; supervisory-factor coverage for those
// asset classes is documented as TODO in `pfe-addon.ts` until the bank
// originates trades in those products.
// ---------------------------------------------------------------------------

export type SaCcrAssetClass = "ir" | "fx" | "credit" | "equity" | "commodity";

export interface AddOnComponent {
  assetClass: SaCcrAssetClass;
  /** Aggregated notional for the asset class. Money in netting-set ccy. */
  notional: Money;
  /** BCBS d317 Table 2 / CRE52 §52.45 supervisory factor for the asset
   * class. Expressed as a fraction (e.g. 0.005 = 0.5%). */
  supervisoryFactor: number;
  /** Asset-class add-on. v0 simplification: addOn = notional × SF (single-
   * period maturity factor = 1.0 — see `pfe-addon.ts` header). */
  addOn: Money;
}

// ---------------------------------------------------------------------------
// EadComputation — the per-netting-set EAD result, RC + PFE composition.
// Result shape of `computeEad`.
//
// Per BCBS d317 §10: EAD = α × (RC + PFE) with α = 1.4. PFE in v0 is
// `Σ AddOnComponent.addOn` (i.e. AggregatedAddOn with multiplier = 1.0
// pending the BCBS multiplier formula in a follow-on slice).
// ---------------------------------------------------------------------------

export interface EadComputation {
  nettingSetId: string;
  counterpartyId: string;
  rc: Money;
  /** PFE = multiplier × aggregatedAddOn (BCBS d317 §149 / CRE52 §52.5). */
  pfe: Money;
  /** BCBS d317 §10 regulatory multiplier α. Constant 1.4 — carried in the
   * result for caller audit. */
  alpha: 1.4;
  /**
   * BCBS d317 §149 / CRE52 §52.5 PFE multiplier — in [0.05, 1.0]. Equal
   * to 1.0 when the netting set is at-the-money or in-the-money; shrinks
   * towards 0.05 (5% floor) as V − C goes deeply negative (over-
   * collateralised). Carried on the result for caller audit + Vera recon.
   */
  multiplier: number;
  /**
   * Σ(asset-class add-on) — the unscaled aggregated add-on, before the
   * PFE multiplier is applied. Carried on the result for caller audit
   * (BCBS d317 §149 inputs).
   */
  aggregatedAddOn: Money;
  ead: Money;
  asOf: string;
}

// ---------------------------------------------------------------------------
// TradeSummary — minimal trade-shape required by `computeAddOn`. Engine-
// internal shape; consumers populate this from upstream sources (forward
// obligations / market-data / trade-booking). Kept structural so the
// engine doesn't bind to a single upstream trade representation.
//
// v1 (PR-SA-CCR-V1, D-CREDIT-LIMIT-ENGINE-BUILD Phase 5) adds:
//   - `direction` — drives the BCBS d317 §15 supervisory delta (linear
//     products: δ = +1 long / −1 short).
//   - `remainingYears` — drives the BCBS d317 §164 maturity factor
//     (unmargined: √(min(M, 1y)/1y)) and the IR hedging-set bucket.
//   - `currency` — IR hedging-set keys are `<currency>:<bucket>`; defaults
//     to `notional.currency` if omitted.
//   - `hedgingSetTag` — FX currency pair / commodity type for hedging-set
//     keying.
//   - `optionType` — option discriminator (currently unused; supervisory
//     delta for options is a follow-on slice).
// ---------------------------------------------------------------------------

export interface TradeSummary {
  /** Trade-side identifier — purely for callers' debugging. */
  tradeId?: string;
  /** Counterparty the trade belongs to. */
  counterpartyId: string;
  /** Netting set the trade is governed by. */
  nettingSetId: string;
  /** SA-CCR asset class — drives supervisory-factor selection. */
  assetClass: SaCcrAssetClass;
  /** Notional in the trade's currency. Always positive — direction is
   * encoded by `direction`, not by sign. */
  notional: Money;
  /**
   * Trade direction from the bank's perspective. Drives the BCBS d317
   * supervisory delta (linear: δ = +1 long / −1 short — CRE52 §52.46).
   * Defaults to "long" if omitted (preserves v0 behaviour where notionals
   * were summed without offsetting).
   */
  direction?: "long" | "short";
  /**
   * Remaining tenor to maturity in years (≥ 0). Drives both the BCBS
   * d317 §164 maturity factor (unmargined: √(min(M, 1y)/1y), capped 1.0)
   * and the IR hedging-set bucket (lt-1y / 1y-5y / gt-5y per §158).
   * When omitted, treated as 1.0y (yields MF = 1.0 — matches v0).
   */
  remainingYears?: number;
  /**
   * Currency tag for hedging-set keying — for IR trades this is the
   * leg currency. Defaults to `String(notional.currency)`.
   */
  currency?: string;
  /**
   * Hedging-set tag for asset classes whose key is a string label rather
   * than a derived bucket:
   *   - FX trades: canonical currency-pair (e.g. "EUR/USD" — alphabetical).
   *   - Commodity trades: commodity type (e.g. "wti-crude", "electricity").
   *   - Credit / Equity: ignored at v1 (single bucket per netting set).
   */
  hedgingSetTag?: string;
  /**
   * Option discriminator. When set, indicates the trade is an option —
   * the BCBS d317 supervisory delta for options is a follow-on slice (v1
   * conservatively treats options as linear; see `tradeDelta`).
   */
  optionType?: "call" | "put";
}
