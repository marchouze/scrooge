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
// here under the Amendment A re-check + the FU2 evidence promotion (2026-06-19,
// WS-FX-OTC-CLOSURE) — 6 implementation-attested (market-risk, liquidity-risk,
// operational-readiness, accounting, model-risk, data-quality — each citing a
// GREEN, non-vacuous completeness recon RUN on the clean ci:migrate store) + 9
// design-attested-with-gaps (credit-risk, operational-risk, capital, conduct,
// aml, legal, infosec, privacy, tax) — the gate is `ready` with open conditions
// → an **INTERNAL-TEST-scope** `ProductApproved` is the honest result. We do NOT
// emit a production-scope approval: production is gated on closing every tracked
// gap and on the real-counterparty / external-counsel triggers. The `approvedBy`
// tag and the `conditions[]` carry that boundary explicitly.
//
// FU2 HONEST RE-ATTESTATION (2026-06-19, D-FX-OTC-CLOSURE-BACKLOG) — two
// dimensions previously design-attested are PROMOTED to implementation-attested
// because two green, non-vacuous completeness recons now exist and were RUN on
// the clean ci:migrate store (Charter command 3 — evidence, not assertion):
//   - model-risk → implementation-attested: `recon:fx-model-validation-of-record`
//     (PR #1453) is GREEN and non-vacuous on the gated store (asserted=2 — both
//     FX models carry a genuine `agent:nadia:*` validation-of-record with a
//     non-empty expiry; `seed:nadia-fx-model-validations` is wired into
//     ci:migrate so the validation-of-record reproduces deterministically). The
//     closed gap `fx-model-validation-of-record-not-in-gated-store` is DROPPED
//     (superseded — done); the forward gap `fx-forward-model-revalidation-live-
//     curve` is KEPT (an impl-attested dimension may carry a forward/licence-day
//     gap, exactly as market-risk does).
//   - data-quality → implementation-attested: `recon:fx-data-feed-lineage`
//     (PR #1458) is GREEN and non-vacuous over the FX RATE-FEED scope on the
//     clean store (78 fx-quote production ticks audited for lineage-to-source,
//     all carrying a non-empty source + a recognised provenance). The
//     SETTLEMENT-confirmation leg is genuinely unpopulated in the build phase —
//     the recon surfaces it as an explicit `info` tracked residual (never green-
//     by-omission) and the rule is fail-closed (regression-proven non-vacuous).
//     So data-quality is impl-attested on the audited rate-feed lineage, and the
//     settlement-confirmation lineage residual is KEPT as a tracked deferred gap
//     (`fx-settlement-confirmation-lineage`) awaiting licence-day settlement data.
// STALE-OPEN SWEEP (FU2): `fx-sa-ccr-daily-cadence` is DROPPED from credit-risk
// — it was completed + merged by PR #1258 (SA-CCR EOD scheduled handler +
// staleness watchdog, 2026-06-12). credit-risk RETAINS
// `fx-counterparty-basel-class-values`, so it stays design-attested-with-a-gap
// (valid). A live-check of the other tracked gaps confirmed the remainder are
// genuinely still open (licence-day-gated, external-counsel-gated, quarterly-
// cadence-gated, or V2-cutover-incomplete — e.g. the FX V2 dashboard surface
// exists per PR #1454 but the legacy-V1-read retirement clause is NOT yet done
// and panel parity does NOT hold, so `fx-dashboard-v2-surface` remains open),
// so none of those is dropped.
//
// INVENTORY RECONCILIATION (2026-06-19, D-FX-OTC-CLOSURE-BACKLOG): the FX
// gap-analysis closure plan (record:documents:scrooge:fx-otc-vanilla-gap-
// analysis-closure-plan:2026-06-19) found that seven build-phase backlog items
// were NOT registered as `ProductDeferredGap` records — "the gap-tracking itself
// has a gap", so the inventory understated the backlog. This cycle adds them as
// well-formed tracked gaps WITHOUT changing any per-dimension result, because the
// honest per-dimension call on each is that the underlying capability is built/
// green (or, for NDF, out of v1.0 scope) and only a V2-migration cutover or a
// scoped sub-item is deferred — exactly the schema-sanctioned "impl-attested for
// the built substrate, sub-item explicitly tracked" pattern:
//   - market-risk (impl-attested, +2): fx-daily-pnl-v2-authoritative-cutover (A2),
//     fx-var-v2-authoritative-cutover (A3) — V1→V2 cutovers; the revaluation/VaR
//     capability is built+green, only the authoritative flip is deferred.
//   - operational-readiness (impl-attested, +1): fx-dashboard-v2-surface — a
//     presentation-layer (`/api/v2/markets/fx/<view>`) migration, not a readiness gap.
//   - capital (design-attested, +1): fx-ba320-v2-parity-enforcing — flip the
//     advisory BA-320 V2 parity gate to enforcing.
//   - accounting (impl-attested, was 0 gaps → +2): fx-s0d-product-binding (fold
//     resolves via the FAIL-CLOSED type-scope fallback today — postings are not
//     wrong, only the productId-binding path is deferred) and
//     fx-ndf-cash-leg-posting (NDF is out of v1.0 scope; a v1.1 posting follow-on).
//   - conduct (design-attested, +1): fx-finsurv-reporting-procedure — author the
//     SARB FinSurv reporting procedure + BoP-category tagging (ORG-FX-FIN orphan).
// The inventory reconciliation itself changed NO result. The subsequent FU2
// re-attestation (see "FU2 HONEST RE-ATTESTATION" above) DID change two results
// on EVIDENCE — model-risk and data-quality were promoted design→implementation-
// attested against two green, non-vacuous recons RUN on the clean store — so the
// honest end-state is 6 implementation-attested + 9 design-attested-with-gaps;
// the gate is RE-RUN over that set and still yields the INTERNAL-TEST approval.
// The cycle CITES D-FX-OTC-CLOSURE-BACKLOG (the Decision is recorded canonically
// by Scrooge in the shared store — this cycle does NOT record it; recording a
// Decision in the seed path trips recon:decision-symmetry).
//
// Authority:
//   - D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19) — approve the FX closure
//     backlog; Phase A = make the NPA gap inventory honest (this cycle).
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
  makeProductDimensionRetrospectiveReview,
  makeProductDueDiligenceCompleted,
  makeProductPostApprovalFinding,
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

/**
 * Logical instant of the Slice-3 post-approval model refinement
 * (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, CEO-approved 2026-06-23). The Trade /
 * Settlement / Product model (settlement-of-record = `TradeSettlementExecuted`)
 * landed AFTER the FX OTC vanilla internal-test approval, so it is recorded
 * events-first as a `ProductPostApprovalFinding` (the model-refinement discovered
 * post-approval) PLUS the responsible dimension's `ProductDimensionRetrospectiveReview`
 * (so `recon:npa-post-approval-finding-review` stays green: the finding is
 * reviewed within SLA in the same cycle). Strictly later than FX_NPA_CYCLE_AS_OF
 * so it is genuinely post-approval and wins latest-wins on the conceptualisation.
 */
export const FX_NPA_SETTLEMENT_MODEL_AS_OF = "2026-06-23T09:00:00.000Z";

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
  "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL",
  "D-FX-OTC-CLOSURE-BACKLOG",
  "D-FX-NPA-RESTART",
  "D-NEW-PRODUCT-APPROVAL-POLICY-V2",
  "D-NPA-GATE-POLICY-REDESIGN",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
] as const;

/**
 * The Trade / Settlement / Product settlement-model PRs that landed the code this
 * post-approval refinement documents (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL Slices
 * 1–2). Cited on the post-approval finding + retrospective review so the
 * governance facts trace to the implementing change-sets.
 */
const SETTLEMENT_MODEL_PR_CITATIONS = ["#1516", "#1517"] as const;

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
      // V2-migration-completeness gap A2 (closure-plan §5 Bucket 1a). The
      // revaluation / position-level P&L capability IS built and green-reconned
      // (VaR-freshness above), so the impl-attestation stands; what is deferred is
      // the V1→V2 AUTHORITATIVE cutover — V1 `FxPositionRevalued` is still the
      // authoritative daily-P&L source while V2 `FxBookValuationSnapshotted` runs
      // in parallel, and `recon:fx-v2-parity` pins the A2 incommensurability. This
      // is a migration gap, not a capability absence, hence a tracked deferral on
      // a built+green dimension rather than a downgrade.
      {
        gapId: "fx-daily-pnl-v2-authoritative-cutover",
        title:
          "FX daily P&L is still V1-authoritative: `platform/product-control/daily-pnl.ts` reads V1 `FxPositionRevalued`; `daily-pnl-v2.ts` / `FxBookValuationSnapshotted` runs in parallel only. Make the V2 path the authoritative position-level P&L and resolve the V1↔V2 incommensurability that `recon:fx-v2-parity` (A2 leg) pins.",
        owner:
          "Bea (Financial Accountant, finance) / Rohan (Market risk quantitative engineer, engineering)",
        targetTrigger:
          "V2 daily-P&L wired authoritative from FIL/V2 projections; `recon:fx-v2-parity` A2 leg reconciles V1↔V2 (enforcing flip may legitimately wait for licence-day P&L cohort data per D-BANK-WIDE-V2-MIGRATION)",
        citations: [
          "D-BANK-WIDE-V2-MIGRATION",
          "recon:fx-v2-parity",
          "platform/product-control/daily-pnl-v2.ts",
        ],
      },
      // V2-migration-completeness gap A3 (closure-plan §5 Bucket 1a). VaR is built
      // and green (V1 `MarketRiskMeasureComputed` authoritative); V2
      // `MarketRiskVarComputed` is emitted advisory-only. Deferred sub-item: make
      // V2 VaR the production path and flip `recon:var-v2-parity` ADVISORY→
      // ENFORCING. Depends on the A2 valuation feed.
      {
        gapId: "fx-var-v2-authoritative-cutover",
        title:
          "VaR is still V1-authoritative: V1 `MarketRiskMeasureComputed` is authoritative while V2 `MarketRiskVarComputed` is advisory-only. Emit V2 VaR on the production path and flip `recon:var-v2-parity` ADVISORY→ENFORCING (depends on the A2 V2 valuation feed).",
        owner: "Rohan (Market risk quantitative engineer, engineering)",
        targetTrigger:
          "V2 `MarketRiskVarComputed` emitted on the production path off the A2 V2 valuation feed; `recon:var-v2-parity` flipped ADVISORY→ENFORCING (enforcing flip may wait for licence-day VaR cohort data)",
        citations: [
          "D-BANK-WIDE-V2-MIGRATION",
          "recon:var-v2-parity",
          "v2-core/fil-models/market-risk-var",
        ],
      },
    ],
  },
  // -- Dimension 2: credit-risk (Helena / Rohan) — DESIGN-ATTESTED (honest). ---
  // Amendment A (§3a.1) re-check: the SA-CCR completeness recon
  // (recon:v2-saccr-parity) is VACUOUS on the clean store ("0 recorded SA-CCR
  // netting sets — engine has not run"); it does not prove the EAD/RWA capability
  // is exercised and complete across the FX book. With no green completeness
  // recon evidencing liveness, the honest result is design-attested + the tracked
  // gap (the authoritative Basel-class run pending). The interim conservative
  // 100% RWA stands.
  // FU2 stale-open sweep (2026-06-19): the `fx-sa-ccr-daily-cadence` gap is
  // DROPPED — it was completed + merged by PR #1258 (runtime/agents/
  // rohan-sa-ccr-eod.ts EOD scheduled handler + per-netting-set staleness
  // watchdog, 2026-06-12); carrying it overstated the backlog. credit-risk
  // RETAINS `fx-counterparty-basel-class-values`, so it remains design-attested-
  // with-a-gap (the authoritative Basel-class value-assignment run is genuinely
  // still pending — verified open).
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
      // `fx-sa-ccr-daily-cadence` was here — DROPPED in the FU2 stale-open sweep
      // (closed by PR #1258: SA-CCR EOD scheduled handler + staleness watchdog).
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
      "BCBS-bcbs128-§644",
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
          "op-RWA capital (BIA/TSA per Basel II bcbs128 §645–654 / Reg 33) is gross-income-blocked: it requires three fiscal years of audited gross income, which do not exist in the build phase. No hollow gross-income figure is fabricated.",
        owner:
          "Camille (Chief Financial Officer, governance) + Bea (Financial Accountant, finance)",
        targetTrigger:
          "revenue-start + three fiscal years of audited gross income (post-licence-day) feed the BA 400 op-RWA computation",
        citations: ["BCBS-bcbs128-§644", "REG-33", "platform/reporting/ba-400-op-risk.ts"],
      },
      {
        gapId: "fx-op-risk-loss-distribution",
        title:
          "No loss-distribution / LDA capital model exists; OperationalLossEvent is the CAPTURE substrate only. An LDA needs a multi-year loss-data history and is a licence-day model build.",
        owner: "Tomas (Operations & payments engineer, engineering)",
        targetTrigger:
          "licence-day op-risk model build — multi-year internal-loss data accumulates, then the LDA/SMA model is calibrated and validated",
        citations: ["BCBS-bcbs128-§644", "platform/event-store/event-types/operational-risk.ts"],
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
  // Trade / Settlement / Product model (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL,
  // #1516/#1517): the settlement-of-record is now the uniform single-asset
  // `TradeSettlementExecuted` event (FX spot = 2: received-cash + paid-cash legs),
  // each materialising a holding AT COST and executing a specific trade. This is
  // the explicit settlement-of-record that REPLACES the prior 2-leg
  // `FilFxSettlementConfirmed`; the settlement-continuity structural invariant
  // (green recon below) is unchanged by Slice 3 (no settlement code change).
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
      // Settlement-of-record under the Trade/Settlement/Product model (#1516/#1517):
      // uniform single-asset `TradeSettlementExecuted` + the per-trade `tradeFamily`
      // grouping (Create + Settles + holdings under the trade id).
      "v2-core/fil-instances/trade-settlement.ts",
      "v2-core/fil-instances/trade-family.ts",
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
      // V2-migration-completeness gap (closure-plan §5 Bucket 1a — FX dashboard
      // V2). Operational-readiness is impl-attested on the settlement-continuity
      // structural invariant (green recon above); the operator surfaces work today
      // on the legacy `/api/markets/fx/<view>` reads. Deferred sub-item: build the
      // name-free `/api/v2/markets/fx/<view>` surface (per the V2 UI policy — seats
      // by Title only) reading FIL/V2 projections, and retire the V1 reads. A
      // presentation-layer migration gap, not a readiness-capability absence.
      {
        gapId: "fx-dashboard-v2-surface",
        title:
          "All `dashboard/markets-fx` views (risk/trade/gateway/npa/summary/counterparties/headroom) are served on legacy `/api/markets/fx/<view>` reading V1 events; there is no `/api/v2/markets/fx/<view>` surface. Build the V2 FX dashboard surface with name-free DTOs reading FIL/V2 projections and retire the legacy V1 reads once parity holds.",
        owner: "Atlas (Core banking platform architect, engineering)",
        targetTrigger:
          "`/api/v2/markets/fx/<view>` name-free DTO surface built off FIL/V2 projections (D-BANK-WIDE-V2-MIGRATION); legacy `/api/markets/fx/<view>` reads retired at parity",
        citations: ["D-BANK-WIDE-V2-MIGRATION", "dashboard/v2-regulations-view.ts"],
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
      // Trade / Settlement / Product model (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL,
      // #1516/#1517): settlement-of-record is now `TradeSettlementExecuted`
      // (uniform single-asset, holding-at-cost). The posting fold derives
      // derecognition + realised P&L (IAS 21 §28) from the booked-vs-settled
      // amounts on each settlement event — see the trade-settlement fold + its
      // green balance test (no posting-behaviour change in Slice 3).
      "platform/accounting/posting-rules-v2/fx-instance-fold.ts",
      "v2-core/posting-rules/trade-settlement.ts",
    ],
    // Accounting REMAINS implementation-attested: the modular product-composed
    // posting fold is built, exercised, and green (no-suspense recon above) over
    // the v1.0 supported scope. Under the Trade / Settlement / Product model
    // (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, #1516/#1517) the settlement-of-record
    // is the uniform single-asset `TradeSettlementExecuted` (holding-at-cost),
    // which REPLACES the 2-leg `FilFxSettlementConfirmed` representation; the fold
    // already derives derecognition + realised P&L from each settlement's
    // booked-vs-settled amounts (IAS 21 §28). The two deferred sub-items below
    // were previously UNTRACKED (closure-plan §5 "the gap-tracking itself has a
    // gap") and are now recorded honestly — neither undermines the
    // impl-attestation:
    //   - S0d is a booking-time PRODUCT-BINDING enhancement; today the fold
    //     resolves correctly via the FAIL-CLOSED type-scope fallback (path 2 in
    //     fx-fold.ts requires exactly-one match, else `treatment-unresolved`),
    //     so postings are not silently wrong — only the productId-on-trade binding
    //     path is deferred.
    //   - NDF cash-leg posting is a v1.1 follow-on; NDF is OUT of scope at v1.0,
    //     so its absence cannot make the v1.0 attestation dishonest.
    deferredGaps: [
      {
        gapId: "fx-s0d-product-binding",
        title:
          "Booking-time product binding (S0d) is deferred: FX trades do not yet carry a `productId` at booking, so the modular posting fold resolves via the fail-closed type-scope fallback (path 2, fx-fold.ts) rather than the productId→Product→treatment path. Set `productId` on the FIL trade at booking (NPA-gated) and retire the build-phase fold fallback so path 1 always wins.",
        owner:
          "Bea (Financial Accountant, finance) / Atlas (Core banking platform architect, engineering)",
        targetTrigger:
          "S0d lands — `productId` set on FIL trade at booking + NPA-gate; build-phase type-scope fold fallback retired",
        citations: [
          "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
          "platform/accounting/posting-rules-v2/fx-fold.ts",
        ],
      },
      {
        gapId: "fx-ndf-cash-leg-posting",
        title:
          "NDF net-cash settlement posting rule and the EOD-terminal treatment of `FilNdfFixingObserved` (NDF fixing observed → terminal, net-cash leg posted) are not built; NDF is out of scope at v1.0 and this posting follow-on lands with the v1.1 NDF scope addition (pairs with the op-readiness `fx-ndf-runbooks` gap).",
        owner:
          "Bea (Financial Accountant, finance) / Anya (Data & analytics engineer, engineering)",
        targetTrigger:
          "v1.1 NDF scope addition — NDF net-cash posting rule + EOD-runner treats `FilNdfFixingObserved` as terminal",
        citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION", "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD"],
      },
    ],
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
      // V2-migration-completeness gap (closure-plan §5 Bucket 1a — BA-320 FX
      // parity). The Phase-3e V2 BA-320 FX market-risk-charge projection is
      // canonical, but `recon:ba320-fx-v2-parity` is ADVISORY (rate-conversion
      // precision gaps, null V1 charge). Close the precision gaps and flip the gate
      // ADVISORY→ENFORCING so the V2 BA-320 charge is reconciled, not just parallel.
      {
        gapId: "fx-ba320-v2-parity-enforcing",
        title:
          "BA-320 FX market-risk charge: the V2 projection (`platform/projections/ba320-fx-v2.ts`) is canonical but `recon:ba320-fx-v2-parity` is ADVISORY with rate-conversion precision gaps and a null V1 charge. Close the precision gaps and flip the parity gate ADVISORY→ENFORCING.",
        owner:
          "Rohan (Market risk quantitative engineer, engineering) / Camille (Chief Financial Officer, governance)",
        targetTrigger:
          "BA-320 rate-conversion precision gaps closed; `recon:ba320-fx-v2-parity` flipped ADVISORY→ENFORCING (D-BANK-WIDE-V2-MIGRATION)",
        citations: ["D-BANK-WIDE-V2-MIGRATION", "recon:ba320-fx-v2-parity"],
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
      // Build-phase-closeable engineering gap (closure-plan §4.3 / §5 Bucket 1b —
      // FinSurv procedure). The SARB Exchange-Control / FinSurv reporting
      // obligation set (ORG-FX-FIN-01..14) is an orphan: the reporting procedure
      // is not yet authored and BoP-category tagging at settlement is not wired.
      // This is a regulatory-reporting (conduct) build-phase shortfall, distinct
      // from the licence-day-gated reporting substrate above.
      {
        gapId: "fx-finsurv-reporting-procedure",
        title:
          "FinSurv / SARB Exchange-Control reporting (ORG-FX-FIN-01..14) is an orphan obligation set: `Procedures/by-policy/finsurv-reporting.md` is not yet authored and balance-of-payments (BoP) category tagging at settlement is not built. Author the procedure and wire BoP-category tagging at settlement (the build-phase-closeable portion; ORG-FX-FIN-10..14 net-payment legs remain v1.1-deferred).",
        owner:
          "Mira (Compliance / RegTech engineer, engineering) / Anya (Data & analytics engineer, engineering)",
        targetTrigger:
          "`Procedures/by-policy/finsurv-reporting.md` authored + BoP-category tagging wired at settlement (closes the build-phase portion of the ORG-FX-FIN orphan set)",
        citations: ["ORG-FX-FIN-01", "Procedures/by-policy/finsurv-reporting.md"],
      },
      // Settlement-model follow-on (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, #1516/#1517).
      // The FinSurv BoP per-transaction projection
      // (`platform/markets/regulatory/finsurv-bop-projection.ts`) folds the
      // settlement-of-record to derive each cross-border BoP-reportable flow. Under
      // the Trade/Settlement/Product model the settlement-of-record is now
      // `TradeSettlementExecuted` (the explicit, single-asset settlement event),
      // but the projection still reads only `FilFxSettlementConfirmed` /
      // `FilNdfFixingObserved` (the retired/oracle representation). The projection
      // must ALSO read `TradeSettlementExecuted` when BoP per-transaction reporting
      // activates at licence-day, else cross-border settlements booked under the new
      // model would be invisible to FinSurv. No silent deferral — tracked here.
      {
        gapId: "fx-bop-projection-trade-settlement-source",
        title:
          "The FinSurv BoP per-transaction projection (`platform/markets/regulatory/finsurv-bop-projection.ts`) reads only `FilFxSettlementConfirmed` / `FilNdfFixingObserved` for BoP-reportable settlement flows. Under D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL (#1516/#1517) the settlement-of-record is now `TradeSettlementExecuted`; the projection must also fold `TradeSettlementExecuted` (carrying the optional `bopCategory` tag) when BoP per-transaction reporting activates at licence-day, or cross-border settlements booked under the new model will be invisible to FinSurv.",
        owner:
          "Mira (Compliance / RegTech engineer, engineering) / Anya (Data & analytics engineer, engineering)",
        targetTrigger:
          "licence-day FinSurv BoP per-transaction reporting activation — `finsurv-bop-projection.ts` extended to fold `TradeSettlementExecuted` alongside the legacy settlement-confirmation/NDF-fixing events",
        citations: [
          "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL",
          "#1516",
          "#1517",
          "platform/markets/regulatory/finsurv-bop-projection.ts",
        ],
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
  // -- Dimension 10: model-risk (Nadia) — IMPLEMENTATION-ATTESTED (FU2). -------
  // FU2 promotion (2026-06-19, D-FX-OTC-CLOSURE-BACKLOG): the prior design-
  // attested result rested on the validation-of-record being absent from the
  // gated / ci:migrate clean store (it lived only in the home store). PR #1453
  // closes that: `seed:nadia-fx-model-validations` is wired into ci:migrate, so
  // the `ModelValidationApproved` events for BOTH FX models the model-risk
  // dimension binds to (model:fx-forward-irp-v1, model:market-risk-var-hs-v1)
  // reproduce deterministically on the clean store, and `recon:fx-model-
  // validation-of-record` (BLOCKING) asserts them. RUN on the clean ci:migrate
  // store this gate is GREEN and NON-VACUOUS: asserted=2, both models carry a
  // genuine `agent:nadia:*` second-line verdict with a non-empty expiry horizon
  // (not a hollow row). That is the green, non-vacuous completeness recon the
  // Amendment-A rule requires for implementation-attested. The closed gap
  // `fx-model-validation-of-record-not-in-gated-store` is DROPPED (superseded —
  // done). The forward gap `fx-forward-model-revalidation-live-curve` is KEPT: an
  // impl-attested dimension may carry a forward/licence-day gap (market-risk
  // carries `fx-forward-curve-live-feed` the same way), and the static-curve
  // input-regime revalidation is genuinely deferred until the live curve lands.
  {
    dimension: "model-risk",
    owner: "Nadia (Independent-validation engineer, second line)",
    result: "implementation-attested",
    citationChain: [
      ...BASE_CHAIN,
      // FU2 (§3a.1): GREEN, non-vacuous completeness recon — the FX model
      // validation-of-record is present on the gated store (asserted=2, both
      // models, genuine Nadia verdict + expiry). PR #1453.
      "recon:fx-model-validation-of-record",
      "ModelValidationApproved:model:fx-forward-irp-v1",
      "ModelValidationApproved:model:market-risk-var-hs-v1",
      "D-TRUSTED-FIGURES-PROGRAM-V1",
      "Policies/model-risk-policy-v1.md",
      "platform/model-registry/fx-model-validation-seed.ts",
      "platform/market-risk/var-engine.ts",
    ],
    deferredGaps: [
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
  // -- Dimension 15: data-quality (Anya) — IMPLEMENTATION-ATTESTED (FU2). ------
  // FU2 promotion (2026-06-19, D-FX-OTC-CLOSURE-BACKLOG): PR #1458 landed
  // `recon:fx-data-feed-lineage` (BLOCKING), which audits the FX product's data
  // feeds end-to-end and FAILS CLOSED on missing lineage. RUN on the clean
  // ci:migrate store this gate is GREEN and NON-VACUOUS over the FX RATE-FEED
  // scope: 78 fx-quote production ticks are audited for lineage-to-source, every
  // one carrying a non-empty `source` (the provider/feed axis) and a recognised
  // `provenance`. That is a real, exercised, complete lineage assertion over the
  // rate-feed population — the green, non-vacuous completeness recon the
  // Amendment-A rule requires — so data-quality is implementation-attested on the
  // audited rate-feed lineage. The previous catch-all gap `fx-data-feed-lineage-
  // audit` (rate + settlement, untracked-complete) is SUPERSEDED: its rate-feed
  // leg is now green-evidenced.
  // HONEST RESIDUAL (kept, not hidden — Charter command 3 + 5): the SETTLEMENT-
  // confirmation lineage leg is genuinely unpopulated in the build phase (no
  // production seed emits `FilFxSettlementConfirmed` yet; the FX book is
  // materialised as FIL instances). The recon does NOT silently green that — it
  // surfaces an explicit `info` tracked residual and the rule is fail-closed
  // (regression-proven non-vacuous: a populated store with a lineage-less
  // settlement event makes the gate FAIL). So the settlement-confirmation lineage
  // residual is KEPT as a well-formed tracked deferred gap awaiting licence-day
  // settlement-event population.
  {
    dimension: "data-quality",
    owner: "Anya (Data & analytics engineer, engineering)",
    result: "implementation-attested",
    citationChain: [
      ...BASE_CHAIN,
      // FU2 (§3a.1): GREEN, non-vacuous completeness recon — FX rate-feed lineage
      // audited to source over 78 production fx-quote ticks; fail-closed on any
      // missing lineage. PR #1458.
      "recon:fx-data-feed-lineage",
      "D-NPA-POST-APPROVAL-FINDING-REVIEW",
      "D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE",
      "platform/event-store/provenance-category.ts",
    ],
    deferredGaps: [
      {
        gapId: "fx-settlement-confirmation-lineage",
        title:
          "The FX RATE-FEED lineage is audited green-to-source (recon:fx-data-feed-lineage, 78 production fx-quote ticks). The SETTLEMENT-confirmation lineage leg is wired and fail-closed but exercises ZERO events in the build phase — no production seed emits `FilFxSettlementConfirmed` yet (the FX book is materialised as FIL instances). The lineage assertion (originatingEvent ref + envelope provenance.sourceLineage) is live and will FAIL on the first lineage-less settlement event (regression-tested); it awaits licence-day FX settlement-event population before it can be exercised on real data.",
        owner: "Anya (Data & analytics engineer, engineering)",
        targetTrigger:
          "licence-day FX settlement flow populates `FilFxSettlementConfirmed` events; the fail-closed settlement-confirmation lineage rule then exercises real data (recon:fx-data-feed-lineage settlement leg)",
        citations: [
          "D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE",
          "platform/recon/fx-data-feed-lineage.ts",
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Slice-3 post-approval settlement-model refinement
// (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, CEO-approved 2026-06-23; #1516/#1517)
//
// The Trade / Settlement / Product model landed AFTER the FX OTC vanilla
// internal-test approval, so it is recorded EVENTS-FIRST as a post-approval
// model refinement (NOT a re-approval, NOT a scope change):
//   - a second `ProductConceptualised` carrying the refined lifecycle event
//     family (settlement-of-record = `TradeSettlementExecuted`), latest-wins;
//   - a `ProductPostApprovalFinding` recording the model refinement discovered
//     post-approval (severity `medium` — a representation refinement, postings/
//     settlement behaviour unchanged; the prior implicit-settlement representation
//     was not wrong, just superseded by an explicit settlement-of-record);
//   - a matching `ProductDimensionRetrospectiveReview` on the `accounting`
//     dimension closing the finding within SLA (`revisedAttestation:
//     "deferred-gap-added"` — the BoP-projection follow-on is the tracked gap),
//     so `recon:npa-post-approval-finding-review` stays GREEN.
// ---------------------------------------------------------------------------

/**
 * The lifecycle event family under the Trade / Settlement / Product model
 * (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL). Three cleanly-separated constructs:
 *   - Trade = the agreement: `FilInstrumentCreated` (executory receivable/payable).
 *   - Settlement = the execution: `TradeSettlementExecuted` — uniform single-asset
 *     settlement-OF-RECORD (FX spot = 2 legs: received-cash + paid-cash), each
 *     materialising a holding AT COST and executing a specific trade; booked-vs-
 *     settled drives derecognition + realised P&L (IAS 21 §28). REPLACES the
 *     2-leg `FilFxSettlementConfirmed` representation.
 *   - Product = the glue: the type-level rulebook + the per-trade `tradeFamily`
 *     grouping (Create + its Settles + holdings under the trade id).
 * `FilFxSettlementConfirmed` stays registered as the oracle / historical event
 * only (retired as settlement-of-record).
 */
export const SETTLEMENT_MODEL_LIFECYCLE_FAMILY: readonly string[] = [
  // Trade = agreement (executory receivable/payable).
  "FilInstrumentCreated",
  // Interim mark-to-market between Create and Settle (a Valuable-facet reval, not
  // a settlement).
  "FxPositionRevalued",
  // Settlement = execution: uniform single-asset settlement-of-record.
  "TradeSettlementExecuted",
  // Derecognition / maturity of the trade instrument.
  "FilInstrumentTerminated",
  // Regulatory trade reporting.
  "TradeReportSubmitted",
  // Oracle / historical only — retired as settlement-of-record, superseded by
  // `TradeSettlementExecuted` (kept registered for replay of historical events).
  "FilFxSettlementConfirmed (oracle/historical — retired as settlement-of-record)",
];

/** Stable finding id for the Slice-3 settlement-model post-approval refinement. */
export const FX_SETTLEMENT_MODEL_FINDING_ID = "PAF-FX-SETTLEMENT-MODEL-001";

/**
 * The dimension whose attestation the settlement-model refinement most directly
 * touches (postings now derive derecognition + realised P&L from the explicit
 * settlement-of-record). The retrospective review is recorded against it.
 */
export const FX_SETTLEMENT_MODEL_MISSED_DIMENSION = "accounting";

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
 * Author the Slice-3 post-approval settlement-model refinement
 * (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, #1516/#1517) into `store`, events-first.
 *
 * Emits, all at FX_NPA_SETTLEMENT_MODEL_AS_OF (strictly post-approval → wins
 * latest-wins on the conceptualisation; genuinely post-approval for the recon):
 *   1. ProductConceptualised             — refined lifecycle event family
 *      (settlement-of-record = `TradeSettlementExecuted`), same version (no
 *      re-approval / version bump).
 *   2. ProductPostApprovalFinding        — the model refinement discovered
 *      post-approval (severity `medium`; settlement behaviour unchanged).
 *   3. ProductDimensionRetrospectiveReview — the `accounting` owner closes the
 *      finding within SLA (`revisedAttestation: "deferred-gap-added"`, the
 *      BoP-projection follow-on), keeping `recon:npa-post-approval-finding-review`
 *      GREEN.
 *
 * This is NOT a re-approval and NOT a scope change — the approval result and the
 * declared scope are untouched (Slice-3 DO-NOT). It documents an already-
 * implemented representation refinement (Slices 1–2) as a governance fact.
 */
function emitSettlementModelRefinement(store: EventStore, eventsEmitted: string[]): void {
  const refinementChain = [...BASE_CHAIN, ...SETTLEMENT_MODEL_PR_CITATIONS];

  // 1. Refined conceptualisation — latest-wins on the lifecycle event family.
  store.append({
    ...makeProductConceptualised({
      asOf: FX_NPA_SETTLEMENT_MODEL_AS_OF,
      entity: ENTITY,
      actor: CYCLE_ACTOR,
      citations: refinementChain,
      payload: {
        productId: FX_NPA_PRODUCT_ID,
        version: FX_NPA_VERSION,
        cdmComposition: {
          name: "OTC Vanilla FX (Spot, Forward, Swap; Option at M5)",
          family: "fx",
          composedBy: CYCLE_ACTOR.id,
          settlementModel: "trade-settlement-product",
          settlementOfRecord: "TradeSettlementExecuted",
          retiredSettlementOfRecord: "FilFxSettlementConfirmed",
          decision: "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL",
        },
        lifecycleEventFamily: [...SETTLEMENT_MODEL_LIFECYCLE_FAMILY],
      },
    }),
    provenance: provenanceFor("conceptualised-settlement-model"),
  });
  eventsEmitted.push("ProductConceptualised");

  // 2. Post-approval finding — the model refinement discovered post-approval.
  store.append({
    ...makeProductPostApprovalFinding({
      asOf: FX_NPA_SETTLEMENT_MODEL_AS_OF,
      entity: ENTITY,
      actor: CYCLE_ACTOR,
      citations: refinementChain,
      payload: {
        productId: FX_NPA_PRODUCT_ID,
        findingId: FX_SETTLEMENT_MODEL_FINDING_ID,
        severity: "medium",
        title:
          "FX settlement representation refined to the Trade / Settlement / Product model (settlement-of-record = TradeSettlementExecuted)",
        description:
          "Post-approval model refinement (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, #1516/#1517): the FX OTC vanilla settlement-of-record is now the uniform single-asset `TradeSettlementExecuted` event (FX spot = 2 legs: received-cash + paid-cash), each materialising a holding AT COST and executing a specific trade; booked-vs-settled drives derecognition + realised P&L (IAS 21 §28). This REPLACES the 2-leg `FilFxSettlementConfirmed` representation (retired to oracle/historical only — Slice-2 finding: FX vanilla never actually emitted it in production; settlement was implicit via terminated{settled} + cash). Three cleanly-separated constructs: Trade = agreement (`FilInstrumentCreated`); Settlement = execution (`TradeSettlementExecuted`); Product = glue (type-level rulebook + per-trade `tradeFamily` grouping). Settlement/posting behaviour is unchanged (Slices 1–2 landed the code); this is a representation refinement, hence severity medium. Follow-on tracked as the conduct `fx-bop-projection-trade-settlement-source` deferred gap.",
        discoveredBy: "Atlas (Core banking platform architect, engineering)",
        discoveredAt: FX_NPA_SETTLEMENT_MODEL_AS_OF,
        missedDimension: FX_SETTLEMENT_MODEL_MISSED_DIMENSION,
        findingTrigger: "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL settlement-model design (#1516/#1517)",
        citations: refinementChain,
      },
    }),
    provenance: provenanceFor("post-approval-finding-settlement-model"),
  });
  eventsEmitted.push("ProductPostApprovalFinding");

  // 3. Retrospective review — closes the finding within SLA; deferred-gap-added.
  store.append({
    ...makeProductDimensionRetrospectiveReview({
      asOf: FX_NPA_SETTLEMENT_MODEL_AS_OF,
      entity: ENTITY,
      actor: CYCLE_ACTOR,
      citations: refinementChain,
      payload: {
        productId: FX_NPA_PRODUCT_ID,
        findingId: FX_SETTLEMENT_MODEL_FINDING_ID,
        dimension: FX_SETTLEMENT_MODEL_MISSED_DIMENSION,
        reviewedBy: "Bea (Financial Accountant, finance)",
        reviewedAt: FX_NPA_SETTLEMENT_MODEL_AS_OF,
        rootCause:
          "The Trade / Settlement / Product model post-dated the FX OTC vanilla internal-test approval: at approval time settlement was represented implicitly (terminated{settled} + materialised cash) and the never-emitted `FilFxSettlementConfirmed` was the nominal carrier. The accounting attestation was honest for the substrate that existed; the explicit single-asset settlement-of-record (`TradeSettlementExecuted`, holding-at-cost) is a later architectural refinement (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL), not a defect missed by the original attestation.",
        correctiveAction:
          "Accounting attestation render updated to cite the trade-settlement fold (`platform/accounting/posting-rules-v2/fx-instance-fold.ts`, `v2-core/posting-rules/trade-settlement.ts`); the conceptualisation lifecycle event family is refined to the settlement-of-record `TradeSettlementExecuted` (latest-wins). No posting-behaviour change — Slices 1–2 landed and balance-tested the fold. The one genuine follow-on (the FinSurv BoP per-transaction projection must also read `TradeSettlementExecuted` at licence-day) is recorded as the conduct `fx-bop-projection-trade-settlement-source` tracked deferred gap (no silent deferral).",
        revisedAttestation: "deferred-gap-added",
        citations: [
          ...refinementChain,
          "platform/accounting/posting-rules-v2/fx-instance-fold.ts",
          "platform/markets/regulatory/finsurv-bop-projection.ts",
        ],
      },
    }),
    provenance: provenanceFor("retrospective-review-settlement-model"),
  });
  eventsEmitted.push("ProductDimensionRetrospectiveReview");
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
        // Lifecycle event family AS CONCEPTUALISED AT APPROVAL TIME. The Trade /
        // Settlement / Product model (settlement-of-record = `TradeSettlementExecuted`)
        // landed AFTER this internal-test approval (D-FX-TRADE-SETTLEMENT-PRODUCT-
        // MODEL, 2026-06-23) and is recorded as a post-approval refinement: a
        // second `ProductConceptualised` at FX_NPA_SETTLEMENT_MODEL_AS_OF supersedes
        // this family latest-wins, and a `ProductPostApprovalFinding` +
        // `ProductDimensionRetrospectiveReview` carry the governance fact. See
        // `SETTLEMENT_MODEL_LIFECYCLE_FAMILY` below.
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

  // 6. Post-approval settlement-model refinement (D-FX-TRADE-SETTLEMENT-PRODUCT-
  //    MODEL, #1516/#1517) — landed AFTER the internal-test approval, recorded
  //    events-first (refined conceptualisation + post-approval finding + its
  //    retrospective review so the finding-review recon stays green).
  emitSettlementModelRefinement(store, eventsEmitted);

  return {
    outcome: "approved-internal-test",
    gateReady: true,
    blockingDimensions: [],
    openConditions: gate.openConditions,
    eventsEmitted,
  };
}
