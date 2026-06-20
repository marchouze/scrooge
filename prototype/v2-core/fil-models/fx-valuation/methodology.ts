// v2-core/fil-models/fx-valuation/methodology.ts
//
// FX VALUATION methodology — the v2-native mark-to-market arithmetic shared by
// the FX `Valuable` FIL-Model and the FCY-cash `Valuable` FIL-Model (V2 A2).
//
// The arithmetic is DELIBERATELY minimal and lifecycle-FREE: a position's value
// is `signedNotional × closingRate` in the reporting currency, evaluated at the
// observed marks for a given asOf. There is NO settlement input, NO maturity
// input, NO lifecycle branch — that absence IS the settlement-continuity
// invariant (A2 "Prove" §1): value_pre == value_post on the settlement date at
// the settlement-date closing rate, because `value()` has no lifecycle argument
// to make the two differ.
//
// NO v1 imports (recon:v2-no-v1-import — ENFORCING). All money/curve types are
// v2-native primitives.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (A2 build slice);
//   D-FIL-FRAMEWORK-UNIFICATION (Valuable facet, W9 §3.4);
//   D-MODEL-BINDING-CONTRACT-V1; IAS-21-§23/§28; IFRS-9-§5.7.1; Principle 1; Principle 5.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Bea (Accounting & financial reporting engineer, engineering — Accountable facet).

import { mulD, roundDecimal, toDecimal } from "../../fil-core/decimal";
import { type Instant, type Money, moneyFromDecimal } from "../../fil-core/primitives";
import type { MarketDataSlice, ObservableRef } from "../../fil-facets/facets";

// ---------------------------------------------------------------------------
// Currency display precision (decimal places). The anchor book is
// ZAR/USD/EUR/GBP/JPY; all are carried at 2dp for byte-parity with the v1 FX
// book (JPY is 0dp at the ISO level but the v1 book carries it as 2dp minor
// units — a dp-aware refinement is a named substrate gap). Default 2dp.
// ---------------------------------------------------------------------------

const DEFAULT_DISPLAY_DP = 2;

function displayDp(_currency: string): number {
  return DEFAULT_DISPLAY_DP;
}

// ---------------------------------------------------------------------------
// Observable conventions — how an FX valuation names the marks it requires.
//
// A spot position requires one observable: the closing spot rate for the
// position currency against the reporting currency (`<CCY>/<REPORTING>`). A
// forward additionally requires the forward-points observable for the same pair
// at the position's tenor. The observable id is the canonical pair string; the
// `MarketDataSlice.observables` map is keyed by that id (rate in MAJOR units,
// e.g. ZAR per 1 unit of CCY).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HISTORICAL methodology-hash token — NOT a runtime default.
//
// `V1_PINNED_REPORTING_CURRENCY` exists for ONE purpose: it is the immutable
// description of the reporting currency that the v1 (pinned-ZAR) methodology
// used, embedded inside the v1 methodology-hash pin string so historical events
// replay byte-for-byte and existing FX/SA-CCR parity gates stay green
// (WS-MULTI-BASE-CURRENCY MC-3; Engineering Charter cmd 3 — no green by
// concealment, so the v1 hash is preserved, not loosened). It is DELIBERATELY
// NOT a `?? "ZAR"` fallback in any valuation path — the runtime reporting
// currency is resolved from the holding entity's functional currency and is
// fail-closed (Charter cmd 2 + cmd 4). Do NOT reference this constant from the
// valuation kernel; it belongs to the v1 hash construction alone.
const V1_PINNED_REPORTING_CURRENCY = "ZAR" as const;

/** Spot observable id for a currency against the reporting currency. */
export function spotObservableId(currency: string, reporting: string): string {
  return `${currency}/${reporting}`;
}

/** Forward-points observable id for a currency/tenor against the reporting ccy. */
export function forwardPointsObservableId(currency: string, reporting: string): string {
  return `${currency}/${reporting}:fwd-points`;
}

export function spotObservableRef(currency: string, reporting: string): ObservableRef {
  return { observableId: spotObservableId(currency, reporting), kind: "fixing" };
}

export function forwardPointsObservableRef(currency: string, reporting: string): ObservableRef {
  return { observableId: forwardPointsObservableId(currency, reporting), kind: "curve" };
}

// ---------------------------------------------------------------------------
// OIS discount-factor observable (M1 — WS-FX-V2-SIMULATOR).
//
// Present-valuing a forward MtM requires the reporting-currency risk-free
// discount factor to the settlement date. The discount factor for tenor T is
// carried as its OWN observable, keyed `OIS:<REPORTING>:<tenorDays>d`, holding
// the multiplicative factor DF(0,T) ∈ (0,1]. The simulator injects it on the
// market path; the SUT reads it from the marks slice — never from the
// simulator directly.
//
// This RETIRES the flat-discount approximation ([GAP-FWD-2] in the v1 EOD
// module): a forward's MtM is `notional × (F_t − K) × DF(0,T)`, not the
// undiscounted `(F_t − K) × notional` of the flat-discount path.
// ---------------------------------------------------------------------------

/** OIS discount-factor observable id for the reporting ccy at a tenor (calendar days). */
export function oisDiscountObservableId(reporting: string, tenorDays: number): string {
  return `OIS:${reporting}:${tenorDays}d`;
}

export function oisDiscountObservableRef(reporting: string, tenorDays: number): ObservableRef {
  return { observableId: oisDiscountObservableId(reporting, tenorDays), kind: "curve" };
}

/**
 * Compute the multiplicative OIS discount factor DF(0,T) = exp(−r·T) for a
 * continuously-compounded annualised rate `r` and a tenor of `tenorDays`
 * calendar days (ACT/365). Returns 1 for a zero/negative tenor (spot or past).
 * Pure — the rate enters as a number; the result is bounded in (0, 1].
 */
export function oisDiscountFactor(annualRate: number, tenorDays: number): number {
  if (tenorDays <= 0) return 1;
  const t = tenorDays / 365;
  return Math.exp(-annualRate * t);
}

// ---------------------------------------------------------------------------
// The valuation kernel — signed notional × all-in rate, in the reporting ccy.
//
// `signedNotional` is the position's notional in its OWN currency's MAJOR units,
// as a SIGNED canonical decimal string (long +, short −). The all-in rate (spot,
// plus forward points for a forward) translates one MAJOR unit of the position
// currency into MAJOR units of the reporting currency. Value = notional × rate,
// rounded HALF-UP (half-away-from-zero) to the reporting currency's display dp.
//
// DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE): all arithmetic goes through
// the v2 decimal helper — never `amount * rate`. The rate enters as its decimal
// string (`toDecimal(String(rate))`). The previous minor-unit `scaleMinorByRate`
// (Number × Number float-multiply) is DELETED — that float-multiply was the
// exact hazard the decimal-native cutover eliminates.
// ---------------------------------------------------------------------------

export interface FxValuationInput {
  /** Position currency (the foreign leg), ISO-4217 alpha-3. */
  readonly currency: string;
  /** Notional in the position currency's MAJOR units, SIGNED decimal string. */
  readonly signedNotional: string;
  /** All-in rate: reporting-currency MAJOR units per 1 MAJOR unit of `currency`. */
  readonly allInRate: number;
  /**
   * Reporting currency — the holding entity's FUNCTIONAL currency (IAS-21),
   * resolved via `resolveReportingCurrency` (WS-MULTI-BASE-CURRENCY). REQUIRED +
   * fail-closed: there is NO `?? "ZAR"` default in the valuation kernel.
   */
  readonly reporting: string;
}

export interface FxValuation {
  /** Mark-to-market value in the REPORTING currency (decimal-native Money). */
  readonly value: Money;
  /** The all-in rate applied. */
  readonly rateApplied: number;
}

/**
 * Mark a single FX position to market in the reporting currency. PURE — no
 * lifecycle, no settlement, no maturity input. This is the structural root of
 * the settlement-continuity invariant.
 */
export function valueFxPosition(input: FxValuationInput): FxValuation {
  const reporting = input.reporting;
  if (input.currency === reporting) {
    // A reporting-currency leg is its own value at rate 1 (no translation).
    return {
      value: moneyFromDecimal(
        reporting,
        roundDecimal(toDecimal(input.signedNotional), displayDp(reporting), "HALF_UP"),
      ),
      rateApplied: 1,
    };
  }
  // value (reporting major) = notional (CCY major) × rate (reporting/CCY).
  const valued = mulD(toDecimal(input.signedNotional), toDecimal(String(input.allInRate)));
  return {
    value: moneyFromDecimal(reporting, roundDecimal(valued, displayDp(reporting), "HALF_UP")),
    rateApplied: input.allInRate,
  };
}

// ---------------------------------------------------------------------------
// Resolving the all-in rate from a MarketDataSlice (the `Valuable.value` marks).
// ---------------------------------------------------------------------------

export interface FxRateResolution {
  readonly allInRate: number;
  readonly observablesUsed: readonly ObservableRef[];
}

/**
 * Resolve the all-in rate for a position from the supplied marks. Spot uses the
 * spot observable; a forward adds the forward-points observable (additive points
 * in reporting-currency-per-CCY terms — the v2-native convention). A missing
 * spot observable for a non-reporting currency is a hard error (the caller must
 * supply marks for every required observable; recon history-sufficiency is the
 * gate that surfaces an unquoted pair upstream).
 */
export function resolveAllInRate(args: {
  currency: string;
  isForward: boolean;
  marks: MarketDataSlice;
  reporting: string;
}): FxRateResolution {
  const reporting = args.reporting;
  if (args.currency === reporting) {
    return { allInRate: 1, observablesUsed: [] };
  }
  const spotId = spotObservableId(args.currency, reporting);
  const spot = args.marks.observables[spotId];
  if (spot === undefined) {
    throw new Error(
      `FX valuation: missing required spot observable "${spotId}" in the marks slice (asOf ${args.marks.asOf})`,
    );
  }
  const used: ObservableRef[] = [spotObservableRef(args.currency, reporting)];
  let allIn = spot;
  if (args.isForward) {
    const fwdId = forwardPointsObservableId(args.currency, reporting);
    const points = args.marks.observables[fwdId] ?? 0;
    allIn = spot + points;
    used.push(forwardPointsObservableRef(args.currency, reporting));
  }
  return { allInRate: allIn, observablesUsed: used };
}

// ---------------------------------------------------------------------------
// Present-valued forward MtM (M1 — WS-FX-V2-SIMULATOR).
//
// A forward booked at rate K, valued at all-in forward rate F_t for the
// remaining tenor, has an unrealised mark-to-market in the reporting currency:
//
//   MtM = signedNotionalBase × (F_t − K) × DF(0,T)
//
// where DF(0,T) is the reporting-currency OIS discount factor to settlement.
// This is the present-valued forward valuation that RETIRES the flat-discount
// approximation: setting DF = 1 recovers the undiscounted (flat) figure, so the
// flat path is the degenerate r=0 case of this function.
//
// DECIMAL-NATIVE: notional + booked rate enter as decimal strings; the all-in
// rate and DF enter as numbers (curve reads). The result is reporting-currency
// Money rounded HALF-AWAY-FROM-ZERO to the reporting dp.
// ---------------------------------------------------------------------------

export interface ForwardMtmInput {
  /** Base (foreign) currency, ISO-4217 alpha-3. */
  readonly currency: string;
  /** Signed base-currency notional, MAJOR-unit decimal string (long +, short −). */
  readonly signedNotional: string;
  /** Agreed (booked) all-in forward rate, reporting per 1 base. */
  readonly bookedRate: number;
  /** Current all-in forward rate for the remaining tenor (spot + fwd points). */
  readonly currentForwardRate: number;
  /** OIS discount factor DF(0,T) to settlement (multiplicative, in (0,1]). */
  readonly discountFactor: number;
  /** Reporting currency — REQUIRED, fail-closed (no `?? "ZAR"`). */
  readonly reporting: string;
}

export interface ForwardMtm {
  /** Present-valued mark-to-market in the reporting currency (decimal Money). */
  readonly value: Money;
  /** The all-in forward rate applied. */
  readonly forwardRateApplied: number;
  /** The discount factor applied. */
  readonly discountFactorApplied: number;
}

/**
 * Present-value a forward position's mark-to-market in the reporting currency.
 * PURE — no lifecycle/settlement input. `currency === reporting` yields a zero
 * MtM (a reporting-leg forward has no FX MtM). Throws on a non-positive or
 * out-of-range discount factor (fail-closed: a bad curve read must never pass
 * silently as DF=1).
 */
export function forwardMtmValue(input: ForwardMtmInput): ForwardMtm {
  const reporting = input.reporting;
  if (
    !Number.isFinite(input.discountFactor) ||
    input.discountFactor <= 0 ||
    input.discountFactor > 1
  ) {
    throw new Error(
      `forwardMtmValue: discountFactor must be in (0,1] (got ${input.discountFactor}) — a bad OIS curve read must fail closed, never default to 1`,
    );
  }
  if (input.currency === reporting) {
    return {
      value: moneyFromDecimal(
        reporting,
        roundDecimal(toDecimal("0"), displayDp(reporting), "HALF_UP"),
      ),
      forwardRateApplied: input.currentForwardRate,
      discountFactorApplied: input.discountFactor,
    };
  }
  // rateDelta (reporting per base) = F_t − K
  const rateDelta = toDecimal(String(input.currentForwardRate - input.bookedRate));
  // undiscounted = signedNotional × rateDelta  (reporting major)
  const undiscounted = mulD(toDecimal(input.signedNotional), rateDelta);
  // present-valued = undiscounted × DF
  const pv = mulD(undiscounted, toDecimal(String(input.discountFactor)));
  return {
    value: moneyFromDecimal(reporting, roundDecimal(pv, displayDp(reporting), "HALF_UP")),
    forwardRateApplied: input.currentForwardRate,
    discountFactorApplied: input.discountFactor,
  };
}

// ---------------------------------------------------------------------------
// methodologyHash — deterministic integrity anchor (D-MODEL-BINDING-CONTRACT-V1
// §3). Pins the methodology version + the load-bearing constants (reporting
// currency, rounding convention, value formula) so any silent change to the
// arithmetic changes the hash. Pure FNV-1a digest (no crypto dep; stable across
// replays) — mirrors the SA-CCR model's hash construction.
// ---------------------------------------------------------------------------

export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * V1 methodology hash — FROZEN (WS-MULTI-BASE-CURRENCY MC-3). The pin string
 * still embeds `reporting=ZAR` because that is the HISTORICAL TRUTH: v1 events
 * were computed under a pinned-ZAR methodology. Keeping the v1 pin byte-identical
 * means historical events validate against this exact hash and every existing FX/
 * SA-CCR parity gate stays green WITHOUT being loosened (Engineering Charter cmd
 * 3). The runtime ZAR literal was removed from the valuation path; this constant
 * survives only inside the hash as an immutable description of how v1 numbers
 * were produced.
 */
export function computeFxMethodologyHash(
  modelId: string,
  version: { major: number; minor: number },
): string {
  const pin = [
    `model=${modelId}`,
    `version=${version.major}.${version.minor}`,
    `reporting=${V1_PINNED_REPORTING_CURRENCY}`,
    "value=signedNotional*allInRate",
    "allIn=spot(+fwdPoints)",
    "round=half-away-from-zero",
    "dp=2",
    "lifecycle-free=true",
  ].join("|");
  return `fxval:v${version.major}.${version.minor}:${fnv1a(pin)}`;
}

/**
 * V2 methodology hash — the RESOLVED-currency methodology (WS-MULTI-BASE-CURRENCY
 * MC-3). The pin records that the reporting currency is resolved from the holding
 * entity's functional currency (a constant string TOKEN describing the
 * methodology, NOT a per-position value — the hash describes HOW we value, never
 * a specific currency). Stamped `fxval:v2.<…>` so it never collides with the v1
 * hash. A model adopts this when its declaration cuts over to resolver-sourced
 * reporting; existing model versions keep `computeFxMethodologyHash` so the
 * current parity gates are untouched. New model-version bumps use this.
 */
export function computeFxMethodologyHashV2(
  modelId: string,
  version: { major: number; minor: number },
): string {
  const pin = [
    `model=${modelId}`,
    `version=${version.major}.${version.minor}`,
    "reporting=resolved-from-entity-functional-currency",
    "value=signedNotional*allInRate",
    "allIn=spot(+fwdPoints)",
    "round=half-away-from-zero",
    "dp=2",
    "lifecycle-free=true",
  ].join("|");
  return `fxval:v2.${version.major}.${version.minor}:${fnv1a(pin)}`;
}

// Re-export the asOf type for downstream model files.
export type { Instant };
