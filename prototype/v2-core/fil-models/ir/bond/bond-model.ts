// v2-core/fil-models/ir/bond/bond-model.ts
//
// Fixed-rate vanilla bond: Valuable (FVTPL — DISCOUNTS) + Performable +
// RiskMeasurable FIL-Model. The one instrument in the V1-removal batch that PVs
// future cash flows.
//
//   Valuable      — FVTPL fair value = Σ PV(remaining coupons) + PV(principal),
//                   discounted at the market yield resolved (fail-closed) from
//                   the ISIN observable, falling back to a credit-spread-adjusted
//                   curve key. Values in the bond's OWN currency; cross-currency
//                   reporting translation is a view-time concern (#1382 resolver).
//   Performable   — carry = accrued coupon for the period (ACT/365); unrealised
//                   P&L = fair value − booked cost; theta ≈ −daily coupon carry.
//   RiskMeasurable— modified duration (first-order rate sensitivity), plus the
//                   typed risk-factor + position-selector facet methods.
//
// FAIL-CLOSED REPORTING CURRENCY (WS-MULTI-BASE-CURRENCY, #1382): every facet
// resolves the reporting currency via `requireReporting` at construction — there
// is NO hardcoded `?? "ZAR"`. The model also fails closed when neither yield
// observable resolves (see bond-observables.resolveBondYield).
//
// Authority: D-V1-REMOVAL-PHASE-3C; D-ENGINEERING-INTEGRITY-CHARTER;
//   IFRS 9 §5.7.1 (FVTPL fair-value movement); IFRS 9 B5.4.1 (EIR coupon);
//   IAS 32 (initial recognition); BCBS d368 §21 (duration);
//   brief:atlas:v1-removal-phase-3c-bond-accounting-on-v2-fvtpl-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import type { FilEventRef } from "../../../fil-core/lifecycle.ts";
import type { CitationRef, Instant, MethodologyHash, Money } from "../../../fil-core/primitives.ts";
import type { FilScopePattern } from "../../../fil-core/urn.ts";
import type {
  EngineId,
  MarketDataSlice,
  ObservableRef,
  Performable,
  PerformanceRecord,
  PositionSelector,
  RevaluationRecord,
  RiskFactorRef,
  RiskMeasurable,
  Valuable,
} from "../../../fil-facets/facets.ts";
import type { FilModelImplementationDeclared } from "../../declaration.ts";
import { requireReporting } from "../../fx-valuation/reporting-currency-resolver.ts";
import {
  accruedCouponCarry,
  theta as bondTheta,
  unrealisedPnl as bondUnrealisedPnl,
  modifiedDuration as computeModifiedDuration,
  presentValue,
} from "./performance/bond-methodology.ts";
import {
  bondFallbackYieldObsRef,
  bondYieldObsRef,
  resolveBondYield,
} from "./shared/bond-observables.ts";
import type { BondPosition } from "./shared/bond-positions.ts";

// ---------------------------------------------------------------------------
// Valuable — FVTPL, DISCOUNTS the remaining cash-flow schedule.
// ---------------------------------------------------------------------------

export function bondValuable(pos: BondPosition): Valuable {
  const reporting = requireReporting(pos.reporting, "bondValuable");
  return {
    valuationMethod: () => "mark-to-model",
    requiredObservables(): readonly ObservableRef[] {
      // Both candidate marks are declared; the resolver uses whichever resolves.
      return [bondYieldObsRef(pos.isin), bondFallbackYieldObsRef(pos.fallbackYieldKey)];
    },
    value(marks: MarketDataSlice, asOf: Instant): RevaluationRecord {
      const { yieldDecimal, observablesUsed } = resolveBondYield({
        isin: pos.isin,
        fallbackYieldKey: pos.fallbackYieldKey,
        marks,
        asOf,
      });
      const value = presentValue({
        faceValue: pos.faceValue,
        remainingCoupons: pos.remainingCoupons,
        maturityYears: pos.maturityYears,
        yieldDecimal,
        direction: pos.direction,
        currency: reporting,
      });
      return { value, asOf, observablesUsed };
    },
  };
}

// ---------------------------------------------------------------------------
// Performable — accrued-coupon carry; FVTPL unrealised P&L.
// ---------------------------------------------------------------------------

export function bondPerformable(pos: BondPosition): Performable {
  const reporting = requireReporting(pos.reporting, "bondPerformable");

  const carryFor = (): Money =>
    accruedCouponCarry({
      faceValue: pos.faceValue,
      couponRate: pos.couponRate,
      accruedDays: pos.accruedDays,
      direction: pos.direction,
      currency: reporting,
    });

  const thetaFor = (): Money =>
    bondTheta({
      faceValue: pos.faceValue,
      couponRate: pos.couponRate,
      direction: pos.direction,
      currency: reporting,
    });

  return {
    unrealisedPnl(marks: MarketDataSlice, asOf: Instant, bookedCost: Money): PerformanceRecord {
      const { yieldDecimal, observablesUsed } = resolveBondYield({
        isin: pos.isin,
        fallbackYieldKey: pos.fallbackYieldKey,
        marks,
        asOf,
      });
      const fairValue = presentValue({
        faceValue: pos.faceValue,
        remainingCoupons: pos.remainingCoupons,
        maturityYears: pos.maturityYears,
        yieldDecimal,
        direction: pos.direction,
        currency: reporting,
      });
      return {
        unrealisedPnl: bondUnrealisedPnl(fairValue, bookedCost),
        carry: carryFor(),
        theta: thetaFor(),
        asOf,
        observablesUsed,
      };
    },
    carry(_marks: MarketDataSlice, _asOf: Instant): Money {
      return carryFor();
    },
    theta(_marks: MarketDataSlice, _asOf: Instant, _remainingDays: number): Money {
      return thetaFor();
    },
  };
}

// ---------------------------------------------------------------------------
// RiskMeasurable — modified duration is the first-order rate sensitivity.
// ---------------------------------------------------------------------------

const BOND_RISK_FACTORS: readonly RiskFactorRef[] = [
  { factorId: "ir:curve", kind: "curve" },
  { factorId: "ir:delta", kind: "delta" },
];

export function bondRiskMeasurable(_pos: BondPosition): RiskMeasurable {
  return {
    riskFactors(): readonly RiskFactorRef[] {
      return BOND_RISK_FACTORS;
    },
    positionContribution(engine: EngineId): PositionSelector {
      return {
        engine,
        // IRRBB / VaR select the bond from its full lifecycle (the V2 events).
        lifecycleEvents: [
          "BondTradeExecutedV2",
          "BondInterestAccruedV2",
          "BondPositionRevaluedV2",
          "BondMaturedV2",
          "BondSoldV2",
        ] as FilEventRef[],
      };
    },
  };
}

/**
 * Modified duration (years) for a bond at a resolved market yield — the explicit
 * risk-metric read the BA-320 / IRRBB duration-bucket grid consumes. Fail-closed
 * on the yield resolution (mirrors `value`). Separate from the facet methods
 * because it needs the market slice to resolve the yield.
 */
export function bondModifiedDuration(
  pos: BondPosition,
  marks: MarketDataSlice,
  asOf: Instant,
): number {
  const { yieldDecimal } = resolveBondYield({
    isin: pos.isin,
    fallbackYieldKey: pos.fallbackYieldKey,
    marks,
    asOf,
  });
  return computeModifiedDuration({
    faceValue: pos.faceValue,
    remainingCoupons: pos.remainingCoupons,
    maturityYears: pos.maturityYears,
    yieldDecimal,
    couponsPerYear: pos.couponsPerYear,
  });
}

// ---------------------------------------------------------------------------
// Model declaration (the FIL-Models registry manifest row).
// ---------------------------------------------------------------------------

export const BOND_FIXED_RATE_VANILLA_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: "ir-bond-fixed-rate-vanilla",
  implementsFacets: ["Valuable", "Performable", "RiskMeasurable", "Lifecycled"],
  scope: ["fil:type:ir:bond:fixed-rate-vanilla@1.0"] as FilScopePattern[],
  version: { major: 1, minor: 0 },
  requires: {
    facets: ["Lifecycled"],
    referenceData: ["bond-yield-curve-table", "bond-credit-spread-table"],
    postureDimensions: ["reporting.currency"],
  },
  emits: ["BondPositionRevaluedV2"] as FilEventRef[],
  cites: [
    "urn:reg:iasb:ifrs-9:§5.7.1",
    "urn:reg:iasb:ifrs-9:B5.4.1",
    "urn:reg:iasb:ias-32",
    "D-V1-REMOVAL-PHASE-3C",
  ] as CitationRef[],
  methodologyHash: "fil-ir-bond-fixed-rate-vanilla-v1.0" as MethodologyHash,
  validationStatus: "submitted",
};
