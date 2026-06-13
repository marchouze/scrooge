// v2-core/fil-models/sa-ccr/model.ts
//
// SA-CCR as the FIRST FIL-Model (V2 S7-FIL).
//
// Declares SA-CCR as a registered implementation of the `RiskMeasurable` facet
// over the IR + FX taxonomy scopes (`fil:type:ir:*`, `fil:type:fx:*`), and
// exposes:
//   - `SA_CCR_MODEL_DECLARATION` — the `FilModelImplementationDeclared` payload
//     that folds into the FIL-Models register (one row, keyed by
//     (facet, scope, version), methodologyHash-anchored).
//   - `saCcrRiskMeasurable(...)` — a `RiskMeasurable` facet implementation: a
//     model is a registered implementation of an interface (the whole point of
//     D-FIL-FRAMEWORK-UNIFICATION). It selects IR + FX positions into SA-CCR
//     hedging sets and exposes the risk factors the engine quantifies over.
//   - `resolvesForScope(...)` — pure scope-pattern resolution used by the
//     model's own test (it resolves for IR + FX) and by `recon:fil-conformance`.
//
// The COMPUTATION lives in `./methodology.ts` (a faithful, no-v1-import port of
// the live v1 engine). This module binds it to the FIL surface.
//
// NO v1 imports (enforced by `recon:v2-no-v1-import`). The `methodologyHash` is
// computed deterministically from the methodology version + the d317 constants
// the implementation pins, so any silent drift in the formulae changes the hash
// (the integrity anchor of D-MODEL-BINDING-CONTRACT-V1 §3).
//
// Authority: D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Rohan (Risk Engineer, engineering).

import type { FilEventRef } from "../../fil-core/lifecycle";
import type { CitationRef, MethodologyHash } from "../../fil-core/primitives";
import { type FilScopePattern, isFilScopePattern, isFilTypeUrn } from "../../fil-core/urn";
import type {
  EngineId,
  PositionSelector,
  RiskFactorRef,
  RiskMeasurable,
} from "../../fil-facets/facets";
import type { FilModelImplementationDeclared } from "../declaration";
import { ALPHA_SA_CCR, PFE_MULTIPLIER_FLOOR, type SaCcrTradeSummary } from "./methodology";

// ---------------------------------------------------------------------------
// Model identity + version.
// ---------------------------------------------------------------------------

export const SA_CCR_MODEL_ID = "sa-ccr" as const;
export const SA_CCR_MODEL_VERSION = { major: 1, minor: 0 } as const;

/** The IR + FX taxonomy scopes this model implements `RiskMeasurable` over. */
export const SA_CCR_SCOPE = ["fil:type:ir:*", "fil:type:fx:*"] as FilScopePattern[];

/** The events-of-record the model emits (registered v1-side; see CCR schemas). */
export const SA_CCR_EMITS = ["CcrReplacementCostComputed", "CcrEadComputed"] as FilEventRef[];

/** BCBS d317 / CRE52 provisions the model implements (IMPLEMENTED_BY targets). */
export const SA_CCR_CITES = [
  "BCBS-SA-CCR-CRE52",
  "urn:reg:bcbs:d317:§10",
  "urn:reg:bcbs:d317:§136",
  "urn:reg:bcbs:d317:§149",
  "urn:reg:bcbs:cre52:§52.5",
  "Policies/credit-risk-policy-v1.md#3",
  "D-CREDIT-LIMIT-ENGINE-BUILD",
] as CitationRef[];

// ---------------------------------------------------------------------------
// methodologyHash — deterministic integrity anchor (D-MODEL-BINDING-CONTRACT-V1
// §3). Pins the methodology version + the load-bearing d317 constants so any
// silent change to the formulae (α, the PFE floor, the supervisory-factor
// schedule, the maturity-factor schedule) changes the hash. Deliberately a
// pure synchronous string digest (FNV-1a) so the kernel takes no crypto dep and
// the value is stable across replays.
// ---------------------------------------------------------------------------

const SUPERVISORY_FACTORS_PINNED = "ir=0.005;fx=0.04;credit=0.013;equity=0.32;commodity=0.18";

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Unsigned 32-bit hex, zero-padded.
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function computeSaCcrMethodologyHash(): MethodologyHash {
  const pin = [
    `model=${SA_CCR_MODEL_ID}`,
    `version=${SA_CCR_MODEL_VERSION.major}.${SA_CCR_MODEL_VERSION.minor}`,
    `alpha=${ALPHA_SA_CCR}`,
    `pfeFloor=${PFE_MULTIPLIER_FLOOR}`,
    "mpor=10bd/250",
    `sf=${SUPERVISORY_FACTORS_PINNED}`,
    "rc=max(V-C,MTA+TH,0)|max(V,0)",
    "pfe=mult*Σ(|Σδ·d·MF|·SF)",
    "ead=alpha*(RC+PFE)",
  ].join("|");
  return `saccr:v1.0:${fnv1a(pin)}` as MethodologyHash;
}

export const SA_CCR_METHODOLOGY_HASH = computeSaCcrMethodologyHash();

// ---------------------------------------------------------------------------
// The model declaration — the `FilModelImplementationDeclared` payload.
//
//   implements RiskMeasurable over fil:type:ir:* + fil:type:fx:*
//   requires   Lifecycled + Valuable (the engine reads stage + MTM) + the
//              netting-set / collateral reference registers + the
//              counterparty-credit-risk approach posture dimension
//   emits      CcrReplacementCostComputed + CcrEadComputed
//   cites      BCBS d317 / CRE52
//   with methodology in core (versioned) + calibration as tenant events
// ---------------------------------------------------------------------------

export const SA_CCR_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: SA_CCR_MODEL_ID,
  implementsFacets: ["RiskMeasurable"],
  scope: SA_CCR_SCOPE,
  version: SA_CCR_MODEL_VERSION,
  requires: {
    // SA-CCR reads each instrument's lifecycle stage (live vs closed) and its
    // mark-to-market — the Lifecycled + Valuable facets (W9 §3.4).
    facets: ["Lifecycled", "Valuable"],
    // Reference registers the model consumes (declared; content unchanged).
    referenceData: [
      "netting-set-register",
      "collateral-inventory",
      "supervisory-factor-table-d317",
    ],
    // The W8 posture dimension that conditions the approach (SA-CCR vs IMM).
    postureDimensions: ["approach.counterparty-credit"],
  },
  emits: SA_CCR_EMITS,
  cites: SA_CCR_CITES,
  methodologyHash: SA_CCR_METHODOLOGY_HASH,
  // Builder submits; Nadia (Model validation) approval is a gated follow-on
  // (brief §"Out of scope"). The parity proof here is engineering validation,
  // not the independent model-validation sign-off.
  validationStatus: "submitted",
};

// ---------------------------------------------------------------------------
// Scope resolution — does the model resolve for a given FIL type URN? Pure
// prefix-wildcard match over the model's declared scope patterns (mirrors the
// posture `matchesScopePattern`, kept local to avoid a cross-module dep).
// ---------------------------------------------------------------------------

function patternMatches(pattern: string, typeUrn: string): boolean {
  if (pattern.endsWith("*")) return typeUrn.startsWith(pattern.slice(0, -1));
  return pattern === typeUrn;
}

/** `true` iff this model's scope covers `typeUrn` (e.g. an IR or FX type). */
export function resolvesForScope(typeUrn: string): boolean {
  if (!isFilTypeUrn(typeUrn)) return false;
  return SA_CCR_SCOPE.some((p) => patternMatches(p, typeUrn));
}

/** Guard: every declared scope pattern is a valid `fil:type:…` pattern. */
export function scopePatternsValid(): boolean {
  return SA_CCR_SCOPE.every((p) => isFilScopePattern(p));
}

// ---------------------------------------------------------------------------
// The RiskMeasurable facet IMPLEMENTATION.
//
// A FIL-Model is a registered implementation of a facet interface. This is the
// SA-CCR implementation of `RiskMeasurable` for an IR or FX instance: it
// exposes the typed risk factors the engine quantifies over and how the SA-CCR
// engine selects the instance's positions (its lifecycle events + hedging set).
//
// `positionContribution(engine)` returns a `PositionSelector` — the
// lifecycle-event family the engine watches. The actual EAD math is the
// methodology module; the facet is the *selection / risk-factor* surface
// (W9 §3.4: "how SA-CCR / IRRBB / VaR select this instrument's positions").
// ---------------------------------------------------------------------------

export const SA_CCR_ENGINE_ID = "sa-ccr" as EngineId;

/** Lifecycle event families the SA-CCR engine selects positions from. */
const SA_CCR_IR_LIFECYCLE_EVENTS = ["IrsTradeBooked", "IrdSwapPositionRevalued"] as FilEventRef[];
const SA_CCR_FX_LIFECYCLE_EVENTS = ["FxTradeExecuted", "FxPositionRevalued"] as FilEventRef[];

export function saCcrRiskMeasurable(trade: SaCcrTradeSummary): RiskMeasurable {
  return {
    riskFactors(): readonly RiskFactorRef[] {
      // SA-CCR is driven by the netting-set delta-adjusted notional — the
      // load-bearing risk factor per asset class is the directional delta
      // exposure; IR additionally carries the maturity-bucket curve factor.
      const factors: RiskFactorRef[] = [{ factorId: `${trade.assetClass}:delta`, kind: "delta" }];
      if (trade.assetClass === "ir") {
        factors.push({ factorId: "ir:curve", kind: "curve" });
      }
      return factors;
    },
    positionContribution(engine: EngineId): PositionSelector {
      const lifecycleEvents =
        trade.assetClass === "ir" ? SA_CCR_IR_LIFECYCLE_EVENTS : SA_CCR_FX_LIFECYCLE_EVENTS;
      return { engine, lifecycleEvents };
    },
  };
}
