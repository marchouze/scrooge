// v2-core/fil-models/ir/money-market/repo/mm-repo-model.ts
//
// Classic repo: Valuable + Performable FIL-Model.
// Secured borrowing (classic repo, liability) or secured lending (reverse repo,
// asset); the position's `direction` selects the sign. Valuable = amortised cost
// (principal + accrued repo interest); Performable = daily repo carry. The repo
// is carried as a secured-financing balance, NOT marked to the collateral price
// (IAS 39 §27 — a repo is a secured borrowing, the collateral stays on the
// seller's balance sheet). No discount curve.
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
import type { MoneyMarketRepoPosition } from "../shared/mm-positions.ts";

const NO_OBSERVABLES: readonly ObservableRef[] = [];

export function mmRepoValuable(pos: MoneyMarketRepoPosition): Valuable {
  const reporting = requireReporting(pos.reporting, "mmRepoValuable");
  return {
    valuationMethod: () => "amortised",
    requiredObservables(): readonly ObservableRef[] {
      return NO_OBSERVABLES;
    },
    value(_marks: MarketDataSlice, asOf: Instant): RevaluationRecord {
      const value = amortisedCost({
        principal: pos.principal,
        accrued: pos.accrued,
        direction: pos.direction,
        currency: reporting,
      });
      return { value, asOf, observablesUsed: NO_OBSERVABLES };
    },
  };
}

export function mmRepoPerformable(pos: MoneyMarketRepoPosition): Performable {
  const reporting = requireReporting(pos.reporting, "mmRepoPerformable");
  return {
    unrealisedPnl(_marks: MarketDataSlice, asOf: Instant, _bookedCost: Money): PerformanceRecord {
      return {
        unrealisedPnl: mmUnrealisedPnl(reporting),
        carry: dailyCarry({
          principal: pos.principal,
          rateDecimal: pos.rateDecimal,
          direction: pos.direction,
          currency: reporting,
        }),
        theta: mmTheta({
          principal: pos.principal,
          rateDecimal: pos.rateDecimal,
          direction: pos.direction,
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
        direction: pos.direction,
        currency: reporting,
      });
    },
    theta(_marks: MarketDataSlice, _asOf: Instant, _remainingDays: number): Money {
      return mmTheta({
        principal: pos.principal,
        rateDecimal: pos.rateDecimal,
        direction: pos.direction,
        currency: reporting,
      });
    },
  };
}

export const MM_REPO_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: "ir-money-market-repo-classic",
  implementsFacets: ["Valuable", "Performable", "Lifecycled"],
  scope: ["fil:type:ir:money-market.repo:classic@1.0"] as FilScopePattern[],
  version: { major: 1, minor: 0 },
  requires: {
    facets: ["Lifecycled"],
    referenceData: [],
    postureDimensions: ["reporting.currency"],
  },
  emits: ["FilPositionAmortised"] as FilEventRef[],
  cites: [
    "urn:reg:iasb:ias-39:§27",
    "urn:reg:iasb:ifrs-9:§5.4.1",
    "D-V1-REMOVAL-PHASE-3B",
  ] as CitationRef[],
  methodologyHash: "fil-ir-mm-repo-classic-v1.0" as MethodologyHash,
  validationStatus: "submitted",
};
