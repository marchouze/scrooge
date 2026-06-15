// v2-core/fil-models/fx/spot/fx-spot-model.ts
//
// FX Spot: Valuable + Performable FIL-Model.
// Spot carry = 0, theta = 0 (no time-value in a settled transaction).
// Unrealised P&L = spot MTM − book cost at booked spot rate.
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
import { isZeroD, toDecimal } from "../../../fil-core/decimal.ts";
import { zeroMoney } from "../../../fil-core/primitives.ts";
import { valueFxPosition } from "../../fx-valuation/methodology.ts";
import { bookCost, computeUnrealisedPnl } from "../performance/fx-performance-methodology.ts";
import { fxSpotObsRef as spotObservableRef } from "../shared/fx-observables.ts";
import type { FxSpotPosition } from "../shared/fx-positions.ts";

export function fxSpotValuable(pos: FxSpotPosition): Valuable {
  const reporting = pos.reporting ?? "ZAR";
  return {
    valuationMethod: () => "mark-to-market",
    requiredObservables(): readonly ObservableRef[] {
      return [spotObservableRef(pos.currency, reporting)];
    },
    value(marks: MarketDataSlice, asOf: Instant): RevaluationRecord {
      const spotId = `${pos.currency}/${reporting}`;
      const spot = marks.observables[spotId];
      if (spot === undefined) {
        throw new Error(
          `fxSpotValuable: missing required spot observable "${spotId}" in marks (asOf ${marks.asOf})`,
        );
      }
      const { value } = valueFxPosition({
        currency: pos.currency,
        signedNotional: pos.signedNotional,
        allInRate: spot,
        reporting,
      });
      return {
        value,
        asOf,
        observablesUsed: [spotObservableRef(pos.currency, reporting)],
      };
    },
  };
}

export function fxSpotPerformable(pos: FxSpotPosition): Performable {
  const reporting = pos.reporting ?? "ZAR";
  return {
    unrealisedPnl(
      marks: MarketDataSlice,
      asOf: Instant,
      bookedCost: Money,
    ): PerformanceRecord {
      const spotId = `${pos.currency}/${reporting}`;
      const spot = marks.observables[spotId];
      if (spot === undefined) {
        throw new Error(
          `fxSpotPerformable: missing required spot observable "${spotId}" in marks (asOf ${marks.asOf})`,
        );
      }
      const { value } = valueFxPosition({
        currency: pos.currency,
        signedNotional: pos.signedNotional,
        allInRate: spot,
        reporting,
      });
      const bk = !isZeroD(toDecimal(bookedCost.amount))
        ? bookedCost
        : bookCost(pos.signedNotional, pos.bookedSpotRate, reporting);
      const unrealisedPnl = computeUnrealisedPnl(value, bk);
      return {
        unrealisedPnl,
        carry: zeroMoney(reporting),
        theta: zeroMoney(reporting),
        asOf,
        observablesUsed: [spotObservableRef(pos.currency, reporting)],
      };
    },
    carry(_marks: MarketDataSlice, _asOf: Instant): Money {
      return zeroMoney(pos.reporting ?? "ZAR");
    },
    theta(_marks: MarketDataSlice, _asOf: Instant, _remainingDays: number): Money {
      return zeroMoney(pos.reporting ?? "ZAR");
    },
  };
}

export const FX_SPOT_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: "fx-spot",
  implementsFacets: ["Valuable", "Performable", "RiskMeasurable", "Lifecycled"],
  scope: ["fil:type:fx:spot:otc-vanilla@1.0"] as FilScopePattern[],
  version: { major: 1, minor: 0 },
  requires: {
    facets: ["Lifecycled"],
    referenceData: ["fx-rate-table"],
    postureDimensions: ["reporting.currency"],
  },
  emits: ["FxPositionRevalued"] as FilEventRef[],
  cites: ["urn:reg:iasb:ias-21:§23", "D-ENGINEERING-INTEGRITY-CHARTER"] as CitationRef[],
  methodologyHash: "fil-fx-spot-v1.0" as MethodologyHash,
  validationStatus: "submitted",
};
