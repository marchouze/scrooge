// v2-core/fil-models/market-risk-var/model.ts
//
// MARKET-RISK VaR as a `RiskMeasurable`-consuming model declaration (V2 A3).
//
// The VaR `AttributionMetric` (var-metric.ts) is the load-bearing artefact; this
// file is the FIL-Model DECLARATION that records the metric's facet dependencies,
// methodology hash, and validation status — the same declaration shape SA-CCR
// (S7-FIL) and FX (A2) carry, so the FIL-Models registry + recon:fil-conformance
// reason about it uniformly.
//
// The model CONSUMES `RiskMeasurable` (each member's risk factor) + `Valuable`
// (each member's signed ZAR exposure). It does NOT itself implement a facet — a
// portfolio VaR is an AGGREGATE over instances, not a per-instrument facet
// answer (the inter-instance axis the attribution layer owns; W9 §1 keeps the
// per-instrument facets and the cross-instance metric orthogonal). The
// declaration therefore lists VaR as a model that binds an `AttributionMetric`
// rather than an instrument facet — recorded via `implementsFacets: []`-style is
// not valid (min 1), so it declares the facets it READS as the binding surface
// is the metric, documented here.
//
// READ-ONLY / PARALLEL TO v1 (A3 binding constraint): asserted against the v1
// VaR engine by `recon:attribution-var-diversification` (group VaR ↔ v1
// standing-NOP VaR). No v1 import; the HS math is ported (methodology.ts).
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (A3 build slice);
//   D-VAR-EXPOSURE-INCLUDES-STANDING-NOP; D-FIL-FRAMEWORK-UNIFICATION;
//   BCBS d457 (FRTB) MAR33; Basel-2.5 MAR; Principle 1.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Rohan (Risk systems engineer, engineering) ·
//         Helena (Chief Risk Officer, governance — methodology accountability).

import type { CitationRef, MethodologyHash } from "../../fil-core/primitives";
import type { FilScopePattern } from "../../fil-core/urn";
import type { FilModelImplementationDeclared } from "../declaration";
import { computeVarMethodologyHash } from "./methodology";

export const VAR_MODEL_ID = "market-risk-var" as const;
export const VAR_MODEL_VERSION = { major: 1, minor: 0 } as const;

/** VaR consumes the FX taxonomy (spot, forward, cash) as its position set. */
export const VAR_MODEL_SCOPE = ["fil:type:fx:*"] as FilScopePattern[];

/** Provisions + decisions the VaR methodology implements (IMPLEMENTED_BY). */
export const VAR_MODEL_CITES = [
  "urn:reg:bcbs:d457:MAR33",
  "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
  "RISK-MRP-01:§1.1",
] as CitationRef[];

export const VAR_MODEL_METHODOLOGY_HASH = computeVarMethodologyHash(
  VAR_MODEL_ID,
  VAR_MODEL_VERSION,
) as MethodologyHash;

/**
 * The VaR model declaration. It CONSUMES `RiskMeasurable` + `Valuable` — the two
 * facets the metric reads off each member — and produces a cross-instance VaR
 * `AttributionMetric`. `implementsFacets` records `RiskMeasurable` as the facet
 * the model is anchored on (the risk-factor declaration is what a VaR engine
 * keys off); `requires` records `Valuable` (the exposure source) + the return-
 * window reference data.
 */
export const VAR_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: VAR_MODEL_ID,
  implementsFacets: ["RiskMeasurable"],
  scope: VAR_MODEL_SCOPE,
  version: VAR_MODEL_VERSION,
  requires: {
    facets: ["Valuable", "Lifecycled"],
    referenceData: ["fx-return-window"],
    postureDimensions: ["reporting.currency"],
  },
  // A3 is READ-ONLY: the VaR metric computes a figure asserted against v1 by
  // recon; it emits no new event-of-record (the metric is a query, not a
  // mutation). A later slice may add a `MarketRiskVarComputed` event-of-record.
  emits: [],
  cites: VAR_MODEL_CITES,
  methodologyHash: VAR_MODEL_METHODOLOGY_HASH,
  // A3 ships the metric SUBMITTED — independent validation (Nadia) is the gate
  // before any v1 retirement, mirroring the SA-CCR + FX cutover sequence.
  validationStatus: "submitted",
};
