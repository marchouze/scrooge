// platform/reporting/ba-320-market-risk-charge-adapter.ts
//
// The FULL BA 320 standardised market-risk capital charge, folded from events,
// for the BA 700 market-RWA leg (D-BA-RETURN-SIMULATOR-FIRST capstone).
//
// ## Why this exists
//
// The BA 700 V2 capital-adequacy projection (`ba700-v2.ts`) previously sourced
// market RWA as `12.5 × computeBA320V2().fx.openPositionChargeMinor` — the FX
// open-position charge ONLY. That understated market RWA: the trading-book
// equity / commodity / IR-general / IR-specific charges (all driven non-zero by
// the simulated trading book, #1562) never reached the capital ratio.
//
// This adapter assembles the COMPLETE Reg 28(3)(a) standardised market-risk
// charge — the sum across ALL risk classes:
//
//   total charge = FX open-position          (Reg 28(5)  — rate-dependent)
//                + IR general                 (Reg 28(3)(a) — bond + IRS ladder)
//                + IR specific                (Reg 28(3)(b))
//                + equity position            (Reg 28(3)(a))
//                + commodity (simplified)     (Reg 28(3)(a))
//
//   market RWA = 12.5 × total charge          (Reg 38 / BCBS Basel III §50–§90)
//
// It REUSES the existing per-risk-class event-fold adapters (Principle 2 — single
// derivation site; Charter cmd 4 — source, don't duplicate):
//   - FX:              `computeBA320V2().fx.openPositionChargeMinor` (FIL events)
//   - IR general:      `buildBondIrGeneralLadder` + `buildIrsIrGeneralLadder`
//                      → `combineIrGeneralLadders`
//   - IR specific:     `buildBondIrSpecificRiskRows`
//   - equity:          `buildEquityRows`
//   - commodity:       `buildCommodityRows`
// The non-FX legs are fed into the pure `generateBa320MarketRisk` engine; the FX
// leg is added on top (it is computed in the FIL-native V2 FX projection, which
// the V1 trial-balance generator does not see).
//
// ## Availability semantics (Charter cmd 2 — fail-closed; never zero-coerce)
//
// The two leg families have DIFFERENT availability conditions, deliberately
// modelled separately:
//
//   - FX leg — RATE-DEPENDENT. Available iff `computeBA320V2` resolves a
//     production FX rate for every open pair (charge !== null). When no rate
//     resolves, the FX charge is `null` → the FX leg is EXCLUDED (not zeroed):
//     `fxAvailable === false`, `fxChargeMinor === null`. The aggregate flags this.
//
//   - Non-FX legs (IR / equity / commodity) — POSITION × RISK-WEIGHT, NO RATE.
//     They do NOT depend on an FX rate, so they are ALWAYS available — present
//     even when the FX rate is null. A zero charge here means "no open position",
//     never "unavailable".
//
// So the aggregate is computable whenever the non-FX legs resolve (always); the
// FX leg adds in only when its rate resolves. `marketRiskChargeMinor` is NEVER
// `null` (the non-FX legs always carry a real figure, possibly 0); the
// `fxAvailable` flag, not a zero, is the signal for the EXCLUDED FX term. This
// preserves the historical fail-closed behaviour of the FX leg while making the
// non-FX legs first-class.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-FRTB-TRADING-DESK-STRUCTURE; D-CAPITAL-ASSET-CLASS-V1;
//   D-PROVENANCE-FILTER-ENFORCEMENT; Regulations Relating to Banks Reg 28(3)(a),
//   Reg 28(5), Reg 38; BCBS D352 §718; BCBS Basel III §50–§90.
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../event-store/store";
import type { MarketDataStore } from "../market-data/store";
import { computeBA320V2 } from "../projections/ba320-fx-v2";
import {
  buildBondIrGeneralLadder,
  buildBondIrSpecificRiskRows,
} from "./ba-320-bond-events-adapter";
import { buildCommodityRows } from "./ba-320-commodity-events-adapter";
import { buildEquityRows } from "./ba-320-equity-events-adapter";
import { buildIrsIrGeneralLadder, combineIrGeneralLadders } from "./ba-320-irs-events-adapter";
import { generateBa320MarketRisk } from "./ba-320-market-risk";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface Ba320MarketRiskChargeInput {
  /** Event store to replay the trading-book position events from. */
  readonly eventStore: EventStore;
  /** Legal entity short-id (`LE-ZA-HOZ-BANK`). Throws on non-bank. */
  readonly entity: string;
  /** ISO 8601 — as-of / period-end. Positions opened ≤ this date are folded. */
  readonly asOf: string;
  /** ISO 4217 functional currency. */
  readonly functionalCurrency: string;
  /**
   * Market-data store for the FX leg's production rate lookups — threaded
   * straight through to `computeBA320V2` (same rate source the V2 FX projection
   * + daily-pnl-v2 consume). Absent ⇒ the FX leg fails closed when an open pair
   * has no rate.
   */
  readonly marketDataStore?: MarketDataStore;
  /**
   * Explicit FX rate map (base currency → functional-units-per-base, MAJOR
   * units), threaded through to `computeBA320V2`. Overrides the `marketDataStore`
   * lookup per currency. Lets a caller feed BA-320 + BA-700 from one identical
   * rate snapshot.
   */
  readonly zarRates?: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Per-risk-class capital charge breakdown (functional-currency minor units). */
export interface Ba320RiskClassCharges {
  readonly irGeneralMinor: number;
  readonly irSpecificMinor: number;
  readonly equityMinor: number;
  readonly commodityMinor: number;
  /**
   * FX open-position charge. `null` when the FX leg fails closed (no production
   * rate for an open pair) — EXCLUDED, not zero-coerced. `0` only as a genuine
   * no-open-FX-position figure.
   */
  readonly fxMinor: number | null;
}

export interface Ba320MarketRiskChargeResult {
  /**
   * The TOTAL market-risk capital charge across all risk classes (functional-
   * currency minor units) = Σ(non-FX legs) + (FX leg when available). NEVER
   * `null` — the non-FX legs always carry a real figure (possibly 0). The FX
   * term is summed in ONLY when `fxAvailable`; an excluded FX leg contributes
   * nothing (fail-closed). Read `fxAvailable` to know whether FX is included.
   */
  readonly marketRiskChargeMinor: number;
  /** Per-risk-class breakdown. */
  readonly charges: Ba320RiskClassCharges;
  /**
   * Whether the FX leg is INCLUDED in `marketRiskChargeMinor`. `false` = the
   * BA-320 FX charge was `null` (no production FX rate, fail-closed) → FX
   * EXCLUDED, not zeroed. The non-FX legs are unaffected.
   */
  readonly fxAvailable: boolean;
  /**
   * The non-FX legs are always available (position × risk-weight, no rate). This
   * is structurally `true`; surfaced explicitly so the aggregate clearly reports
   * each leg's inclusion. Charter cmd 2 — explicit, deliberate availability.
   */
  readonly nonFxAvailable: true;
  /** BA-320 FX projection coverage status (passed through for gap text). */
  readonly fxCoverageStatus: "no-data" | "partial" | "complete";
  /**
   * IRS trade-IDs whose maturity-method decomposition failed (non-vanilla / no
   * next-reset) — surfaced, never dropped (WS-BA-RETURNS-FOLLOWON G1).
   */
  readonly swapsMissingTerms: readonly string[];
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Fold the FULL BA 320 standardised market-risk capital charge from events.
 *
 * All sub-adapters apply the SAME default provenance filter (production-only by
 * default; a `setDefaultProvenanceModeOverride("combined")` makes the simulated
 * book visible) — so the production read folds to the fail-closed baseline (no
 * real positions → no charge) and the simulated / combined read drives the
 * non-zero charge. The R300m-into-Prod guard is structural: the production lens
 * never sees the simulated trading book.
 *
 * Citations: Reg 28(3)(a), Reg 28(5); BCBS D352 §718; D-BA-RETURN-SIMULATOR-FIRST.
 */
export function buildBa320MarketRiskCharge(
  input: Ba320MarketRiskChargeInput,
): Ba320MarketRiskChargeResult {
  const { eventStore, entity, asOf, functionalCurrency } = input;

  // ---- Non-FX legs: fold the event adapters (each under the default lens). ---
  const equity = buildEquityRows({ entity, periodEnd: asOf, eventStore });
  const commodity = buildCommodityRows({ entity, periodEnd: asOf, eventStore });
  const bondLadder = buildBondIrGeneralLadder({ entity, periodEnd: asOf, eventStore });
  const irsLadder = buildIrsIrGeneralLadder({ entity, periodEnd: asOf, eventStore });
  const irGeneralLadder = combineIrGeneralLadders(bondLadder, irsLadder.rows);
  const irSpecific = buildBondIrSpecificRiskRows({ entity, periodEnd: asOf, eventStore });

  // Feed the non-FX legs into the pure generator (FX is computed separately in
  // the FIL-native V2 projection, so we pass an empty FX position set here).
  const nonFx = generateBa320MarketRisk({
    entity,
    asOf,
    periodId: `period:${entity}:ba320-market-charge`,
    functionalCurrency,
    irGeneralMaturityLadder: irGeneralLadder,
    irSpecificRisk: irSpecific,
    equity,
    fxPositions: [],
    commodity,
  });

  const irGeneralMinor = nonFx.interestRateGeneral.capitalMinor;
  const irSpecificMinor = nonFx.interestRateSpecific.capitalMinor;
  const equityMinor = nonFx.equity.capitalMinor;
  const commodityMinor = nonFx.commodity.capitalMinor;
  const nonFxMinor = irGeneralMinor + irSpecificMinor + equityMinor + commodityMinor;

  // ---- FX leg: the FIL-native V2 FX open-position charge (rate-dependent). ----
  const ba320Fx = computeBA320V2({
    eventStore,
    asOf,
    entity,
    functionalCurrency,
    ...(input.marketDataStore !== undefined ? { marketDataStore: input.marketDataStore } : {}),
    ...(input.zarRates !== undefined ? { zarRates: input.zarRates } : {}),
  });
  const fxMinor = ba320Fx.fx.openPositionChargeMinor;
  const fxAvailable = fxMinor !== null;

  // Total: non-FX legs always sum in; the FX leg only when available (Charter
  // cmd 2 — an excluded FX leg contributes nothing, never a fabricated 0-as-if).
  const marketRiskChargeMinor = nonFxMinor + (fxAvailable ? fxMinor : 0);

  return {
    marketRiskChargeMinor,
    charges: {
      irGeneralMinor,
      irSpecificMinor,
      equityMinor,
      commodityMinor,
      fxMinor,
    },
    fxAvailable,
    nonFxAvailable: true,
    fxCoverageStatus: ba320Fx.fx.coverageStatus,
    swapsMissingTerms: irsLadder.swapsMissingTerms,
  };
}
