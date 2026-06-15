// v2-core/fil-models/fx/swap/fx-swap-model.ts
//
// FX Swap: Valuable + Performable composed from two forward legs.
// Mirrors FilComposition.legs: nearLeg (receive) + farLeg (pay).
// MTM = nearLeg MTM + farLeg MTM (opposite signedNotionalMinor signs net them).
// Carry = nearLeg carry + farLeg carry.
// Theta = nearLeg theta + farLeg theta.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Core banking platform architect, engineering).

import { addD, toDecimal } from "../../../fil-core/decimal.ts";
import type { FilEventRef } from "../../../fil-core/lifecycle.ts";
import type { Instant, Money } from "../../../fil-core/primitives.ts";
import type { CitationRef, MethodologyHash } from "../../../fil-core/primitives.ts";
import { addMoney, moneyFromDecimal, zeroMoney } from "../../../fil-core/primitives.ts";
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
import { fxForwardLegPerformable, fxForwardLegValuable } from "../forward/fx-forward-model.ts";
import type { FxSwapPosition } from "../shared/fx-positions.ts";

export function fxSwapValuable(pos: FxSwapPosition): Valuable {
  const reporting = pos.reporting ?? "ZAR";
  const nearValuable = fxForwardLegValuable({ ...pos.nearLeg, reporting });
  const farValuable = fxForwardLegValuable({ ...pos.farLeg, reporting });
  return {
    valuationMethod: () => "mark-to-market",
    requiredObservables(): readonly ObservableRef[] {
      return [...nearValuable.requiredObservables(), ...farValuable.requiredObservables()];
    },
    value(marks: MarketDataSlice, asOf: Instant): RevaluationRecord {
      const nearRev = nearValuable.value(marks, asOf);
      const farRev = farValuable.value(marks, asOf);
      // Sum legs — opposite signedNotional signs net the two legs (decimal-exact).
      const total = moneyFromDecimal(
        reporting,
        addD(toDecimal(nearRev.value.amount), toDecimal(farRev.value.amount)),
      );
      const deduped = dedupeObservables([...nearRev.observablesUsed, ...farRev.observablesUsed]);
      return {
        value: total,
        asOf,
        observablesUsed: deduped,
      };
    },
  };
}

export function fxSwapPerformable(pos: FxSwapPosition): Performable {
  const reporting = pos.reporting ?? "ZAR";
  const nearPerformable = fxForwardLegPerformable({ ...pos.nearLeg, reporting });
  const farPerformable = fxForwardLegPerformable({ ...pos.farLeg, reporting });
  return {
    unrealisedPnl(marks: MarketDataSlice, asOf: Instant, _bookedCost: Money): PerformanceRecord {
      // Each leg passes a zero-amount Money so it derives book cost from its own
      // bookedForwardRate (the decimal-native sentinel, D-V2-CORE-MONEY-DECIMAL-NATIVE).
      const zero = zeroMoney(reporting);
      const nearPerf = nearPerformable.unrealisedPnl(marks, asOf, zero);
      const farPerf = farPerformable.unrealisedPnl(marks, asOf, zero);
      return {
        unrealisedPnl: addMoney(nearPerf.unrealisedPnl, farPerf.unrealisedPnl),
        carry: addMoney(nearPerf.carry, farPerf.carry),
        theta: addMoney(nearPerf.theta, farPerf.theta),
        asOf,
        observablesUsed: dedupeObservables([
          ...nearPerf.observablesUsed,
          ...farPerf.observablesUsed,
        ]),
      };
    },
    carry(marks: MarketDataSlice, asOf: Instant): Money {
      const nearCarry = nearPerformable.carry(marks, asOf);
      const farCarry = farPerformable.carry(marks, asOf);
      return addMoney(nearCarry, farCarry);
    },
    theta(marks: MarketDataSlice, asOf: Instant, remainingDays: number): Money {
      const nearTheta = nearPerformable.theta(marks, asOf, remainingDays);
      const farTheta = farPerformable.theta(marks, asOf, remainingDays);
      return addMoney(nearTheta, farTheta);
    },
  };
}

function dedupeObservables(refs: readonly ObservableRef[]): readonly ObservableRef[] {
  const seen = new Set<string>();
  return refs.filter((r) => {
    const key = `${r.kind}:${r.observableId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const FX_SWAP_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: "fx-swap",
  implementsFacets: ["Valuable", "Performable", "RiskMeasurable", "Lifecycled"],
  scope: ["fil:type:fx:swap:vanilla@1.0"] as FilScopePattern[],
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
  methodologyHash: "fil-fx-swap-v1.0" as MethodologyHash,
  validationStatus: "submitted",
};
