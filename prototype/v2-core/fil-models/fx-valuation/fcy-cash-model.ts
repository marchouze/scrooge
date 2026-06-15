// v2-core/fil-models/fx-valuation/fcy-cash-model.ts
//
// FCY CASH as a monetary `Valuable` FIL instrument — V2 A2.
//
// When an FX trade settles, the receivable (an FX position) is DERECOGNISED and
// a foreign-currency CASH balance is RECOGNISED in its place. That FCY cash is
// itself a FIL instrument carrying its own `Valuable`: value = notional ×
// closing rate (IAS-21 §23 — a monetary item retranslated at the closing rate
// at each reporting date). It is the POST-SETTLEMENT member of the fx-trading
// book slice.
//
// RECOGNITION BASIS (A2 "Build" §2, the load-bearing accounting point): the FCY
// cash is recognised at the DERECOGNISED RECEIVABLE'S SETTLEMENT-DATE CARRYING
// AMOUNT — i.e. the notional carried into the cash balance is the position's
// own notional, valued at the SETTLEMENT-DATE closing rate, NOT the original
// contracted (trade-date) cost. This is exactly what makes settlement
// continuous: the receivable's pre-settlement value at the settlement-date rate
// and the FCY cash's post-settlement value at the SAME rate are identical,
// because both are `notional × settlement-date-rate`. The cash carries the
// settlement-date carrying amount forward; subsequent reporting dates retranslate
// it at the then-current closing rate (the normal monetary-item treatment).
//
// `value(marks, asOf)` is the SAME lifecycle-free arithmetic as the FX position
// Valuable — that shared arithmetic is the structural settlement-continuity
// guarantee.
//
// NO v1 imports (recon:v2-no-v1-import — ENFORCING).
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (A2 build slice);
//   D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   IAS-21-§23 (monetary item retranslated at closing rate); IFRS-9-§3.2
//   (derecognition); Principle 1; Principle 5.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Bea (Accounting & financial reporting engineer, engineering).

import type { FilEventRef } from "../../fil-core/lifecycle";
import type { CitationRef, Instant, MethodologyHash } from "../../fil-core/primitives";
import type { FilScopePattern } from "../../fil-core/urn";
import type {
  Accountable,
  BookDesignation,
  EngineId,
  ObservableRef,
  PositionSelector,
  RevaluationRecord,
  RiskFactorRef,
  RiskMeasurable,
  Valuable,
} from "../../fil-facets/facets";
import type { FilModelImplementationDeclared } from "../declaration";
import {
  computeFxMethodologyHash,
  resolveAllInRate,
  spotObservableRef,
  valueFxPosition,
} from "./methodology";

// ---------------------------------------------------------------------------
// Model identity + version + scope.
// ---------------------------------------------------------------------------

export const FCY_CASH_MODEL_ID = "fcy-cash" as const;
export const FCY_CASH_MODEL_VERSION = { major: 1, minor: 0 } as const;

/** The FCY-cash taxonomy scope (`fil:type:fx:cash:*` — the monetary cash family). */
export const FCY_CASH_MODEL_SCOPE = ["fil:type:fx:cash"] as FilScopePattern[];

/** The event-of-record the FCY-cash Valuable mirrors (the FCY balance reval). */
export const FCY_CASH_MODEL_EMITS = ["FcyCashBalanceRevalued"] as FilEventRef[];

/** IAS-21 / IFRS-9 provisions the FCY-cash model implements (IMPLEMENTED_BY). */
export const FCY_CASH_MODEL_CITES = [
  "urn:reg:iasb:ias-21:§23",
  "urn:reg:iasb:ifrs-9:§3.2.3",
  "Policies/fx-trading-policy-v1.md#fcy-cash",
] as CitationRef[];

export const FCY_CASH_MODEL_METHODOLOGY_HASH = computeFxMethodologyHash(
  FCY_CASH_MODEL_ID,
  FCY_CASH_MODEL_VERSION,
) as MethodologyHash;

// ---------------------------------------------------------------------------
// The model declaration.
// ---------------------------------------------------------------------------

export const FCY_CASH_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: FCY_CASH_MODEL_ID,
  implementsFacets: ["Valuable", "Accountable", "RiskMeasurable"],
  scope: FCY_CASH_MODEL_SCOPE,
  version: FCY_CASH_MODEL_VERSION,
  requires: {
    facets: ["Lifecycled"],
    referenceData: ["fx-rate-table"],
    postureDimensions: ["reporting.currency"],
  },
  emits: FCY_CASH_MODEL_EMITS,
  cites: FCY_CASH_MODEL_CITES,
  methodologyHash: FCY_CASH_MODEL_METHODOLOGY_HASH,
  validationStatus: "submitted",
};

// ---------------------------------------------------------------------------
// The FCY-cash position — recognised at the SETTLEMENT-DATE carrying amount.
// ---------------------------------------------------------------------------

export interface FcyCashPosition {
  /** FCY balance currency, ISO-4217 alpha-3. */
  readonly currency: string;
  /**
   * Balance in the FCY's MAJOR units, SIGNED decimal string. This is the notional
   * carried from the derecognised receivable — NOT a contracted/trade-date cost.
   * The reporting-currency carrying amount is `balance × settlement-date rate` at
   * recognition; subsequent reporting dates retranslate at the then-current rate.
   */
  readonly balance: string;
  /** Reporting currency (default ZAR). */
  readonly reporting?: string;
}

/**
 * Build an FCY-cash position from a derecognised FX receivable AT SETTLEMENT.
 *
 * The FCY balance carried into the cash instrument is the receivable's own
 * (signed) notional — the SETTLEMENT-DATE carrying amount when valued at the
 * settlement-date rate. We deliberately carry the FCY NOTIONAL (not a pre-
 * converted reporting amount), so the FCY cash retranslates correctly at every
 * future reporting date (IAS-21 §23). The settlement-date rate is therefore NOT
 * stored on the instrument — it is the closing rate observed at settlement, and
 * the value at settlement is `notional × that rate`, identical to the
 * receivable's pre-settlement value.
 */
export function fcyCashFromSettledReceivable(args: {
  currency: string;
  signedNotional: string;
  reporting?: string;
}): FcyCashPosition {
  return {
    currency: args.currency,
    balance: args.signedNotional,
    ...(args.reporting !== undefined ? { reporting: args.reporting } : {}),
  };
}

// ---------------------------------------------------------------------------
// The Valuable facet IMPLEMENTATION — same lifecycle-free arithmetic.
// ---------------------------------------------------------------------------

export function fcyCashValuable(position: FcyCashPosition): Valuable {
  return {
    valuationMethod(): "mark-to-market" {
      return "mark-to-market";
    },
    requiredObservables(): readonly ObservableRef[] {
      return [spotObservableRef(position.currency, position.reporting)];
    },
    value(marks, asOf: Instant): RevaluationRecord {
      const { allInRate, observablesUsed } = resolveAllInRate({
        currency: position.currency,
        isForward: false,
        marks,
        ...(position.reporting !== undefined ? { reporting: position.reporting } : {}),
      });
      const { value } = valueFxPosition({
        currency: position.currency,
        signedNotional: position.balance,
        allInRate,
        ...(position.reporting !== undefined ? { reporting: position.reporting } : {}),
      });
      return { value, asOf, observablesUsed };
    },
  };
}

// ---------------------------------------------------------------------------
// The Accountable facet IMPLEMENTATION (co-authored as Bea).
//
// FCY cash is a monetary item: AMORTISED-COST under IFRS-9 (a cash/loan-and-
// receivable held to collect), retranslated through P&L per IAS-21 §23 (the FX
// retranslation gain/loss hits P&L even though the instrument is amortised-cost —
// the category and the FX retranslation are orthogonal). Fair-value hierarchy is
// LEVEL-1 for the cash balance itself (the FCY amount is a quoted/observed cash
// balance; its reporting-currency translation uses a level-2 rate, but the cash
// instrument is level-1).
// ---------------------------------------------------------------------------

export const FCY_CASH_POSTING_KEYS: ReadonlyArray<{
  lifecycleEvent: FilEventRef;
  ruleKey: CitationRef;
}> = [
  {
    // Recognition at settlement — the derecognised receivable becomes FCY cash.
    lifecycleEvent: "TradeMatured" as FilEventRef,
    ruleKey: "posting:fx:fcy-cash-recognition:pr-fx-fcy-001" as CitationRef,
  },
  {
    // Period-end retranslation of the FCY cash balance.
    lifecycleEvent: "FcyCashBalanceRevalued" as FilEventRef,
    ruleKey: "posting:fx:fcy-cash-retranslation:pr-fx-fcy-002" as CitationRef,
  },
];

export function fcyCashAccountable(): Accountable {
  return {
    ifrs9Category(designation: BookDesignation): "amortised-cost" | "fvtpl" | "fvoci" {
      void designation;
      return "amortised-cost";
    },
    postingKeys() {
      return FCY_CASH_POSTING_KEYS;
    },
    fairValueHierarchy(): "level-1" | "level-2" | "level-3" {
      return "level-1";
    },
  };
}

// ---------------------------------------------------------------------------
// The RiskMeasurable facet IMPLEMENTATION (A3).
//
// Standing FCY cash is a STANDING-NOP risk factor — the bank still holds the
// foreign currency after settlement and bears FX risk on it (D-VAR-EXPOSURE-
// INCLUDES-STANDING-NOP). Its risk factor is the same `<CCY>/ZAR` spot pair as
// the pre-settlement FX position, so the VaR `AttributionMetric` nets the
// settled cash and the live position into ONE per-currency exposure (the
// settlement-continuity invariant carried into the risk factor).
// ---------------------------------------------------------------------------

export function fcyCashRiskMeasurable(position: FcyCashPosition): RiskMeasurable {
  const reporting = position.reporting ?? "ZAR";
  return {
    riskFactors(): readonly RiskFactorRef[] {
      if (position.currency === reporting) return [];
      return [{ factorId: `${position.currency}/${reporting}`, kind: "delta" }];
    },
    positionContribution(engine: EngineId): PositionSelector {
      return {
        engine,
        lifecycleEvents: ["TradeMatured", "FcyCashBalanceRevalued"] as FilEventRef[],
      };
    },
  };
}
