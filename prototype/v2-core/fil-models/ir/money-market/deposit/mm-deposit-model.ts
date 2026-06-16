// v2-core/fil-models/ir/money-market/deposit/mm-deposit-model.ts
//
// Fixed-term deposit (bank as taker): Valuable + Performable FIL-Model.
// Always a liability (the bank owes the depositor). Valuable = amortised cost
// (principal + EIR accrual, negative-signed); Performable = daily accrual
// (interest expense). Distinct type from unsecured because NSFR/LCR ASF
// treatment differs. No discount curve (banking-book IFRS-9 amortised cost).
//
// Authority: D-V1-REMOVAL-PHASE-3B; D-ENGINEERING-INTEGRITY-CHARTER;
//   brief:atlas:v1-removal-phase-3b-alm-liquidity-on-v2-money-ma:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import type { FilEventRef } from "../../../../fil-core/lifecycle.ts";
import type {
  CitationRef,
  Instant,
  MethodologyHash,
  Money,
} from "../../../../fil-core/primitives.ts";
import type { FilScopePattern } from "../../../../fil-core/urn.ts";
import type {
  MarketDataSlice,
  ObservableRef,
  Performable,
  PerformanceRecord,
  RevaluationRecord,
  Valuable,
} from "../../../../fil-facets/facets.ts";
import type { FilModelImplementationDeclared } from "../../../declaration.ts";
import { requireReporting } from "../../../fx-valuation/reporting-currency-resolver.ts";
import {
  amortisedCost,
  dailyCarry,
  theta as mmTheta,
  unrealisedPnl as mmUnrealisedPnl,
} from "../performance/mm-methodology.ts";
import type { MoneyMarketDepositPosition } from "../shared/mm-positions.ts";

const NO_OBSERVABLES: readonly ObservableRef[] = [];

export function mmDepositValuable(pos: MoneyMarketDepositPosition): Valuable {
  const reporting = requireReporting(pos.reporting, "mmDepositValuable");
  return {
    valuationMethod: () => "amortised",
    requiredObservables(): readonly ObservableRef[] {
      return NO_OBSERVABLES;
    },
    value(_marks: MarketDataSlice, asOf: Instant): RevaluationRecord {
      const value = amortisedCost({
        principal: pos.principal,
        accrued: pos.accrued,
        direction: "liability",
        currency: reporting,
      });
      return { value, asOf, observablesUsed: NO_OBSERVABLES };
    },
  };
}

export function mmDepositPerformable(pos: MoneyMarketDepositPosition): Performable {
  const reporting = requireReporting(pos.reporting, "mmDepositPerformable");
  return {
    unrealisedPnl(_marks: MarketDataSlice, asOf: Instant, _bookedCost: Money): PerformanceRecord {
      return {
        unrealisedPnl: mmUnrealisedPnl(reporting),
        carry: dailyCarry({
          principal: pos.principal,
          rateDecimal: pos.rateDecimal,
          direction: "liability",
          currency: reporting,
        }),
        theta: mmTheta({
          principal: pos.principal,
          rateDecimal: pos.rateDecimal,
          direction: "liability",
          currency: reporting,
        }),
        asOf,
        observablesUsed: NO_OBSERVABLES,
      };
    },
    carry(_marks: MarketDataSlice, _asOf: Instant): Money {
      return dailyCarry({
        principal: pos.principal,
        rateDecimal: pos.rateDecimal,
        direction: "liability",
        currency: reporting,
      });
    },
    theta(_marks: MarketDataSlice, _asOf: Instant, _remainingDays: number): Money {
      return mmTheta({
        principal: pos.principal,
        rateDecimal: pos.rateDecimal,
        direction: "liability",
        currency: reporting,
      });
    },
  };
}

export const MM_DEPOSIT_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: "ir-money-market-deposit-fixed-term",
  implementsFacets: ["Valuable", "Performable", "Lifecycled"],
  scope: ["fil:type:ir:money-market.deposit:fixed-term@1.0"] as FilScopePattern[],
  version: { major: 1, minor: 0 },
  requires: {
    facets: ["Lifecycled"],
    referenceData: [],
    postureDimensions: ["reporting.currency"],
  },
  emits: ["FilPositionAmortised"] as FilEventRef[],
  cites: [
    "urn:reg:iasb:ifrs-9:§4.2.1",
    "urn:reg:iasb:ifrs-9:§5.4.1",
    "D-V1-REMOVAL-PHASE-3B",
  ] as CitationRef[],
  methodologyHash: "fil-ir-mm-deposit-fixed-term-v1.0" as MethodologyHash,
  validationStatus: "submitted",
};
