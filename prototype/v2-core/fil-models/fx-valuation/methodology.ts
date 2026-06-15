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

/** The reporting currency the FX book values into (the bank's home currency). */
export const FX_REPORTING_CURRENCY: string = "ZAR";

/** Spot observable id for a currency against the reporting currency. */
export function spotObservableId(currency: string, reporting?: string): string {
  return `${currency}/${reporting ?? FX_REPORTING_CURRENCY}`;
}

/** Forward-points observable id for a currency/tenor against the reporting ccy. */
export function forwardPointsObservableId(currency: string, reporting?: string): string {
  return `${currency}/${reporting ?? FX_REPORTING_CURRENCY}:fwd-points`;
}

export function spotObservableRef(currency: string, reporting?: string): ObservableRef {
  return { observableId: spotObservableId(currency, reporting), kind: "fixing" };
}

export function forwardPointsObservableRef(currency: string, reporting?: string): ObservableRef {
  return { observableId: forwardPointsObservableId(currency, reporting), kind: "curve" };
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
  /** Reporting currency (default ZAR). */
  readonly reporting?: string;
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
  const reporting = input.reporting ?? FX_REPORTING_CURRENCY;
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
  reporting?: string;
}): FxRateResolution {
  const reporting = args.reporting ?? FX_REPORTING_CURRENCY;
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

export function computeFxMethodologyHash(
  modelId: string,
  version: { major: number; minor: number },
): string {
  const pin = [
    `model=${modelId}`,
    `version=${version.major}.${version.minor}`,
    `reporting=${FX_REPORTING_CURRENCY}`,
    "value=signedNotional*allInRate",
    "allIn=spot(+fwdPoints)",
    "round=half-away-from-zero",
    "dp=2",
    "lifecycle-free=true",
  ].join("|");
  return `fxval:v${version.major}.${version.minor}:${fnv1a(pin)}`;
}

// Re-export the asOf type for downstream model files.
export type { Instant };
