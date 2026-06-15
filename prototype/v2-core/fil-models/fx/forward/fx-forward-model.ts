// v2-core/fil-models/fx/forward/fx-forward-model.ts
//
// FX Forward + Forward-Leg: Valuable + Performable FIL-Models.
// MTM = notional × (spot + interpolated forward points at remainingDays).
// Carry = forward premium / remainingDays.
// Theta ≈ −carry (linear approximation for forwards).
//
// Also exports fxForwardLegValuable / fxForwardLegPerformable which the swap
// model composes to avoid duplicated logic.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Core banking platform architect, engineering).

import type { FilEventRef } from "../../../fil-core/lifecycle.ts";
import type { Instant, Money } from "../../../fil-core/primitives.ts";
import type { CitationRef, MethodologyHash } from "../../../fil-core/primitives.ts";
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
import { valueFxPosition } from "../../fx-valuation/methodology.ts";
import {
  bookCostMinor,
  computeDailyCarry,
  computeTheta,
  computeUnrealisedPnl,
} from "../performance/fx-performance-methodology.ts";
import { interpolateCurve } from "../shared/fx-interpolation.ts";
import {
  fwdCurveObservableRef,
  fwdCurvePrefix,
  fxSpotObsRef as spotObservableRef,
} from "../shared/fx-observables.ts";
import type { FxForwardLegPosition, FxForwardPosition } from "../shared/fx-positions.ts";

// ---------------------------------------------------------------------------
// Shared leg logic (used by both forward model and swap model)
// ---------------------------------------------------------------------------

function resolveFwdRate(
  marks: MarketDataSlice,
  currency: string,
  reporting: string,
  remainingDays: number,
): { spot: number; forwardRate: number; observablesUsed: readonly ObservableRef[] } {
  const spotId = `${currency}/${reporting}`;
  const spot = marks.observables[spotId];
  if (spot === undefined) {
    throw new Error(`fxForwardModel: missing spot observable "${spotId}" (asOf ${marks.asOf})`);
  }
  const prefix = fwdCurvePrefix(currency, reporting);
  const forwardPoints = interpolateCurve(marks, prefix, remainingDays);
  const forwardRate = spot + forwardPoints;
  return {
    spot,
    forwardRate,
    observablesUsed: [
      spotObservableRef(currency, reporting),
      fwdCurveObservableRef(currency, reporting),
    ],
  };
}

export function fxForwardLegValuable(pos: FxForwardLegPosition): Valuable {
  const reporting = pos.reporting ?? "ZAR";
  return {
    valuationMethod: () => "mark-to-market",
    requiredObservables(): readonly ObservableRef[] {
      return [
        spotObservableRef(pos.currency, reporting),
        fwdCurveObservableRef(pos.currency, reporting),
      ];
    },
    value(marks: MarketDataSlice, asOf: Instant): RevaluationRecord {
      const { forwardRate, observablesUsed } = resolveFwdRate(
        marks,
        pos.currency,
        reporting,
        pos.remainingDays,
      );
      const { value } = valueFxPosition({
        currency: pos.currency,
        signedNotionalMinor: pos.signedNotionalMinor,
        allInRate: forwardRate,
        reporting,
      });
      return { value, asOf, observablesUsed };
    },
  };
}

export function fxForwardLegPerformable(pos: FxForwardLegPosition): Performable {
  const reporting = pos.reporting ?? "ZAR";
  return {
    unrealisedPnl(
      marks: MarketDataSlice,
      asOf: Instant,
      bookedCostMinorArg: bigint,
    ): PerformanceRecord {
      const { forwardRate, observablesUsed } = resolveFwdRate(
        marks,
        pos.currency,
        reporting,
        pos.remainingDays,
      );
      const { value } = valueFxPosition({
        currency: pos.currency,
        signedNotionalMinor: pos.signedNotionalMinor,
        allInRate: forwardRate,
        reporting,
      });
      const bk =
        bookedCostMinorArg !== 0n
          ? bookedCostMinorArg
          : bookCostMinor(pos.signedNotionalMinor, pos.bookedForwardRate);
      const unrealisedPnl = computeUnrealisedPnl(value.minorUnits, bk, reporting);
      const spotId = `${pos.currency}/${reporting}`;
      const spot = marks.observables[spotId] ?? 0;
      const carry = computeDailyCarry(
        pos.signedNotionalMinor,
        spot,
        forwardRate,
        pos.remainingDays,
        reporting,
      );
      const theta = computeTheta(
        pos.signedNotionalMinor,
        spot,
        forwardRate,
        pos.remainingDays,
        reporting,
      );
      return { unrealisedPnl, carry, theta, asOf, observablesUsed };
    },
    carry(marks: MarketDataSlice, asOf: Instant): Money {
      void asOf;
      const { spot, forwardRate } = resolveFwdRate(
        marks,
        pos.currency,
        reporting,
        pos.remainingDays,
      );
      return computeDailyCarry(
        pos.signedNotionalMinor,
        spot,
        forwardRate,
        pos.remainingDays,
        reporting,
      );
    },
    theta(marks: MarketDataSlice, asOf: Instant, remainingDays: number): Money {
      void asOf;
      const prefix = fwdCurvePrefix(pos.currency, reporting);
      const spotId = `${pos.currency}/${reporting}`;
      const spot = marks.observables[spotId] ?? 0;
      const forwardPoints = interpolateCurve(marks, prefix, remainingDays);
      const forwardRate = spot + forwardPoints;
      return computeTheta(pos.signedNotionalMinor, spot, forwardRate, remainingDays, reporting);
    },
  };
}

// ---------------------------------------------------------------------------
// FxForwardPosition (adds kind discriminant)
// ---------------------------------------------------------------------------

export function fxForwardValuable(pos: FxForwardPosition): Valuable {
  return fxForwardLegValuable(pos);
}

export function fxForwardPerformable(pos: FxForwardPosition): Performable {
  return fxForwardLegPerformable(pos);
}

export const FX_FORWARD_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: "fx-forward",
  implementsFacets: ["Valuable", "Performable", "RiskMeasurable", "Lifecycled"],
  scope: ["fil:type:fx:forward:outright@1.0"] as FilScopePattern[],
  version: { major: 1, minor: 0 },
  requires: {
    facets: ["Lifecycled"],
    referenceData: ["fx-rate-table", "fx-forward-curve-table"],
    postureDimensions: ["reporting.currency"],
  },
  emits: ["FxPositionRevalued"] as FilEventRef[],
  cites: [
    "urn:reg:iasb:ias-21:§23",
    "urn:reg:iasb:ifrs-9:§5.7.1",
    "D-ENGINEERING-INTEGRITY-CHARTER",
  ] as CitationRef[],
  methodologyHash: "fil-fx-forward-v1.0" as MethodologyHash,
  validationStatus: "submitted",
};
