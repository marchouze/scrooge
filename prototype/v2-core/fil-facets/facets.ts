// v2-core/fil-facets/facets.ts
//
// FIL-Facets — the seven kernel interfaces (W9 §3.4, verbatim design).
//
// These are INTERFACES ONLY (brief §3): the contract every v2 consumer layer
// binds to. NO implementations — implementations are FIL-Models registered in
// the FIL-Models registry (later slices: S7-FIL onward). A layer never reaches
// into ad-hoc instrument fields; it programs against the facet it needs
// (W9 §1: encapsulation is the audit property — exactly one answer in the
// system, carrying its citation).
//
// Two design invariants from W9 §3.4 are preserved precisely:
//   1. Regulatory facets take a `PostureSnapshot` — classification is
//      approach-conditioned (a bond's risk-weight basis differs under SA vs
//      IRB), the W8 connection CDM does not model.
//   2. Facets EMIT events-of-record rather than returning bare values where the
//      answer is load-bearing (`value()` → `*Revalued`). At the interface level
//      this is expressed as a method that returns the event-of-record payload
//      shape an implementation must emit; the actual bus emission is an
//      implementation concern (out of scope for S0).
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (FIL-Facets, W9 §3.4);
// D-MODEL-BINDING-CONTRACT-V1 (absorbed) — facets are the sole data-access path.
// Author: Atlas (Core banking platform architect, engineering).

import type {
  FilEventRef,
  FilLifecycleDeclaration,
  FilLifecycleStage,
} from "../fil-core/lifecycle";
import type { CitationRef, Instant, Money } from "../fil-core/primitives";
import type { FilFacetName } from "../fil-core/type-definition";

// ---------------------------------------------------------------------------
// Supporting v2-native types (no v1 imports)
// ---------------------------------------------------------------------------

/**
 * A posture snapshot — the W8 "products held + approach elections" the
 * regulatory facets are conditioned on (W9 §3.4). Opaque at the kernel level;
 * its concrete shape lands with the W8 posture register (S1/S2, separate
 * dispatch). Facets quantify over named dimensions, never the raw structure.
 */
export interface PostureSnapshot {
  readonly asOf: Instant;
  /** dimensionKey → value (e.g. `approach.counterparty-credit` → `SA-CCR`). */
  readonly dimensions: Readonly<Record<string, string>>;
}

export type PostureDimensionKey = string & { readonly __brand: "fil.PostureDimensionKey" };

/** A FIL-native asset-class discriminator for regulatory classification (W9 §3.4). */
export type SaCcrAssetClass = "ir" | "fx" | "credit" | "equity" | "commodity";

export type BaFormId = string & { readonly __brand: "fil.BaFormId" };

/** A provenance-typed reference to a market observable (curve, fixing, price). */
export interface ObservableRef {
  readonly observableId: string;
  readonly kind: "curve" | "fixing" | "price" | "surface";
}

/** A typed risk-factor reference (delta/vega/curve …) — typed, not enum-listed (W9 §3.4). */
export interface RiskFactorRef {
  readonly factorId: string;
  readonly kind: "delta" | "vega" | "curve" | "basis" | "correlation";
}

export type EngineId = string & { readonly __brand: "fil.EngineId" };

/** How an engine selects this instrument's positions (W9 §3.4). */
export interface PositionSelector {
  readonly engine: EngineId;
  readonly lifecycleEvents: readonly FilEventRef[];
}

/** A typed, resolvable return-cell binding (W9 §3.4, §2.8 lesson). */
export interface CellBinding {
  readonly form: BaFormId;
  /** Resolvable cell ref against the canonical BA-form schema — never a free string. */
  readonly cell: string;
}

/** A slice of market data threaded into a valuation (provenance-typed). */
export interface MarketDataSlice {
  readonly asOf: Instant;
  readonly observables: Readonly<Record<string, number>>;
}

export type BookDesignation = string & { readonly __brand: "fil.BookDesignation" };

/** The event-of-record payload a `Valuable` implementation must emit (W9 §3.4). */
export interface RevaluationRecord {
  readonly value: Money;
  readonly asOf: Instant;
  /** The observables consumed — lineage for the emitted `*Revalued` event. */
  readonly observablesUsed: readonly ObservableRef[];
}

// ---------------------------------------------------------------------------
// The seven facet interfaces (W9 §3.4)
// ---------------------------------------------------------------------------

export interface Lifecycled {
  /** The typed state machine of §3.3. */
  lifecycle(): FilLifecycleDeclaration;
  /** The stage of an instance as a projection over its events (Principle 1). */
  stage(asOf: Instant): FilLifecycleStage;
}

export interface Valuable {
  valuationMethod(): "mark-to-market" | "mark-to-model" | "amortised";
  /** Curves, fixings, prices — provenance-typed (W9 §3.4). */
  requiredObservables(): readonly ObservableRef[];
  /** Emits the `*Revalued` event-of-record payload (W9 §3.4 — load-bearing answer ⇒ event). */
  value(marks: MarketDataSlice, asOf: Instant): RevaluationRecord;
}

export interface Accountable {
  ifrs9Category(designation: BookDesignation): "amortised-cost" | "fvtpl" | "fvoci";
  /** GL binding (W9 §5): the (lifecycle event → posting rule key) pairs. */
  postingKeys(): ReadonlyArray<{ lifecycleEvent: FilEventRef; ruleKey: CitationRef }>;
  fairValueHierarchy(): "level-1" | "level-2" | "level-3";
}

export interface RegulatoryClassifiable {
  /** Posture-conditioned (W9 §3.4) — approach changes the answer. */
  baselAssetClass(posture: PostureSnapshot): SaCcrAssetClass;
  hqlaTier(posture: PostureSnapshot): "L1" | "L2A" | "L2B" | "non-hqla";
  /** CRE20 bucket inputs — posture-conditioned. */
  riskWeightBasis(posture: PostureSnapshot): "standardised" | "irb-foundation" | "irb-advanced";
}

export interface RiskMeasurable {
  /** Typed, not enum-listed (W9 §3.4). */
  riskFactors(): readonly RiskFactorRef[];
  /** How SA-CCR / IRRBB / VaR select this instrument's positions. */
  positionContribution(engine: EngineId): PositionSelector;
}

export interface Reportable {
  /** Typed, resolvable cell bindings (W9 §3.4) — posture-conditioned. */
  returnsCells(form: BaFormId, posture: PostureSnapshot): readonly CellBinding[];
}

export interface PostureRelevant {
  /** Which W8 products-held dimensions this type feeds (W9 §3.4, §5). */
  postureDimensions(): readonly PostureDimensionKey[];
}


// ---------------------------------------------------------------------------
// 8th kernel facet: Performable (FIL FX Language Phase 1)
//
// A generic performance-attribution contract applicable to any asset class:
//   - unrealisedPnl: MTM value − book cost
//   - carry: daily accrual (forward premium for FX, coupon for IRD, dividend for equity)
//   - theta: ∂V/∂t per day (linear approx for forwards; exact GK for options in Phase 2)
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// ---------------------------------------------------------------------------

export interface PerformanceRecord {
  readonly unrealisedPnl: Money;
  readonly carry: Money;
  readonly theta: Money;
  readonly asOf: Instant;
  readonly observablesUsed: readonly ObservableRef[];
}

export interface Performable {
  unrealisedPnl(marks: MarketDataSlice, asOf: Instant, bookedCostMinor: bigint): PerformanceRecord;
  carry(marks: MarketDataSlice, asOf: Instant): Money;
  theta(marks: MarketDataSlice, asOf: Instant, remainingDays: number): Money;
}

/**
 * The mapping from facet NAME (the kernel vocabulary) to its interface. Used by
 * the FIL-Models registry and `recon:fil-conformance` to reason about which
 * interface a model claims to implement, purely at the type level.
 */
export interface FilFacetInterfaces {
  Lifecycled: Lifecycled;
  Valuable: Valuable;
  Accountable: Accountable;
  RegulatoryClassifiable: RegulatoryClassifiable;
  RiskMeasurable: RiskMeasurable;
  Reportable: Reportable;
  PostureRelevant: PostureRelevant;
  Performable: Performable;
}

/** Compile-time guarantee that every facet name has an interface and vice-versa. */
export type FilFacetInterfaceName = keyof FilFacetInterfaces;
const _facetNameExhaustive: Record<FilFacetName, FilFacetInterfaceName> = {
  Lifecycled: "Lifecycled",
  Valuable: "Valuable",
  Accountable: "Accountable",
  RegulatoryClassifiable: "RegulatoryClassifiable",
  RiskMeasurable: "RiskMeasurable",
  Reportable: "Reportable",
  PostureRelevant: "PostureRelevant",
  Performable: "Performable",
};
void _facetNameExhaustive;
