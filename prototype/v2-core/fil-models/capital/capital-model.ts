// v2-core/fil-models/capital/capital-model.ts
//
// CAPITAL as an `Accountable` FIL instrument — the bank's OWN qualifying
// regulatory capital (D-CAPITAL-ASSET-CLASS-V1).
//
// A capital instrument is the bank's own-funds instrument-of-record: a paid-up
// ordinary-share subscription (CET1), a perpetual non-cumulative AT1 instrument,
// or a subordinated-debt / qualifying-general-provision Tier 2 instrument. It is
// the SOURCE of the BA-700 / BA-100 capital numerator (own funds), the complement
// of the RWA denominator.
//
// ACCOUNTING CLASSIFICATION (the load-bearing point):
//   - CET1 paid-up ordinary shares / share premium → IAS 32 §22 EQUITY. An entity's
//     own equity instrument is NOT a financial liability and is NOT remeasured —
//     it sits at its issue proceeds. There is no IFRS 9 measurement category for
//     own equity; the `ifrs9Category` facet method returns the nearest enum member
//     (`amortised-cost` = held at historical proceeds, not fair-valued) and the
//     posting rules route the credit to an EQUITY account (ACC-5000-*).
//   - Retained earnings / OCI reserve → CET1 equity components (IAS 1 presentation).
//   - AT1 perpetual non-cumulative → classified per IAS 32 §16 / §AG25–26: if the
//     bank has an UNCONDITIONAL right to avoid coupons + redemption, it is EQUITY;
//     otherwise a financial LIABILITY at amortised cost (IFRS 9 §4.2.1). The build-
//     phase model treats AT1 as a liability-classified instrument at amortised cost
//     (the conservative + common Basel-compliant going-concern AT1 structure);
//     the per-instance election can override to equity when the terms support it.
//   - Tier 2 subordinated debt → financial LIABILITY at amortised cost (IFRS 9
//     §4.2.1); qualifying general provisions → an IFRS 9 impairment allowance
//     (not an issued instrument — recognised by the ECL fold; carried here as a
//     Tier 2 capital component for COMPOSITION only).
//
// Capital is NOT a market exposure: it implements NO Valuable / RiskMeasurable.
// It is the capital-adequacy numerator, not a mark-to-market trading position —
// the deliberate difference from the `cash` model.
//
// NO v1 imports (recon:v2-no-v1-import — ENFORCING).
//
// Authority: D-CAPITAL-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-MODEL-BINDING-CONTRACT-V1;
//   IAS-32-§22 (own equity not a liability); IAS-32-§16 (liability/equity split);
//   IFRS-9-§4.2.1 (financial liabilities at amortised cost);
//   urn:reg:za:regs-relating-to-banks:reg38; Banks Act 94 of 1990 §70;
//   urn:reg:bcbs:rbc:20.2; D5/2025 §2.1.3 (form BA 100); Principle 1; Principle 5.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { FilEventRef } from "../../fil-core/lifecycle";
import type { CitationRef, MethodologyHash } from "../../fil-core/primitives";
import type { FilScopePattern } from "../../fil-core/urn";
import type { Accountable, BookDesignation } from "../../fil-facets/facets";
import type { FilModelImplementationDeclared } from "../declaration";
import { fnv1a } from "../fx-valuation/methodology";

// ---------------------------------------------------------------------------
// Model identity + version + scope.
// ---------------------------------------------------------------------------

export const CAPITAL_MODEL_ID = "capital" as const;
export const CAPITAL_MODEL_VERSION = { major: 1, minor: 0 } as const;

/** The capital taxonomy scope — the first-class `capital` asset class. */
export const CAPITAL_MODEL_SCOPE = ["fil:type:capital:instrument"] as FilScopePattern[];

/**
 * Capital is a pure-fold asset class: the BA-700 / BA-100 composition is derived
 * from the generic FIL lifecycle events (FilInstrumentCreated / Amended /
 * Terminated) via the capital posting rules — there is NO stored per-instrument
 * "CapitalRevalued" event (capital own funds are not revalued; equity is held at
 * proceeds, liability-classified capital is amortised cost). The model therefore
 * emits no events of record (Principle 1: the lifecycle events are canonical;
 * composition is a query).
 */
export const CAPITAL_MODEL_EMITS = [] as FilEventRef[];

/** Reg 38 / Banks Act §70 / BCBS CAP+RBC / IAS 32 / IFRS 9 provisions implemented. */
export const CAPITAL_MODEL_CITES = [
  "urn:reg:za:regs-relating-to-banks:reg38",
  "urn:reg:za:banks-act-94-1990:s70",
  "urn:reg:bcbs:rbc:20.2",
  "urn:reg:bcbs:rbc:30.2",
  "urn:reg:iasb:ias-32:§22",
  "urn:reg:iasb:ifrs-9:§4.2.1",
  "D5/2025 §2.1.3",
  "ORG-PR-01",
  "ORG-PR-RETURNS-002",
] as CitationRef[];

/**
 * Methodology hash — FNV-1a digest over the model id + version + the capital
 * composition methodology pin (the same construction the FX/SA-CCR models use, no
 * crypto dep, stable across replays). The pin DESCRIBES how capital is classified
 * + composed, so a change to that methodology re-anchors the hash and re-opens
 * model validation (D-MODEL-BINDING-CONTRACT-V1).
 */
export function computeCapitalMethodologyHash(
  modelId: string,
  version: { major: number; minor: number },
): MethodologyHash {
  const pin = [
    `model=${modelId}`,
    `version=${version.major}.${version.minor}`,
    "tiers=cet1|at1|t2",
    "cet1=ias32-equity-at-proceeds",
    "at1=ifrs9-amortised-cost-or-ias32-equity",
    "t2=ifrs9-amortised-cost",
    "composition=tier1=cet1+at1;total=tier1+t2",
    "remeasured=false",
  ].join("|");
  return `capital:v${version.major}.${version.minor}:${fnv1a(pin)}` as MethodologyHash;
}

export const CAPITAL_MODEL_METHODOLOGY_HASH = computeCapitalMethodologyHash(
  CAPITAL_MODEL_ID,
  CAPITAL_MODEL_VERSION,
);

// ---------------------------------------------------------------------------
// The model declaration.
// ---------------------------------------------------------------------------

export const CAPITAL_MODEL_DECLARATION: FilModelImplementationDeclared = {
  kind: "FilModelImplementationDeclared",
  modelId: CAPITAL_MODEL_ID,
  implementsFacets: ["Accountable", "Reportable"],
  scope: CAPITAL_MODEL_SCOPE,
  version: CAPITAL_MODEL_VERSION,
  requires: {
    facets: ["Lifecycled"],
    referenceData: ["chart-of-accounts"],
    postureDimensions: ["reporting.currency"],
  },
  emits: CAPITAL_MODEL_EMITS,
  cites: CAPITAL_MODEL_CITES,
  methodologyHash: CAPITAL_MODEL_METHODOLOGY_HASH,
  validationStatus: "submitted",
};

// ---------------------------------------------------------------------------
// The Accountable facet IMPLEMENTATION.
//
// The posting keys map the generic FIL lifecycle events to the capital posting
// rules (`v2-core/posting-rules/capital.ts`). The fair-value hierarchy is N/A for
// own funds (own equity / amortised-cost liability are not fair-valued) — the
// nearest enum member, `level-1`, is returned (the issue proceeds are an observed
// cash amount), documented here as "not fair-valued".
// ---------------------------------------------------------------------------

export const CAPITAL_POSTING_KEYS: ReadonlyArray<{
  lifecycleEvent: FilEventRef;
  ruleKey: CitationRef;
}> = [
  {
    // Issuance / subscription / recognition — own funds recognised on the book.
    lifecycleEvent: "FilInstrumentCreated" as FilEventRef,
    ruleKey: "posting:capital:issuance:pr-cap-issue-001-v2" as CitationRef,
  },
  {
    // In-life change — partial redemption / Tier 2 amortisation step.
    lifecycleEvent: "FilInstrumentAmended" as FilEventRef,
    ruleKey: "posting:capital:adjustment:pr-cap-adjust-002-v2" as CitationRef,
  },
  {
    // Redemption / call / maturity / cancellation — own funds derecognised.
    lifecycleEvent: "FilInstrumentTerminated" as FilEventRef,
    ruleKey: "posting:capital:redemption:pr-cap-redeem-003-v2" as CitationRef,
  },
];

export function capitalAccountable(): Accountable {
  return {
    // Own equity (CET1) is IAS 32 equity held at proceeds — NOT an IFRS 9
    // financial instrument and NOT remeasured. Liability-classified AT1 / Tier 2
    // are IFRS 9 §4.2.1 amortised cost. Either way the measurement basis is
    // amortised-cost (no fair-value remeasurement of own funds).
    ifrs9Category(designation: BookDesignation): "amortised-cost" | "fvtpl" | "fvoci" {
      void designation;
      return "amortised-cost";
    },
    postingKeys() {
      return CAPITAL_POSTING_KEYS;
    },
    // Own funds are not fair-valued; the proceeds are an observed cash amount.
    fairValueHierarchy(): "level-1" | "level-2" | "level-3" {
      return "level-1";
    },
  };
}
