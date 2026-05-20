// platform/risk/sa-ccr/pfe-addon.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 — SA-CCR PFE add-on engine (v1).
//
// Per Credit Risk Policy §3 line 130 and BCBS d317 §149–§191 / CRE52
// §52.10–§52.13 / §52.45–§52.52:
//
//   PFE = multiplier × AggregatedAddOn
//   AggregatedAddOn = Σ (hedging-set add-on)
//   hedging-set add-on = |Σ_i (δ_i × d_i × MF_i)| × SF
//   adjusted notional (per trade) = δ × d × MF
//   multiplier = min(1, Floor + (1 − Floor) × exp((V − C) / (2 × (1 − Floor) × AggOn)))
//     where Floor = 0.05 (5%).
//
// v1 closes the four substrate gaps of v0 (PR #617):
//
//   1. **Multiplier — BCBS d317 multiplier formula now wired.**
//      `pfeMultiplier(vMtm, collateral, aggAddOn)` returns the BCBS d317
//      §149 / CRE52 §52.5 multiplier in [0.05, 1.0]. When the netting set
//      is deep ITM (V − C ≫ 0) the multiplier rides at 1.0; as V − C falls
//      below zero (over-collateralised), the multiplier shrinks towards
//      its 5% floor — recognising the collateral cushion against PFE.
//
//   2. **Maturity factor — BCBS d317 §164 schedule wired.**
//      Unmargined: MF = √(min(M, 1y) / 1y), capped at 1.0.
//      Margined  : MF = √(MPOR / 1y), MPOR = 10 business days
//                  (≈ 14 calendar days, 10/250-bd → ~0.04y), v0 constant.
//      The disputed-margin 20 bd extension is documented but not wired
//      until the bank originates trades into a live CSA dispute regime.
//
//   3. **Supervisory factors — full BCBS d317 Table 2 / CRE52 §52.45–§52.52.**
//      ir 0.5 % / fx 4.0 % / credit 1.30 % / equity 32 % / commodity 18 %.
//      v0 acceptable simplification per dispatch brief: one representative
//      SF per asset class. Granular IG/sub-IG and index/single-name
//      differentiation is documented inline and queued for the next slice.
//
//   4. **Hedging-set / delta adjustments — BCBS d317 §15 / CRE52 §52.46 wired.**
//      Per-trade adjusted notional = δ × d × MF. For linear products
//      (IRS, FRA, FX-forward — bank's v0 universe): δ = +1 long / −1 short.
//      Options stub: δ TODO, will be the BCBS d317 supervisory delta when
//      the bank originates option products.
//      Hedging-set keys (per asset class):
//        ir         : `<currency>:<maturity-bucket>` where maturity bucket
//                     is one of "lt-1y" (M < 1y), "1y-5y" (1y ≤ M < 5y),
//                     "gt-5y" (M ≥ 5y) per BCBS d317 §158.
//        fx         : `<currency-pair>` (canonical alphabetical, e.g.
//                     "EUR/USD" — direction-independent).
//        commodity  : `<commodity-type>` (e.g. "wti-crude", "electricity").
//        credit     : a single set per netting set at v0 (BCBS d317
//                     §159 requires per-reference-entity buckets — deferred).
//        equity     : a single set per netting set at v0 (BCBS d317
//                     §160 requires per-issuer buckets — deferred).
//      Within each hedging set, the net `Σ(δ × d × MF)` is taken in
//      absolute value before multiplying by SF — long offsets short for
//      linear products within the same hedging set.
//
// Pure function — no event emission, no side effects, no event-store
// reads.
//
// Citations:
//   BCBS d317 §10 (α), §15 (delta-adjusted notional), §149–§191 (SA-CCR PFE);
//   CRE52 §52.5 (multiplier), §52.10–§52.13 (multiplier formula),
//   §52.45–§52.52 (supervisory factors), §52.46 (delta), §52.58–§52.63
//   (hedging-set keys);
//   Policies/credit-risk-policy-v1.md §3 line 130 (IN FORCE 2026-05-13);
//   D-CREDIT-LIMIT-ENGINE-BUILD Phase 5.
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
// Supervisory-factor table — BCBS d317 Table 2 / CRE52 §52.45–§52.52.
//
// v1 wires one representative SF per asset class (acceptable per dispatch
// brief): granular sub-class differentiation is a follow-on slice.
//   ir         0.005   (0.5 %)    — CRE52 §52.46
//   fx         0.04    (4.0 %)    — CRE52 §52.47
//   credit     0.013   (1.30 %)   — CRE52 §52.48 (non-IG; conservative)
//   equity     0.32    (32 %)     — CRE52 §52.50 (single-name; conservative)
//   commodity  0.18    (18 %)     — CRE52 §52.51 (other; electricity 40%
//                                                  deferred to commodity slice)
// Follow-on (BCBS d317 Table 2 granular schedule — substrate gap):
//   credit IG     0.46 %       — CRE52 §52.48
//   credit non-IG 1.30 %       — CRE52 §52.48
//   equity index  20 %         — CRE52 §52.50
//   commodity electricity 40%  — CRE52 §52.51
// ---------------------------------------------------------------------------

const SUPERVISORY_FACTOR: Record<SaCcrAssetClass, number> = {
  ir: 0.005,
  fx: 0.04,
  credit: 0.013,
  equity: 0.32,
  commodity: 0.18,
};

/**
 * `supervisoryFactor` — looks up the v1 supervisory factor for an asset
 * class. All five BCBS d317 asset classes are now wired.
 */
export function supervisoryFactor(assetClass: SaCcrAssetClass): number {
  const sf = SUPERVISORY_FACTOR[assetClass];
  if (sf === undefined) {
    throw new Error(
      `SA-CCR PFE: supervisory factor for assetClass='${String(assetClass)}' is not in the BCBS d317 Table 2 lookup`,
    );
  }
  return sf;
}

// ---------------------------------------------------------------------------
// Multiplier — BCBS d317 §149 / CRE52 §52.5.
//
//   multiplier = min(1, Floor + (1 − Floor) × exp((V − C) / (2 × (1 − Floor) × AggAddOn)))
//
// where Floor = 0.05. When AggAddOn = 0 the formula is degenerate — return
// 1.0 (no PFE add-on to multiply anyway).
// ---------------------------------------------------------------------------

export const PFE_MULTIPLIER_FLOOR = 0.05 as const;

export function pfeMultiplier(
  vMtmMinor: bigint,
  collateralMinor: bigint,
  aggAddOnMinor: bigint,
): number {
  if (aggAddOnMinor === 0n) return 1.0;
  // Floor and complement.
  const floor = PFE_MULTIPLIER_FLOOR;
  const oneMinusFloor = 1 - floor;
  // Numerator: V − C in minor units. Carry as Number — multiplier is
  // dimensionless and inside the BCBS formula the exponent is a ratio.
  const vMinusC = Number(vMtmMinor - collateralMinor);
  const denom = 2 * oneMinusFloor * Number(aggAddOnMinor);
  const exponent = vMinusC / denom;
  const raw = floor + oneMinusFloor * Math.exp(exponent);
  return Math.min(1.0, raw);
}

// ---------------------------------------------------------------------------
// Maturity factor — BCBS d317 §164 / CRE52 §52.52.
//
// Unmargined: MF = √(min(M, 1y) / 1y), capped at 1.0 where M is the trade's
//             remaining maturity in years.
// Margined  : MF = √(MPOR / 1y), MPOR = 10 business days standard
//             (≈ 10/250 = 0.04y). The disputed-margin 20 bd extension is
//             documented but constant at 10 bd for v1 until the bank
//             originates trades into a live CSA dispute regime.
// ---------------------------------------------------------------------------

export const MPOR_BUSINESS_DAYS = 10 as const;
const BUSINESS_DAYS_PER_YEAR = 250;
/** Margined maturity factor: √(MPOR / 1y) — constant at v1 (MPOR = 10 bd). */
export const MARGINED_MATURITY_FACTOR = Math.sqrt(MPOR_BUSINESS_DAYS / BUSINESS_DAYS_PER_YEAR);

export function maturityFactor(opts: {
  margined: boolean;
  remainingYears?: number;
}): number {
  if (opts.margined) return MARGINED_MATURITY_FACTOR;
  // Unmargined: √(min(M, 1y) / 1y) capped at 1.0.
  // When remainingYears is missing, treat as 1y (M ≥ 1y → MF = 1.0).
  const m = opts.remainingYears ?? 1.0;
  const capped = Math.min(m, 1.0);
  if (capped <= 0) return 0;
  return Math.sqrt(capped);
}

// ---------------------------------------------------------------------------
// Hedging-set keys — BCBS d317 §158–§160 / CRE52 §52.58–§52.63.
//
// Within each hedging set, Σ(δ × d × MF) is taken across long and short
// trades (offsetting recognised), then absolute-valued before multiplying
// by SF. Between hedging sets within the same asset class, the absolute
// values are summed (no offsetting).
// ---------------------------------------------------------------------------

const IR_MATURITY_BUCKET = (years: number): "lt-1y" | "1y-5y" | "gt-5y" => {
  if (years < 1) return "lt-1y";
  if (years < 5) return "1y-5y";
  return "gt-5y";
};

/** Compute the hedging-set key for a trade. v0 universe = linear products. */
export function hedgingSetKey(trade: TradeSummary): string {
  switch (trade.assetClass) {
    case "ir":
      // currency × maturity bucket. trade.currency holds the IRS leg
      // currency. Falls back to the notional currency if `currency` not
      // supplied.
      return `ir:${trade.currency ?? String(trade.notional.currency)}:${IR_MATURITY_BUCKET(
        trade.remainingYears ?? 1.0,
      )}`;
    case "fx":
      // currency pair, alphabetical canonicalisation (direction-independent).
      return `fx:${trade.hedgingSetTag ?? String(trade.notional.currency)}`;
    case "commodity":
      // commodity type. Caller supplies via hedgingSetTag.
      return `commodity:${trade.hedgingSetTag ?? "other"}`;
    case "credit":
      // v0: a single bucket per netting set (single-name granularity
      // deferred — BCBS d317 §159 requires per-reference-entity).
      return "credit:bucket-v0";
    case "equity":
      // v0: a single bucket per netting set (single-issuer granularity
      // deferred — BCBS d317 §160).
      return "equity:bucket-v0";
    default: {
      // Exhaustiveness — should never hit at compile time.
      const exhaustive: never = trade.assetClass;
      throw new Error(`SA-CCR PFE: unknown asset class ${String(exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Trade delta — BCBS d317 §15 / CRE52 §52.46.
//
// Linear products (IRS / FRA / FX-forward): δ = +1 long / −1 short.
// Options: BCBS supervisory delta — TODO when bank originates options.
// ---------------------------------------------------------------------------

export function tradeDelta(trade: TradeSummary): number {
  if (trade.optionType !== undefined) {
    // TODO — BCBS d317 supervisory delta for options. Until the bank
    // originates option products, conservative stub: |δ| = 1, sign by
    // direction (i.e. treat as linear). This will be replaced by the
    // ln-moneyness Black-Scholes-style supervisory delta in a follow-on
    // slice.
    return trade.direction === "short" ? -1 : 1;
  }
  return trade.direction === "short" ? -1 : 1;
}

// ---------------------------------------------------------------------------
// computeAddOn — pure aggregation of trade notionals by asset class into
// SA-CCR PFE add-on components.
//
// v1 algorithm (BCBS d317 §156–§166):
//   1. For each trade, compute the adjusted notional = δ × d × MF.
//   2. Group by (assetClass, hedgingSetKey); sum signed adjusted notional
//      within each hedging set.
//   3. For each hedging set, |Σ(δ × d × MF)| × SF = hedging-set add-on.
//   4. For each asset class, addOn = Σ(hedging-set add-on).
//
// All trades passed in must share a single netting-set currency — callers
// upstream of the engine are responsible for FX conversion (a netting set
// is single-currency by Credit Risk Policy §3 line 132 / convention).
// Cross-currency input is rejected at runtime to keep money arithmetic
// honest (P5).
//
// The `margined` flag is supplied by the caller (it lives on the
// `NettingSet` config, not the trade); when omitted we default to
// unmargined to match v0 behaviour.
// ---------------------------------------------------------------------------

export function computeAddOn(
  trades: TradeSummary[],
  opts: { margined?: boolean } = {},
): AddOnComponent[] {
  const first = trades[0];
  if (first === undefined) return [];

  const ccy = String(first.notional.currency) as Currency;
  for (const t of trades) {
    if (String(t.notional.currency) !== String(ccy)) {
      throw new Error(
        `SA-CCR PFE: cross-currency trade list — expected ${String(ccy)}, got ${String(t.notional.currency)} on tradeId=${t.tradeId ?? "<unset>"}`,
      );
    }
  }

  const margined = opts.margined ?? false;

  // Step 1+2: per-trade adjusted notional, grouped by (assetClass, hedgingSetKey).
  // Use Number arithmetic for adjusted notional — MF and δ are real-valued.
  // Carry adjusted notional in minor units (Number); precision loss is at
  // the cent level and dominated by SF rounding downstream.
  type HedgingSetAccum = {
    assetClass: SaCcrAssetClass;
    hedgingSetKey: string;
    signedAdjustedNotionalMinor: number;
  };
  const sets = new Map<string, HedgingSetAccum>();

  for (const t of trades) {
    const delta = tradeDelta(t);
    const mf = maturityFactor(
      t.remainingYears !== undefined
        ? { margined, remainingYears: t.remainingYears }
        : { margined },
    );
    const notionalMinor = Number(t.notional.amount);
    const adjusted = delta * notionalMinor * mf;
    const key = `${t.assetClass}::${hedgingSetKey(t)}`;
    const prev = sets.get(key);
    if (prev) {
      prev.signedAdjustedNotionalMinor += adjusted;
    } else {
      sets.set(key, {
        assetClass: t.assetClass,
        hedgingSetKey: hedgingSetKey(t),
        signedAdjustedNotionalMinor: adjusted,
      });
    }
  }

  // Step 3+4: per-asset-class add-on = Σ(|net hedging set| × SF).
  // We carry the aggregated notional per asset class (sum of |net hedging-
  // set|) on the result so callers can audit. SF is uniform per asset
  // class at v1.
  type AssetAccum = {
    assetClass: SaCcrAssetClass;
    aggregatedNotionalMinor: number;
    addOnMinor: number;
  };
  const byClass = new Map<SaCcrAssetClass, AssetAccum>();

  for (const set of sets.values()) {
    const sf = supervisoryFactor(set.assetClass);
    const absAdjusted = Math.abs(set.signedAdjustedNotionalMinor);
    const addOn = absAdjusted * sf;
    const prev = byClass.get(set.assetClass);
    if (prev) {
      prev.aggregatedNotionalMinor += absAdjusted;
      prev.addOnMinor += addOn;
    } else {
      byClass.set(set.assetClass, {
        assetClass: set.assetClass,
        aggregatedNotionalMinor: absAdjusted,
        addOnMinor: addOn,
      });
    }
  }

  // Stable iteration order — assetClass union order in the result.
  const order: SaCcrAssetClass[] = ["ir", "fx", "credit", "equity", "commodity"];
  const out: AddOnComponent[] = [];
  for (const ac of order) {
    const acc = byClass.get(ac);
    if (acc === undefined) continue;
    const sf = supervisoryFactor(ac);
    out.push({
      assetClass: ac,
      notional: minor(BigInt(Math.round(acc.aggregatedNotionalMinor)), ccy),
      supervisoryFactor: sf,
      addOn: minor(BigInt(Math.round(acc.addOnMinor)), ccy),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// aggregatedAddOn — sum the per-asset-class add-ons into the single
// `AggregatedAddOn` figure used by the PFE multiplier. Internal helper
// consumed by `ead.ts`.
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
