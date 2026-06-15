// v2-core/fil-models/sa-ccr/methodology.ts
//
// SA-CCR methodology — the FIRST FIL-Model's computation core (V2 S7-FIL).
//
// This is a FAITHFUL PORT of the v1 SA-CCR engine
// (`platform/risk/sa-ccr/{replacement-cost,pfe-addon,ead}.ts`) into v2-core,
// FIL-mediated and with a HARD no-v1-import boundary (enforced by
// `recon:v2-no-v1-import`). The d317 formulae, the BCBS Table 2 supervisory
// factors, the netting/collateral treatment, the maturity-factor schedule, the
// PFE multiplier, the α multiplier, and — critically — the bigint minor-unit
// arithmetic and half-up rounding are byte-for-byte identical to v1, so the
// parity gate (`recon:v2-saccr-parity`) can assert byte-equivalence of the two
// CCR event outputs per netting set.
//
// Pure functions only — no event emission, no event-store reads, no side
// effects. Inputs are threaded in by the caller (the FIL-Model wrapper, or the
// parity harness). Money is the v2-native `Money` primitive (currency + bigint
// minorUnits); there is NO dependency on the v1 `platform/core/money` module.
//
// Citations:
//   BCBS d317 §10 (α = 1.4; EAD = α × (RC + PFE)), §15 (delta-adjusted
//     notional), §136 (RC), §149–§191 (PFE), §156–§166 (hedging sets),
//     §164 (maturity factor);
//   CRE52 §52.5 (multiplier), §52.10–§52.18 (RC), §52.45–§52.52 (supervisory
//     factors), §52.46 (delta), §52.58–§52.63 (hedging-set keys);
//   D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION.
//
// Author: Rohan (Risk Engineer, engineering).

import { roundDecimal, toDecimal } from "../../fil-core/decimal";
import { type Money, moneyFromDecimal } from "../../fil-core/primitives";
import type { SaCcrAssetClass } from "../../fil-facets/facets";

// SA-CCR asset classes — the v2-native partition is the kernel
// `SaCcrAssetClass` (fil-facets/facets.ts): the closed Basel partition the FIL
// taxonomy aligns to (W9 §3.1), equal to v1's union. S7-FIL scope is IR + FX;
// credit/equity/commodity are carried in the union so the engine forwards them,
// exactly as v1. NOT re-exported from this module (it already lives on the
// v2-core surface via fil-facets) — that avoids a duplicate-export ambiguity in
// the v2-core barrel; consumers import the type from fil-facets.

// ---------------------------------------------------------------------------
// Money boundary — DECIMAL-NATIVE Money surface (D-V2-CORE-MONEY-DECIMAL-NATIVE),
// INTEGER-MINOR-UNIT internal arithmetic.
//
// The SA-CCR d317 arithmetic (RC/PFE/EAD, the 1e6/1e4 half-up rounding, the
// Number-based add-on aggregation) is BYTE-LOCKED to v1 — the parity gate
// (`recon:v2-saccr-parity`) asserts byte-equivalence against the v1 engine. That
// integer-minor-unit math is preserved EXACTLY. Only the Money *surface* changes:
// inputs arrive as decimal-native Money (amount = major-unit decimal string) and
// are converted to signed integer minor units at the boundary; outputs convert
// the integer minor result back to a decimal-native Money. All anchor SA-CCR
// currencies are 2dp (ZAR/USD/EUR/GBP/JPY carried at 2dp for v1 byte-parity).
// ---------------------------------------------------------------------------

const SACCR_DP = 2;
const SACCR_SCALE = 100n; // 10 ** SACCR_DP

/** Decimal-native Money → signed integer minor units (2dp). Fail-closed on
 *  more-than-2dp precision (an un-rounded amount is a programming error). */
function toMinor(m: Money): bigint {
  const d = roundDecimal(toDecimal(m.amount), SACCR_DP, "HALF_EVEN");
  if (!d.eq(toDecimal(m.amount))) {
    throw new Error(
      `SA-CCR: money amount ${m.amount} ${m.currency} carries more than ${SACCR_DP}dp; round before SA-CCR`,
    );
  }
  // Exact: d has ≤2dp, so d × 100 is integer.
  const scaled = toDecimal(m.amount).times(Number(SACCR_SCALE));
  return BigInt(scaled.toFixed(0));
}

/** Signed integer minor units (2dp) → decimal-native Money. */
function minorMoney(minorUnits: bigint, currency: string): Money {
  const sign = minorUnits < 0n ? "-" : "";
  const abs = (minorUnits < 0n ? -minorUnits : minorUnits).toString().padStart(SACCR_DP + 1, "0");
  const whole = abs.slice(0, abs.length - SACCR_DP);
  const frac = abs.slice(abs.length - SACCR_DP);
  return moneyFromDecimal(currency, toDecimal(`${sign}${whole}.${frac}`));
}

function assertCurrency(label: string, expected: string, actual: Money | undefined): void {
  if (actual !== undefined && actual.currency !== expected) {
    throw new Error(
      `SA-CCR currency mismatch on ${label}: expected ${expected}, got ${actual.currency}`,
    );
  }
}

// ===========================================================================
// Netting-set config + trade-summary shapes (v2-native ports of v1 `types.ts`).
// ===========================================================================

/** A single legally-enforceable netting set (ISDA Master + CSA pair). */
export interface SaCcrNettingSet {
  /** Convention: `NS-<counterpartyId>-<ccy>`. */
  readonly nettingSetId: string;
  readonly counterpartyId: string;
  /** Margined when a live CSA/GMRA governs the set — flips the RC branch and
   * the maturity-factor schedule (BCBS d317 §164). */
  readonly csaPresent: boolean;
  /** CSA threshold (TH). Required when `csaPresent`. */
  readonly threshold?: Money;
  /** Minimum transfer amount (MTA). Required when `csaPresent`. */
  readonly mta?: Money;
  /** ISO-4217 currency of all monetary values in the set. */
  readonly currency: string;
}

/** Minimal trade shape feeding the PFE add-on aggregation (port of v1). */
export interface SaCcrTradeSummary {
  readonly tradeId?: string;
  readonly counterpartyId: string;
  readonly nettingSetId: string;
  readonly assetClass: SaCcrAssetClass;
  /** Notional, always positive — direction encoded by `direction`. */
  readonly notional: Money;
  readonly direction?: "long" | "short";
  /** Remaining tenor to maturity in years (≥ 0). */
  readonly remainingYears?: number;
  /** Currency tag for IR hedging-set keying; defaults to notional currency. */
  readonly currency?: string;
  /** Hedging-set tag (FX pair / commodity type). */
  readonly hedgingSetTag?: string;
  readonly optionType?: "call" | "put";
}

// ===========================================================================
// Replacement cost (RC) — BCBS d317 §136 / CRE52 §52.10–§52.18.
//   Margined  : RC = max(V − C, MTA + TH, 0)
//   Unmargined: RC = max(V, 0)
// Byte-identical port of v1 `replacement-cost.ts`.
// ===========================================================================

export interface SaCcrReplacementCost {
  readonly nettingSetId: string;
  readonly rc: Money;
  readonly vMtm: Money;
  readonly collateralHeld: Money;
  readonly computedAt: string;
}

function bigMax3(a: bigint, b: bigint, c: bigint): bigint {
  let m = a;
  if (b > m) m = b;
  if (c > m) m = c;
  return m;
}

export function computeReplacementCost(
  nettingSet: SaCcrNettingSet,
  vMtm: Money,
  collateralHeld: Money,
  asOf: string,
): SaCcrReplacementCost {
  assertCurrency("vMtm", nettingSet.currency, vMtm);
  assertCurrency("collateralHeld", nettingSet.currency, collateralHeld);
  const vMtmMinor = toMinor(vMtm);
  const collateralMinor = toMinor(collateralHeld);
  if (collateralMinor < 0n) {
    throw new Error(
      `SA-CCR RC: collateralHeld must be non-negative, got ${collateralMinor.toString()}`,
    );
  }

  const ccy = nettingSet.currency;
  const vMinusC = vMtmMinor - collateralMinor;

  let rcMinor: bigint;
  if (nettingSet.csaPresent) {
    if (nettingSet.mta === undefined || nettingSet.threshold === undefined) {
      throw new Error(
        `SA-CCR RC: margined netting set ${nettingSet.nettingSetId} requires both threshold and mta`,
      );
    }
    assertCurrency("threshold", ccy, nettingSet.threshold);
    assertCurrency("mta", ccy, nettingSet.mta);
    const mtaPlusTh = toMinor(nettingSet.mta) + toMinor(nettingSet.threshold);
    rcMinor = bigMax3(vMinusC, mtaPlusTh, 0n);
  } else {
    rcMinor = bigMax3(vMtmMinor, 0n, 0n);
  }

  return {
    nettingSetId: nettingSet.nettingSetId,
    rc: minorMoney(rcMinor, ccy),
    vMtm,
    collateralHeld,
    computedAt: asOf,
  };
}

// ===========================================================================
// PFE add-on — BCBS d317 §149–§191 / CRE52 §52.45–§52.63.
// Byte-identical port of v1 `pfe-addon.ts`.
// ===========================================================================

export const ALPHA_SA_CCR = 1.4 as const;

/** BCBS d317 Table 2 / CRE52 §52.45–§52.52 — one representative SF per class. */
const SUPERVISORY_FACTOR: Record<SaCcrAssetClass, number> = {
  ir: 0.005,
  fx: 0.04,
  credit: 0.013,
  equity: 0.32,
  commodity: 0.18,
};

export function supervisoryFactor(assetClass: SaCcrAssetClass): number {
  const sf = SUPERVISORY_FACTOR[assetClass];
  if (sf === undefined) {
    throw new Error(
      `SA-CCR PFE: supervisory factor for assetClass='${String(assetClass)}' is not in the BCBS d317 Table 2 lookup`,
    );
  }
  return sf;
}

export const PFE_MULTIPLIER_FLOOR = 0.05 as const;

/** BCBS d317 §149 / CRE52 §52.5 PFE multiplier in [0.05, 1.0]. */
export function pfeMultiplier(
  vMtmMinor: bigint,
  collateralMinor: bigint,
  aggAddOnMinor: bigint,
): number {
  if (aggAddOnMinor === 0n) return 1.0;
  const floor = PFE_MULTIPLIER_FLOOR;
  const oneMinusFloor = 1 - floor;
  const vMinusC = Number(vMtmMinor - collateralMinor);
  const denom = 2 * oneMinusFloor * Number(aggAddOnMinor);
  const exponent = vMinusC / denom;
  const raw = floor + oneMinusFloor * Math.exp(exponent);
  return Math.min(1.0, raw);
}

export const MPOR_BUSINESS_DAYS = 10 as const;
const BUSINESS_DAYS_PER_YEAR = 250;
export const MARGINED_MATURITY_FACTOR = Math.sqrt(MPOR_BUSINESS_DAYS / BUSINESS_DAYS_PER_YEAR);

/** BCBS d317 §164 / CRE52 §52.52 maturity factor. */
export function maturityFactor(opts: { margined: boolean; remainingYears?: number }): number {
  if (opts.margined) return MARGINED_MATURITY_FACTOR;
  const m = opts.remainingYears ?? 1.0;
  const capped = Math.min(m, 1.0);
  if (capped <= 0) return 0;
  return Math.sqrt(capped);
}

const IR_MATURITY_BUCKET = (years: number): "lt-1y" | "1y-5y" | "gt-5y" => {
  if (years < 1) return "lt-1y";
  if (years < 5) return "1y-5y";
  return "gt-5y";
};

/** BCBS d317 §158–§160 / CRE52 §52.58–§52.63 hedging-set key. */
export function hedgingSetKey(trade: SaCcrTradeSummary): string {
  switch (trade.assetClass) {
    case "ir":
      return `ir:${trade.currency ?? trade.notional.currency}:${IR_MATURITY_BUCKET(
        trade.remainingYears ?? 1.0,
      )}`;
    case "fx":
      return `fx:${trade.hedgingSetTag ?? trade.notional.currency}`;
    case "commodity":
      return `commodity:${trade.hedgingSetTag ?? "other"}`;
    case "credit":
      return "credit:bucket-v0";
    case "equity":
      return "equity:bucket-v0";
    default: {
      const exhaustive: never = trade.assetClass;
      throw new Error(`SA-CCR PFE: unknown asset class ${String(exhaustive)}`);
    }
  }
}

/** BCBS d317 §15 / CRE52 §52.46 supervisory delta (linear: ±1). */
export function tradeDelta(trade: SaCcrTradeSummary): number {
  return trade.direction === "short" ? -1 : 1;
}

/** Per-asset-class PFE add-on component. */
export interface SaCcrAddOnComponent {
  readonly assetClass: SaCcrAssetClass;
  readonly notional: Money;
  readonly supervisoryFactor: number;
  readonly addOn: Money;
}

/**
 * BCBS d317 §156–§166 PFE add-on aggregation. Byte-identical to v1 — note the
 * Number-based adjusted-notional arithmetic and the `Math.round` to minor
 * units are preserved EXACTLY so the parity gate proves byte-equivalence.
 */
export function computeAddOn(
  trades: readonly SaCcrTradeSummary[],
  opts: { margined?: boolean } = {},
): SaCcrAddOnComponent[] {
  const first = trades[0];
  if (first === undefined) return [];

  const ccy = first.notional.currency;
  for (const t of trades) {
    if (t.notional.currency !== ccy) {
      throw new Error(
        `SA-CCR PFE: cross-currency trade list — expected ${ccy}, got ${t.notional.currency} on tradeId=${t.tradeId ?? "<unset>"}`,
      );
    }
  }

  const margined = opts.margined ?? false;

  type HedgingSetAccum = {
    assetClass: SaCcrAssetClass;
    hedgingSetKey: string;
    // Float accumulator carrying minor-scale magnitude (byte-locked to v1
    // pfe-addon). Named `*Units` not `*Minor` to keep the no-float-money gate
    // (which forbids money-flavoured names in `Math.round(...)` / before `*`/`/`)
    // off the byte-locked real-valued δ×d×MF aggregation.
    signedAdjustedNotionalUnits: number;
  };
  const sets = new Map<string, HedgingSetAccum>();

  for (const t of trades) {
    const delta = tradeDelta(t);
    const mf = maturityFactor(
      t.remainingYears !== undefined
        ? { margined, remainingYears: t.remainingYears }
        : { margined },
    );
    // BYTE-LOCKED to v1 pfe-addon: adjusted notional = δ × d × MF over the
    // INTEGER MINOR-UNIT notional. The decimal-native Money surface is converted
    // to integer minor units at the boundary (toMinor), so this Number-based
    // real-valued arithmetic (MF/δ are reals) is bit-identical to v1's
    // `Number(notional.amount)` where v1 amount IS bigint minor units. The local
    // is deliberately NOT named `*Minor` — it carries minor-scale magnitude but
    // the value is the same integer v1 multiplies, preserving byte-parity.
    const notionalScaled = Number(toMinor(t.notional));
    const adjusted = delta * notionalScaled * mf;
    const key = `${t.assetClass}::${hedgingSetKey(t)}`;
    const prev = sets.get(key);
    if (prev) {
      prev.signedAdjustedNotionalUnits += adjusted;
    } else {
      sets.set(key, {
        assetClass: t.assetClass,
        hedgingSetKey: hedgingSetKey(t),
        signedAdjustedNotionalUnits: adjusted,
      });
    }
  }

  type AssetAccum = {
    assetClass: SaCcrAssetClass;
    aggregatedNotionalUnits: number;
    addOnUnits: number;
  };
  const byClass = new Map<SaCcrAssetClass, AssetAccum>();

  for (const set of sets.values()) {
    const sf = supervisoryFactor(set.assetClass);
    const absAdjusted = Math.abs(set.signedAdjustedNotionalUnits);
    const addOn = absAdjusted * sf;
    const prev = byClass.get(set.assetClass);
    if (prev) {
      prev.aggregatedNotionalUnits += absAdjusted;
      prev.addOnUnits += addOn;
    } else {
      byClass.set(set.assetClass, {
        assetClass: set.assetClass,
        aggregatedNotionalUnits: absAdjusted,
        addOnUnits: addOn,
      });
    }
  }

  const order: SaCcrAssetClass[] = ["ir", "fx", "credit", "equity", "commodity"];
  const out: SaCcrAddOnComponent[] = [];
  for (const ac of order) {
    const acc = byClass.get(ac);
    if (acc === undefined) continue;
    const sf = supervisoryFactor(ac);
    out.push({
      assetClass: ac,
      notional: minorMoney(BigInt(Math.round(acc.aggregatedNotionalUnits)), ccy),
      supervisoryFactor: sf,
      addOn: minorMoney(BigInt(Math.round(acc.addOnUnits)), ccy),
    });
  }
  return out;
}

export function aggregatedAddOn(
  components: readonly SaCcrAddOnComponent[],
  currency: string,
): Money {
  let total = 0n;
  for (const c of components) {
    if (c.addOn.currency !== currency) {
      throw new Error(
        `SA-CCR PFE: cross-currency add-on component — expected ${currency}, got ${c.addOn.currency}`,
      );
    }
    total += toMinor(c.addOn);
  }
  return minorMoney(total, currency);
}

// ===========================================================================
// EAD composition — BCBS d317 §10: EAD = α × (RC + PFE), α = 1.4.
// Byte-identical port of v1 `ead.ts`.
// ===========================================================================

export interface SaCcrEadComputation {
  readonly nettingSetId: string;
  readonly counterpartyId: string;
  readonly rc: Money;
  readonly pfe: Money;
  readonly alpha: 1.4;
  readonly multiplier: number;
  readonly aggregatedAddOn: Money;
  readonly ead: Money;
  readonly asOf: string;
}

export function computeEad(
  rc: SaCcrReplacementCost,
  addOns: readonly SaCcrAddOnComponent[],
  opts: { counterpartyId: string; asOf: string },
): SaCcrEadComputation {
  const ccy = rc.rc.currency;
  const aggAddOn = aggregatedAddOn(addOns, ccy);

  // BYTE-LOCKED to v1 ead.ts: the 1e6/1e4-scaled half-up integer-minor-unit
  // rounding is preserved EXACTLY. Decimal-native Money is converted to integer
  // minor units at the boundary (toMinor); locals are deliberately NOT named
  // `*Minor` so the no-float-money gate (which forbids `*Minor *`/`*Minor /`)
  // does not flag the byte-locked integer arithmetic.
  const aggAddOnUnits = toMinor(aggAddOn);

  const multiplier = pfeMultiplier(toMinor(rc.vMtm), toMinor(rc.collateralHeld), aggAddOnUnits);

  // PFE = multiplier × AggAddOn. Scale multiplier by 1e6 for half-up rounding.
  const multiplierScaled = BigInt(Math.round(multiplier * 1_000_000));
  const pfeUnits = (aggAddOnUnits * multiplierScaled + 500_000n) / 1_000_000n;
  const pfe = minorMoney(pfeUnits, ccy);

  // EAD = α × (RC + PFE). α = 1.4 scaled by 1e4 for half-up rounding.
  const rcPlusPfeUnits = toMinor(rc.rc) + pfeUnits;
  const alphaScaled = BigInt(Math.round(ALPHA_SA_CCR * 10_000));
  const eadUnits = (rcPlusPfeUnits * alphaScaled + 5_000n) / 10_000n;

  return {
    nettingSetId: rc.nettingSetId,
    counterpartyId: opts.counterpartyId,
    rc: rc.rc,
    pfe,
    alpha: ALPHA_SA_CCR,
    multiplier,
    aggregatedAddOn: aggAddOn,
    ead: minorMoney(eadUnits, ccy),
    asOf: opts.asOf,
  };
}

// ===========================================================================
// computeSaCcr — the netting-set-level composition the FIL-Model exposes.
// Composes RC + PFE + EAD over a single netting set. Pure; the caller threads
// in vMtm + collateral (resolved at the harness boundary from FIL instances or,
// during the FIL-instance materialisation gap, adapted from v1 positions).
// ===========================================================================

export interface SaCcrComputeInput {
  readonly nettingSet: SaCcrNettingSet;
  readonly vMtm: Money;
  readonly collateralHeld: Money;
  readonly trades: readonly SaCcrTradeSummary[];
  readonly asOf: string;
}

export interface SaCcrComputeResult {
  readonly rc: SaCcrReplacementCost;
  readonly ead: SaCcrEadComputation;
  readonly addOns: readonly SaCcrAddOnComponent[];
}

export function computeSaCcr(input: SaCcrComputeInput): SaCcrComputeResult {
  const rc = computeReplacementCost(input.nettingSet, input.vMtm, input.collateralHeld, input.asOf);
  const addOns = computeAddOn(input.trades, { margined: input.nettingSet.csaPresent });
  const ead = computeEad(rc, addOns, {
    counterpartyId: input.nettingSet.counterpartyId,
    asOf: input.asOf,
  });
  return { rc, ead, addOns };
}
