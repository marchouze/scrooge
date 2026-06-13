// v2-core/fil-models/fx-valuation/fx-model.ts
//
// FX as a `Valuable` (+ `Accountable`) FIL-Model — V2 A2.
//
// The SECOND cross-package FIL-Model (SA-CCR was the first, S7-FIL). Declares FX
// spot + forward as a registered implementation of the `Valuable` facet over the
// FX taxonomy scope (`fil:type:fx:*`), and co-declares the `Accountable` facet
// (IFRS-9 category + posting keys + fair-value hierarchy) authored with Bea
// (Accounting & financial reporting engineer, engineering).
//
//   implements Valuable + Accountable over fil:type:fx:*
//   requires   Lifecycled (stage gates which instances feed a book P&L slice) +
//              the FX rate reference data + the booking-currency posture dim
//   emits      FxPositionRevalued (the v1 event-of-record the Valuable mirrors)
//   cites      IAS-21 / IFRS-9 + the FX policy provisions
//   with methodology in core (versioned) + calibration as tenant events
//
// THE SETTLEMENT-CONTINUITY INVARIANT (A2 "Prove" §1): `value(marks, asOf)` has
// NO lifecycle argument. The same mark-to-market arithmetic runs whether the
// instance is `active` (pre-settlement) or `settled` (post-settlement). On the
// settlement date, at the settlement-date closing rate, value_pre == value_post
// — structurally, not by a reconciliation. The FCY-cash model
// (`fcy-cash-model.ts`) is the post-settlement member that recognises the
// derecognised receivable at its settlement-date carrying amount, so book P&L is
// continuous across the boundary.
//
// READ-ONLY / PARALLEL TO v1 (A2 binding constraint): this model does NOT touch
// `runEodFxRevaluation`, the v1 GL/posting path, or any production number. It is
// asserted against v1 by recon (settlement-continuity + GL⟷NOP parity). The v1
// retirement is A4.
//
// NO v1 imports (recon:v2-no-v1-import — ENFORCING). The Accountable facet only
// DECLARES the IFRS-9 category + posting-rule KEYS; it does NOT wire the GL
// cutover (A4).
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (A2 build slice);
//   D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   IAS-21-§23/§28; IFRS-9-§5.7.1; Principle 1; Principle 5.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Bea (Accounting & financial reporting engineer, engineering).

import type { FilEventRef } from "../../fil-core/lifecycle";
import type { CitationRef, Instant, MethodologyHash } from "../../fil-core/primitives";
import { type FilScopePattern, isFilScopePattern, isFilTypeUrn } from "../../fil-core/urn";
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
  forwardPointsObservableRef,
  resolveAllInRate,
  spotObservableRef,
  valueFxPosition,
} from "./methodology";

// ---------------------------------------------------------------------------
// Model identity + version + scope.
// ---------------------------------------------------------------------------

export const FX_MODEL_ID = "fx-valuation" as const;
export const FX_MODEL_VERSION = { major: 1, minor: 0 } as const;

/** The FX taxonomy scope this model implements `Valuable` + `Accountable` over. */
export const FX_MODEL_SCOPE = ["fil:type:fx:*"] as FilScopePattern[];

/** The event-of-record the Valuable mirrors (the v1 FxPositionRevalued). */
export const FX_MODEL_EMITS = ["FxPositionRevalued"] as FilEventRef[];

/** IAS-21 / IFRS-9 provisions + FX policy the model implements (IMPLEMENTED_BY). */
export const FX_MODEL_CITES = [
  "urn:reg:iasb:ias-21:§23",
  "urn:reg:iasb:ias-21:§28",
  "urn:reg:iasb:ifrs-9:§5.7.1",
  "urn:reg:iasb:ifrs-9:§4.1.4",
  "Policies/fx-trading-policy-v1.md#valuation",
  "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
] as CitationRef[];

export const FX_MODEL_METHODOLOGY_HASH = computeFxMethodologyHash(
  FX_MODEL_ID,
  FX_MODEL_VERSION,
) as MethodologyHash;

// ---------------------------------------------------------------------------
// The model declaration — the `FilModelImplementationDeclared` payload.
// ---------------------------------------------------------------------------

export const FX_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: FX_MODEL_ID,
  implementsFacets: ["Valuable", "Accountable", "RiskMeasurable"],
  scope: FX_MODEL_SCOPE,
  version: FX_MODEL_VERSION,
  requires: {
    // The book-P&L slice gates members on lifecycle stage (active vs settled);
    // the value itself is lifecycle-free, but membership reads the stage.
    facets: ["Lifecycled"],
    referenceData: ["fx-rate-table", "fx-forward-points-table"],
    // The booking-currency / reporting-currency posture dimension.
    postureDimensions: ["reporting.currency"],
  },
  emits: FX_MODEL_EMITS,
  cites: FX_MODEL_CITES,
  methodologyHash: FX_MODEL_METHODOLOGY_HASH,
  // A2 ships the model SUBMITTED — independent validation (Nadia, Model
  // validation, risk) is the A2→A4 gate, mirroring the SA-CCR cutover sequence.
  // The settlement-continuity + GL⟷NOP parity recon gates are the build-time
  // evidence the validator consumes.
  validationStatus: "submitted",
};

// ---------------------------------------------------------------------------
// Scope resolution.
// ---------------------------------------------------------------------------

function patternMatches(pattern: string, typeUrn: string): boolean {
  if (pattern.endsWith("*")) return typeUrn.startsWith(pattern.slice(0, -1));
  return pattern === typeUrn;
}

/** `true` iff this model's scope covers `typeUrn` (an FX type). */
export function fxResolvesForScope(typeUrn: string): boolean {
  if (!isFilTypeUrn(typeUrn)) return false;
  return FX_MODEL_SCOPE.some((p) => patternMatches(p, typeUrn));
}

/** Guard: every declared scope pattern is a valid `fil:type:…` pattern. */
export function fxScopePatternsValid(): boolean {
  return FX_MODEL_SCOPE.every((p) => isFilScopePattern(p));
}

// ---------------------------------------------------------------------------
// The FX position the Valuable values — the minimal economic terms a mark-to-
// market needs (a v2-native projection of the FIL instance's economic terms).
// ---------------------------------------------------------------------------

export interface FxValuablePosition {
  /** Position currency (the foreign leg), ISO-4217 alpha-3. */
  readonly currency: string;
  /** Notional in the position currency's minor units, SIGNED (long +, short −). */
  readonly signedNotionalMinor: bigint;
  /** Spot vs forward — a forward additionally consumes the forward-points mark. */
  readonly isForward: boolean;
  /** Reporting currency the value is expressed in (default ZAR). */
  readonly reporting?: string;
}

// ---------------------------------------------------------------------------
// The Valuable facet IMPLEMENTATION.
//
// `value(marks, asOf)` returns the `RevaluationRecord` event-of-record payload
// shape — the mark-to-market value + the observables consumed (lineage for the
// emitted `FxPositionRevalued`). NO lifecycle input: this is the structural
// settlement-continuity guarantee.
// ---------------------------------------------------------------------------

export function fxValuable(position: FxValuablePosition): Valuable {
  return {
    valuationMethod(): "mark-to-market" {
      return "mark-to-market";
    },
    requiredObservables(): readonly ObservableRef[] {
      const reporting = position.reporting;
      const obs: ObservableRef[] = [spotObservableRef(position.currency, reporting)];
      if (position.isForward) obs.push(forwardPointsObservableRef(position.currency, reporting));
      return obs;
    },
    value(marks, asOf: Instant): RevaluationRecord {
      const { allInRate, observablesUsed } = resolveAllInRate({
        currency: position.currency,
        isForward: position.isForward,
        marks,
        ...(position.reporting !== undefined ? { reporting: position.reporting } : {}),
      });
      const { value } = valueFxPosition({
        currency: position.currency,
        signedNotionalMinor: position.signedNotionalMinor,
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
// DECLARES the IFRS-9 category, posting-rule KEYS (lifecycle event → rule key),
// and the fair-value hierarchy for FX. A2 establishes the facet + keys ONLY; the
// GL cutover (wiring these keys into the live posting engine, retiring the v1
// path) is A4.
//
// IFRS-9: FX trading positions held for trading are FVTPL (IFRS-9 §4.1.4 —
// trading book). The trading-book designation drives FVTPL; a hedge-designated
// or held-to-collect designation would change the category, hence the parameter.
//
// Fair-value hierarchy: FX spot/forward on quoted, liquid major pairs is
// LEVEL-2 (observable inputs — quoted rates + forward points — but not a quoted
// price for the instrument itself).
// ---------------------------------------------------------------------------

/** Posting-rule key for each FX lifecycle event (the (event → rule key) map). */
export const FX_POSTING_KEYS: ReadonlyArray<{ lifecycleEvent: FilEventRef; ruleKey: CitationRef }> =
  [
    {
      lifecycleEvent: "FxTradeExecuted" as FilEventRef,
      ruleKey: "posting:fx:trade-execution:pr-fx-001" as CitationRef,
    },
    {
      lifecycleEvent: "FxPositionRevalued" as FilEventRef,
      ruleKey: "posting:fx:revaluation:pr-fx-002" as CitationRef,
    },
    {
      lifecycleEvent: "TradeMatured" as FilEventRef,
      ruleKey: "posting:fx:settlement:pr-fx-ba-lifecycle" as CitationRef,
    },
  ];

export function fxAccountable(): Accountable {
  return {
    ifrs9Category(designation: BookDesignation): "amortised-cost" | "fvtpl" | "fvoci" {
      // Trading-book FX is FVTPL (IFRS-9 §4.1.4); any non-trading designation is
      // out of A2 scope and conservatively also FVTPL here (FX positions are
      // monetary items retranslated through P&L unless hedge-designated — hedge
      // accounting is a named A2 substrate gap).
      void designation;
      return "fvtpl";
    },
    postingKeys() {
      return FX_POSTING_KEYS;
    },
    fairValueHierarchy(): "level-1" | "level-2" | "level-3" {
      return "level-2";
    },
  };
}

// ---------------------------------------------------------------------------
// The RiskMeasurable facet IMPLEMENTATION (A3).
//
// An FX position's risk factor is the FX spot pair `<CCY>/ZAR` — a `delta`
// factor (a spot-rate move). The VaR `AttributionMetric` (A3) reads this to know
// which currency's return window the member's exposure maps to. The factor id is
// the canonical pair string, identical to the v1 VaR engine's factor key
// (`${ccy}/ZAR`) — so the v2 attribution VaR and the v1 engine speak the same
// factor vocabulary (the A3 parity proof).
//
// `positionContribution(engine)` declares HOW a risk engine selects this
// instrument's positions: the FX lifecycle events that move the position
// (execution / settlement). The selector is the encapsulated answer to "which
// of my events does the VaR / SA-CCR engine consume?" (W9 §3.4).
// ---------------------------------------------------------------------------

/** The FX spot risk-factor pair for a position currency (`<CCY>/ZAR`). */
export function fxRiskFactorId(currency: string, reporting = "ZAR"): string {
  return `${currency}/${reporting}`;
}

export function fxRiskMeasurable(position: FxValuablePosition): RiskMeasurable {
  const reporting = position.reporting ?? "ZAR";
  return {
    riskFactors(): readonly RiskFactorRef[] {
      // A reporting-currency leg carries no FX risk factor (rate is 1, no
      // translation risk); a foreign leg loads its spot pair as a delta factor.
      if (position.currency === reporting) return [];
      return [{ factorId: fxRiskFactorId(position.currency, reporting), kind: "delta" }];
    },
    positionContribution(engine: EngineId): PositionSelector {
      return {
        engine,
        lifecycleEvents: ["FxTradeExecuted", "TradeMatured"] as FilEventRef[],
      };
    },
  };
}
