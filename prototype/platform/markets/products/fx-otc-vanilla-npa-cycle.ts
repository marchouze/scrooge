// platform/markets/products/fx-otc-vanilla-npa-cycle.ts
//
// THE single, clean, coherent New Product Approval cycle for the umbrella FX
// product `prd:bank:fx:otc-vanilla` (Spot / Forward / Swap; Option at M5,
// out of scope at v1.0). This module is the SOLE canonical authoring of the FX
// OTC NPA cycle — it supersedes the prior accreted layers (the old umbrella
// driver that emitted design-attested-no-gaps, the verification-pass-2
// promotion set, the treatment-module-enrichment re-emit, the contradictory
// legal implementation-attested ↔ design-attested pair, and the
// approve→withhold→re-gate tangle). It is wired into `ci:migrate` so the cycle
// reproduces deterministically on CI's clean store.
//
// "From scratch" under Principle 1 (append-only): we do NOT delete historical
// events. We author ONE fresh, internally-consistent cycle (same productId,
// later as_of) that wins latest-wins per (productId, dimension). Re-runs are
// idempotent on `ProductApproved` already present for the product.
//
// HONEST ATTESTATION (the "flag gaps for build" rule, NPA Policy v2 §3a;
// Amendment A §3a.1 — liveness EVIDENCE, not assertion):
//   - A dimension is `implementation-attested` ONLY where its citationChain cites
//     a GREEN completeness recon proving the capability is wired, exercised, and
//     complete across the declared (internal-test) scope — NOT a bare narrative
//     or code-file citation. Each also carries its Principle-2 citationChain and,
//     where a sub-item is genuinely deferred, a well-formed `ProductDeferredGap`
//     (gapId + title + owner[name+position] + targetTrigger + citations — all
//     mandatory, enforced by the Zod schema and inventoried by
//     `recon:npa-deferred-gap-tracking`).
//   - A dimension is `design-attested` (with a well-formed gap) where the
//     capability is narrative/structural-only in the build phase: either no green
//     completeness recon exists, the only available recon is VACUOUS on the clean
//     store (engine not run / flat book / no instances), or the capability
//     genuinely depends on real counterparties / external counsel that cannot
//     exist in the build phase (`legal`).
//   - The accounting / capital(prudential) / tax dimensions SOURCE from the
//     versioned reporting-treatment modules (`v2-core/reporting-treatments/
//     fx-modules.ts`) — the `treatment-module:<id>@<version>` head is resolved
//     from the declarations via `formatVersion` (never hardcoded), so the cited
//     version always resolves in the registry.
//
// GATE OUTCOME (build phase): the gate RULE (`validateNpaGate`) is RUN over the
// honest attestations and its result is taken — it is NOT pre-decided. Under
// D-NPA-GATE-POLICY-REDESIGN, implementation-attested passes unconditionally and
// design-attested-WITH-a-tracked-gap passes with a recorded open condition; a
// design-attested-NO-gap or a `failed` dimension blocks. With the honest set
// here under the Amendment A re-check — 4 implementation-attested (market-risk,
// liquidity-risk, operational-readiness, accounting — each citing a green,
// non-vacuous completeness recon) + 11 design-attested-with-gaps (credit-risk,
// operational-risk, capital, conduct, aml, model-risk, legal, infosec, privacy,
// tax, data-quality) — the gate is `ready` with open conditions → an
// **INTERNAL-TEST-scope** `ProductApproved` is the honest result. We do NOT emit
// a production-scope approval: production is gated on closing every tracked gap
// and on the real-counterparty / external-counsel triggers. The `approvedBy`
// tag and the `conditions[]` carry that boundary explicitly.
//
// Authority:
//   - D-FX-NPA-RESTART (CEO-approved 2026-06-17) — restart the FX NPA from
//     scratch; flag every build shortfall as a tracked gap; comply with all
//     policies and procedures.
//   - D-NEW-PRODUCT-APPROVAL-POLICY-V2 (CEO session-delegation 2026-06-08) §3a.
//   - D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15).
//   - D-FX-OTC-NPA-SCOPE-EXPANSION (CEO session-delegation 2026-06-10) — typed scope.
//   - D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17) — treatment modules.
//   - PROC-MK-NPA-DD-01 (14-dimension due-diligence) + PROC-NPA-GATE-01 (gate).
//
// Author: Saskia (Head of Global Markets, governance) — NPA cycle owner,
//   coordinating the 15 dimension owners (named per dimension below; identity
//   discipline — name + position on first mention).

import { formatVersion } from "../../../v2-core/fil-core/urn";
import { FX_TREATMENT_MODULES } from "../../../v2-core/reporting-treatments/fx-modules";
import {
  type ProductDeferredGap,
  type ProductDimensionAttestedResult,
  type ProductScopeForEvent,
  makeProductApproved,
  makeProductConceptualised,
  makeProductDimensionAttested,
  makeProductDueDiligenceCompleted,
  makeProductProposalRegistered,
  makeProductWithheld,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import { buildProductRegisterView } from "../../projections/products/product-register";
import type { DimensionKey } from "./npa-attestation-runner";
import { validateNpaGate } from "./npa-gate";

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const FX_NPA_PRODUCT_ID = "prd:bank:fx:otc-vanilla";
export const FX_NPA_VERSION = "1.0.0";
const ENTITY = "LE-ZA-HOZ-BANK";

/**
 * The clean cycle's logical instant. Later than every prior FX-NPA attestation
 * (the latest prior was the 2026-06-17T10:00 enrichment), so this cycle's
 * attestations win latest-wins per (productId, dimension) and supersede the
 * cruft without deleting any historical event (Principle 1).
 */
export const FX_NPA_CYCLE_AS_OF = "2026-06-17T18:00:00.000Z";

/** Typed declared scope (Amendment D — exact scope, no silent absorption). */
export const FX_NPA_SCOPE: ProductScopeForEvent = {
  executionVenue: "otc",
  // v1.0 approved instrument set; Option joins at v1.1 (M5 pricing substrate).
  fxInstrumentVariants: ["spot", "forward", "swap"],
  currencyPairs: "any",
  // Institutional/professional only (D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL /
  // D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY). Retail is OUT of scope.
  counterpartyEligibility: "institutional",
};

const PROPOSED_BY = "agent:saskia:head-global-markets";

/** Base authority chain on every event in this cycle (Principle 2). */
const BASE_CHAIN = [
  "D-FX-NPA-RESTART",
  "D-NEW-PRODUCT-APPROVAL-POLICY-V2",
  "D-NPA-GATE-POLICY-REDESIGN",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
] as const;

const CYCLE_ACTOR = {
  type: "service" as const,
  id: "agent:saskia:fx-otc-vanilla-npa-cycle",
};

// ---------------------------------------------------------------------------
// Treatment-module citation resolution (accounting / capital / tax)
// ---------------------------------------------------------------------------

/**
 * Resolve `treatment-module:<id>@<version>` from the canonical FX module
 * declarations. Fail-closed: a missing module id is a programming error (the
 * four ids are fixed) — throw rather than cite a non-resolving module.
 */
function moduleCitation(treatmentId: string): string {
  const decl = FX_TREATMENT_MODULES.find((m) => m.treatmentId === treatmentId);
  if (!decl) {
    throw new Error(
      `FX treatment module "${treatmentId}" not found in FX_TREATMENT_MODULES — cannot author an NPA attestation citing a non-resolving treatment module.`,
    );
  }
  return `treatment-module:${decl.treatmentId}@${formatVersion(decl.version)}`;
}

// ---------------------------------------------------------------------------
// The canonical 15-dimension attestation set (the honest end-state)
// ---------------------------------------------------------------------------

export interface CleanDimensionAttestation {
  readonly dimension: DimensionKey;
  /** Governance owner — name + position on first mention (identity discipline). */
  readonly owner: string;
  readonly result: ProductDimensionAttestedResult;
  readonly citationChain: readonly string[];
  readonly deferredGaps: readonly ProductDeferredGap[];
}

/**
 * The 15 dimensions, in PROC-MK-NPA-DD-01 / npa-attestation-runner order. Each
 * result + citationChain + deferredGaps is the honest current state, consolidated
 * from the per-dimension owner reviews (build-3 close, the per-dimension
 * verification pass, the held-dims seat sweep, the gateway gate closures, and
 * the post-withdrawal legal re-attestation). The accounting / capital / tax
 * heads cite the versioned treatment modules.
 */
export const FX_NPA_DIMENSIONS: readonly CleanDimensionAttestation[] = [
  // -- Dimension 1: market-risk (Rohan / Helena) — implementation-attested. ---
  {
    dimension: "market-risk",
    owner:
      "Rohan (Market risk quantitative engineer, engineering) / Helena (Chief Risk Officer, governance)",
    result: "implementation-attested",
    citationChain: [
      ...BASE_CHAIN,
      "D-FX-FORWARDS-TRADING-FVTPL",
      "D-B3-5",
      "ORG-PR-19",
      "Policies/market-risk-policy-v1.md",
      // Amendment A (§3a.1): GREEN completeness recon — VaR-freshness manifest
      // parity (the Amendment A Item-8 valuation-cadence evidence).
      "recon:expected-event-watchdog",
      "platform/market-risk/var-engine.ts",
      "platform/markets/eod/fx-forward-revaluation.ts",
      "runtime/agents/rohan-market-risk-measure.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-forward-curve-live-feed",
        title:
          "Forward-rate curve is a static build-phase seed (forward-rate-seed.ts); production replaces ForwardRateSource with a live curve feed from the ALM / yield-curve substrate.",
        owner: "Ravi (Treasury / ALM engineer, engineering)",
        targetTrigger: "ALM yield-curve substrate delivers a live forward-curve feed",
        citations: ["D-FX-FORWARDS-TRADING-FVTPL", "platform/markets/eod/forward-rate-seed.ts"],
      },
      {
        gapId: "fx-ois-discounting",
        title:
          "Forward/swap MtM uses the flat-discount approximation; production valuation discounts with currency-specific OIS factors from the ALM substrate.",
        owner: "Ravi (Treasury / ALM engineer, engineering)",
        targetTrigger: "ALM substrate delivers currency-specific OIS discount factors",
        citations: [
          "D-FX-FORWARDS-TRADING-FVTPL",
          "platform/markets/eod/fx-forward-revaluation.ts",
        ],
      },
    ],
  },
  // -- Dimension 2: credit-risk (Helena / Rohan) — DESIGN-ATTESTED (honest). ---
  // Amendment A (§3a.1) re-check: the SA-CCR completeness recon
  // (recon:v2-saccr-parity) is VACUOUS on the clean store ("0 recorded SA-CCR
  // netting sets — engine has not run"); it does not prove the EAD/RWA capability
  // is exercised and complete across the FX book. With no green completeness
  // recon evidencing liveness, the honest result is design-attested + tracked
  // gaps (the authoritative Basel-class run + the daily SA-CCR cadence both
  // pending). The interim conservative 100% RWA stands.
  {
    dimension: "credit-risk",
    owner:
      "Helena (Chief Risk Officer, governance) / Rohan (Market risk quantitative engineer, engineering)",
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED",
      "D-FX-SA-CCR-BUILD-PHASE-ACTIVATION",
      "D-FX-EAD-FX-CONVERSION",
      "D-FX-CCR-INTERIM-CONSERVATIVE-RWA",
      "D-FX-COUNTERPARTY-BASEL-CLASSIFICATION",
      "ORG-PR-09",
      "platform/risk/sa-ccr/compute-and-emit.ts",
      "platform/projections/rwa-from-positions.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-counterparty-basel-class-values",
        title:
          "Authoritative counterparty Basel-class value-assignment (CounterpartyBaselClassAssigned events) pending the CRO classification run; until it lands the prudent corporate-non-ig 100% interim RWA stands.",
        owner: "Helena (Chief Risk Officer, governance)",
        targetTrigger:
          "CRO counterparty Basel-classification run lands CounterpartyBaselClassAssigned events",
        citations: ["D-FX-CCR-INTERIM-CONSERVATIVE-RWA", "D-FX-COUNTERPARTY-BASEL-CLASSIFICATION"],
      },
      {
        gapId: "fx-sa-ccr-daily-cadence",
        title:
          "SA-CCR over the FX book runs via the on-demand production driver; register it as a scheduled EOD handler so CcrEadComputed refreshes daily without operator action.",
        owner: "Rohan (Market risk quantitative engineer, engineering)",
        targetTrigger:
          "SA-CCR EOD run registered in runtime/handlers-metadata.ts on the daily scheduled cadence",
        citations: ["D-FX-SA-CCR-BUILD-PHASE-ACTIVATION", "scripts/run-sa-ccr-fx-eod.ts"],
      },
    ],
  },
  // -- Dimension 3: liquidity-risk (Eitan / Ravi) — implementation-attested. --
  {
    dimension: "liquidity-risk",
    owner: "Eitan (Treasurer, governance) / Ravi (Treasury / ALM engineer, engineering)",
    result: "implementation-attested",
    citationChain: [
      ...BASE_CHAIN,
      "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS",
      "D-BA300-LCR-FX-ENRICHMENT",
      "ORG-PR-01",
      "Policies/liquidity-risk-policy-v1.md",
      // Amendment A (§3a.1): GREEN completeness recon — both gateway paths enforce
      // the CRO-ratified capital-impact + funding thresholds (15 assertions).
      "recon:fx-gateway-threshold-enforcement",
      "platform/risk/fx-gateway-thresholds.ts",
      "runtime/agents/bea-ba300-lcr-period-close.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-gateway-live-lcr-observation",
        title:
          "The gateway funding check evaluates against the build-phase baseline LCR constant; wire the live LCR observation chain into the gateway so post-trade LCR is estimated off the latest computed ratio.",
        owner: "Ravi (Treasury / ALM engineer, engineering) → Eitan (Treasurer, governance)",
        targetTrigger:
          "WS-RETURNS-SUBMISSION-WIRING live LCR observation chain feeds the gateway funding evaluator",
        citations: ["D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS", "D-BA300-LCR-FX-ENRICHMENT"],
      },
    ],
  },
  // -- Dimension 4: operational-risk (Tomas / Devon) — DESIGN-ATTESTED (honest).
  // Amendment A (§3a.1) re-check: there is NO green completeness recon proving the
  // op-risk capital capability is wired+exercised+complete. op-RWA is gross-income-
  // blocked (no audited history exists in the build phase), no LDA/SMA model
  // exists (OperationalLossEvent is capture-only), and the identity-gate's
  // counterparty CDD records are SIMULATED fixtures. The capture substrate is
  // genuinely built, but the dimension as a whole is design-attested honestly,
  // with each shortfall a tracked forward gap.
  {
    dimension: "operational-risk",
    owner:
      "Tomas (Operations & payments engineer, engineering) / Devon (Chief Operating Officer, governance)",
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "BCBS-D196-§644",
      "REG-33",
      "FIC-ACT-38-2001",
      "platform/event-store/event-types/operational-risk.ts",
      "platform/reporting/operational-loss-projection.ts",
      "platform/markets/identity/counterparty-identity-gate.ts",
      "platform/reporting/ba-400-op-risk.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-op-rwa-gross-income",
        title:
          "op-RWA capital (BIA/TSA per BCBS D196 §645–654 / Reg 33) is gross-income-blocked: it requires three fiscal years of audited gross income, which do not exist in the build phase. No hollow gross-income figure is fabricated.",
        owner:
          "Camille (Chief Financial Officer, governance) + Bea (Financial Accountant, finance)",
        targetTrigger:
          "revenue-start + three fiscal years of audited gross income (post-licence-day) feed the BA 400 op-RWA computation",
        citations: ["BCBS-D196-§644", "REG-33", "platform/reporting/ba-400-op-risk.ts"],
      },
      {
        gapId: "fx-op-risk-loss-distribution",
        title:
          "No loss-distribution / LDA capital model exists; OperationalLossEvent is the CAPTURE substrate only. An LDA needs a multi-year loss-data history and is a licence-day model build.",
        owner: "Tomas (Operations & payments engineer, engineering)",
        targetTrigger:
          "licence-day op-risk model build — multi-year internal-loss data accumulates, then the LDA/SMA model is calibrated and validated",
        citations: ["BCBS-D196-§644", "platform/event-store/event-types/operational-risk.ts"],
      },
      {
        gapId: "fx-op-risk-real-counterparty-onboarding",
        title:
          "The identity gate's party-of-record + KYC-acceptance records for the authorised FX counterparties are SIMULATED build-phase fixtures (no hashed CDD evidence). Real institutional onboarding (full Niko 21-phase lifecycle) replaces them at licence-day.",
        owner: "Niko (Client lifecycle, sales)",
        targetTrigger:
          "licence-day counterparty onboarding (real KYC/CDD with hashed evidence; Niko lifecycle activates at licence-day)",
        citations: ["FIC-ACT-38-2001", "scripts/register-sim-fx-counterparty-identity.ts"],
      },
    ],
  },
  // -- Dimension 5: operational-readiness (Tomas / Devon) — impl-attested. -----
  {
    dimension: "operational-readiness",
    owner:
      "Tomas (Operations & payments engineer, engineering) / Devon (Chief Operating Officer, governance)",
    result: "implementation-attested",
    citationChain: [
      ...BASE_CHAIN,
      "PROC-OPS-SFBCP-01-V0.2",
      "ISDA-2002-§6",
      "ISDA-2002-§2(c)",
      "BCBS-D226-§4",
      "Banks-Act-94-Reg-39",
      // Amendment A (§3a.1): GREEN completeness recon — settlement value() is
      // lifecycle-free (structural invariant proven across 5 structural cases).
      "recon:fx-settlement-continuity",
      "platform/markets/fx/nostro-routing-registry.ts",
      "platform/markets/fx/otc-failure-handlers.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-ndf-runbooks",
        title:
          "NDF (non-deliverable forward) settlement on a fixing-date net basis is out of scope at v1.0. The fixing-date event, central-bank fixing-rate feed, and net-payment settlement pathway require a separate build at v1.1.",
        owner: "Tomas (Operations & payments engineer, engineering)",
        targetTrigger:
          "v1.1 when NDF is added to product scope (fixing-rate feed + NDF settlement event type + net-payment handler)",
        citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION"],
      },
    ],
  },
  // -- Dimension 6: accounting (Bea / Camille) — impl-attested, treatment-module.
  {
    dimension: "accounting",
    owner: "Bea (Financial Accountant, finance) / Camille (Chief Financial Officer, governance)",
    result: "implementation-attested",
    citationChain: [
      moduleCitation("ifrs-classification:fx-fvtpl"),
      ...BASE_CHAIN,
      "D-FX-FORWARDS-TRADING-FVTPL",
      "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
      "Policies/accounting-policy-v1.md",
      "IAS-21",
      "IFRS-9",
      // Amendment A (§3a.1): GREEN completeness recon — GL Chart-of-Accounts
      // full-scope, no suspense (28 resolutions, 0 suspense balances). This is
      // the Amendment A Item-3 evidence; the capability is genuinely exercised
      // and complete across the supported-currency scope.
      "recon:fx-supported-currency-no-suspense",
    ],
    deferredGaps: [],
  },
  // -- Dimension 7: capital / prudential (Camille / Helena) — DESIGN-ATTESTED (honest).
  // Amendment A (§3a.1) re-check: the BA 320 capital-charge completeness recon
  // (recon:ba320-fx-v2-parity) is ADVISORY with warn violations and a null V1
  // charge (no live charge recorded); it does not green-evidence a wired+
  // exercised+complete capital stack across the product scope. The market-risk
  // FX-NOP charge leg computes, but op-RWA remains the bank-wide gross-income-
  // blocked placeholder, so the capital stack is not complete. Honest result:
  // design-attested + tracked gap. The treatment module is still the canonical
  // policy source (cited below).
  {
    dimension: "capital",
    owner:
      "Camille (Chief Financial Officer, governance) / Helena (Chief Risk Officer, governance)",
    result: "design-attested",
    citationChain: [
      moduleCitation("prudential-treatment:fx-trading-book"),
      ...BASE_CHAIN,
      "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS",
      "D-RWA-ENGINE-W2-SLICE-3",
      "D-FX-EAD-FX-CONVERSION",
      "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
      "Reg38-CRE20",
      "BA-320",
      "ORG-PR-19",
      "platform/risk/rwa-computed-engine.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-op-rwa-gross-income",
        title:
          "Operational-risk RWA remains the bank-wide placeholder pending gross-income data (D-RWA-ENGINE-W2-SLICE-3 op-RWA leg); the FX product's capital stack inherits it.",
        owner:
          "Camille (Chief Financial Officer, governance) with Bea (Financial Accountant, finance)",
        targetTrigger: "revenue-start gross-income data enables the BIA/SA op-RWA computation",
        citations: ["D-RWA-ENGINE-W2-SLICE-3"],
      },
    ],
  },
  // -- Dimension 8: conduct (Zara) — DESIGN-ATTESTED (honest). -----------------
  // Amendment A (§3a.1) re-check: no green completeness recon evidences the
  // conduct capability end-to-end. Best-execution is measured against an FTP
  // proxy (directional, not a live FX mid-rate), and the EDD/STR/CTR/TPR
  // reporting substrate is design-only pending licence-day FIC registration.
  // The surveillance sweep is wired, but the dimension as a whole is honestly
  // design-attested with tracked gaps.
  {
    dimension: "conduct",
    owner: "Zara (Chief Compliance Officer, governance)",
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
      "D-MARKET-CONDUCT",
      "D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY",
      "ORG-MK-01",
      "FAIS-ACT-37-2002-S16",
      "FAIS-ACT-37-2002-S8D",
      "platform/conduct/fx-conduct-surveillance-sweep.ts",
      "platform/conduct/fx-trade-conduct-evaluation.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-best-ex-ftp-live-feed",
        title:
          "Best-execution spread is measured against the FtpCurvePublished proxy (a ZAR money-market rate), not a live FX mid-rate feed; spread comparison is directional until a live FX mid-rate feed is wired as reference.",
        owner: "Rohan (Market risk quantitative engineer, engineering)",
        targetTrigger:
          "live FTP curve feed active at execution time; live FX mid-rate feed wired as the best-execution reference",
        citations: ["FAIS-ACT-37-2002-S16", "platform/conduct/fx-trade-conduct-evaluation.ts"],
      },
      {
        gapId: "fx-edd-str-substrate",
        title:
          "EDD workflow and STR/CTR/TPR conduct-reporting substrate are design-only; they bind at licence-day when real counterparties exist and FIC registration is live.",
        owner: "Zara (Chief Compliance Officer, governance)",
        targetTrigger: "licence-day FIC registration + real-counterparty onboarding",
        citations: ["ORG-FC-02", "ORG-FC-08"],
      },
    ],
  },
  // -- Dimension 9: aml / sanctions (Zara / Mira) — DESIGN-ATTESTED (honest). --
  // Amendment A (§3a.1) re-check: no green completeness recon evidences the AML/
  // sanctions capability across scope. The sanctions screen matches a LOCAL STUB
  // blocked list (exact-match on synthetic IDs); the live UN/OFAC/EU/HMT/POCDATARA
  // feeds and the EDD/STR/CTR/TPR filing substrate are not built. The screen is
  // wired, but the dimension is honestly design-attested with tracked gaps.
  {
    dimension: "aml",
    owner:
      "Zara (Chief Compliance Officer, governance) / Mira (Compliance / RegTech engineer, engineering)",
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "ORG-FC-13",
      "ORG-FC-02",
      "platform/markets/regulatory/sanctions-screen.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-live-sanctions-feeds",
        title:
          "Sanctions screen matches against the local stub blocked list (exact-match on synthetic IDs); the live UN/OFAC/EU/HMT/POCDATARA feeds integrate via the Sanctions Screening Platform (not yet built).",
        owner:
          "Zara (Chief Compliance Officer, governance) with Mira (Compliance / RegTech engineer, engineering)",
        targetTrigger:
          "licence-day Sanctions Screening Platform build (D-SANCTIONS-SCREENING-SUBSTRATE)",
        citations: ["ORG-FC-13", "platform/markets/regulatory/sanctions-screen.ts"],
      },
      {
        gapId: "fx-edd-str-substrate",
        title:
          "EDD workflow and STR/CTR/TPR filing substrate are design-only; they bind when real customers exist and FIC registration is live.",
        owner: "Zara (Chief Compliance Officer, governance)",
        targetTrigger: "licence-day FIC registration + real-counterparty onboarding",
        citations: ["ORG-FC-02", "ORG-FC-08"],
      },
    ],
  },
  // -- Dimension 10: model-risk (Nadia) — DESIGN-ATTESTED (honest). ------------
  // Amendment A (§3a.1) re-check: the citationChain points at two
  // ModelValidationApproved events of record (fx-forward-irp-v1, market-risk-
  // var-hs-v1), but those validation events are NOT present in the gated /
  // ci:migrate clean store — they live only in the shared home store from prior
  // model-validation runs, and no seeder for them is wired into ci:migrate.
  // There is therefore no green completeness recon and no validation-of-record
  // in the gated store evidencing the FX models are independently validated for
  // this product. Honest result: design-attested with a tracked gap to land the
  // validation-of-record into the canonical (CI-reproducible) store.
  {
    dimension: "model-risk",
    owner: "Nadia (Independent-validation engineer, second line)",
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "ModelValidationApproved:model:fx-forward-irp-v1",
      "ModelValidationApproved:model:market-risk-var-hs-v1",
      "D-TRUSTED-FIGURES-PROGRAM-V1",
      "Policies/model-risk-policy-v1.md",
      "platform/market-risk/var-engine.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-model-validation-of-record-not-in-gated-store",
        title:
          "The ModelValidationApproved events for model:fx-forward-irp-v1 and model:market-risk-var-hs-v1 exist only in the shared home store; no seeder lands them in the ci:migrate clean store, so the gated store carries no validation-of-record for the FX models. Land the validation-of-record into the canonical CI-reproducible store before model-risk may be implementation-attested.",
        owner: "Nadia (Independent-validation engineer, second line)",
        targetTrigger:
          "FX model-validation seeder wired into ci:migrate (ModelValidationApproved reproducible on the clean store)",
        citations: ["D-TRUSTED-FIGURES-PROGRAM-V1", "Policies/model-risk-policy-v1.md"],
      },
      {
        gapId: "fx-forward-model-revalidation-live-curve",
        title:
          "model:fx-forward-irp-v1 was validated on the build-phase static-curve usage; revalidate when the live forward-curve feed replaces the static seed (input-regime change).",
        owner: "Nadia (Independent-validation engineer, second line)",
        targetTrigger: "live forward-curve feed integration (closes fx-forward-curve-live-feed)",
        citations: ["D-TRUSTED-FIGURES-PROGRAM-V1", "platform/markets/eod/forward-rate-seed.ts"],
      },
    ],
  },
  // -- Dimension 11: legal (Imani / Devon) — DESIGN-ATTESTED (honest). ---------
  // Real ISDA execution, the first jurisdictional opinion, CSA margining, and the
  // FAIS s.45 counsel opinion all require REAL counterparties / external counsel
  // that cannot exist in the build phase. design-attested is the honest result;
  // every condition is a well-formed tracked gap. (Resolves the prior
  // contradictory implementation-attested ↔ design-attested pair in favour of
  // the honest design-attested state.)
  {
    dimension: "legal",
    owner:
      "Imani (Legal-as-code engineer, engineering) / Devon (Chief Operating Officer, governance — interim, pending future GC)",
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "D-FX-HELD-DIMS-SEAT-SWEEP",
      "ORG-CS3-001",
      "ISDA-2002-MASTER-AGREEMENT",
      "ECTA-25-2002",
      "FAIS-ACT-37-2002",
      "platform/markets/legal/legal-documentation-gate.ts",
      "platform/markets/legal/opinion-refresh-watchdog.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-fais-s45-counsel-opinion",
        title:
          "FAIS s.45 exemption/licensing analysis for the institutional FX desk is pending an external-counsel opinion; the in-house reading (institutional-only venue, market-counterparty scope) stands un-opined until counsel is engaged.",
        owner:
          "Devon (Chief Operating Officer, governance — interim, pending future GC) — discharged via external counsel at engagement",
        targetTrigger:
          "licence-application external-counsel engagement (FAIS s.45 opinion delivered)",
        citations: ["FAIS-ACT-37-2002", "D-FX-HELD-DIMS-SEAT-SWEEP"],
      },
      {
        gapId: "fx-real-isda-execution",
        title:
          "LegalDocumentationSigned events for the authorised FX counterparties are SIMULATED build-phase fixtures (no executed agreements, no doc-store documentHash); real ISDA 2002 Master executions with hashed documents replace them at licence-day.",
        owner: "Imani (Legal-as-code engineer, engineering)",
        targetTrigger:
          "licence-day counterparty legal onboarding (real ISDA 2002 Master + SA Schedule executions, documentHash mandatory)",
        citations: ["ORG-CS3-001", "scripts/register-sim-fx-legal-documentation.ts"],
      },
      {
        gapId: "fx-jurisdictional-opinion-refresh",
        title:
          "No JurisdictionalOpinionRefreshed of record exists yet (the ISDA South Africa netting-opinion subscription is a licence-day engagement); the annual-refresh watchdog reports missing-opinion findings (medium, monitoring) until the first real opinion is filed.",
        owner: "Imani (Legal-as-code engineer, engineering)",
        targetTrigger:
          "licence-day ISDA opinion subscription — first JurisdictionalOpinionRefreshed filed with doc-store opinionDocumentHash",
        citations: [
          "ISDA-2002-MASTER-AGREEMENT",
          "platform/markets/legal/opinion-refresh-watchdog.ts",
        ],
      },
      {
        gapId: "fx-csa-margin-mechanics",
        title:
          "No CSA margining substrate exists (fixture signings carry csaPresent:false); a CSA is mandatory once forward/IRD margin requirements bind (Imani G-9 §3), so CSA execution + variation-margin mechanics are deferred to that trigger.",
        owner: "Imani (Legal-as-code engineer, engineering)",
        targetTrigger:
          "first live ISDA/CSA execution with a real counterparty (margining substrate build precedes forward/IRD margin go-live)",
        citations: ["ISDA-2002-MASTER-AGREEMENT", "D-FX-FORWARDS-TRADING-FVTPL"],
      },
    ],
  },
  // -- Dimension 12: infosec (Rashida) — DESIGN-ATTESTED (honest). -------------
  // Amendment A (§3a.1) re-check: no green completeness recon evidences the
  // infosec capability across scope. The registered threat model is STALE versus
  // the as-built synchronous gateway, the HSM key-custody substrate is not
  // provisioned (placeholder keys), and runtime detection (SIEM/EDR/SOAR) is
  // registered posture only — not live. The permission/identity gates are wired,
  // but the dimension is honestly design-attested with tracked gaps.
  {
    dimension: "infosec",
    owner: "Rashida (Chief Information Security Officer, governance)",
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "D-FX-HELD-DIMS-SEAT-SWEEP",
      "TMGD-RASHIDA-TRADING-STACK-M1-2026-06-12",
      "ORG-CY-01",
      "ORG-CY-03",
      "ORG-CY-05",
      "platform/event-store/permission-gate.ts",
      "platform/markets/identity/counterparty-identity-gate.ts",
      "runtime/agents/senna-m1-trading-stack-threat-model.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-threat-model-sync-gateway-refresh",
        title:
          "Registered zero-trust dimension models an async aggregator + check fan-out; the live path is a synchronous in-process pipeline. Refresh the threat model against the as-built gateway at the next quarterly threat-model gate.",
        owner: "Senna (Security engineer, engineering)",
        targetTrigger:
          "next quarterly threat-model gate (ThreatModelGateCompleted cadence, PROC-CISO-THREAT-GATE-01)",
        citations: ["tm:senna:trading-stack:gateway-zero-trust", "ORG-CY-01", "ORG-CY-03"],
      },
      {
        gapId: "fx-hsm-key-custody",
        title:
          "HSM substrate (FIPS 140-2/3 Level 3 key custody for order-signing / trade-confirmation paths) is not provisioned; build phase uses wire-compatible placeholder keys.",
        owner: "Atlas (Core banking platform architect, engineering)",
        targetTrigger: "licence-day / Azure cloud-lift provisions the managed cloud HSM",
        citations: ["tm:senna:trading-stack:hsm-order-signing", "ORG-CY-06"],
      },
      {
        gapId: "fx-runtime-detection-pipeline",
        title:
          "Runtime detection (SIEM/EDR/XDR) and SOAR orchestration on the trading stack are registered posture only; live detection + rehearsed response light up pre-licence.",
        owner: "Senna (Security engineer, engineering)",
        targetTrigger: "pre-licence detection-pipeline substrate lands (Senna spec §16)",
        citations: ["tm:senna:trading-stack:oms-ems-ops-security", "ORG-CY-05", "ORG-CY-08"],
      },
    ],
  },
  // -- Dimension 13: privacy (Iris) — DESIGN-ATTESTED (honest). ----------------
  // Amendment A (§3a.1) re-check: no green completeness recon evidences the
  // privacy capability across scope. POPIA s.72 cross-border assessment is not
  // yet run per counterparty, the DSAR intake channel + PAIA s.51 manual are not
  // published, and the consent phase-gate has emitted ZERO events. The DSAR
  // register/watchdog substrate is wired, but the dimension is honestly
  // design-attested with tracked gaps.
  {
    dimension: "privacy",
    owner: "Iris (Information Officer, governance)",
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "D-FX-HELD-DIMS-SEAT-SWEEP",
      "ORG-PR(IV)-01",
      "ORG-PR(IV)-08",
      "ORG-PR(IV)-15",
      "urn:reg:za:popia:s23",
      "urn:reg:za:popia:s25",
      "urn:reg:za:popia:s72",
      "platform/privacy/dsar-register.ts",
      "platform/privacy/dsar-sla-watchdog.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-popia-s72-cross-border-assessment",
        title:
          "POPIA s.72 cross-border transfer condition is not yet assessed per counterparty jurisdiction. In the build phase counterparties are fixtures and no actual cross-border transfer of personal information occurs; the per-transfer assessment substrate activates with real counterparties.",
        owner: "Iris (Information Officer, governance)",
        targetTrigger:
          "licence-day onboarding of real cross-border counterparties (first actual transfer of personal information outside SA)",
        citations: ["urn:reg:za:popia:s72", "ORG-PR(IV)-15"],
      },
      {
        gapId: "fx-dsar-intake-channel-paia-manual",
        title:
          "DSAR intake is event-substrate only: no public-facing intake channel, no published PAIA s.51 manual, no prescribed-fee schedule. These bind when real data subjects exist; the lifecycle substrate stands now and the intake channel plugs in without schema change.",
        owner: "Iris (Information Officer, governance)",
        targetTrigger:
          "licence-day (real data subjects; PAIA manual publication obligation activates)",
        citations: ["urn:reg:za:popia:s25", "ORG-PR(IV)-08"],
      },
      {
        gapId: "fx-popia-consent-phase-gate-activation",
        title:
          "The onboarding phase-8 popia-recorded gate has emitted zero events; the live KYC path evidences the s.11 lawful-basis control via LawfulProcessingRegistered instead. Converging the two consent-evidence paths is tracked, not hidden.",
        owner: "Iris (Information Officer, governance)",
        targetTrigger:
          "21-phase onboarding orchestrator runs over the live counterparty flow (first live PopiaConsentRecorded), or a deliberate convergence decision retires one family",
        citations: ["urn:reg:za:popia:s11", "ORG-PR(IV)-01"],
      },
    ],
  },
  // -- Dimension 14: tax (Yael / Camille) — DESIGN-ATTESTED (honest), treatment-module.
  // Amendment A (§3a.1) re-check: no green completeness recon evidences the tax
  // capability across scope. The VAT exemption rests on administrative guidance
  // (no binding SARS private ruling), the s24J accrual engine + IT14 integration
  // build from the first taxable year (none in the build phase), and FATCA/CRS
  // self-certification collection joins the licence-day onboarding workflow. The
  // treatment module is the canonical policy source (cited below), but the
  // operative tax capability is honestly design-attested with tracked gaps.
  {
    dimension: "tax",
    owner: "Yael (Tax engineer, engineering) / Camille (Chief Financial Officer, governance)",
    result: "design-attested",
    citationChain: [
      moduleCitation("tax-treatment:fx"),
      ...BASE_CHAIN,
      "D-FX-HELD-DIMS-SEAT-SWEEP",
      "D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY",
      "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
      "urn:reg:za:stt-act-25-2007:s1",
      "urn:reg:za:stt-act-25-2007:s7",
      "urn:reg:za:vat-act-89-1991:s2(1)(f)",
      "urn:reg:za:vat-act-89-1991:sch1-item1(f)",
      "urn:reg:za:vat-act-89-1991:sch1-item1(g)",
      "SARS-VAT-419-GUIDE-FOR-BANKS",
      "urn:reg:za:income-tax-act-58-1962:s24j",
      "FATCA-IRC-S1471-1474",
      "SA-US-FATCA-IGA-2014",
      "urn:reg:za:income-tax-act-58-1962:s70",
      "OECD-CRS-2014",
      "SARS-BRS-CRS-2017",
    ],
    deferredGaps: [
      {
        gapId: "fx-vat-sars-binding-private-ruling",
        title:
          "VAT exemption for FX forward/swap (incl. forward-points) is supported by VAT Act Sch 1 items 1(f)–(g) and SARS VAT 419 Guide §6.2 (administrative guidance, not a binding ruling); a SARS binding private ruling should be obtained before material notional volumes at licence-day.",
        owner: "Yael (Tax engineer, engineering)",
        targetTrigger:
          "SARS binding private ruling obtained OR first material FX notional threshold reached at licence-day",
        citations: [
          "urn:reg:za:vat-act-89-1991:s2(1)(f)",
          "urn:reg:za:vat-act-89-1991:sch1-item1(g)",
          "SARS-VAT-419-GUIDE-FOR-BANKS",
        ],
      },
      {
        gapId: "fx-income-tax-s24j-accrual-activation",
        title:
          "Income Tax Act s24J accrual methodology governs the timing of taxable income on the interest-rate-differential component of FX forwards. No s24J computations are required in the build phase (no taxable income); the engine + IT14 integration build from the first taxable year.",
        owner: "Yael (Tax engineer, engineering)",
        targetTrigger:
          "revenue-start at licence-day (first taxable year — s24J accrual engine + provisional-tax instalments + IT14 return integration)",
        citations: ["urn:reg:za:income-tax-act-58-1962:s24j", "D-FX-OTC-NPA-SCOPE-EXPANSION"],
      },
      {
        gapId: "fx-fatca-w8-certification-collection",
        title:
          "FATCA compliance requires W-8BEN-E / W-8IMY self-certifications from each non-US institutional counterparty before payments. Build-phase counterparties are fixtures; collection joins the counterparty legal-onboarding workflow at licence-day.",
        owner: "Yael (Tax engineer, engineering)",
        targetTrigger:
          "first real counterparty onboarding at licence-day (W-8BEN-E / W-8IMY collection in the legal-onboarding workflow)",
        citations: [
          "FATCA-IRC-S1471-1474",
          "SA-US-FATCA-IGA-2014",
          "urn:reg:za:income-tax-act-58-1962:s70",
        ],
      },
      {
        gapId: "fx-crs-counterparty-classification-and-reporting",
        title:
          "CRS compliance requires self-certification from each counterparty and, for Passive NFEs with reportable controlling persons, annual SARS BRS-CRS reporting. Build-phase counterparties are fixtures; due-diligence + submission activate on first real onboarding.",
        owner: "Yael (Tax engineer, engineering)",
        targetTrigger:
          "first real counterparty onboarding at licence-day (CRS self-certification + SARS BRS-CRS annual-reporting substrate)",
        citations: ["OECD-CRS-2014", "SARS-BRS-CRS-2017", "urn:reg:za:income-tax-act-58-1962:s70"],
      },
    ],
  },
  // -- Dimension 15: data-quality (Anya) — DESIGN-ATTESTED with a tracked gap. --
  // The original umbrella driver left data-quality design-attested with NO gap
  // (a recon violation: design-attested needs ≥1 well-formed gap). The honest
  // state: the provenance architecture is in place, but per-feed lineage metadata
  // is pending Anya's data-quality audit — that IS the well-formed tracked gap.
  {
    dimension: "data-quality",
    owner: "Anya (Data & analytics engineer, engineering)",
    result: "design-attested",
    citationChain: [
      ...BASE_CHAIN,
      "D-NPA-POST-APPROVAL-FINDING-REVIEW",
      "D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE",
      "platform/event-store/provenance-category.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-data-feed-lineage-audit",
        title:
          "Data provenance architecture is in place (categoryForEventType, provenance-category.ts, bank-mode projection), but per-instrument rate-feed and settlement-confirmation lineage metadata is not yet audited end-to-end. No silent data-quality gap may reach a live product, so the per-feed lineage audit is tracked rather than asserted complete.",
        owner: "Anya (Data & analytics engineer, engineering)",
        targetTrigger:
          "Anya data-quality lineage audit completes (per-feed rate + settlement-confirmation lineage metadata verified to source)",
        citations: [
          "D-NPA-POST-APPROVAL-FINDING-REVIEW",
          "D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE",
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Run the cycle (idempotent, append-only, gate-determined)
// ---------------------------------------------------------------------------

export interface FxNpaCycleResult {
  readonly outcome: "approved-internal-test" | "withheld" | "skipped-already-run";
  readonly gateReady: boolean;
  readonly blockingDimensions: readonly string[];
  readonly openConditions: readonly string[];
  readonly eventsEmitted: readonly string[];
}

function hasApprovalAtOrAfterCycle(store: EventStore): boolean {
  for (const ev of store.replay({ type: "ProductApproved" })) {
    const p = ev.payload as { productId?: string };
    if (p.productId === FX_NPA_PRODUCT_ID && ev.as_of >= FX_NPA_CYCLE_AS_OF) return true;
  }
  return false;
}

function provenanceFor(variant: string) {
  return buildPhaseFixtureTag({
    sourceLineage: "platform:fx-otc-vanilla-npa-cycle",
    variant: `fx-npa-cycle:${FX_NPA_PRODUCT_ID}:${variant}`,
    tags: ["npa-gate", "fx-otc-vanilla-npa-cycle", FX_NPA_PRODUCT_ID],
  });
}

/**
 * Author the single clean FX OTC vanilla NPA cycle into `store`.
 *
 * Emits (append-only, all at FX_NPA_CYCLE_AS_OF so they win latest-wins):
 *   1. ProductProposalRegistered (typed scope, exact declared scope)
 *   2. ProductConceptualised     (version bump)
 *   3. 15 × ProductDimensionAttested (the honest set above)
 *   4. ProductDueDiligenceCompleted
 *   5. ProductApproved (INTERNAL-TEST scope) OR ProductWithheld — determined by
 *      RUNNING validateNpaGate over the fresh attestations (not pre-decided).
 *
 * Idempotent: if a ProductApproved at or after FX_NPA_CYCLE_AS_OF already
 * exists for the product (this cycle already ran), returns skipped-already-run.
 */
export function runFxOtcVanillaNpaCycle(store: EventStore): FxNpaCycleResult {
  if (hasApprovalAtOrAfterCycle(store)) {
    return {
      outcome: "skipped-already-run",
      gateReady: true,
      blockingDimensions: [],
      openConditions: [],
      eventsEmitted: [],
    };
  }

  const eventsEmitted: string[] = [];

  // 1. ProductProposalRegistered (fresh proposal, exact declared scope).
  store.append({
    ...makeProductProposalRegistered({
      asOf: FX_NPA_CYCLE_AS_OF,
      entity: ENTITY,
      actor: CYCLE_ACTOR,
      citations: [...BASE_CHAIN],
      payload: {
        productId: FX_NPA_PRODUCT_ID,
        family: "fx",
        proposedBy: PROPOSED_BY,
        asOf: FX_NPA_CYCLE_AS_OF,
        scope: FX_NPA_SCOPE,
      },
    }),
    provenance: provenanceFor("proposal"),
  });
  eventsEmitted.push("ProductProposalRegistered");

  // 2. ProductConceptualised.
  store.append({
    ...makeProductConceptualised({
      asOf: FX_NPA_CYCLE_AS_OF,
      entity: ENTITY,
      actor: CYCLE_ACTOR,
      citations: [...BASE_CHAIN],
      payload: {
        productId: FX_NPA_PRODUCT_ID,
        version: FX_NPA_VERSION,
        cdmComposition: {
          name: "OTC Vanilla FX (Spot, Forward, Swap; Option at M5)",
          family: "fx",
          composedBy: CYCLE_ACTOR.id,
        },
        lifecycleEventFamily: [
          "FxTradeExecuted",
          "FxPositionRevalued",
          "FxSettlementInstructed",
          "SettlementConfirmed",
          "TradeReportSubmitted",
          "TradeMatured",
        ],
      },
    }),
    provenance: provenanceFor("conceptualised"),
  });
  eventsEmitted.push("ProductConceptualised");

  // 3. 15 × ProductDimensionAttested — the honest attestation set.
  for (const dim of FX_NPA_DIMENSIONS) {
    store.append({
      ...makeProductDimensionAttested({
        asOf: FX_NPA_CYCLE_AS_OF,
        entity: ENTITY,
        actor: CYCLE_ACTOR,
        citations: [...BASE_CHAIN, `dimension:${dim.dimension}`, `owner:${dim.owner}`],
        payload: {
          productId: FX_NPA_PRODUCT_ID,
          dimension: dim.dimension,
          result: dim.result,
          citationChain: [...dim.citationChain],
          ...(dim.deferredGaps.length > 0
            ? { deferredGaps: dim.deferredGaps.map((g) => ({ ...g, citations: [...g.citations] })) }
            : {}),
        },
      }),
      provenance: provenanceFor(`dimension:${dim.dimension}`),
    });
    eventsEmitted.push("ProductDimensionAttested");
  }

  // 4. ProductDueDiligenceCompleted.
  const gatesCleared = FX_NPA_DIMENSIONS.filter((d) => d.result !== "failed").map(
    (d) => d.dimension,
  );
  const gatesFailed = FX_NPA_DIMENSIONS.filter((d) => d.result === "failed").map(
    (d) => d.dimension,
  );
  store.append({
    ...makeProductDueDiligenceCompleted({
      asOf: FX_NPA_CYCLE_AS_OF,
      entity: ENTITY,
      actor: CYCLE_ACTOR,
      citations: [...BASE_CHAIN],
      payload: { productId: FX_NPA_PRODUCT_ID, gatesCleared, gatesFailed },
    }),
    provenance: provenanceFor("due-diligence-completed"),
  });
  eventsEmitted.push("ProductDueDiligenceCompleted");

  // 5. RUN the gate rule over the fresh attestations (not pre-decided).
  const events = Array.from(store.replay());
  const register = buildProductRegisterView(events);
  const row = register.get(FX_NPA_PRODUCT_ID);
  if (!row) {
    throw new Error(
      `No register row for ${FX_NPA_PRODUCT_ID} after emitting the cycle — cannot run the gate.`,
    );
  }
  const gate = validateNpaGate(row);

  if (!gate.ready) {
    // Honest withhold: a dimension is failed or design-attested-with-no-gap.
    store.append({
      ...makeProductWithheld({
        asOf: FX_NPA_CYCLE_AS_OF,
        entity: ENTITY,
        actor: CYCLE_ACTOR,
        citations: [...BASE_CHAIN],
        payload: {
          productId: FX_NPA_PRODUCT_ID,
          version: FX_NPA_VERSION,
          reason: `NPA gate not ready — blocking dimensions: ${gate.missing.join(", ")}`,
        },
      }),
      provenance: provenanceFor("withheld"),
    });
    eventsEmitted.push("ProductWithheld");
    return {
      outcome: "withheld",
      gateReady: false,
      blockingDimensions: gate.missing,
      openConditions: gate.openConditions,
      eventsEmitted,
    };
  }

  // Gate is ready (impl-attested + design-attested-with-gaps) → INTERNAL-TEST
  // scope approval. NOT production: production is gated on closing every tracked
  // gap and on the real-counterparty / external-counsel triggers below.
  const conditions = [
    "scope: INTERNAL-TEST (pre-licence rehearsal) — NOT a production approval.",
    "Production approval is blocked until every tracked deferred gap is closed " +
      "AND every production-required dimension is implementation-attested with a " +
      "GREEN completeness recon (NPA Policy v2 §3a.1/§3a.2).",
    `Open conditions (design-attested-with-tracked-gap): ${gate.openConditions.join("; ")}.`,
    "Real-counterparty / external-counsel triggers (legal dimension): real ISDA 2002 " +
      "execution, first jurisdictional opinion, CSA margining, FAIS s.45 counsel opinion — " +
      "all at licence-application / licence-day.",
    "Out-of-scope trades (currency/tenor/leg/counterparty/venue outside the declared " +
      "scope) are rejected at the pre-trade gate, never absorbed into suspense (Amendment D).",
  ];

  store.append({
    ...makeProductApproved({
      asOf: FX_NPA_CYCLE_AS_OF,
      entity: ENTITY,
      actor: CYCLE_ACTOR,
      citations: [...BASE_CHAIN],
      payload: {
        productId: FX_NPA_PRODUCT_ID,
        version: FX_NPA_VERSION,
        conditions,
        approvedBy: "internal-test:saskia:npa-committee-chair",
        scope: FX_NPA_SCOPE,
      },
    }),
    provenance: provenanceFor("approved-internal-test"),
  });
  eventsEmitted.push("ProductApproved");

  return {
    outcome: "approved-internal-test",
    gateReady: true,
    blockingDimensions: [],
    openConditions: gate.openConditions,
    eventsEmitted,
  };
}
