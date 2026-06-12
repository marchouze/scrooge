// platform/governance/decision-distillation/classifications.ts
//
// WS-V2-BBAAS W1 — the authored classification dataset: every decisionId
// that has ever reached `phase: "approved"` in the canonical event log,
// classified along the BBaaS shared-core seam:
//   - foundational — defines the backbone; holds for any tenant bank.
//   - directional  — this specific bank's choices.
//   - obsolete     — superseded or overtaken (latest phase no longer
//     approved, or explicitly superseded by a later decision).
//
// This file is the REVIEWABLE source for `scripts/distill-decisions-w1.ts`,
// which emits one `DecisionDistilled` event per entry (latest event per
// decisionId wins). The event log is canonical once emitted (P1); this file
// is the authoring surface and stays deterministic (sorted by decisionId).
//
// Universe derivation (read-only, shared store):
//   SELECT DISTINCT json_extract(payload,'$.decisionId') FROM events
//   WHERE type='Decision' AND json_extract(payload,'$.phase')='approved'
// Snapshot date: 2026-06-12 (257 decisionIds). The
// `recon:decision-distillation-coverage` gate asserts ongoing 100% coverage.
//
// Authority: D-V2-BBAAS-W1-DECISION-DISTILLATION (CEO session-delegation
// 2026-06-12); D-V2-BBAAS-ANALYSIS-LAUNCH; P1-EVENTS-AS-TRUTH.
// Author: Owen (Company Secretary, governance).

import type { DecisionDistillationClass } from "../../event-store/event-types/decision-distillation";

export interface DecisionClassification {
  readonly decisionId: string;
  readonly class: DecisionDistillationClass;
  /** 1-3 short sentences; specific, decisive. */
  readonly rationale: string;
  /** Optional typed citations (superseding decision ids, principle paths). */
  readonly citations?: readonly string[];
}

export const DISTILLED_BY = "company-secretary";
export const DISTILLATION_WORKSTREAM = "WS-V2-BBAAS-W1";

export const DECISION_CLASSIFICATIONS: readonly DecisionClassification[] = [
  {
    decisionId: "D-A22-RETIRE-LEGACY",
    class: "directional",
    rationale:
      "Seed-approval record for a legacy-component retirement step in this bank's agent-runtime build sequence. The retirement discipline is extractable, but the decision content is a one-off cleanup of this build.",
  },
  {
    decisionId: "D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK",
    class: "directional",
    rationale:
      "One-off re-book of cross-currency residuals stranded in this bank's USD-designated accounts plus a standing recon. Tenant-specific data correction; the designated-currency recon pattern is the extractable piece.",
  },
  {
    decisionId: "D-AGENT-AUTONOMY-COHORT-2-PILOT",
    class: "directional",
    rationale:
      "Scopes which of this bank's agents (Vera-first cohort 2) pilot autonomous authoring and under what guardrails. Rollout sequencing of this bank's fleet, not backbone mechanics.",
  },
  {
    decisionId: "D-AGENT-AUTONOMY-OPERATIONAL",
    class: "foundational",
    rationale:
      "Declares agent autonomy operational as the bank's working mode \u2014 the autonomous-by-default labour model (Principle 6) that any tenant of the backbone inherits.",
    citations: ["Principles/6-autonomous-by-default.md"],
  },
  {
    decisionId: "D-AGENT-AUTONOMY-RISK-TREASURY-PILOT",
    class: "directional",
    rationale:
      "Pilots autonomous goal-loops on this bank's specific risk/treasury agents (Rohan now, Ravi fast-follow). Fleet sequencing for this tenant.",
  },
  {
    decisionId: "D-AGENT-RUNTIME-AUTHORIZE",
    class: "obsolete",
    rationale:
      "Latest phase is superseded \u2014 a later decision replaced this seed authorisation of the agent runtime.",
  },
  {
    decisionId: "D-ALM-SETTLEMENT-INSTRUCTION-CORRESPONDENT",
    class: "directional",
    rationale:
      "Sources this bank's non-trade contractual LCR outflows from correspondent-funding repayments. Wiring choice tied to this bank's correspondent-settlement posture.",
  },
  {
    decisionId: "D-API-CLOUD-COST-BUDGET",
    class: "directional",
    rationale:
      "Sets this bank's build-phase API + cloud spend envelope (USD 1,500-3,500/month). Pure tenant budget posture.",
  },
  {
    decisionId: "D-AUDIT-FINDING-MASS-CLOSURE",
    class: "directional",
    rationale:
      "One-off mass closure of this bank's open audit findings plus the closure path. The closure-path mechanics are extractable; the decision itself is tenant audit history.",
  },
  {
    decisionId: "D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION",
    class: "foundational",
    rationale:
      "Requires every goal-loop iteration to emit agent-runtime run-lifecycle events so the autonomy feed reflects reality. Instrumentation discipline for the agent substrate any tenant runs on.",
  },
  {
    decisionId: "D-AZURE-COST-BUDGET",
    class: "obsolete",
    rationale:
      "Ghost placeholder (referenced, no owning record) for cloud-cost budgeting; the operative envelope was set by D-API-CLOUD-COST-BUDGET, which supersedes it in practice.",
    citations: ["D-API-CLOUD-COST-BUDGET"],
  },
  {
    decisionId: "D-BA-330-REATTRIBUTION-IRRBB",
    class: "directional",
    rationale:
      "Re-attributes this bank's BA-330 artefacts to IRRBB (verified against SARB forms). SARB-return numbering housekeeping for this tenant's reporting estate.",
  },
  {
    decisionId: "D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION",
    class: "obsolete",
    rationale:
      "Executed propagation of the D5/2025 BA-numbering scheme, which was later found fabricated and superseded by D-BA-RETURN-NUMBERING-EXCEL-CANONICAL. The work it dispatched was redone under the Excel-canonical map.",
    citations: ["D-BA-RETURN-NUMBERING-EXCEL-CANONICAL"],
  },
  {
    decisionId: "D-BA-RETURN-FORM-NUMBERING-RECON",
    class: "obsolete",
    rationale:
      "Reconciliation grounded in the fabricated D5/2025 BA-numbering scheme; superseded by D-BA-RETURN-NUMBERING-EXCEL-CANONICAL which made the downloaded Excel forms definitive.",
    citations: ["D-BA-RETURN-NUMBERING-EXCEL-CANONICAL"],
  },
  {
    decisionId: "D-BA-RETURN-NUMBERING-EXCEL-CANONICAL",
    class: "directional",
    rationale:
      "Makes the downloaded SARB Excel forms the definitive BA-return numbering source for this bank. SARB-jurisdiction reporting canon \u2014 tenant regulatory posture, though the go-to-source-artifact lesson generalises.",
  },
  {
    decisionId: "D-BA300-LCR-FX-ENRICHMENT",
    class: "directional",
    rationale:
      "Wires FX-rate enrichment and period-close into this bank's BA 300 LCR return. SARB-return wiring for this tenant.",
  },
  {
    decisionId: "D-BALANCE-SHEET-SUBSTANTIATION-POLICY-V1",
    class: "foundational",
    rationale:
      "Adopts a balance-sheet substantiation policy (FIN-BSS-01). Every deposit-taking institution must substantiate its balance sheet; the policy framework generalises to any tenant, with thresholds as tenant config.",
  },
  {
    decisionId: "D-BANK-ACCOUNT-SUBSTRATE",
    class: "foundational",
    rationale:
      "Establishes the bank-account event family and master/balance projections \u2014 core account mechanics every tenant bank needs, derived from events per Principle 1.",
    citations: ["Principles/1-events-are-truth.md"],
  },
  {
    decisionId: "D-BANK-NAME-FALLBACK",
    class: "directional",
    rationale:
      "Pre-clears fallback name candidates (Lucet, Noeta, Synaps) in parallel with the Hoz s.22 clearance. Pure tenant identity matter.",
  },
  {
    decisionId: "D-BANK-NAME-SELECTION",
    class: "obsolete",
    rationale:
      "Latest phase is superseded \u2014 the original name-selection seed record was replaced by later naming decisions.",
  },
  {
    decisionId: "D-BANK-STRATEGY-V1",
    class: "obsolete",
    rationale:
      "Superseded by D-BANK-STRATEGY-V2, the operative strategy with the machine-extractable typed-scope appendix.",
    citations: ["D-BANK-STRATEGY-V2"],
  },
  {
    decisionId: "D-BANK-STRATEGY-V2",
    class: "directional",
    rationale:
      "This bank's operative institutional strategy (scope inclusions/exclusions, mandate). Quintessentially tenant-directional; the typed-scope appendix mechanism is the extractable pattern.",
  },
  {
    decisionId: "D-BASEL-CATALOGUE-PILLAR-1",
    class: "foundational",
    rationale:
      "Catalogues the Basel Framework as the prudential baseline and localises it via a typed adoption layer. The catalogue-plus-typed-adoption mechanism is exactly how any tenant in any jurisdiction binds to Basel.",
  },
  {
    decisionId: "D-BCBS-239-RDARR-INGESTION",
    class: "foundational",
    rationale:
      "Ingests BCBS 239 (RDARR) and its SA transposition into the reference plane. Global-standard reference content plus the cross-jurisdiction TRANSPOSES pattern \u2014 reusable by any tenant.",
  },
  {
    decisionId: "D-BCBS-OBJECTIVE-LAYER-INGESTION",
    class: "foundational",
    rationale:
      "Wires the Basel mandate and objectives over the existing BCBS obligations. Global reference-plane content; the regulator-objective layer generalises across tenants.",
  },
  {
    decisionId: "D-BOND-RAS-APPETITE",
    class: "directional",
    rationale:
      "Calibrates this bank's bond-inventory cap and IRRBB delta-EVE outlier appetite lines. RAS calibration \u2014 tenant risk posture.",
  },
  {
    decisionId: "D-BRC-INTERIM-MR-1-FX",
    class: "directional",
    rationale:
      "Sets interim MR-1-FX risk limits with the CEO acting as interim BRC. Tenant limit calibration under build-phase governance.",
  },
  {
    decisionId: "D-BUILD-PHASE-EVENT-RESET",
    class: "directional",
    rationale:
      "One-off wipe of this bank's build-phase trade and GL activity. Tenant data history, not a reusable rule.",
  },
  {
    decisionId: "D-BUILD-PHASE-SYNTHETIC-RESPONSE",
    class: "foundational",
    rationale:
      "Requires that a build-phase breach trigger a build-phase synthetic response \u2014 the rehearsed-readiness discipline that makes a pre-licence backbone exercise its controls end-to-end. Generalises to any tenant's build phase.",
  },
  {
    decisionId: "D-CAE-AUDIT-UNIVERSE-V1",
    class: "directional",
    rationale:
      "Defines this bank's inaugural 4-domain audit universe. Tenant audit-plan content; the audit-universe structure is the extractable template.",
  },
  {
    decisionId: "D-CANCEL-OVERSIZED-MANUAL-SIM-2026-06-01",
    class: "directional",
    rationale:
      "Cancels 12 oversized simulated FX trades booked with implausible notionals. One-off tenant data correction.",
  },
  {
    decisionId: "D-CANCEL-WRONG-COUNTER-NOTIONAL",
    class: "directional",
    rationale:
      "Mass-cancels 159 FX trades affected by a counter-notional bug. One-off tenant data correction.",
  },
  {
    decisionId: "D-CCO-RMCP-FRAMEWORK-V1",
    class: "directional",
    rationale:
      "Adopts the 4-pillar FIC Act RMCP compliance programme. SA-jurisdiction AML posture for this tenant.",
  },
  {
    decisionId: "D-CFO-BSS-2026-05-SEED-NOSTRO-AGED-EXCEPTION",
    class: "directional",
    rationale:
      "CFO documented exception for specific aged nostro items in one substantiation cycle. Point-in-time tenant accounting judgement.",
  },
  {
    decisionId: "D-CFO-IFRS9-ECL-GENERAL-APPROACH",
    class: "directional",
    rationale:
      "This bank's IFRS 9 accounting-policy election (general approach ECL). Tenant accounting posture; another tenant may elect differently.",
  },
  {
    decisionId: "D-CI-GATE-INTEGRITY",
    class: "foundational",
    rationale:
      "Establishes CI-gate integrity discipline (test isolation from the canonical store, gates that mean what they assert). Engineering-substrate hygiene any tenant build inherits.",
  },
  {
    decisionId: "D-CI-GITHUB-PLAN-UPGRADE-DEFER",
    class: "directional",
    rationale:
      "Defers a GitHub plan upgrade, relying on agent discipline instead of branch protection. Build-phase tooling economics for this tenant.",
  },
  {
    decisionId: "D-CISO-JS2-PROGRAMME-FRAMEWORK",
    class: "directional",
    rationale:
      "Adopts SA Joint Standard 2 of 2024 as the cyber-security mandate. SA-jurisdiction regulatory binding; the programme-framework shape is extractable.",
  },
  {
    decisionId: "D-COA-CURRENCY-DECOUPLING",
    class: "directional",
    rationale:
      "Restructures this bank's chart of accounts (currency decoupling, reserve account, USD/EUR merge). Tenant CoA design.",
  },
  {
    decisionId: "D-COMP-FRAMEWORK-SIX-SEATS",
    class: "directional",
    rationale:
      "Seed approval of this bank's six-seat compensation framework. Tenant people/governance posture.",
  },
  {
    decisionId: "D-COMPLETENESS-AUDIT-WORKSTREAM",
    class: "foundational",
    rationale:
      "Stands up continuous third-line assurance against silent incompleteness (6-class taxonomy, inert-module gate). A standing audit pattern over the backbone itself \u2014 any tenant deployment needs it.",
  },
  {
    decisionId: "D-COO-OPERATIONAL-RESILIENCE-SCENARIO-FRAMEWORK-V1",
    class: "foundational",
    rationale:
      "Adopts an operational-resilience scenario design framework. The framework (scenario taxonomy, severity laddering) generalises; specific scenarios are tenant calibration.",
  },
  {
    decisionId: "D-CORRECT-DUPLICATE-MTM-REVERSALS",
    class: "directional",
    rationale:
      "Corrects duplicate MTM reversal postings on one account on one date. One-off tenant data correction.",
  },
  {
    decisionId: "D-CREDIT-RISK-CAPITAL-APPROACH-V1",
    class: "directional",
    rationale:
      "Elects the Standardised Approach and declines IRB. Tenant capital posture \u2014 another tenant may pursue IRB.",
  },
  {
    decisionId: "D-CRO-CLIMATE-FLUENCY",
    class: "directional",
    rationale:
      "Sets climate-risk fluency as Preferred (not Must-have) for the human CRO seat. Tenant hiring posture.",
  },
  {
    decisionId: "D-CROSS-WORKTREE-EVENT-STORE-SYNC",
    class: "foundational",
    rationale:
      "Single shared event store mounted across dispatch worktrees, with typed escape-valve alerts. Core event-store mechanics, structurally identical to the cloud target \u2014 pure backbone.",
    citations: ["Principles/1-events-are-truth.md"],
  },
  {
    decisionId: "D-DATA-PROVENANCE-SUBSTRATE",
    class: "foundational",
    rationale:
      "Charters the data-provenance substrate (ProvenanceTag, production/simulated separation). Foundational: any tenant backbone must distinguish real from rehearsal data at the type level.",
  },
  {
    decisionId: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-2",
    class: "foundational",
    rationale:
      "Provenance Slice 2 \u2014 projection-runtime mode selection and filtering. Backbone provenance mechanics.",
    citations: ["D-DATA-PROVENANCE-SUBSTRATE"],
  },
  {
    decisionId: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-3",
    class: "foundational",
    rationale:
      "Provenance Slice 3 \u2014 output watermarking plus recon. Backbone provenance mechanics.",
    citations: ["D-DATA-PROVENANCE-SUBSTRATE"],
  },
  {
    decisionId: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-6-1",
    class: "foundational",
    rationale:
      "Provenance Slices 6+1 \u2014 backfill, ProvenanceTag envelope, flag-gated append-rejection. Backbone provenance mechanics.",
    citations: ["D-DATA-PROVENANCE-SUBSTRATE"],
  },
  {
    decisionId: "D-DATA-QUALITY-CROSS-DOMAIN-V1",
    class: "foundational",
    rationale:
      "Cross-domain consistency plan across Risk, Accounting, Liquidity, Ops. Data-quality recon architecture over the shared event log \u2014 generalises to any tenant.",
  },
  {
    decisionId: "D-DATA-QUALITY-GOLDEN-SOURCE-V1",
    class: "foundational",
    rationale:
      "Golden-source enforcement so every rendered figure derives from one canonical source. Core single-source-of-truth discipline of the backbone.",
    citations: ["Principles/1-events-are-truth.md"],
  },
  {
    decisionId: "D-DCAM",
    class: "foundational",
    rationale:
      "Completes the DCAM taxonomy mapping (ProductFamily to L1/L2/L3 scope codes). Industry-standard data-management taxonomy applied to the platform's product model \u2014 reusable across tenants.",
  },
  {
    decisionId: "D-DECISIONS-FRAMEWORK-REDESIGN",
    class: "foundational",
    rationale:
      "Unifies all decision records into the single Decision event family with phases, authorities, and categories. The governance spine of the backbone \u2014 this distillation exercise itself runs on it.",
  },
  {
    decisionId: "D-DISPATCH-MULTI-HOST-POSTGRES-MIRROR-AUTO-INVOKE",
    class: "foundational",
    rationale:
      "Best-effort Postgres mirror of the event store with no-op fallback for dispatch. Event-store scaling/replication mechanics on the cloud path.",
  },
  {
    decisionId: "D-DISPATCH-SYNC-PRIMITIVE",
    class: "foundational",
    rationale:
      "Reviewer/decider run topology with blocking semantics and a retrospective recon gate. Dispatch-lifecycle mechanics of the agent substrate \u2014 pure backbone.",
  },
  {
    decisionId: "D-EVENT-STORE-ARCHIVE-GAP-RECOVERY",
    class: "directional",
    rationale:
      "Recovers a specific archive-tier sequence gap (203832-222995) and registers orphan archives in this bank's store. One-off tenant data-integrity remediation; the archive-integrity recon it satisfied is the standing piece.",
  },
  {
    decisionId: "D-EVENT-STORE-SCALING",
    class: "foundational",
    rationale:
      "Charters event-store scaling (retention metadata, archival tiers, snapshot cadence). Core backbone storage architecture.",
  },
  {
    decisionId: "D-EVENT-STORE-SCALING-SLICE-3B",
    class: "foundational",
    rationale:
      "Removes materialised dashboard state from the commit graph; recon derives from sources directly. Projections-not-stored-state discipline (Principle 1).",
    citations: ["Principles/1-events-are-truth.md"],
  },
  {
    decisionId: "D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION",
    class: "foundational",
    rationale:
      "Sanctions selective archive-extraction as THE remediation mechanism for test-fixture pollution in a canonical append-only store. A reusable backbone mechanism, not a one-off fix.",
  },
  {
    decisionId: "D-EVENT-VIEW-BOUNDARY-WIRE",
    class: "foundational",
    rationale:
      "Wires the event-view boundary for policy activation, official marks, and period close. Event-of-record boundary mechanics every tenant inherits.",
  },
  {
    decisionId: "D-EXTERNAL-COUNSEL",
    class: "directional",
    rationale:
      "Defers external legal counsel engagement to the SARB pre-application gate. Tenant licence-path sequencing.",
  },
  {
    decisionId: "D-FAIS-ANALYSIS-V1",
    class: "directional",
    rationale:
      "FAIS Act analysis and obligations-register update. SA-jurisdiction regulatory analysis for this tenant.",
  },
  {
    decisionId: "D-FIC-REGULATORY-INTELLIGENCE-INGESTION",
    class: "directional",
    rationale:
      "Ingests FIC (SA AML regulator) instruments into the objective layer. SA-jurisdiction source acquisition; the ingestion pattern itself is foundational and was set by the objective-layer decision.",
    citations: ["D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER"],
  },
  {
    decisionId: "D-FIL-FRAMEWORK-UNIFICATION",
    class: "foundational",
    rationale:
      "Unifies the instrument language and model library into one FIL Framework — facets as interfaces, models as their versioned citable implementations; one boundary spec for any tenant.",
    citations: ["D-V2-BBAAS-W9-FIL", "D-V2-BBAAS-W4-W7-DISPATCH"],
  },
  {
    decisionId: "D-FINANCIAL-INSTRUMENT-ENTITY",
    class: "foundational",
    rationale:
      "Establishes the FinancialInstrument master-record schema and cross-asset integration. A canonical instrument entity is core backbone data architecture for any tenant.",
  },
  {
    decisionId: "D-FIRST-DRY-RUN-SCENARIO",
    class: "directional",
    rationale:
      "Approves this bank's first dry-run scenario. Tenant rehearsal content; the scenario substrate is covered by D-SCENARIO-CLOCK.",
  },
  {
    decisionId: "D-FLEET-ROLLOUT-SEQUENCING",
    class: "directional",
    rationale:
      "Sequences the rollout of this bank's agent fleet. Tenant deployment ordering, not substrate mechanics.",
  },
  {
    decisionId: "D-FOLLOW-ON-ROUTER-TEST",
    class: "obsolete",
    rationale:
      "Latest phase is withdrawn \u2014 a substrate smoke test of the follow-on router, withdrawn once verified.",
  },
  {
    decisionId: "D-FSCA-REGULATORY-INTELLIGENCE-INGESTION",
    class: "directional",
    rationale:
      "Ingests FSCA (SA market-conduct regulator) instruments into the objective layer. SA-jurisdiction source acquisition on the foundational objective-layer pattern.",
    citations: ["D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER"],
  },
  {
    decisionId: "D-FSP-LICENCE-NECESSITY",
    class: "directional",
    rationale:
      "Counterparty institutional-eligibility screening v0 tied to SA FSP licensing. Tenant regulatory perimeter.",
  },
  {
    decisionId: "D-FX-AD-STATUS",
    class: "directional",
    rationale:
      "Pursues Full Authorised Dealer status under the SA Currency and Exchanges Act. Tenant regulatory posture.",
  },
  {
    decisionId: "D-FX-BOOK-BOUNDARY",
    class: "directional",
    rationale:
      "Adopts the explicit-tag-at-execution model for this bank's FX trading/banking book boundary. Product-level modelling choice; the pattern is extractable but the election is tenant-specific.",
  },
  {
    decisionId: "D-FX-CCR-INTERIM-CONSERVATIVE-RWA",
    class: "directional",
    rationale:
      "Interim conservative 100% RWA weighting for FX/IRS counterparty credit pending classification. Tenant prudential interim measure, later replaced by the classification substrate.",
    citations: ["D-FX-COUNTERPARTY-BASEL-CLASSIFICATION"],
  },
  {
    decisionId: "D-FX-CHAIN-CLOSURE-DISPATCH",
    class: "directional",
    rationale:
      "Dispatches the CoSec chain-closure sweep over this bank's 47 FX obligations. Tenant FX-programme work dispatch.",
  },
  {
    decisionId: "D-FX-CLS-MEMBERSHIP",
    class: "directional",
    rationale:
      "Elects indirect CLS access via correspondent. Tenant settlement-infrastructure posture.",
  },
  {
    decisionId: "D-FX-CONDUCT-SURVEILLANCE-REMEDIATION-DISPATCH",
    class: "directional",
    rationale:
      "Dispatches the CCO to wire this bank's inert conduct-surveillance handler (best-execution, FAIS suitability). Tenant remediation dispatch.",
  },
  {
    decisionId: "D-FX-CORRESPONDENT-PAIR-NAMING",
    class: "directional",
    rationale:
      "Seed approval of this bank's FX correspondent-pair naming convention. Tenant operational convention.",
  },
  {
    decisionId: "D-FX-COUNTERPARTY-BASEL-CLASSIFICATION",
    class: "foundational",
    rationale:
      "Replaces an RWA-code hardcode with an authoritative counterparty Basel-classification substrate (CounterpartyBaselClassAssigned). Counterparty classification driving capital is backbone mechanics any tenant needs.",
  },
  {
    decisionId: "D-FX-COUNTERPARTY-SCOPE-INSTITUTIONAL",
    class: "directional",
    rationale:
      "Restricts the FX OTC umbrella to institutional/professional counterparties. Tenant product-scope election.",
  },
  {
    decisionId: "D-FX-CROSS-PAIR-CASH-COST-BASIS",
    class: "directional",
    rationale:
      "Imputes ZAR cost basis for cross-pair FX cash positions. Tenant accounting treatment within its functional-currency setup.",
  },
  {
    decisionId: "D-FX-CROSS-PAIRS-PRODUCTION-INGEST",
    class: "directional",
    rationale:
      "Ingests EUR/USD and GBP/USD as production market data for this bank's cross positions. Tenant market-data scope.",
  },
  {
    decisionId: "D-FX-EAD-FX-CONVERSION",
    class: "directional",
    rationale:
      "Converts non-ZAR SA-CCR EAD to functional currency before CreditRWA. Correct-calculation fix expressed against this tenant's functional currency; the rule generalises but lives in the engine.",
  },
  {
    decisionId: "D-FX-FORWARDS-TRADING-FVTPL",
    class: "directional",
    rationale:
      "Classifies FX forwards/swaps on this bank's umbrella product as trading (FVTPL), not hedge-designated. Tenant accounting election.",
  },
  {
    decisionId: "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS",
    class: "directional",
    rationale:
      "Calibrates pre-trade gateway capital-impact and funding thresholds. Tenant risk-gate calibration.",
  },
  {
    decisionId: "D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED",
    class: "directional",
    rationale:
      "Makes this bank's FX pre-trade credit-limit check fail-closed. Tenant control posture; fail-closed-by-default is the extractable principle.",
  },
  {
    decisionId: "D-FX-HELD-DIMS-SEAT-SWEEP",
    class: "directional",
    rationale:
      "Routes held NPA dimensions to owning seats and closes quick-win deferred gaps on the FX product. Tenant product-programme management.",
  },
  {
    decisionId: "D-FX-MESSAGE-EVENTS",
    class: "directional",
    rationale:
      "Wires this bank's FX settlement messaging (MT202/MT103/MT300/pacs) into the event log. Product wiring for this tenant; message generation as events is the extractable pattern.",
  },
  {
    decisionId: "D-FX-MTM-REVAL-ON-BOOKING",
    class: "directional",
    rationale:
      "Auto-triggers FX position revaluation inline on each booking. Tenant processing-cadence choice.",
  },
  {
    decisionId: "D-FX-NOP-SLA-CITATION-D5-MIGRATION",
    class: "obsolete",
    rationale:
      "Migrated FX NOP SLA citations onto the D5/2025 return schedule, which was subsequently found fabricated and superseded by the Excel-canonical numbering.",
    citations: ["D-BA-RETURN-NUMBERING-EXCEL-CANONICAL"],
  },
  {
    decisionId: "D-FX-NPA-VERIFICATION-PASS-2-DISPATCH",
    class: "directional",
    rationale:
      "Dispatches per-dimension NPA verification pass v2 for this bank's FX product. Tenant product-approval programme step.",
  },
  {
    decisionId: "D-FX-OTC-NPA-SCOPE-EXPANSION",
    class: "directional",
    rationale:
      "Broadens this bank's FX NPA to the umbrella OTC vanilla product (Spot/Forward/Swap). Tenant product approval.",
  },
  {
    decisionId: "D-FX-QUOTING-CONVENTION",
    class: "directional",
    rationale:
      "Standardises the FX quoting calculator across this bank's five message generators. Tenant convention; single-calculator discipline is the extractable pattern.",
  },
  {
    decisionId: "D-FX-SA-CCR-BUILD-PHASE-ACTIVATION",
    class: "directional",
    rationale:
      "Activates SA-CCR for FX with simulated netting sets during the build phase. Tenant build-phase risk activation.",
  },
  {
    decisionId: "D-FX-SALES-TRADING-FRONTEND",
    class: "directional",
    rationale: "Seed approval for this bank's FX sales and trading frontend. Tenant channel build.",
  },
  {
    decisionId: "D-FX-SALES-TRADING-FRONTEND-SLICE-1",
    class: "directional",
    rationale: "FX frontend Slice 1 (UI shell, counterparty picker). Tenant channel build.",
  },
  {
    decisionId: "D-FX-SALES-TRADING-FRONTEND-SLICE-2",
    class: "directional",
    rationale: "FX frontend Slice 2 (RFQ form, trade-emit). Tenant channel build.",
  },
  {
    decisionId: "D-FX-SIM-FRONTEND-INPUT-DRIVER",
    class: "directional",
    rationale:
      "Routes simulated counterparty trades through the real front-end form via a browser driver. Tenant rehearsal tooling; exercising production paths in rehearsal is the extractable principle.",
  },
  {
    decisionId: "D-FX-SUBLEDGER-LEGACY-RECONCILIATION",
    class: "directional",
    rationale:
      "Reconciles this bank's legacy FX sub-ledger accounts. One-off tenant accounting cleanup.",
  },
  {
    decisionId: "D-FX-SUBLEDGER-REBUILD",
    class: "directional",
    rationale:
      "Rebuilds the FX sub-ledger cash leg on ACC-1100-001. One-off tenant accounting remediation.",
  },
  {
    decisionId: "D-FX-SUBLEDGER-WRITEOFF-CFO",
    class: "directional",
    rationale:
      "CFO write-off of build-phase FX sub-ledger residue. One-off tenant accounting judgement.",
  },
  {
    decisionId: "D-FX-SUPPORTED-CURRENCY-SET-V1",
    class: "directional",
    rationale:
      "Fixes this bank's supported FX currency set at 7 majors with suspense+alert routing beyond. Tenant product scope; the formalise-don't-expand guard is the extractable pattern.",
  },
  {
    decisionId: "D-G2-ENTITY-ID-BACKFILL",
    class: "directional",
    rationale:
      "Backfills the deprecated BANK-ZA-001 entity-id to LE-ZA-HOZ-BANK across affected events. One-off tenant data migration.",
  },
  {
    decisionId: "D-GOAL-LOOP-SHARED-DISPATCH-MIGRATION-AND-BLOCKED-DRAIN",
    class: "foundational",
    rationale:
      "Migrates cohort goal-loops onto the shared brief-dispatch path and drains the blocked scopes. Goal-loop/dispatch mechanics of the agent substrate \u2014 backbone plumbing.",
  },
  {
    decisionId: "D-GROUP-STRUCTURE",
    class: "directional",
    rationale:
      "Defines this group's legal-entity tree v0 (Hoz Group, Hoz Bank, Hoz Securities). Tenant structure; the versioned legal-entity-tree mechanism is Principle 5 substrate.",
    citations: ["Principles/5-multi-currency-entity-country.md"],
  },
  {
    decisionId: "D-HIRE-COMPANY-SECRETARY",
    class: "directional",
    rationale: "Hires the Company Secretary seat. Tenant team composition.",
  },
  {
    decisionId: "D-HIRE-COMPLIANCE-LEAD",
    class: "directional",
    rationale: "Hires the compliance lead seat. Tenant team composition.",
  },
  {
    decisionId: "D-HIRE-HUMAN-CRO",
    class: "directional",
    rationale: "Approves the human CRO hire path. Tenant team composition.",
  },
  {
    decisionId: "D-HIRE-INDEPENDENT-CHAIR",
    class: "directional",
    rationale: "Approves the independent chair hire path. Tenant board composition.",
  },
  {
    decisionId: "D-HIRE-NED-2",
    class: "directional",
    rationale: "Approves NED 2 hire path. Tenant board composition.",
  },
  {
    decisionId: "D-HIRE-NED-3",
    class: "directional",
    rationale: "Approves NED 3 hire path. Tenant board composition.",
  },
  {
    decisionId: "D-HIRE-SIX-SEATS-PACK",
    class: "directional",
    rationale:
      "Approves the six governance-seat hiring pack. Tenant team composition; the governance-seat taxonomy itself is reusable.",
  },
  {
    decisionId: "D-HOZ-DOMAIN-REGISTRATION-SET",
    class: "directional",
    rationale: "Registers this bank's domain names. Pure tenant identity.",
  },
  {
    decisionId: "D-HQLA-CASH-CUSTODIAN-DERIVED",
    class: "directional",
    rationale:
      "Derives cash HQLA tier from custodian Party classification rather than an authored CoA tag. Modelling choice in this tenant's liquidity stack; derive-don't-author is the extractable principle.",
  },
  {
    decisionId: "D-HQLA-COA-CLASSIFICATION",
    class: "directional",
    rationale:
      "Adds HQLA classification fields to this bank's CoA and a dynamic HQLA scan. Tenant liquidity-reporting wiring.",
  },
  {
    decisionId: "D-IASB-REGULATORY-INTELLIGENCE-INGESTION",
    class: "foundational",
    rationale:
      "Ingests IASB/IFRS instruments into the objective layer. Global accounting-standards reference content reusable by any tenant.",
    citations: ["D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER"],
  },
  {
    decisionId: "D-IFRS-THRESHOLDS-CFO-RATIFY-NEXT-ICAAP",
    class: "directional",
    rationale:
      "Schedules CFO ratification of SICR/materiality thresholds at the next ICAAP cycle. Tenant accounting-policy governance cadence.",
  },
  {
    decisionId: "D-IFRS-THRESHOLDS-V13",
    class: "directional",
    rationale:
      "Approves this bank's IFRS quantitative threshold amendments (v1.3). Tenant accounting calibration.",
  },
  {
    decisionId: "D-IFRS9-STAGING-V1",
    class: "foundational",
    rationale:
      "Builds the IFRS 9 staging engine v1. The staging engine is backbone accounting machinery every IFRS tenant needs; the simplified build-phase rules are tenant calibration.",
  },
  {
    decisionId: "D-INFOREG-REGULATORY-INTELLIGENCE-INGESTION",
    class: "directional",
    rationale:
      "Ingests SA Information Regulator (POPIA/PAIA) instruments into the objective layer. SA-jurisdiction source acquisition on the foundational pattern.",
    citations: ["D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER"],
  },
  {
    decisionId: "D-INTRADAY-RAS-APPETITE",
    class: "directional",
    rationale:
      "Calibrates the intraday-liquidity appetite line (BCBS 248 bands, R50m floor). Tenant RAS calibration.",
  },
  {
    decisionId: "D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22",
    class: "directional",
    rationale:
      "Sets IPV tolerance tiers for FX Spot (0.75%/1.00%). Tenant valuation-control calibration.",
  },
  {
    decisionId: "D-IRRBB-DELTA-EVE-OUTLIER-MEASUREMENT",
    class: "directional",
    rationale:
      "Builds the delta-EVE outlier measurement for this bank's RAS B4 line. Tenant risk-measurement wiring resolving a specific unmeasured-line escalation.",
  },
  {
    decisionId: "D-KG-GRAPHITI-SPIKE-FX-SPOT",
    class: "foundational",
    rationale:
      "Spikes Graphiti as the unified knowledge-graph substrate on the FX-Spot slice. Knowledge-graph substrate evaluation \u2014 part of the single-graph backbone lineage (Principle 2).",
    citations: ["Principles/2-single-graph-discipline.md"],
  },
  {
    decisionId: "D-LCR-TILE-PROVENANCE",
    class: "directional",
    rationale:
      "Sets which provenance classes this bank's LCR dashboard tile counts. Tenant build-phase rendering choice on top of the provenance substrate.",
  },
  {
    decisionId: "D-LEGAL-ENTITY-TREE-V0",
    class: "directional",
    rationale:
      "Seed approval of this group's legal-entity tree v0. Tenant structure on the Principle 5 mechanism.",
    citations: ["Principles/5-multi-currency-entity-country.md"],
  },
  {
    decisionId: "D-LICENCE-TYPE",
    class: "directional",
    rationale: "Elects a full South African bank licence (SARB PA). Tenant regulatory posture.",
  },
  {
    decisionId: "D-M4-FX-SUB-DECISIONS",
    class: "directional",
    rationale: "Seed approval of the M4 FX sub-decision pack. Tenant FX product-programme content.",
  },
  {
    decisionId: "D-MARKET-CONDUCT",
    class: "directional",
    rationale:
      "Ghost placeholder (referenced, no owning record) standing in for this bank's market-conduct posture. Tenant regulatory posture reference.",
  },
  {
    decisionId: "D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING",
    class: "foundational",
    rationale:
      "Hardens production/simulated isolation in the MarketDataStore (production-only by default). Provenance-isolation mechanics of the backbone data plane.",
  },
  {
    decisionId: "D-MARKETS-CAPEX-OVERRUN-REVIEW",
    class: "directional",
    rationale: "Seed approval of a markets capex overrun review. Tenant cost-governance episode.",
  },
  {
    decisionId: "D-MARKETS-CAPITAL-TIME-SHAPE",
    class: "directional",
    rationale:
      "Adopts the capital time-shape framework in this bank's ICAAP/ILAAP paper v1. Tenant capital-planning content.",
  },
  {
    decisionId: "D-MARKETS-SCHEMA-FOUNDATION",
    class: "foundational",
    rationale:
      "Lays the markets event-schema foundation (trade/position/lifecycle families). Core backbone schema for any tenant running markets activity; the title's idempotency-test annotation reflects re-emission testing, not content.",
  },
  {
    decisionId: "D-MODEL-REGISTRY-SCOPE-CLOSURE-V1",
    class: "directional",
    rationale:
      "Registers this bank's Tier-1 models (RWA build, IFRS 9 ECL suite) to close a registry scope gap. Tenant model inventory on the foundational model-registry substrate.",
  },
  {
    decisionId: "D-MR-PROC-S8-2-APPROVE",
    class: "directional",
    rationale: "CRO approval of four market-risk procedures. Tenant procedure content.",
  },
  {
    decisionId: "D-MR-PROC-S8-2-V11-APPROVE",
    class: "directional",
    rationale: "CRO approval of market-risk procedure v1.1 amendments. Tenant procedure content.",
  },
  {
    decisionId: "D-NEW-PRODUCT-APPROVAL-POLICY",
    class: "obsolete",
    rationale:
      "Superseded by D-NEW-PRODUCT-APPROVAL-POLICY-V2, which binds attestation to liveness and closes the v1 coverage holes.",
    citations: ["D-NEW-PRODUCT-APPROVAL-POLICY-V2"],
  },
  {
    decisionId: "D-NEW-PRODUCT-APPROVAL-POLICY-V2",
    class: "foundational",
    rationale:
      "NPA Policy v2 binds implementation-attestation to live completeness recon and forward-tracks deferrals. A product-approval gate framework any tenant needs; specific product NPAs remain tenant decisions.",
  },
  {
    decisionId: "D-NPA-APPROVAL-POLICY",
    class: "obsolete",
    rationale:
      "Ghost placeholder (referenced, no owning record) for the NPA policy; the owning records are D-NEW-PRODUCT-APPROVAL-POLICY and its operative v2 successor.",
    citations: ["D-NEW-PRODUCT-APPROVAL-POLICY-V2"],
  },
  {
    decisionId: "D-NPA-FX-SPOT-INTERNAL-TEST",
    class: "directional",
    rationale: "Approves FX-spot for internal pre-licence test scope. Tenant product approval.",
  },
  {
    decisionId: "D-OBLIGATION-DECOMPOSITION-PARAGRAPH-LEVEL",
    class: "foundational",
    rationale:
      "Adopts paragraph-level decomposition (one obligation per normative paragraph) for the obligation knowledge base. Reference-plane modelling standard reusable across tenants and regulators.",
  },
  {
    decisionId: "D-OBLIGATION-FOOTNOTE-REPRESENTATION",
    class: "foundational",
    rationale:
      "Represents footnotes as separate structured elements, never inline-concatenated. Reference-plane data-modelling standard for the regulatory library.",
  },
  {
    decisionId: "D-OBLIGATION-REVIEW-SUBSTRATE",
    class: "foundational",
    rationale:
      "Builds the obligation-review event substrate with advisory recon for LLM-extracted obligations. Regulatory-intelligence pipeline mechanics of the backbone.",
  },
  {
    decisionId: "D-OBLIGATIONS-REGISTER-CLEANUP",
    class: "foundational",
    rationale:
      "Beyond cleaning this bank's register, establishes the SA-BCBS equivalence model (ObligationEquivalenceClassified, EQUIVALENT_TO/CONFLICTS_WITH edges, divergence recon) \u2014 the cross-jurisdiction equivalence mechanism any multi-jurisdiction tenant needs.",
  },
  {
    decisionId: "D-ONTOLOGY-REG-EXTRACTION-PHASE-1",
    class: "foundational",
    rationale:
      "Phase 1 of the regulatory ontology: extraction, URN normalisation, obligation substrate. The regulatory-knowledge backbone's founding build.",
  },
  {
    decisionId: "D-OPEN-THREADS-CLOSEOUT-2026-06-09",
    class: "directional",
    rationale:
      "Batch closeout of this bank's open threads (IRS disallowances, formId reconciliation, seven audit findings). Tenant work-queue management.",
  },
  {
    decisionId: "D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE",
    class: "foundational",
    rationale:
      "Separates lineage from inclusion with a settable bank-wide prod/sim mode and per-category granularity over one canonical operating book. Core provenance architecture of the backbone.",
  },
  {
    decisionId: "D-OPRISK-ENGINEER-ROLE",
    class: "directional",
    rationale:
      "Subsumes the operational-risk engineer role into Rohan's roster. Tenant team-shape choice.",
  },
  {
    decisionId: "D-OWNER-INBOX-AUTO-ARCHIVE",
    class: "obsolete",
    rationale:
      "Automated archiving of Owner Inbox decision cards \u2014 the Owner Inbox mechanism itself was retired by RMS Phase 4, overtaking this decision.",
    citations: ["D-RMS-PHASE-4-ARCHIVE-SCOPE"],
  },
  {
    decisionId: "D-PA-COMMUNICATIONS-FULL-HISTORICAL-SWEEP",
    class: "directional",
    rationale:
      "Full historical sweep of SARB PA communications into the obligations register. SA-jurisdiction source acquisition.",
  },
  {
    decisionId: "D-PA-COMMUNICATIONS-REGISTER-UPDATE",
    class: "directional",
    rationale:
      "PA communications survey and register expansion. SA-jurisdiction source acquisition.",
  },
  {
    decisionId: "D-PA-EXTRACT-QUALITY-REMEDIATION",
    class: "directional",
    rationale:
      "Remediates four defect classes in this bank's SARB PA extracts. SA-jurisdiction source-quality work; the extract-quality scoring gate is the extractable pattern.",
  },
  {
    decisionId: "D-PA-OBLIGATION-ADOPTION",
    class: "directional",
    rationale:
      "Adopts obligations for all currently-effective SARB PA binding instruments. SA-jurisdiction obligation adoption \u2014 quintessential tenant regulatory binding.",
  },
  {
    decisionId: "D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION",
    class: "directional",
    rationale:
      "Re-extracts poor-quality SARB PA directives and stands up an enforcing quality gate. SA-jurisdiction source work; the quality-gate pattern generalises.",
  },
  {
    decisionId: "D-PA-SOURCE-EXTRACT-RECOVERY-WAVE-2",
    class: "directional",
    rationale:
      "Wave-2 re-extraction of mangled/thin SARB PA instruments plus quality-gate tightening. SA-jurisdiction source work, sibling of wave 1; the extract-quality pattern generalises.",
  },
  {
    decisionId: "D-PARTY-REGISTER",
    class: "foundational",
    rationale:
      "Party register v0 \u2014 the unified identity axis across natural persons, legal entities, counterparties, and agents. Core backbone identity architecture.",
  },
  {
    decisionId: "D-PARTY-REGISTER-CORRECTION",
    class: "foundational",
    rationale:
      "Corrects the party-register decision record (retracts an F-032 closure prediction). Travels with the foundational register's decision lineage as its accuracy correction.",
    citations: ["D-PARTY-REGISTER"],
  },
  {
    decisionId: "D-PARTY-RELATIONSHIP-KINDS-V0",
    class: "foundational",
    rationale:
      "Closed v0 enum of typed Party relationship edges. Identity-graph mechanics of the backbone.",
    citations: ["D-PARTY-REGISTER"],
  },
  {
    decisionId: "D-PNL-ATTR-FTP-CURVE-FIX",
    class: "directional",
    rationale:
      "Fixes the pnl-attribution ftpCurve reader schema mismatch and wires FTP curve publication. Defect fix in this tenant's treasury wiring.",
  },
  {
    decisionId: "D-POLICY-DOCUMENT-HOME",
    class: "foundational",
    rationale:
      "Fixes the canonical home and structure for policy documents. Document-architecture convention of the backbone's governance estate.",
  },
  {
    decisionId: "D-POLICY-NEXT-REVIEW-CONVENTION",
    class: "foundational",
    rationale:
      "Mandates a next-review ISO-date frontmatter field on every policy plus a CI recon gate. Policy-lifecycle discipline reusable by any tenant.",
  },
  {
    decisionId: "D-PRELICENCE-SUBSTRATE-GATES-G3-G4-G5",
    class: "directional",
    rationale:
      "Signs off this bank's pre-licence substrate gates G3/G4/G5. Point-in-time attestation of this tenant's build state.",
  },
  {
    decisionId: "D-PRINCIPLE-2-CAPABILITY-LAYER",
    class: "foundational",
    rationale:
      "Adds the Capability node and REALISES edges, closing the Procedure-to-Capability hop in the single graph. Graph-architecture backbone (Principle 2).",
    citations: ["Principles/2-single-graph-discipline.md"],
  },
  {
    decisionId: "D-PRINCIPLES-P2-P6-MERGE",
    class: "foundational",
    rationale:
      "Merges the citation-discipline and single-graph principles into one Principle 2 and renumbers. Constitutional maintenance of the backbone's principle set.",
    citations: ["Principles/2-single-graph-discipline.md"],
  },
  {
    decisionId: "D-PROACTIVE-ESCALATION-SURFACING",
    class: "foundational",
    rationale:
      "Decision-required items from autonomous runs must reach the accountable human proactively, paired with a call-to-action. Human-oversight escalation discipline of the autonomous backbone (Principle 6).",
    citations: ["Principles/6-autonomous-by-default.md"],
  },
  {
    decisionId: "D-PROCEDURE-REGISTER-FIRST-BATCH",
    class: "directional",
    rationale:
      "Accepts this bank's first ten procedures into the register. Tenant procedure content on the foundational register mechanism.",
  },
  {
    decisionId: "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
    class: "foundational",
    rationale:
      "Builds the policy-attestation runtime, NPA attestations, and attestation-integrity recon. Product-construction substrate mechanics of the backbone.",
    citations: ["D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
  },
  {
    decisionId: "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    class: "foundational",
    rationale:
      "Charters the product-construction substrate (typed product lifecycle, NPA gates). How any tenant constructs and approves products on the backbone.",
  },
  {
    decisionId: "D-PROVENANCE-BUILD-PHASE-CLASS",
    class: "foundational",
    rationale:
      "Introduces the third ProvenanceKind value for build-phase data. Provenance type-system mechanics of the backbone.",
    citations: ["D-DATA-PROVENANCE-SUBSTRATE"],
  },
  {
    decisionId: "D-QUEUE-CLOSEOUT-2026-06-10",
    class: "directional",
    rationale:
      "Closes the full 2026-06-10 open-thread queue across eight runs. Tenant work-queue management batch.",
  },
  {
    decisionId: "D-RAS-B-CLUSTER-CONCENTRATION-LINES",
    class: "directional",
    rationale:
      "Adds FX-settlement and correspondent-bank concentration appetite lines. Tenant RAS calibration.",
  },
  {
    decisionId: "D-RAS-B2-SETTLEMENT-EXPOSURE-FIX",
    class: "directional",
    rationale:
      "Wires the B2 settlement-exposure (Herstatt) measurement and fixes B1 currency conversion. Tenant RAS measurement wiring.",
  },
  {
    decisionId: "D-RAS-B2-SETTLEMENT-EXPOSURE-METHODOLOGY",
    class: "directional",
    rationale:
      "Ratifies the settlement-window (Herstatt) exposure methodology for RAS B2. Tenant risk-measurement methodology election.",
  },
  {
    decisionId: "D-RAS-CLIMATE-SCENARIO-FRAMEWORK",
    class: "directional",
    rationale:
      "Adopts the PA Guidance Note 1 of 2024 climate scenario approach. SA-jurisdiction risk-framework binding for this tenant.",
  },
  {
    decisionId: "D-RAS-LEVERAGE-RATIO-THRESHOLDS",
    class: "directional",
    rationale: "Sets leverage-ratio appetite-line thresholds. Tenant RAS calibration.",
  },
  {
    decisionId: "D-RAS-MARKET-RISK-TAXONOMY-ALIGNMENT",
    class: "directional",
    rationale:
      "Accepts the 94-code risk taxonomy into this bank's RAS framework. Tenant taxonomy adoption; the taxonomy itself is reusable reference content.",
  },
  {
    decisionId: "D-RECON-CLIENT-ENTITYNAME-UNIQUENESS",
    class: "foundational",
    rationale:
      "Adds a uniqueness recon gate plus projection-level invariant for client entity names. Recon-gate pattern guarding a backbone data invariant.",
  },
  {
    decisionId: "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
    class: "foundational",
    rationale:
      "Separates regulation-as-reference-data (Plane A) from the bank's adoption events (Plane B) with DERIVES_FROM bridges. The foundational regulatory architecture of the backbone \u2014 every tenant binds its own Plane B over a shared Plane A.",
  },
  {
    decisionId: "D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER",
    class: "foundational",
    rationale:
      "Models regulator mandates and objectives as first-class nodes (SERVES/ALIGNS_TO edges) so policies align to intent, not just requirement text. Regulatory-graph architecture reusable for any regulator.",
  },
  {
    decisionId: "D-REGULATORY-LIBRARY-V1",
    class: "foundational",
    rationale:
      "Golden-source acquisition, section-level extraction, and full backward obligation traceability with enforcing coverage gates. The regulatory-library machinery of the backbone; specific source sets are per-jurisdiction config.",
  },
  {
    decisionId: "D-REGULATORY-PERIMETER",
    class: "directional",
    rationale:
      "Shared-board posture with per-entity statutory officers for this group. Tenant governance/regulatory structure.",
  },
  {
    decisionId: "D-REGULATORY-READINESS-GATE-PLAN",
    class: "directional",
    rationale:
      "Plans this bank's SARB licence-readiness gates. Tenant licence path; the gate-plan structure is the extractable template.",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W1-SLICE-1",
    class: "directional",
    rationale:
      "Maps the RMCP attestable spec to FIC s.42(2)(a)-(j). SA-jurisdiction readiness work.",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W2-SLICE-1",
    class: "directional",
    rationale:
      "ICAAP/ILAAP/Recovery framework slice for this bank's readiness programme. Tenant prudential-readiness content.",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W2-SLICE-2",
    class: "directional",
    rationale:
      "RAS B2 calibration and CET1 management-buffer ratification. Tenant capital calibration.",
  },
  {
    decisionId: "D-REGULATORY-READINESS-W2-SLICE-4",
    class: "directional",
    rationale:
      "Stress-projection engine, Pillar-2 add-on, ICAAP narrative feed for this bank. Tenant readiness wiring; the stress engine itself leans foundational but was scoped to this ICAAP.",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
    class: "foundational",
    rationale:
      "Charters the reporting capability build (semantic layer, period close, statement rendering). Reporting architecture of the backbone.",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-1",
    class: "foundational",
    rationale: "Semantic-layer registry skeleton. Reporting backbone mechanics.",
    citations: ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"],
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-2",
    class: "foundational",
    rationale:
      "Period-close event family and orchestration. Reporting backbone mechanics every tenant closes periods with.",
    citations: ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"],
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-3",
    class: "directional",
    rationale:
      "First SARB return end-to-end (LCR). SARB-specific return wiring for this tenant, albeit proving the foundational pipeline.",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-4",
    class: "directional",
    rationale:
      "BA 700 capital-adequacy return end-to-end. SARB-specific return wiring for this tenant.",
  },
  {
    decisionId: "D-REPORTING-CAPABILITY-SLICE-6",
    class: "foundational",
    rationale:
      "IFRS statement renderer (BS/IS/CF/Equity/Notes skeleton). IFRS financial-statement rendering generalises to any tenant.",
    citations: ["D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN"],
  },
  {
    decisionId: "D-RETURNS-SUBMISSION-WIRING-WORKSTREAM",
    class: "directional",
    rationale:
      "Workstream to wire the remaining inert SARB returns. SARB-specific reporting estate for this tenant.",
  },
  {
    decisionId: "D-RMS-DOCUMENTS-FRESH-RUNNER-DOWNGRADE-RETIRE",
    class: "foundational",
    rationale:
      "Retires the fresh-runner empty-store carve-out so the documents-parity gate asserts unconditionally. RMS gate hardening \u2014 backbone records mechanics.",
    citations: ["D-RMS-PHASE-3"],
  },
  {
    decisionId: "D-RMS-PHASE-1",
    class: "foundational",
    rationale:
      "Charters the Records Management Substrate: seven typed events, content-addressed document store, projection-derived registers. The records backbone of the platform.",
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-1",
    class: "foundational",
    rationale:
      "RMS content-addressed document store with BLAKE3 hashing. Records backbone mechanics.",
    citations: ["D-RMS-PHASE-1"],
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-2",
    class: "foundational",
    rationale: "The seven RMS event types and record-helpers. Records backbone mechanics.",
    citations: ["D-RMS-PHASE-1"],
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-3",
    class: "foundational",
    rationale:
      "Projection runtime and the seven RMS register projections. Records backbone mechanics.",
    citations: ["D-RMS-PHASE-1"],
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-4",
    class: "foundational",
    rationale: "Dashboard register render (dual-render period). Records backbone mechanics.",
    citations: ["D-RMS-PHASE-1"],
  },
  {
    decisionId: "D-RMS-PHASE-1-SLICE-5",
    class: "foundational",
    rationale:
      "End-to-end round-trip proving RMS Phase 1 substantively complete. Records backbone mechanics.",
    citations: ["D-RMS-PHASE-1"],
  },
  {
    decisionId: "D-RMS-PHASE-2",
    class: "foundational",
    rationale:
      "Every agent dispatch requires a backing AgentBriefIssued event; markdown becomes a derived render. Dispatch-records discipline of the backbone.",
    citations: ["D-RMS-PHASE-1"],
  },
  {
    decisionId: "D-RMS-PHASE-3",
    class: "foundational",
    rationale:
      "Every deliverable requires a backing RecordFiled event. Deliverable-records discipline of the backbone.",
    citations: ["D-RMS-PHASE-1"],
  },
  {
    decisionId: "D-RMS-PHASE-4-ARCHIVE-SCOPE",
    class: "foundational",
    rationale:
      "Retires the legacy inbox directories; RMS registers become sole canonical. Completes the events-first records architecture.",
    citations: ["D-RMS-PHASE-1"],
  },
  {
    decisionId: "D-RMS-RECORDFILED-MANIFEST",
    class: "foundational",
    rationale:
      "Canonical manifest replay for RecordFiled events, retiring the one-shot-script pattern. Replayable-records mechanics of the backbone.",
    citations: ["D-RMS-PHASE-3"],
  },
  {
    decisionId: "D-RMS-SLICE-5-OBLIGATION-CADENCE",
    class: "obsolete",
    rationale:
      "A shape-test record emitted while exercising the RMS Slice 5 pipeline; no standing decision content.",
  },
  {
    decisionId: "D-ROADMAP-WS-C-RECONCILE",
    class: "directional",
    rationale:
      "Reconciles this bank's Workstream-C roadmap counts and closes the procedures-backlog milestone. Tenant roadmap bookkeeping; live-derived roadmap counts is the extractable pattern.",
  },
  {
    decisionId: "D-RUNTIME-LANGUAGE",
    class: "foundational",
    rationale:
      "Defers the Bun-vs-Node licence-day runtime evaluation to the M8 cloud lift. Platform-runtime choice for the backbone itself.",
    citations: ["Principles/3-cloud-native.md"],
  },
  {
    decisionId: "D-RWA-ENGINE-W2-SLICE-3",
    class: "foundational",
    rationale:
      "Event-sources credit and market RWA into an RwaComputed event of record consumed by the capital return. Basel capital-calculation engine mechanics \u2014 backbone machinery for any tenant.",
  },
  {
    decisionId: "D-RWA-LIVE-POSITIONS-PROJECTION-V1",
    class: "foundational",
    rationale:
      "Wires live RWA projection from booked positions. Capital-engine mechanics of the backbone.",
  },
  {
    decisionId: "D-S3-THIN-HUMAN-LAYER-COMPOSITION",
    class: "directional",
    rationale:
      "Approves this bank's specific licence-day human-layer composition and timing. Tenant staffing plan on the foundational thin-human-layer model.",
    citations: ["D-THIN-HUMAN-LAYER-MINIMUM"],
  },
  {
    decisionId: "D-S7-SUBSTRATE-COMPLETENESS-GATE",
    class: "directional",
    rationale:
      "Point-in-time assessment that this bank's substrate-completeness gate is satisfied. Tenant build attestation.",
  },
  {
    decisionId: "D-S7-TARGETED-3-5-OPEN-QUESTIONS",
    class: "directional",
    rationale:
      "Resolves a targeted set of open questions in this bank's S7 readiness pass. Tenant build episode.",
  },
  {
    decisionId: "D-S8-A4-CLOSE",
    class: "foundational",
    rationale:
      "Closes S8 A4: agent wiring, fleet-status lifecycle fold, escalation-overdue cron. Agent-runtime substrate mechanics of the backbone.",
  },
  {
    decisionId: "D-S8-AGENT-RUNTIME-SUBSTRATE-APPROVED",
    class: "foundational",
    rationale:
      "Approves the agent-runtime substrate (S8) as complete \u2014 the substrate every autonomous seat runs on. Pure backbone.",
    citations: ["Principles/6-autonomous-by-default.md"],
  },
  {
    decisionId: "D-SAMOS-NON-CLEARING",
    class: "directional",
    rationale:
      "Elects indirect SAMOS participation via a sponsor bank. Tenant payment-infrastructure posture in the SA market.",
  },
  {
    decisionId: "D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025",
    class: "obsolete",
    rationale:
      "Declared the D5/2025 directive canonical for BA-return numbering; the scheme was later found fabricated and superseded by D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (Excel forms definitive).",
    citations: ["D-BA-RETURN-NUMBERING-EXCEL-CANONICAL"],
  },
  {
    decisionId: "D-SCENARIO-CLOCK",
    class: "foundational",
    rationale:
      "Controlled-time substrate (WallClock + SimulatedClock) for scenarios. Core platform mechanics \u2014 the wall-clock ratchet discipline rides on it.",
  },
  {
    decisionId: "D-SCHEDULER-RECORDFILED-EMISSION",
    class: "foundational",
    rationale:
      "Remediates scheduler RecordFiled emission so autonomous-run outputs are events-first. Scheduler/records mechanics of the backbone.",
    citations: ["D-RMS-PHASE-3"],
  },
  {
    decisionId: "D-SLA-APPROVAL-WORKFLOW-SEGREGATION",
    class: "foundational",
    rationale:
      "Five segregation-of-duties controls on SLA rule approval. Maker-checker control architecture for rules-as-data \u2014 generalises to any tenant.",
    citations: ["D-SLA-ENGINE-RULES-AS-DATA"],
  },
  {
    decisionId: "D-SLA-ENGINE-RULES-AS-DATA",
    class: "foundational",
    rationale:
      "Adopts the rules-as-data sub-ledger accounting engine. Core accounting-interpretation architecture of the backbone \u2014 posting logic as governed data, not code.",
  },
  {
    decisionId: "D-SLA-FIRST-REPRESENTATION-SARB-BA",
    class: "directional",
    rationale:
      "Sequences SARB-BA-RETURN as the first secondary accounting representation, before ZA-TAX. Tenant jurisdiction sequencing on the foundational multi-representation engine.",
    citations: ["D-SLA-ENGINE-RULES-AS-DATA"],
  },
  {
    decisionId: "D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING",
    class: "directional",
    rationale:
      "Provisions this bank's dedicated per-currency FX trading accounts. Tenant CoA provisioning.",
  },
  {
    decisionId: "D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS",
    class: "directional",
    rationale:
      "Provisions nostros and settlement-failed receivables for the full supported FX set. Tenant CoA design.",
  },
  {
    decisionId: "D-SLA-REBOOK-SIMULATED-MISBOOKINGS",
    class: "directional",
    rationale:
      "Authorises the corrective re-book of 66 mis-booked FX trades. One-off tenant data correction.",
  },
  {
    decisionId: "D-SLA-REPRESENTATION-ACTIVATION-JOINT-APPROVAL",
    class: "foundational",
    rationale:
      "Requires CFO + CoSec joint approval to activate any non-IFRS representation. Dual-control governance pattern on the rules-as-data engine.",
    citations: ["D-SLA-ENGINE-RULES-AS-DATA"],
  },
  {
    decisionId: "D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE",
    class: "foundational",
    rationale:
      "Unresolved-currency legs route to balancing suspense with an urgent-correction alert. Fail-safe resolver semantics of the accounting engine.",
    citations: ["D-SLA-ENGINE-RULES-AS-DATA"],
  },
  {
    decisionId: "D-SLA-ROUNDING-HALF-EVEN",
    class: "foundational",
    rationale:
      "Banker's half-even rounding engine-wide. Deterministic money-arithmetic semantics of the backbone accounting engine.",
    citations: ["D-SLA-ENGINE-RULES-AS-DATA"],
  },
  {
    decisionId: "D-SLA-RULE-ACTIVATION-AUTHORITY-CFO",
    class: "foundational",
    rationale:
      "Routes SLA rule-version activation authority to the CFO seat as IFRS accounting policy. Authority-routing pattern binding rules-as-data to the accountable seat.",
    citations: ["D-SLA-ENGINE-RULES-AS-DATA"],
  },
  {
    decisionId: "D-SLA-RULE-REGISTRY-RETENTION-7YR",
    class: "directional",
    rationale:
      "Sets the posting-rule registry retention class per SA Companies Act s.24 (7 years). SA-jurisdiction retention binding; the retention-class mechanism is foundational.",
  },
  {
    decisionId: "D-SLA-SARB-ACTIVATION-CFO",
    class: "directional",
    rationale:
      "CFO half of the joint approval activating the SARB-BA-RETURN representation. Tenant SARB-specific activation.",
  },
  {
    decisionId: "D-SLA-SARB-BA-RETURN-ACTIVATION-COSEC",
    class: "directional",
    rationale:
      "CoSec half of the joint approval activating the SARB-BA-RETURN representation. Tenant SARB-specific activation.",
  },
  {
    decisionId: "D-SLA-SARB-BA350-NOP-STRUCTURE-CFO",
    class: "directional",
    rationale:
      "Approves a minimal long/short BA-350 NOP memorandum structure. Tenant SARB return design.",
  },
  {
    decisionId: "D-SLICE-B-DELEGATED-EMIT",
    class: "obsolete",
    rationale:
      "Session-delegation smoke-test record emitted while building the decisions framework; no standing decision content.",
  },
  {
    decisionId: "D-SLICE-B-DELEGATED-VIA",
    class: "obsolete",
    rationale: "Session-delegation smoke-test record; no standing decision content.",
  },
  {
    decisionId: "D-SLICE-B-TEST-RECORD",
    class: "obsolete",
    rationale: "Slice B test record; no standing decision content.",
  },
  {
    decisionId: "D-SOME-OTHER-DECISION",
    class: "obsolete",
    rationale: "Test fixture decision; no standing decision content.",
  },
  {
    decisionId: "D-STRATEGY-GRAPH-LAYER",
    class: "obsolete",
    rationale:
      "Latest phase is withdrawn \u2014 withdrawn 2026-06-11 before any code existed; revival requires a new decision.",
  },
  {
    decisionId: "D-T-01-PERMISSION-GATE-SECURE-DEFAULT",
    class: "foundational",
    rationale:
      "Permission gates default to secure (deny). Zero-trust default-deny posture of the backbone (Principle 4).",
    citations: ["Principles/4-security-designed-in.md"],
  },
  {
    decisionId: "D-TEST-SESSION-AUTHORITY-CHECK",
    class: "obsolete",
    rationale: "Session-delegation test fixture; no standing decision content.",
  },
  {
    decisionId: "D-TEST-SESSION-DELEGATION",
    class: "obsolete",
    rationale: "Session-delegation test fixture; no standing decision content.",
  },
  {
    decisionId: "D-TEST-SESSION-DELEGATION-ACTOR-GUARD",
    class: "obsolete",
    rationale: "Session-delegation test fixture; no standing decision content.",
  },
  {
    decisionId: "D-TEST-SESSION-DELEGATION-CUSTOM-VIA",
    class: "obsolete",
    rationale: "Session-delegation test fixture; no standing decision content.",
  },
  {
    decisionId: "D-TEST-SESSION-DELEGATION-DEFAULT-VIA",
    class: "obsolete",
    rationale: "Session-delegation test fixture; no standing decision content.",
  },
  {
    decisionId: "D-TEST-SESSION-DELEGATION-GATE",
    class: "obsolete",
    rationale: "Session-delegation test fixture; no standing decision content.",
  },
  {
    decisionId: "D-TEST-SESSION-DELEGATION-NO-ASOF",
    class: "obsolete",
    rationale: "Session-delegation test fixture; no standing decision content.",
  },
  {
    decisionId: "D-THIN-HUMAN-LAYER-MINIMUM",
    class: "foundational",
    rationale:
      "Humans are kept to the statutory minimum; agents are the labour force. The thin-human-layer model is the BBaaS operating thesis itself (Principle 6).",
    citations: ["Principles/6-autonomous-by-default.md"],
  },
  {
    decisionId: "D-TRADE-LIFECYCLE-IFRS-CHAIN",
    class: "foundational",
    rationale:
      "TRADE_LIFECYCLE_REGISTRY + POSTING_RULE_REGISTRY chaining every trade lifecycle event to IFRS postings. Core trade-to-accounting architecture of the backbone.",
  },
  {
    decisionId: "D-TREASURER-MANDATE-SAMOS-FTP-2026-05-30",
    class: "directional",
    rationale:
      "Amends the Treasurer mandate (removes SAMOS, closes the FTP gap). Tenant seat-mandate content.",
  },
  {
    decisionId: "D-TREASURER-PROC-COMPLETION-2026-05-30",
    class: "directional",
    rationale:
      "Authors this bank's ALCO/ILAAP/FX treasury procedures and proves the engines. Tenant procedure content.",
  },
  {
    decisionId: "D-TREASURER-ROLE-DEFINITION-REVIEW",
    class: "directional",
    rationale:
      "Consolidates the Treasurer role record, policy/procedure map, and substrate plan. Tenant seat definition.",
  },
  {
    decisionId: "D-TREASURER-WAVE1-SUBSTRATE",
    class: "directional",
    rationale:
      "Treasurer Wave-1: CFP trigger events, EWI monitor, BCBS 248 intraday metrics, intraday RAS line. Treasury calibration and wiring for this tenant; the CFP/EWI event families lean reusable.",
  },
  {
    decisionId: "D-TREASURER-WAVE2-SUBSTRATE",
    class: "directional",
    rationale:
      "Treasurer Wave-2: NSFR scope, non-trade outflows, EWI feed adapters, CFP plan instance. Tenant treasury wiring and calibration.",
  },
  {
    decisionId: "D-TREASURY-GAPS-WAVE1",
    class: "directional",
    rationale:
      "Closes four treasury/liquidity substrate gaps for this bank (collateral inventory, settlement outflows, balance-sheet projection, ILAAP engine). Tenant gap-closure batch with reusable engine components inside.",
  },
  {
    decisionId: "D-TRUSTED-FIGURES-PROGRAM-V1",
    class: "foundational",
    rationale:
      "Financial-constants registry, calculations-as-owned-models with derivation-event provenance, and loud failure on missing inputs. Numeric-trust architecture of the backbone \u2014 every figure traceable to an owned model.",
    citations: ["Principles/1-events-are-truth.md"],
  },
  {
    decisionId: "D-URN-CANONICAL-VOCABULARY",
    class: "foundational",
    rationale:
      "Canonical URN vocabulary for the obligations register. Citation/identity discipline underpinning the single graph (Principle 2).",
    citations: ["Principles/2-single-graph-discipline.md"],
  },
  {
    decisionId: "D-V2-BBAAS-ANALYSIS-LAUNCH",
    class: "foundational",
    rationale:
      "Launches the multi-session BBaaS structural analysis. Meta-decision about the backbone-as-product itself.",
  },
  {
    decisionId: "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    class: "foundational",
    rationale:
      "Capstone synthesis decision folding the eight analysis workstreams into the v2 backbone blueprint and build plan. Meta-decision about the backbone-as-product itself.",
    citations: ["D-V2-BBAAS-ANALYSIS-LAUNCH"],
  },
  {
    decisionId: "D-V2-BBAAS-W1-DECISION-DISTILLATION",
    class: "foundational",
    rationale:
      "Charters the W1-W7 analysis map and dispatches W1 decision distillation (this event family and register). Meta-decision defining the backbone's own knowledge base.",
    citations: ["D-V2-BBAAS-ANALYSIS-LAUNCH"],
  },
  {
    decisionId: "D-V2-BBAAS-W2-W3-DISPATCH",
    class: "foundational",
    rationale:
      "Dispatches the structural pair (W2 domain map, W3 tenancy architecture) of the backbone analysis. Meta-decision about the backbone-as-product itself.",
    citations: ["D-V2-BBAAS-W1-DECISION-DISTILLATION"],
  },
  {
    decisionId: "D-V2-BBAAS-W4-W7-DISPATCH",
    class: "foundational",
    rationale:
      "Dispatches the final four analysis workstreams (model library, platform research, commercial, vendor perimeter), completing the chartered backbone-analysis map. Meta-decision about the backbone-as-product itself.",
    citations: ["D-V2-BBAAS-W1-DECISION-DISTILLATION"],
  },
  {
    decisionId: "D-V2-BBAAS-W8-AGENT-LEARNING",
    class: "foundational",
    rationale:
      "Charters the agent-learning architecture: structured-first knowledge substrate (posture register, applicability assessments, impact sweeps). Defines how backbone agents learn for any tenant.",
    citations: ["D-V2-BBAAS-W1-DECISION-DISTILLATION"],
  },
  {
    decisionId: "D-V2-BBAAS-W9-FIL",
    class: "foundational",
    rationale:
      "Charters the Financial Instrument Language: one versioned instrument type system every layer binds to — the keystone contract under the domain map, model library, and posture register.",
    citations: ["D-V2-BBAAS-ANALYSIS-LAUNCH", "D-V2-BBAAS-BLUEPRINT-SYNTHESIS"],
  },
  {
    decisionId: "D-V2-REPO-STRATEGY-REEXAMINATION",
    class: "foundational",
    rationale:
      "Re-opens the repo-strategy verdict under platform-correctness-dominant weights plus intra-tenant multi-LE and FIL-mediated-access requirements. Meta-decision about the backbone's own structure.",
    citations: ["D-V2-BBAAS-BLUEPRINT-SYNTHESIS", "D-V2-BBAAS-W9-FIL"],
  },
  {
    decisionId: "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
    class: "directional",
    rationale:
      "Sets this bank's market-risk VaR exposure basis to the standing settlement-retained FX NOP, aligned to RAS line B3. Tenant risk-measurement calibration; the exposure-basis-as-decision pattern generalises.",
  },
  {
    decisionId: "D-VERA-IFRS-THRESHOLD-CURRENCY-RECONS-POST-ICAAP",
    class: "directional",
    rationale:
      "Schedules two threshold-currency recon builds after this bank's first ICAAP cycle. Tenant gate-scheduling tied to its ICAAP cadence.",
  },
  {
    decisionId: "D-WS-JS-NUMBER-RECONCILIATION",
    class: "directional",
    rationale:
      "Renames Joint Standard 1/2024 to 2/2024 across this bank's register. SA-jurisdiction citation correction.",
  },
];

/** Snapshot count of approved decisionIds covered at authoring time. */
export const DECISION_CLASSIFICATION_COUNT = 266;

export const DECISION_CLASSIFICATION_COUNTS = {
  foundational: 98,
  directional: 143,
  obsolete: 25,
} as const;
