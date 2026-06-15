// v2-core/fil-models/fx/ndf/fx-ndf-model.ts
//
// FX NDF (Non-Deliverable Forward): Valuable + Performable FIL-Model.
//
// Pre-fixing: value = notional × (ndfForwardRate − bookedNdfRate) in settlementCurrency
//             ndfForwardRate = interpolated from NDF curve at remainingDays
// Post-fixing (fixingRate present): value = notional × (fixingRate − bookedNdfRate)
//             crystallised — no market observables needed
//
// Carry uses NDF forward curve. Theta ≈ −carry (linear approx).
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Core banking platform architect, engineering).

import { mulD, roundDecimal, toDecimal } from "../../../fil-core/decimal.ts";
import type { FilEventRef } from "../../../fil-core/lifecycle.ts";
import type { Instant, Money } from "../../../fil-core/primitives.ts";
import type { CitationRef, MethodologyHash } from "../../../fil-core/primitives.ts";
import { type Money as MoneyT, moneyFromDecimal } from "../../../fil-core/primitives.ts";
import type { FilScopePattern } from "../../../fil-core/urn.ts";
import type {
  MarketDataSlice,
  ObservableRef,
  Performable,
  PerformanceRecord,
  RevaluationRecord,
  Valuable,
} from "../../../fil-facets/facets.ts";
import type { FilModelImplementationDeclared } from "../../declaration.ts";
import {
  bookCost,
  computeDailyCarry,
  computeTheta,
  computeUnrealisedPnl,
} from "../performance/fx-performance-methodology.ts";
import { interpolateCurve } from "../shared/fx-interpolation.ts";
import { ndfCurvePrefix } from "../shared/fx-observables.ts";
import type { FxNdfPosition } from "../shared/fx-positions.ts";

// NDF value = signedNotional (MAJOR) × netRate, rounded HALF-UP to 2dp display.
// Decimal-exact (D-V2-CORE-MONEY-DECIMAL-NATIVE) — never a float multiply.
function ndfValue(signedNotional: string, netRate: number, currency: string): MoneyT {
  const valued = mulD(toDecimal(signedNotional), toDecimal(String(netRate)));
  return moneyFromDecimal(currency, roundDecimal(valued, 2, "HALF_UP"));
}

function resolveNdfRate(
  pos: FxNdfPosition,
  marks: MarketDataSlice,
): { ndfRate: number; observablesUsed: readonly ObservableRef[] } {
  const reporting = pos.reporting ?? "ZAR";
  if (pos.fixingRate !== undefined) {
    // Post-fixing: crystallised rate, no observables needed
    return { ndfRate: pos.fixingRate, observablesUsed: [] };
  }
  const prefix = ndfCurvePrefix(pos.currency, reporting);
  const ndfRate = interpolateCurve(marks, prefix, pos.remainingDays);
  const observablesUsed: ObservableRef[] = [{ observableId: `${prefix}*`, kind: "curve" }];
  return { ndfRate, observablesUsed };
}

export function fxNdfValuable(pos: FxNdfPosition): Valuable {
  const reporting = pos.reporting ?? "ZAR";
  const settlementCurrency = pos.settlementCurrency;
  return {
    valuationMethod: () => "mark-to-model",
    requiredObservables(): readonly ObservableRef[] {
      if (pos.fixingRate !== undefined) return []; // crystallised
      const prefix = ndfCurvePrefix(pos.currency, reporting);
      return [{ observableId: `${prefix}*`, kind: "curve" }];
    },
    value(marks: MarketDataSlice, asOf: Instant): RevaluationRecord {
      const { ndfRate, observablesUsed } = resolveNdfRate(pos, marks);
      const netRate = ndfRate - pos.bookedNdfRate;
      const value = ndfValue(pos.signedNotional, netRate, settlementCurrency);
      return {
        value,
        asOf,
        observablesUsed,
      };
    },
  };
}

export function fxNdfPerformable(pos: FxNdfPosition): Performable {
  const reporting = pos.reporting ?? "ZAR";
  const settlementCurrency = pos.settlementCurrency;
  return {
    unrealisedPnl(marks: MarketDataSlice, asOf: Instant, _bookedCost: Money): PerformanceRecord {
      const { ndfRate, observablesUsed } = resolveNdfRate(pos, marks);
      const netRate = ndfRate - pos.bookedNdfRate;
      const mtmValue = ndfValue(pos.signedNotional, netRate, settlementCurrency);
      // NDF book cost is structurally 0 in settlementCurrency: the booked rate
      // enters `netRate` above, so the MTM value already nets the booked cost. The
      // `_bookedCost` parameter is therefore unused for an NDF (the rate-spread
      // formula subsumes it).
      const bk = bookCost(pos.signedNotional, 0, settlementCurrency);
      const unrealisedPnl = computeUnrealisedPnl(mtmValue, bk);

      // Spot rate for carry computation (use 0 if not in marks — NDF curve is primary)
      const spotId = `${pos.currency}/${reporting}`;
      const spot = marks.observables[spotId] ?? 0;
      const carry = computeDailyCarry(
        pos.signedNotional,
        spot,
        ndfRate,
        pos.remainingDays,
        settlementCurrency,
      );
      const theta = computeTheta(
        pos.signedNotional,
        spot,
        ndfRate,
        pos.remainingDays,
        settlementCurrency,
      );
      return { unrealisedPnl, carry, theta, asOf, observablesUsed };
    },
    carry(marks: MarketDataSlice, asOf: Instant): Money {
      void asOf;
      const { ndfRate } = resolveNdfRate(pos, marks);
      const spotId = `${pos.currency}/${reporting}`;
      const spot = marks.observables[spotId] ?? 0;
      return computeDailyCarry(
        pos.signedNotional,
        spot,
        ndfRate,
        pos.remainingDays,
        settlementCurrency,
      );
    },
    theta(marks: MarketDataSlice, asOf: Instant, remainingDays: number): Money {
      void asOf;
      const { ndfRate } = resolveNdfRate(pos, marks);
      const spotId = `${pos.currency}/${reporting}`;
      const spot = marks.observables[spotId] ?? 0;
      return computeTheta(pos.signedNotional, spot, ndfRate, remainingDays, settlementCurrency);
    },
  };
}

export const FX_NDF_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: "fx-ndf",
  implementsFacets: ["Valuable", "Performable", "RiskMeasurable", "Lifecycled"],
  scope: ["fil:type:fx:ndf:vanilla@1.0"] as FilScopePattern[],
  version: { major: 1, minor: 0 },
  requires: {
    facets: ["Lifecycled"],
    referenceData: ["fx-ndf-curve-table"],
    postureDimensions: ["reporting.currency"],
  },
  emits: ["FxPositionRevalued"] as FilEventRef[],
  cites: [
    "urn:reg:iasb:ias-21:§23",
    "urn:reg:iasb:ifrs-9:§5.7.1",
    "D-ENGINEERING-INTEGRITY-CHARTER",
  ] as CitationRef[],
  methodologyHash: "fil-fx-ndf-v1.0" as MethodologyHash,
  validationStatus: "submitted",
};
