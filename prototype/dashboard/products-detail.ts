// dashboard/products-detail.ts
//
// Per-product detail assembler for the /products page. Joins:
//   - the canonical Product record (fixture or proposal-synthesised),
//   - the 14 NPA dimension cards (owner + artefact + fail rule + citation
//     + latest attestation status + latest agent-authored narrative),
//   - a worked-journal-entry preview per lifecycle event in the product's
//     `lifecycleEventFamily` (joined against a static posting-rule index).
//
// Surface: GET /api/products/:productId (wired in server.ts).
//
// Authority chain (Principle 2 upward):
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10) §5 — 14 dimensions.
//
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { resolve as resolvePath } from "node:path";

import {
  POSTING_RULE_REGISTRY,
  type PostingRuleEntry,
  findEntriesForEventType,
} from "../platform/accounting/posting-rule-registry";
import { lookupEventType } from "../platform/event-store/registry";
import type { EventStore } from "../platform/event-store/store";
import type { Product } from "../platform/markets/products";
import {
  type FxInstrumentVariant,
  fxInstrumentVariantSchema,
} from "../platform/markets/products/types";
import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRow,
  foldFilInstances,
  isLiveStage,
} from "../v2-core";
import { CANONICAL_DESKS } from "../v2-core/desk/roster";
// Risk / valuation model DECLARATIONS — read for `modelId` + `scope` only
// (the FIL-Models register is folded from events and is empty in the build
// phase, so the static declarations are the canonical source of "which model
// is scoped to this asset class"). No hardcoded model ids/scopes — both are
// read off the imported declaration objects.
import { CAPITAL_MODEL_DECLARATION } from "../v2-core/fil-models/capital/capital-model";
import type { FilModelImplementationDeclared } from "../v2-core/fil-models/declaration";
import { CASH_MODEL_DECLARATION } from "../v2-core/fil-models/fx-valuation/cash-model";
import { FX_MODEL_DECLARATION } from "../v2-core/fil-models/fx-valuation/fx-model";
import { BOND_FIXED_RATE_VANILLA_MODEL_DECLARATION } from "../v2-core/fil-models/ir/bond/bond-model";
import { MM_DEPOSIT_MODEL_DECLARATION } from "../v2-core/fil-models/ir/money-market/deposit/mm-deposit-model";
import { MM_REPO_MODEL_DECLARATION } from "../v2-core/fil-models/ir/money-market/repo/mm-repo-model";
import { MM_UNSECURED_MODEL_DECLARATION } from "../v2-core/fil-models/ir/money-market/unsecured/mm-unsecured-model";
import { VAR_MODEL_DECLARATION } from "../v2-core/fil-models/market-risk-var/model";
import { SA_CCR_MODEL_DECLARATION } from "../v2-core/fil-models/sa-ccr/model";
import { activeFxSettlementDeferredGaps } from "../v2-core/posting-rules/fx-settlement";

import { normaliseDimensionKey } from "../platform/markets/products/dimension-key-alias";
import {
  type DimensionPolicyChain,
  type ProductDeclaredFunction,
  resolveDimensionChain,
  resolveProductChain,
} from "./products-policy-chain";

import { NPA_DIMENSIONS, type NpaDimension, resolveProduct } from "./products-view";

// ---------------------------------------------------------------------------
// NPA dimension metadata — canonical source of truth: NPA Policy v1.0 §5.
// Each row pairs the dimension with: human label, owning agent (name +
// position per identity discipline), required artefact, fail rule, citation
// chain. All fields verbatim from the policy table.
// ---------------------------------------------------------------------------

export interface DimensionMetadata {
  /**
   * Display key for this dimension. NOTE: this table historically uses the
   * LONG display keys (e.g. `conduct-suitability`, `legal-documentation`) and
   * the frontend `switch (dim.dimension)` in products.js depends on them, so
   * they are retained here as display aliases. They are normalised to the
   * canonical SHORT key via `normaliseDimensionKey` when matched against the
   * `ProductDimensionAttested` event-of-record. Typed `string` (not the
   * SHORT-key `NpaDimension` union) because the values are the long aliases.
   */
  dimension: string;
  label: string;
  owner: { name: string; position: string };
  artefactRequired: string;
  failRule: string;
  citationChain: readonly string[];
  /** Helps the page render onboarding implications next to conduct / AML / legal. */
  surfacesClientOnboarding: boolean;
  /**
   * Anchor policies for this dimension — file basenames under
   * `/Policies/`. The policy-chain resolver expands these into the full
   * Policy → Procedure → Function chain at request time. Empty array =
   * no policy chain rendered (used for the engineering-only
   * `operational-readiness` substrate dimension).
   */
  policyHints: readonly string[];
  /**
   * Events that trigger action in this dimension (e.g. a trade-execution
   * event that fires the market-risk pre-deal check). Names must match
   * registered event types in `platform/event-store/event-types/*`.
   */
  triggeredBy: readonly string[];
  /**
   * Events the dimension's substrate emits as a consequence of operation
   * (e.g. `CcrEadComputed` from the credit-limit engine).
   */
  emits: readonly string[];
}

export const DIMENSION_METADATA: readonly DimensionMetadata[] = [
  {
    dimension: "market-risk",
    label: "Market risk",
    owner: { name: "Helena", position: "Chief Risk Officer (governance)" },
    artefactRequired:
      "Sensitivity profile (delta, gamma, vega, basis where relevant); RAS § B-market envelope check; pricing-model Tier-classification per Nadia methodology.",
    failRule:
      "Pricing model not validated at appropriate Tier; OR sensitivity profile exceeds RAS § B-market envelope at expected book size; OR the product introduces a non-modellable risk factor (FRTB NMRF) without an interim treatment.",
    citationChain: ["BCBS-d352", "BCBS-d457", "RAS § B-market", "ORG-PR-19"],
    surfacesClientOnboarding: false,
    policyHints: ["market-risk-policy-v1.md"],
    triggeredBy: ["FxTradeExecuted", "FxPositionRevalued", "MarketDataOutage"],
    emits: [
      "FXPositionBreach",
      "BacktestRun",
      "BacktestBreachDisposed",
      "RiskRaised",
      "RasLineCalibrated",
    ],
  },
  {
    dimension: "credit-risk",
    label: "Credit risk",
    owner: { name: "Helena", position: "Chief Risk Officer (governance)" },
    artefactRequired:
      "SA-CCR computation for the product class; counterparty-rating coverage check; concentration impact at expected book size against ORG-PR-09 ceiling.",
    failRule:
      "Pre-deal credit engine returns withhold at expected book size; OR breach of pre-deal envelope; OR counterparty class lacks rating coverage and no interim treatment.",
    citationChain: ["BCBS-Large-Exposures", "Banks-Act-94-1990", "ORG-PR-09", "ORG-PR-16"],
    surfacesClientOnboarding: false,
    policyHints: ["credit-risk-policy-v1.md", "counterparty-onboarding-policy-v1.md"],
    triggeredBy: ["FxTradeExecuted", "CounterpartyCategorised", "CollateralUpdated"],
    emits: [
      "CcrEadComputed",
      "CcrReplacementCostComputed",
      "CreditLimitProposed",
      "CreditLimitBreached",
      "CreditLimitBreachDisposed",
      "LexUtilisationComputed",
      "LexExceptionApproved",
    ],
  },
  {
    dimension: "liquidity-funding",
    label: "Liquidity / funding",
    owner: { name: "Eitan", position: "Head of Treasury (governance)" },
    artefactRequired:
      "LCR / NSFR contribution computation; HQLA classification of any held collateral; FTP attribution methodology.",
    failRule:
      "Net LCR or NSFR effect breaches RAS § B-liquidity envelope at expected book size; OR FTP contribution unattributable under the FTP methodology; OR HQLA classification ambiguous.",
    citationChain: ["BCBS-d295", "BCBS-d335", "ORG-PR-06", "ORG-PR-07", "ORG-PR-08"],
    surfacesClientOnboarding: false,
    policyHints: ["liquidity-risk-management-policy-v1.md", "irrbb-policy-v1.md"],
    triggeredBy: ["FxTradeExecuted", "TradeMatured", "FundingDrawn"],
    emits: [
      "LCRComputed",
      "NSFRComputed",
      "IntradayHQLAStressProjection",
      "HQLACompositionDrift",
      "NostroFundingShortfall",
    ],
  },
  {
    dimension: "operational-risk",
    label: "Operational risk",
    owner: { name: "Devon", position: "Chief Operating Officer (governance)" },
    artefactRequired:
      "Process-readiness checklist; severe-but-plausible scenario set; vendor-concentration analysis; intersection with Important Business Services per Operational Resilience Policy.",
    failRule:
      "Critical operational dependency without backup or rehearsed recovery; OR resilience gap unmitigated at launch; OR process-readiness checklist incomplete.",
    citationChain: ["BCBS-OpRisk-2021", "BCBS-OpResilience-2021", "ORG-PR-17", "ORG-PR-18"],
    surfacesClientOnboarding: false,
    policyHints: ["operational-risk-policy-v1.md", "operational-resilience-policy-v1.md"],
    triggeredBy: [
      "SettlementFailed",
      "FxSettlementFailed",
      "MarketDataOutage",
      "SurveillanceFeedGap",
    ],
    emits: ["IncidentRaised", "SettlementFailureClassified", "SurveillanceAlert", "ReconResult"],
  },
  {
    dimension: "operational-readiness",
    label: "Operational readiness (substrate)",
    owner: { name: "Tomas", position: "Settlements engineer (engineering)" },
    artefactRequired:
      "Substrate-completeness attestation: all required event types registered; settlement path live (or simulator-equivalent in build phase); reconciliation harness covers the new product class; lifecycle handlers complete.",
    failRule:
      "Any required substrate component is not yet built; OR reconciliation harness does not cover the product's lifecycle events; OR settlement path absent and no simulator coverage.",
    citationChain: ["CLAUDE.md-P1", "CLAUDE.md-P3", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
    surfacesClientOnboarding: false,
    // Engineering substrate dimension — no governance policy anchors;
    // chain rendering is skipped (the Operational Readiness story is
    // covered by Tomas's procedures + the lifecycle-event journal block
    // already on the page).
    policyHints: [],
    triggeredBy: [
      "FxTradeExecuted",
      "FxSettlementInstructed",
      "TradeMatured",
      "FxSettlementFailed",
    ],
    emits: [
      "DailyReconciliationReport",
      "ReconciliationBreak",
      "ConfirmationMatched",
      "ConfirmationMismatch",
      "MissedExpectedReceipt",
    ],
  },
  {
    dimension: "accounting",
    label: "Accounting classification",
    owner: { name: "Bea", position: "Accounting & financial reporting engineer (engineering)" },
    artefactRequired:
      "IFRS 9 SPPI test result + business-model classification (amortised cost / FVOCI / FVTPL); IFRS 13 fair-value-hierarchy assignment (Level 1 / 2 / 3); IAS 21 FX treatment; sub-ledger posting map; BA-return cell mapping.",
    failRule:
      "Classification ambiguous between IFRS 9 categories; OR fair-value level cannot be determined from the pricing model; OR sub-ledger postings undefined for any lifecycle event.",
    citationChain: ["IFRS-9", "IFRS-13", "IAS-21", "ORG-AC-15"],
    surfacesClientOnboarding: false,
    policyHints: [
      "accounting-policies-ifrs-v1.md",
      "hedge-accounting-policy-v1.md",
      "ifrs9-ecl-provisioning-policy-v1.md",
    ],
    triggeredBy: [
      "FxTradeExecuted",
      "FxPositionRevalued",
      "PrincipalPayment",
      "TradeMatured",
      "TradeReportSubmitted",
      "TradeMatured",
    ],
    emits: [
      "SubLedgerPostingEmitted",
      "ManualJournalEntry",
      "TrialBalanceSnapshotted",
      "BalanceSheetSubstantiationCompleted",
      "AccountingPeriodOpened",
      "AccountingPeriodClosed",
      "PeriodClosed",
    ],
  },
  {
    dimension: "capital",
    label: "Capital impact",
    owner: { name: "Camille", position: "Chief Financial Officer (governance)" },
    artefactRequired:
      "Pre-deal RWA delta engine output for the product class at expected book size; capital-headroom check against RAS § B-capital; Pillar 2A add-on consideration.",
    failRule:
      "Estimated capital headroom breach at expected book size; OR RWA model uncalibrated for the product class; OR Pillar 2A add-on indicated and not provisioned.",
    citationChain: ["Banks-Act-Reg-39", "Basel-III-IV", "ORG-PR-02", "ORG-PR-03", "ORG-PR-05"],
    surfacesClientOnboarding: false,
    policyHints: ["capital-management-policy-v1.md"],
    triggeredBy: ["FxTradeExecuted", "FxPositionRevalued", "CcrEadComputed", "LCRComputed"],
    emits: ["CapitalEvent", "CapitalActionTrigger", "BAReturnGenerationTriggered"],
  },
  {
    dimension: "conduct-suitability",
    label: "Conduct / suitability",
    owner: { name: "Zara", position: "Chief Compliance Officer (governance)" },
    artefactRequired:
      "FAIS conduct treatment determination; FSCA Conduct Standard 1–3 of 2018 mapping; TCF posture for institutional-only flow.",
    failRule:
      "Client class outside institutional-only without strategic-foundation amendment; OR conduct posture inconsistent with FSCA Conduct Standard 3/2018; OR FAIS-exemption assumption invalid for any counterparty class targeted.",
    citationChain: [
      "FAIS-Act-37-2002",
      "FSCA-Conduct-Standard-1-2018",
      "FSCA-Conduct-Standard-2-2018",
      "FSCA-Conduct-Standard-3-2018",
      "ORG-CD-01",
      "ORG-CS3-001",
    ],
    surfacesClientOnboarding: true,
    policyHints: ["conduct-of-business-tcf-policy-v1.md", "fais-compliance-policy-v1.md"],
    triggeredBy: ["OrderSubmitted", "OrderFilled", "FxTradeExecuted", "AdviceRecordRequested"],
    emits: [
      "ConductEventRecorded",
      "ConductDisclosureEmitted",
      "BestExecutionVerified",
      "BestExecutionBreached",
      "BestExecutionAnalysisCompleted",
      "FaisClassificationSuitabilityChecked",
      "SuitabilityAssessmentRequired",
      "ConductIncidentLogged",
      "FAISConductBreachSuspected",
    ],
  },
  {
    dimension: "aml-sanctions-pep",
    label: "AML / sanctions / PEP",
    owner: { name: "Mira", position: "AML & sanctions engineer (engineering)" },
    artefactRequired:
      "Counterparty CDD pathway extension; sanctions-screening service coverage for any new counterparty class or jurisdiction; PEP-detection gate; STR / CTR pathway for any new transaction shape.",
    failRule:
      "CDD pathway absent for any in-scope counterparty class; OR sanctions service does not extend to the new product's counterparty universe; OR transaction-monitoring rule set has no coverage for the new product's transaction shape.",
    citationChain: ["FIC-Act-38-2001", "UN-OFAC-EU-UK-HMT", "ORG-AML", "ORG-SAN"],
    surfacesClientOnboarding: true,
    policyHints: ["aml-cft-policy-v1.md"],
    triggeredBy: [
      "ClientCandidateRegistered",
      "FxTradeExecuted",
      "SanctionsListPublished",
      "PepListPublished",
      "AdverseMediaPublished",
    ],
    emits: [
      "KYCSanctionsPEPScreened",
      "KYCRiskRated",
      "KYCDecisionMade",
      "KYCEDDInitiated",
      "KYCEDDCompleted",
      "SanctionsHit",
      "PEPMatchExceedsThreshold",
      "STRCandidate",
      "SanctionsHoldRaised",
    ],
  },
  {
    dimension: "model-risk",
    label: "Model risk",
    owner: { name: "Nadia", position: "Model risk engineer (engineering)" },
    artefactRequired:
      "Tier-classification of every new pricing, risk, or classification model under the Nadia methodology library; deferral pointer to RAS § B7 examples until Helena's Model Risk Policy lands.",
    failRule:
      "Model not validated at appropriate Tier (Tier-1 fully validated; Tier-2 limited; Tier-3 challenger / shadow); OR Tier-classification disagreement between first line and Nadia unresolved.",
    citationChain: ["SR-11-7", "SS-1-23", "BCBS-CG-Principles", "RAS § B7"],
    surfacesClientOnboarding: false,
    policyHints: ["model-risk-policy-v1.md"],
    triggeredBy: [
      "ModelSubmitted",
      "BacktestRequested",
      "MethodologyChangeRequested",
      "ProductionUseRequested",
    ],
    emits: [
      "ModelTierClassified",
      "ModelValidationApproved",
      "ModelValidationWithheld",
      "ValidationFindingRaised",
      "ValidationFindingClosed",
      "BacktestRun",
      "ModelDriftDetected",
      "ValidationMethodologyPublished",
    ],
  },
  {
    dimension: "legal-documentation",
    label: "Legal documentation",
    owner: { name: "Imani", position: "Legal documentation engineer (engineering)" },
    artefactRequired:
      "Master-agreement coverage attestation (ISDA Master + ZA Schedule + CSA for OTC IRD; GMRA + SA Schedule for repo; GMSLA for sec-lend; trading agreement for listed cash); ECTA execution path; dispute-resolution procedure; jurisdiction matrix.",
    failRule:
      "Master agreement absent for any in-scope counterparty class; OR ECTA execution path unverified; OR dispute-resolution procedure not in place pre-trade per Conduct Standard 3/2018 §6.",
    citationChain: ["ECTA-25-2002", "ISDA-Master", "GMRA", "GMSLA", "ORG-MK-06", "ORG-CS3-001"],
    surfacesClientOnboarding: true,
    policyHints: ["document-execution-policy-v1.md"],
    triggeredBy: ["OnboardingHandoffPending", "ClientCandidateRegistered", "FxTradeExecuted"],
    emits: [
      "LegalDocumentationSigned",
      "ISDACSAAssessmentCompleted",
      "ConfirmationMatched",
      "JurisdictionalOpinionRefreshed",
    ],
  },
  {
    dimension: "information-security",
    label: "Information security",
    owner: { name: "Senna", position: "Security engineer (engineering)" },
    artefactRequired:
      "Threat model covering the new product's wire path (FIX, RFQ, confirmation, settlement instruction); HSM key custody where the product introduces signing; zero-trust posture for any new external integration; impact on Important Business Services per Cyber Resilience Policy.",
    failRule:
      "Threat-model gate not closed; OR new external integration introduced without zero-trust pattern; OR HSM key custody not specified for any product-signing path.",
    citationChain: ["Joint-Standard-1-2024", "POPIA-s19-22", "CLAUDE.md-P4", "ORG-CY"],
    surfacesClientOnboarding: false,
    policyHints: ["information-security-it-governance-policy-v1.md"],
    triggeredBy: [
      "ThreatModelDimensionRegistered",
      "ProductionUseRequested",
      "SuspiciousAuthEvent",
    ],
    emits: [
      "ThreatModelGateDecision",
      "ThreatModelExceptionRequested",
      "SecurityIncidentRaised",
      "PersonalInformationCompromiseSuspected",
    ],
  },
  {
    dimension: "privacy",
    label: "Privacy",
    owner: { name: "Iris", position: "Information Officer (governance)" },
    artefactRequired:
      "POPIA classification of any personal data the product touches; cross-border transfer determination; retention-schedule mapping.",
    failRule:
      "POPIA classification missing for any personal-data field; OR cross-border transfer pathway not assessed against POPIA s.72.",
    citationChain: ["POPIA-4-2013", "SARB-Directive-3-2018", "ORG-PR-PRIV"],
    surfacesClientOnboarding: false,
    policyHints: ["popia-privacy-policy-v1.md"],
    triggeredBy: [
      "ClientCandidateRegistered",
      "CrossBorderTransferRequested",
      "DSARReceived",
      "PAIARequest",
      "NewProcessingPurposeProposed",
    ],
    emits: [
      "LawfulProcessingRegistered",
      "POPIAControlsSnapshot",
      "ConsentWithdrawn",
      "InformationRegulatorInquiry",
      "PersonalInformationCompromiseSuspected",
    ],
  },
  {
    dimension: "tax",
    label: "Tax",
    owner: { name: "Yael", position: "Tax engineer (engineering)" },
    artefactRequired:
      "VAT classification; STT classification where listed-equity transfers involved; FATCA / CRS classification of new counterparty class / jurisdiction; transfer-pricing implications for any inter-entity flow; section-24J implications for debt instruments.",
    failRule:
      "Tax classification ambiguous for any cashflow type; OR FATCA/CRS classification not determinable for any counterparty class targeted; OR transfer-pricing methodology absent for inter-entity flows.",
    citationChain: ["Income-Tax-Act", "VAT-Act", "STT-Act", "FATCA-IGA", "CRS"],
    surfacesClientOnboarding: false,
    policyHints: ["tax-policy-v1.md"],
    triggeredBy: ["ClientCandidateRegistered", "FxTradeExecuted", "CrossBorderTransferRequested"],
    emits: ["TaxClassificationPublished", "FatcaCrsClassified", "TaxReadinessSnapshot"],
  },
];

// ---------------------------------------------------------------------------
// Posting-rule summary — a per-lifecycle-event view derived from the CANONICAL
// posting-rule registry (v2-core/posting-rules/registry.ts, re-exported via
// platform/accounting/posting-rule-registry.ts). The static, hand-maintained
// POSTING_RULE_INDEX that previously lived here was deleted under
// D-NPA-PAGE-DE-INVENTION: it invented rule ids + module paths (e.g.
// EquityTradeBooked → PR-EQ-001) that did not match the registry, so the
// journal table and the Accounting-treatment section disagreed. Both now read
// the one registry. A lifecycle event with no registry entry surfaces as a
// `missing` substrate gap — fail-closed honesty, never a fabricated row.
// ---------------------------------------------------------------------------

export interface PostingRuleSummary {
  /** Stable rule ID (e.g. "PR-FX-001") — registry `postingRuleId`. */
  ruleId: string;
  /** Canonical registry module the rule is sourced from. */
  module: string;
  /** Human-readable legs / treatment description — registry `conditionDetail`. */
  legs: string;
  /** Where in the lifecycle the trigger sits (registry `lifecycleStage`). */
  lifecycleStage: PostingRuleEntry["lifecycleStage"];
  /** When a posting is expected (registry `condition`). */
  condition: PostingRuleEntry["condition"];
}

/** Canonical home of the posting-rule registry — surfaced as each rule's module. */
const POSTING_RULE_REGISTRY_MODULE = "v2-core/posting-rules/registry.ts";

/**
 * Names that do NOT resolve to a registered event type
 * (platform/event-store/event-types/*). The page surfaces these as a flagged
 * gap rather than asserting them silently. A registered event type returns
 * metadata from `lookupEventType`; an unregistered name returns `undefined`.
 */
function unregisteredEventTypes(names: readonly string[]): string[] {
  return names.filter((n) => lookupEventType(n) === undefined);
}

/**
 * Build a `PostingRuleSummary` for the registry entry that best describes a
 * lifecycle event. When several entries share a trigger event type (e.g. the
 * three FX FIL-fold variants on `FilInstrumentTerminated`), the
 * posting-bearing rules are preferred over `intentional-no-impact` memos, and
 * their ids/legs are concatenated so the page reflects every real rule.
 */
function summariseRegistryEntries(entries: readonly PostingRuleEntry[]): PostingRuleSummary {
  // Prefer the posting-bearing entries; fall back to memo entries if all are
  // intentional-no-impact (still real, registered rules).
  const posting = entries.filter((e) => e.condition !== "intentional-no-impact");
  const chosen = posting.length > 0 ? posting : entries;
  const ruleId = chosen.map((e) => e.postingRuleId).join(" · ");
  const legs = chosen
    .map((e) => (e.conditionDetail ? `${e.postingRuleId}: ${e.conditionDetail}` : e.postingRuleId))
    .join("  |  ");
  // lifecycleStage / condition are reported from the primary (first) chosen
  // entry — they scope the recon assertion strength on the page.
  const primary = chosen[0] as PostingRuleEntry;
  return {
    ruleId,
    module: POSTING_RULE_REGISTRY_MODULE,
    legs,
    lifecycleStage: primary.lifecycleStage,
    condition: primary.condition,
  };
}

// ---------------------------------------------------------------------------
// Public view types.
// ---------------------------------------------------------------------------

export interface DimensionCard {
  /** Display key (LONG alias form) — see `DimensionMetadata.dimension`. */
  dimension: string;
  label: string;
  owner: { name: string; position: string };
  artefactRequired: string;
  failRule: string;
  citationChain: readonly string[];
  /** Event types that trigger action in this dimension. */
  triggeredBy: readonly string[];
  /** Event types this dimension's substrate emits. */
  emits: readonly string[];
  /**
   * Names from `triggeredBy` / `emits` that do NOT resolve to a registered
   * event type (platform/event-store/event-types/*). Surfaced as a flagged gap
   * on the card rather than silently asserted — invented functionality is
   * visible, never hidden (D-NPA-PAGE-DE-INVENTION; Engineering-Charter cmd 2,
   * fail-closed; cmd 5, no silent deferral).
   */
  unbacked: {
    /** Unregistered `triggeredBy` names. */
    triggeredBy: readonly string[];
    /** Unregistered `emits` names. */
    emits: readonly string[];
  };
  surfacesClientOnboarding: boolean;
  /** Latest ProductDimensionAttested for (productId, dimension). */
  attestation: {
    status: "pending" | "design-attested" | "implementation-attested" | "failed";
    attestedAt?: string;
    attestedBy?: string;
    citationChain?: readonly string[];
  };
  /** Latest ProductDimensionNarrativeRecorded for (productId, dimension). */
  narrative: {
    text: string;
    authorAgentName: string;
    authorAgentPosition: string;
    recordedAt: string;
    citationChain: readonly string[];
  } | null;
  /** Whether a narrative has been requested but not yet recorded. */
  narrativeRequested: boolean;
  /**
   * Policy → Procedure → Function chain applicable to this dimension,
   * resolved at request time from `/Policies/*.md` + `/Procedures/**\/*.md`
   * frontmatter. The dimension's `policyHints` anchor the chain; the
   * resolver expands. Empty `policies` array = no governance-anchored
   * chain for this dimension (e.g. operational-readiness substrate).
   */
  chain: DimensionPolicyChain;
}

export interface LifecycleEventJournalRow {
  eventType: string;
  /** "present" if a Bea posting rule maps this event; "missing" otherwise (substrate gap). */
  status: "present" | "missing";
  rule?: PostingRuleSummary;
}

export interface PostApprovalFindingRow {
  findingId: string;
  severity: "critical" | "high" | "medium";
  title: string;
  missedDimension: string;
  discoveredBy: string;
  discoveredAt: string;
  findingTrigger: string;
  /** Populated when a ProductDimensionRetrospectiveReview exists for this findingId. */
  review?: {
    reviewedBy: string;
    reviewedAt: string;
    rootCause: string;
    correctiveAction: string;
    revisedAttestation: "strengthened" | "scope-adjusted" | "deferred-gap-added";
  };
  /** "open" = no review; "reviewed" = review present within SLA; "overdue" = SLA elapsed, no review */
  status: "open" | "reviewed" | "overdue";
}

// ---------------------------------------------------------------------------
// Accounting-treatment surface (WS-ACCT-FX-COMPLETENESS Slice 5).
//
// Name-free DTO (no agent names cross /api/v2): the product's IFRS/IAS
// determination + the posting rules its asset class applies, each with its IFRS
// citation and whether its trigger-wiring is a tracked deferred gap. Rendered as
// the "Accounting treatment" section on the V2 NPA product page.
// ---------------------------------------------------------------------------

export interface AccountingTreatmentPostingRule {
  /** Stable posting-rule id (e.g. PR-FX-001-V2). */
  readonly postingRuleId: string;
  /** The lifecycle event that triggers it. */
  readonly triggerEventType: string;
  /** Where in the lifecycle (opening / in-flight / terminal). */
  readonly lifecycleStage: string;
  /** When a posting is expected (always / non-zero-delta / …). */
  readonly condition: string;
  /** IFRS / IAS citation + rationale (from the registry conditionDetail). */
  readonly ifrs: string;
  /** True when the rule's trigger-wiring is a tracked ProductDeferredGap. */
  readonly deferred: boolean;
  /** Deferred-gap target trigger (present iff deferred). */
  readonly deferredTargetTrigger?: string;
}

export interface AccountingTreatmentView {
  /** IFRS 9 classification family. */
  readonly ifrs9Family: string;
  /** IFRS 13 fair-value hierarchy. */
  readonly ifrs13FairValueHierarchy: string;
  /** IAS 21 FX treatment. */
  readonly ias21FxTreatment: string;
  /** BA-return line refs the postings flow into. */
  readonly baReturnLineMapping: readonly string[];
  /** Posting rules the product's asset class applies, with IFRS + deferred status. */
  readonly postingRules: readonly AccountingTreatmentPostingRule[];
}

/** Product family → posting-rule registry lifecycleId set. */
const FAMILY_LIFECYCLE_IDS: Readonly<Record<string, readonly string[]>> = {
  fx: ["fx-spot-trade", "fx-fil-instance"],
  "listed-bond": ["bond-trade"],
  "listed-equity": ["equity-trade"],
  "otc-ird": ["ird-swap-trade"],
  repo: ["repo-trade"],
};

const DEFERRED_RULE_IDS: ReadonlyMap<string, string> = new Map(
  // A posting rule id is deferred iff a STILL-OPEN FX settlement gap names it in
  // its title. The gap titles lead with the rule id(s) they cover. After
  // WS-FIL-FX-SETTLEMENT-EVENTS resolved all five, this map is empty → every FX
  // posting rule renders `active` on the NPA page.
  activeFxSettlementDeferredGaps().flatMap((g) => {
    const ids = [
      "PR-FX-SETTLE-V2",
      "PR-FX-CLOSE-V2",
      "PR-FX-SWAP-NEAR-V2",
      "PR-FX-SWAP-FAR-V2",
      "PR-FX-NDF-FIX-V2",
      "PR-FX-FVOCI-RECLASS-V2",
    ].filter((id) => g.title.includes(id));
    return ids.map((id) => [id, g.targetTrigger] as const);
  }),
);

/** Build the accounting-treatment view for a product. Pure, name-free. */
export function buildAccountingTreatmentView(product: Product): AccountingTreatmentView {
  const lifecycleIds = FAMILY_LIFECYCLE_IDS[product.family] ?? [];
  const rules: AccountingTreatmentPostingRule[] = POSTING_RULE_REGISTRY.filter(
    (r: PostingRuleEntry) =>
      lifecycleIds.includes(r.lifecycleId) && r.condition !== "intentional-no-impact",
  ).map((r) => {
    const deferredTrigger = DEFERRED_RULE_IDS.get(r.postingRuleId);
    return {
      postingRuleId: r.postingRuleId,
      triggerEventType: r.triggerEventType,
      lifecycleStage: r.lifecycleStage,
      condition: r.condition,
      ifrs: r.conditionDetail ?? "",
      deferred: deferredTrigger !== undefined,
      ...(deferredTrigger !== undefined ? { deferredTargetTrigger: deferredTrigger } : {}),
    };
  });
  return {
    ifrs9Family: product.accountingClassification.ifrs9Family,
    ifrs13FairValueHierarchy: product.accountingClassification.ifrs13FairValueHierarchy,
    ias21FxTreatment: product.accountingClassification.ias21FxTreatment,
    baReturnLineMapping: product.accountingClassification.baReturnLineMapping,
    postingRules: rules,
  };
}

// ---------------------------------------------------------------------------
// Product narrative + visual view-model (NPA detail-page redesign).
//
// Name-free, presentation-ready surfaces that describe the PRODUCT (not just
// its approval state): how it operates, its variants, the components it is
// composed of + how they interact, and how each part of the bank sees it
// (Markets book/desk, Finance FRTB book, Risk models, Compliance). Every field
// is derived from the canonical `Product` record + the desk roster + the FIL
// model declarations — sourced, not authored. All seat references are Titles.
// ---------------------------------------------------------------------------

/** §1 — "How it operates" overview. */
export interface ProductOverview {
  readonly description: string;
  readonly compositionRule: string;
  readonly franchiseScope: string;
  readonly lifecycle: string;
  readonly settlementPath: string;
  readonly reconciliationCadence: string;
  readonly assetClassLabel: string;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly legalEntityId: string;
  /** Typed scope axes when declared (venue / variants / pairs / counterparties). */
  readonly scope?: {
    readonly executionVenue: string;
    readonly instrumentVariants: readonly string[];
    readonly currencyPairs: string;
    readonly counterpartyEligibility: string;
  };
}

/** §2 — a single operating variant of the product. */
export interface ProductVariant {
  readonly key: string;
  readonly label: string;
  /** `in-scope` = attested at this version; `planned` = named in target scope, not yet attested. */
  readonly status: "in-scope" | "planned";
  readonly note: string;
}

/** §3 — one node in the component-interaction graph (a primitive / asset class). */
export interface ComponentNode {
  readonly id: string;
  readonly label: string;
  /** Asset-class / primitive grouping for colour-coding: fx/cash/bond/equity/ir/schedule/settlement/party. */
  readonly group: string;
  readonly detail: string;
}

/** §3 — a directed relationship between two component nodes. */
export interface ComponentEdge {
  readonly from: string;
  readonly to: string;
  /** `composes` = product contains the component; `materialises` = lifecycle interaction (e.g. FX→Cash on settlement). */
  readonly kind: "composes" | "materialises";
  readonly label: string;
}

export interface ComponentGraph {
  /** Central hub label (the product itself). */
  readonly hubLabel: string;
  readonly nodes: readonly ComponentNode[];
  readonly edges: readonly ComponentEdge[];
}

/** §4 — Markets lens: which book / desks the product is traded in. */
export interface MarketsLens {
  readonly book: "trading" | "banking-treasury";
  readonly bookLabel: string;
  readonly desks: readonly { deskName: string; deskKind: string; portfolioRole: string }[];
  readonly eligibility: string;
}

/** §4 — Finance lens: FRTB book + IFRS classification + BA-return cells. */
export interface FinanceLens {
  readonly frtbBook: "trading" | "banking";
  readonly frtbRationale: string;
  readonly ifrs9Family: string;
  readonly ifrs13FairValueHierarchy: string;
  readonly ias21FxTreatment: string;
  readonly baReturnCells: readonly { cell: string; lens: string }[];
}

/** §4 — Risk lens: risk profile + the models scoped to this asset class. */
export interface RiskLens {
  readonly marketRiskDimensions: readonly string[];
  readonly creditRiskShape: string;
  readonly liquidityClassification: string;
  readonly fundingProfile: string;
  readonly modelRiskTier: string;
  /** Model ids whose declared FIL-type scope covers this product's asset class. */
  readonly measuredByModels: readonly string[];
}

/** §4 — Compliance lens: attestation summary + governing documentation. */
export interface ComplianceLens {
  readonly attestedCount: number;
  readonly totalDimensions: number;
  readonly lifecycle: string;
  readonly masterAgreement: string;
  readonly obligationCitations: readonly string[];
}

export interface ProductLensView {
  readonly markets: MarketsLens;
  readonly finance: FinanceLens;
  readonly risk: RiskLens;
  readonly compliance: ComplianceLens;
}

// --- Builders --------------------------------------------------------------

/** Human asset-class label per family (hero tile + overview). */
const FAMILY_ASSET_CLASS_LABEL: Readonly<Record<string, string>> = {
  fx: "Foreign exchange",
  "listed-bond": "Fixed income",
  "listed-equity": "Equity",
  repo: "Securities financing",
  "otc-ird": "Rates derivative",
  "money-market": "Money market",
  "interbank-loan": "Money market",
  structured: "Structured",
};

/** Friendly labels for FX instrument variants. */
const FX_VARIANT_LABEL: Readonly<Record<FxInstrumentVariant, string>> = {
  spot: "FX Spot",
  forward: "FX Forward",
  swap: "FX Swap",
  option: "FX Option",
};

export function buildProductOverview(product: Product): ProductOverview {
  const scope = product.scope
    ? {
        executionVenue: product.scope.executionVenue,
        instrumentVariants: product.scope.fxInstrumentVariants as readonly string[],
        currencyPairs:
          product.scope.currencyPairs === "any"
            ? "Any currency pair"
            : (product.scope.currencyPairs as readonly string[]).join(", "),
        counterpartyEligibility: Array.isArray(product.scope.counterpartyEligibility)
          ? (product.scope.counterpartyEligibility as readonly string[]).join(", ")
          : String(product.scope.counterpartyEligibility),
      }
    : undefined;
  return {
    description: product.description,
    compositionRule: product.cdmComposition.compositionRule,
    franchiseScope: product.franchiseScope,
    lifecycle: product.lifecycle,
    settlementPath: product.operationalReadiness.settlementPath,
    reconciliationCadence: product.operationalReadiness.reconciliationCadence,
    assetClassLabel: FAMILY_ASSET_CLASS_LABEL[product.family] ?? product.family,
    currency: product.currency,
    jurisdiction: product.jurisdiction,
    legalEntityId: product.legalEntityId,
    ...(scope ? { scope } : {}),
  };
}

/**
 * Variants of the product's operation. FX umbrella products carry a typed
 * `scope.fxInstrumentVariants` (the attested subset); the full variant set is
 * the schema enum, so variants named in the target scope but not yet attested
 * render as `planned`. Non-FX families trade as a single instrument form →
 * empty array (the page renders an honest "no sub-variants" panel).
 */
export function buildProductVariants(product: Product): ProductVariant[] {
  if (product.family !== "fx" || !product.scope) return [];
  const inScope = new Set<string>(product.scope.fxInstrumentVariants);
  return fxInstrumentVariantSchema.options.map((v) => {
    const attested = inScope.has(v);
    return {
      key: v,
      label: FX_VARIANT_LABEL[v],
      status: attested ? "in-scope" : "planned",
      note: attested
        ? "In the approved scope at this version."
        : "Named in the product's target scope; not attested at this version.",
    };
  });
}

/** Map a CDM asset-primitive module path to its asset-class node group. */
function moduleGroup(module: string): string {
  if (module.endsWith("/fx")) return "fx";
  if (module.endsWith("/bond")) return "bond";
  if (module.endsWith("/equity")) return "equity";
  if (module.endsWith("/repo")) return "ir";
  if (module.endsWith("/ird")) return "ir";
  return "primitive";
}

/**
 * Node group for colour-coding. Asset/instrument primitives carry their
 * asset-class group (fx/bond/equity/ir); structural primitives are grouped by
 * the role they play (cash-flow / schedule / settlement / party) so the diagram
 * reads as "asset + cashflow + schedule + settlement + identification".
 */
function componentGroup(role: string, module: string): string {
  if (/^\s*cashflow/i.test(role)) return "cash-flow";
  if (/^\s*schedule/i.test(role)) return "schedule";
  if (/^\s*settlement/i.test(role)) return "settlement";
  if (/^\s*identification/i.test(role)) return "party";
  return moduleGroup(module);
}

/** Derive a short node label from a primitive's role text ("Asset primitive: …" → "Asset primitive"). */
function primitiveLabel(role: string, symbol: string): string {
  const m = role.match(/^([A-Za-z/ ]+?)\s+primitive\s*:/i);
  if (m?.[1]) return `${m[1].trim()} primitive`;
  // Fallback: humanise the CDM schema symbol — drop the Schema/Payload suffix
  // and split camelCase ("equitySettlementInstructedPayloadSchema" → "Equity
  // Settlement Instructed").
  const human = symbol
    .replace(/(Payload)?Schema$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return human ? human.charAt(0).toUpperCase() + human.slice(1) : symbol;
}

/**
 * Component-interaction graph. Nodes are the product's CDM primitives (each an
 * asset-class / structural building block); a synthetic node is added for the
 * asset materialised on settlement (the FX→Cash interaction, declared by
 * `maturityMaterialisation`). Edges: the product hub `composes` each primitive;
 * the asset primitive `materialises` the successor asset on settlement.
 */
export function buildComponentGraph(product: Product): ComponentGraph {
  const nodes: ComponentNode[] = product.cdmComposition.primitives.map((p, i) => ({
    id: `c${i}`,
    label: primitiveLabel(p.role, p.symbol),
    group: componentGroup(p.role, p.module),
    detail: p.role,
  }));
  const edges: ComponentEdge[] = nodes.map((n) => ({
    from: "product",
    to: n.id,
    kind: "composes" as const,
    label: "composes",
  }));

  const mm = product.maturityMaterialisation;
  if (mm) {
    nodes.push({
      id: "materialised",
      label: "Cash balance",
      group: "cash",
      detail: `Materialised on ${mm.onLifecycleStage}${mm.bothLegs ? " (both legs)" : ""} → ${mm.materialisesTypeUrn}`,
    });
    // Source of the interaction = the asset/instrument primitive (role begins
    // "Asset …"), else the first non-materialised node.
    const assetNode =
      nodes.find((n) => /^\s*asset/i.test(n.detail)) ?? nodes.find((n) => n.id !== "materialised");
    edges.push({
      from: assetNode ? assetNode.id : "product",
      to: "materialised",
      kind: "materialises",
      label: `settles → ${mm.materialisesAssetClass}`,
    });
  }

  return { hubLabel: product.name, nodes, edges };
}

// Risk / valuation model declarations consulted for the Risk lens. Read for
// `modelId` + `scope` only.
const RISK_VALUATION_MODELS: readonly FilModelImplementationDeclared[] = [
  SA_CCR_MODEL_DECLARATION,
  VAR_MODEL_DECLARATION,
  FX_MODEL_DECLARATION,
  CASH_MODEL_DECLARATION,
  BOND_FIXED_RATE_VANILLA_MODEL_DECLARATION,
  MM_DEPOSIT_MODEL_DECLARATION,
  MM_UNSECURED_MODEL_DECLARATION,
  MM_REPO_MODEL_DECLARATION,
  CAPITAL_MODEL_DECLARATION,
];

/**
 * The canonical FIL-type root each product family books under. Mirrors the
 * `FAMILY_LIFECYCLE_IDS` posture: a small family→type map used to match the
 * product against model scope patterns. Normalised (`.`→`:`) so the segment
 * comparison aligns with both `money-market.deposit` and `money-market:unsecured`
 * spellings in the declarations.
 */
const FAMILY_FIL_TYPE_ROOT: Readonly<Record<string, string>> = {
  fx: "fil:type:fx",
  "listed-bond": "fil:type:ir:bond",
  "listed-equity": "fil:type:equity",
  repo: "fil:type:ir:money-market:repo",
  "otc-ird": "fil:type:ir:swap",
  "money-market": "fil:type:ir:money-market",
  "interbank-loan": "fil:type:ir:money-market:unsecured",
};

/** Normalise a FIL type/scope string to a comparable segment array (drops `@version`). */
function filSegments(s: string): string[] {
  return s.replace(/@.*$/, "").replace(/\./g, ":").split(":");
}

/** True iff a model scope pattern covers the product's FIL-type root (with `*` wildcard). */
function scopeCoversType(scopePattern: string, typeRoot: string): boolean {
  const scope = filSegments(scopePattern);
  const type = filSegments(typeRoot);
  const n = Math.min(scope.length, type.length);
  for (let i = 0; i < n; i++) {
    if (scope[i] === "*") return true; // wildcard matches the remainder
    if (scope[i] !== type[i]) return false;
  }
  // One is a prefix of the other (e.g. generic `…:money-market` covers
  // `…:money-market:deposit`, and `…:ir:bond` is covered by `…:ir:*`).
  return true;
}

/** Model ids whose declared scope covers the product's asset class. */
function modelsForProduct(product: Product): string[] {
  const typeRoot = FAMILY_FIL_TYPE_ROOT[product.family];
  if (!typeRoot) return [];
  const ids = new Set<string>();
  for (const model of RISK_VALUATION_MODELS) {
    if (model.scope.some((s) => scopeCoversType(s, typeRoot))) ids.add(model.modelId);
  }
  return [...ids];
}

/** Classify a BA-return line ref into a human regulatory lens. */
function baReturnLens(line: string): string {
  const up = line.toUpperCase();
  if (up.startsWith("BA320") || up.startsWith("BA325") || up.startsWith("BA310"))
    return "Market risk — trading book";
  if (up.startsWith("BA330")) return "IRRBB — banking book";
  if (up.startsWith("BA700") || up.startsWith("BA701")) return "Capital adequacy";
  if (up.includes("RWA")) return "Risk-weighted assets";
  if (up.startsWith("BA100") || up.startsWith("BA110") || up.startsWith("BA120"))
    return "Balance sheet";
  if (up.startsWith("BA300")) return "Liquidity";
  return "Regulatory return";
}

/**
 * Cross-bank lens view. Markets desks are filtered from `CANONICAL_DESKS` by
 * book type (sourced from the roster; seats already Titles). FRTB book is
 * derived from the IFRS 9 family (FVTPL ⇒ trading book). Risk models are scope-
 * matched against the FIL model declarations.
 */
export function buildProductLenses(
  product: Product,
  attestedCount: number,
  totalDimensions: number,
): ProductLensView {
  const frtbBook: "trading" | "banking" =
    product.accountingClassification.ifrs9Family === "fvtpl" ? "trading" : "banking";
  const deskBookType = frtbBook === "trading" ? "trading" : "banking-treasury";
  const desks = CANONICAL_DESKS.filter((d) => d.bookType === deskBookType).map((d) => ({
    deskName: d.deskName,
    deskKind: d.deskKind,
    portfolioRole: d.businessStrategy.split(".")[0]?.trim() ?? d.deskKind,
  }));

  return {
    markets: {
      book: deskBookType,
      bookLabel: frtbBook === "trading" ? "Trading book" : "Banking / treasury book",
      desks,
      eligibility:
        frtbBook === "trading"
          ? "Booked into the trading book; warehoused and hedged by the markets desks."
          : "Held in the banking / treasury book; managed for funding, liquidity and IRRBB.",
    },
    finance: {
      frtbBook,
      frtbRationale:
        frtbBook === "trading"
          ? "Held-for-trading / FVTPL ⇒ FRTB trading book (market-risk capital)."
          : "Amortised cost / FVOCI ⇒ banking book (IRRBB, not trading-book market risk).",
      ifrs9Family: product.accountingClassification.ifrs9Family,
      ifrs13FairValueHierarchy: product.accountingClassification.ifrs13FairValueHierarchy,
      ias21FxTreatment: product.accountingClassification.ias21FxTreatment,
      baReturnCells: product.accountingClassification.baReturnLineMapping.map((cell) => ({
        cell,
        lens: baReturnLens(cell),
      })),
    },
    risk: {
      marketRiskDimensions: product.riskProfile.marketRiskDimensions,
      creditRiskShape: product.riskProfile.creditRiskShape,
      liquidityClassification: product.riskProfile.liquidityClassification,
      fundingProfile: product.riskProfile.fundingProfile,
      modelRiskTier: product.riskProfile.modelRiskTier,
      measuredByModels: modelsForProduct(product),
    },
    compliance: {
      attestedCount,
      totalDimensions,
      lifecycle: product.lifecycle,
      masterAgreement: product.legalDocumentation.masterAgreement,
      obligationCitations: product.citations,
    },
  };
}

export interface ProductDetailView {
  product: Product;
  dimensions: DimensionCard[];
  /** §1 — "How it operates" narrative overview. */
  overview: ProductOverview;
  /** §2 — operating variants (FX umbrella products; empty for single-instrument families). */
  variants: ProductVariant[];
  /**
   * §2b — the actual booked contractual quad of a representative LIVE `fx` FIL
   * instance (D-FX-INSTRUMENT-BUYSELL-QUAD). Populated ONLY for FX products that
   * have at least one live, quad-bearing instance booked into the v2 anchor store;
   * `undefined` otherwise (non-FX products, or an FX product with no booked
   * quad-bearing instance). NEVER an invented exemplar — sourced from a real
   * instance, omitted when none exists (recon:npa-page-no-invented-functionality).
   * Money amounts are decimal-native major-unit strings, rendered verbatim.
   */
  fxContractualTerms?: {
    buyAmount: string;
    buyCurrency: string;
    sellAmount: string;
    sellCurrency: string;
    settlementDate: string;
    sourceInstanceUrn: string;
  };
  /** §3 — component-interaction graph (CDM primitives + the FX→Cash materialisation edge). */
  componentGraph: ComponentGraph;
  /** §4 — cross-bank lens view (Markets / Finance / Risk / Compliance). */
  lenses: ProductLensView;
  journalEntries: LifecycleEventJournalRow[];
  /** Accounting-treatment surface (WS-ACCT-FX-COMPLETENESS Slice 5). */
  accountingTreatment: AccountingTreatmentView;
  /**
   * Single product-scoped Policy → Procedure → Function chain. Replaces
   * the per-dimension `chain` blocks on the page: shows only the policies
   * relevant to this product, the procedures that touch it, and the
   * functions it actually invokes (CDM modules + posting rules + procedure
   * system-capability).
   */
  productChain: DimensionPolicyChain;
  /** Post-approval findings for this product (D-NPA-POST-APPROVAL-FINDING-REVIEW). */
  postApprovalFindings: PostApprovalFindingRow[];
  asOf: string;
}

// ---------------------------------------------------------------------------
// FX contractual-terms — the booked buy/sell quad of a representative live
// `fx` FIL instance (D-FX-INSTRUMENT-BUYSELL-QUAD).
// ---------------------------------------------------------------------------

/**
 * Pick a representative LIVE, quad-bearing `fx` FIL instance for this product and
 * return its symmetric agreement quad + settlement date.
 *
 * JOIN RULE (per the brief): match by FIL TYPE SCOPE / asset-class `fx`, NOT by
 * `economicTerms.productId` — that S0d booking binding is usually unset on
 * existing instances. We PREFER a `productId` match when one is present (the
 * precise binding), and otherwise fall back to the product's FIL-type root
 * (`fil:type:fx…`) / `assetClass === "fx"` scope. Only live (active/proposed)
 * instances carrying `fxAgreement` are eligible.
 *
 * SOURCE-DON'T-INVENT: returns `undefined` when no booked quad-bearing instance
 * exists — the section is then omitted, never fabricated
 * (recon:npa-page-no-invented-functionality).
 */
function buildFxContractualTerms(
  product: Product,
  filEvents: readonly FilInstanceLifecycleEvent[],
): ProductDetailView["fxContractualTerms"] {
  if (product.family !== "fx") return undefined;

  const typeRoot = FAMILY_FIL_TYPE_ROOT[product.family]; // "fil:type:fx"
  const register = foldFilInstances(filEvents);

  // Eligible = live, fx asset class, carries the quad, and is type-scope relevant
  // to this product (asset-class fx + type-root prefix). productId-bound matches
  // are preferred over type-scope fallbacks.
  const productBound: FilInstanceRow[] = [];
  const typeScoped: FilInstanceRow[] = [];
  for (const row of register.values()) {
    const t = row.economicTerms;
    if (t.assetClass !== "fx") continue;
    if (t.fxAgreement === undefined) continue;
    if (!isLiveStage(row.stage)) continue;
    if (typeRoot !== undefined && !filTypeMatchesRoot(row.type, typeRoot)) continue;
    if (t.productId !== undefined && t.productId === product.productId) {
      productBound.push(row);
    } else if (t.productId === undefined) {
      typeScoped.push(row);
    }
  }

  // Deterministic representative pick: prefer a productId-bound instance, else a
  // type-scoped one; within each, the lexicographically-first instance URN (the
  // page is "representative booked trade, as-of page load", not a live feed).
  const pool = productBound.length > 0 ? productBound : typeScoped;
  if (pool.length === 0) return undefined;
  const chosen = pool.reduce((a, b) => (a.instance <= b.instance ? a : b));

  // Non-null: filtered above (`fxAgreement === undefined` skipped).
  const quad = chosen.economicTerms.fxAgreement;
  if (quad === undefined) return undefined;
  return {
    buyAmount: quad.buy.amount,
    buyCurrency: quad.buy.currency,
    sellAmount: quad.sell.amount,
    sellCurrency: quad.sell.currency,
    settlementDate: chosen.economicTerms.settlementDate,
    sourceInstanceUrn: chosen.instance,
  };
}

/** True iff a FIL instance `type` URN sits under the family's FIL-type root. */
function filTypeMatchesRoot(typeUrn: string, typeRoot: string): boolean {
  const type = filSegments(typeUrn);
  const root = filSegments(typeRoot);
  if (type.length < root.length) return false;
  for (let i = 0; i < root.length; i++) {
    if (type[i] !== root[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Detail builder.
// ---------------------------------------------------------------------------

export function buildProductDetailView(
  productId: string,
  store: Pick<EventStore, "replay">,
  nowIso: string,
  filEvents: readonly FilInstanceLifecycleEvent[] = [],
): ProductDetailView | null {
  const product = resolveProduct(productId, store);
  if (!product) return null;

  // Fold attestations and narratives per dimension.
  const attestationFold = new Map<
    NpaDimension,
    {
      status: DimensionCard["attestation"]["status"];
      asOf: string;
      attestedBy: string;
      citationChain: string[];
    }
  >();
  const narrativeFold = new Map<
    NpaDimension,
    {
      text: string;
      authorAgentName: string;
      authorAgentPosition: string;
      asOf: string;
      citationChain: string[];
    }
  >();
  const narrativeRequestFold = new Map<NpaDimension, { asOf: string }>();

  for (const ev of store.replay()) {
    if (ev.type === "ProductDimensionAttested") {
      const p = ev.payload as Record<string, unknown>;
      if (String(p.productId ?? "") !== productId) continue;
      // Normalise to the canonical SHORT key so short-key events surface.
      const dimension = normaliseDimensionKey(String(p.dimension ?? "")) as NpaDimension;
      if (!NPA_DIMENSIONS.includes(dimension)) continue;
      const prev = attestationFold.get(dimension);
      if (prev && prev.asOf >= ev.as_of) continue;
      attestationFold.set(dimension, {
        status: String(p.result ?? "pending") as DimensionCard["attestation"]["status"],
        asOf: ev.as_of,
        attestedBy: ev.actor.id ?? "",
        citationChain: Array.isArray(p.citationChain) ? (p.citationChain as string[]) : [],
      });
      continue;
    }
    if (ev.type === "ProductDimensionNarrativeRecorded") {
      const p = ev.payload as Record<string, unknown>;
      if (String(p.productId ?? "") !== productId) continue;
      const dimension = normaliseDimensionKey(String(p.dimension ?? "")) as NpaDimension;
      if (!NPA_DIMENSIONS.includes(dimension)) continue;
      const prev = narrativeFold.get(dimension);
      if (prev && prev.asOf >= ev.as_of) continue;
      narrativeFold.set(dimension, {
        text: String(p.narrative ?? ""),
        authorAgentName: String(p.authorAgentName ?? ""),
        authorAgentPosition: String(p.authorAgentPosition ?? ""),
        asOf: ev.as_of,
        citationChain: Array.isArray(p.citationChain) ? (p.citationChain as string[]) : [],
      });
      continue;
    }
    if (ev.type === "ProductDimensionNarrativeRequested") {
      const p = ev.payload as Record<string, unknown>;
      if (String(p.productId ?? "") !== productId) continue;
      const dimension = normaliseDimensionKey(String(p.dimension ?? "")) as NpaDimension;
      if (!NPA_DIMENSIONS.includes(dimension)) continue;
      const prev = narrativeRequestFold.get(dimension);
      if (prev && prev.asOf >= ev.as_of) continue;
      narrativeRequestFold.set(dimension, { asOf: ev.as_of });
    }
  }

  const repoRoot = resolvePath(import.meta.dir, "..", "..");
  const dimensions: DimensionCard[] = DIMENSION_METADATA.map((meta) => {
    // The metadata table keys on the LONG display key (the frontend `switch`
    // in products.js depends on it); the attestation folds key on the
    // canonical SHORT key. Normalise the metadata key to look up the fold.
    const shortKey = normaliseDimensionKey(meta.dimension) as NpaDimension;
    const att = attestationFold.get(shortKey);
    const nar = narrativeFold.get(shortKey);
    const req = narrativeRequestFold.get(shortKey);
    const chain = resolveDimensionChain({
      repoRoot,
      policyHints: meta.policyHints,
      emittedEventTypes: meta.emits,
    });
    // If the latest recorded narrative is more recent than the latest request,
    // the "pending request" state is cleared.
    const narrativeRequested = req !== undefined && (!nar || nar.asOf < req.asOf);
    return {
      dimension: meta.dimension,
      label: meta.label,
      owner: meta.owner,
      artefactRequired: meta.artefactRequired,
      failRule: meta.failRule,
      citationChain: meta.citationChain,
      triggeredBy: meta.triggeredBy,
      emits: meta.emits,
      unbacked: {
        triggeredBy: unregisteredEventTypes(meta.triggeredBy),
        emits: unregisteredEventTypes(meta.emits),
      },
      surfacesClientOnboarding: meta.surfacesClientOnboarding,
      attestation: att
        ? {
            status: att.status,
            attestedAt: att.asOf,
            attestedBy: att.attestedBy,
            citationChain: att.citationChain,
          }
        : { status: "pending" },
      narrative: nar
        ? {
            text: nar.text,
            authorAgentName: nar.authorAgentName,
            authorAgentPosition: nar.authorAgentPosition,
            recordedAt: nar.asOf,
            citationChain: nar.citationChain,
          }
        : null,
      narrativeRequested,
      chain,
    };
  });

  const journalEntries: LifecycleEventJournalRow[] = product.lifecycleEventFamily.map(
    (eventType) => {
      const entries = findEntriesForEventType(eventType);
      if (entries.length > 0) {
        return { eventType, status: "present", rule: summariseRegistryEntries(entries) };
      }
      return { eventType, status: "missing" };
    },
  );

  // Product-level chain: union of dimension policy hints + declared
  // functions from the product fixture (CDM modules + posting rules for
  // the lifecycle event family) + product-relevance filter on procedures.
  const productChain = buildProductChain(product, journalEntries, repoRoot);

  // Fold post-approval findings and retrospective reviews.
  const findingsFold = new Map<
    string,
    {
      severity: "critical" | "high" | "medium";
      title: string;
      missedDimension: string;
      discoveredBy: string;
      discoveredAt: string;
      findingTrigger: string;
    }
  >();
  const reviewsFold = new Map<
    string,
    {
      reviewedBy: string;
      reviewedAt: string;
      rootCause: string;
      correctiveAction: string;
      revisedAttestation: "strengthened" | "scope-adjusted" | "deferred-gap-added";
    }
  >();

  for (const ev of store.replay({ type: "ProductPostApprovalFinding" })) {
    const p = ev.payload as Record<string, unknown>;
    if (String(p.productId ?? "") !== productId) continue;
    const fid = String(p.findingId ?? "");
    if (!fid) continue;
    findingsFold.set(fid, {
      severity: (p.severity as "critical" | "high" | "medium") ?? "medium",
      title: String(p.title ?? fid),
      missedDimension: String(p.missedDimension ?? ""),
      discoveredBy: String(p.discoveredBy ?? ""),
      discoveredAt: String(p.discoveredAt ?? ev.as_of),
      findingTrigger: String(p.findingTrigger ?? ""),
    });
  }

  for (const ev of store.replay({ type: "ProductDimensionRetrospectiveReview" })) {
    const p = ev.payload as Record<string, unknown>;
    if (String(p.productId ?? "") !== productId) continue;
    const fid = String(p.findingId ?? "");
    if (!fid) continue;
    const prev = reviewsFold.get(fid);
    if (prev) continue; // latest wins handled by first seen (events are in order)
    reviewsFold.set(fid, {
      reviewedBy: String(p.reviewedBy ?? ""),
      reviewedAt: String(p.reviewedAt ?? ev.as_of),
      rootCause: String(p.rootCause ?? ""),
      correctiveAction: String(p.correctiveAction ?? ""),
      revisedAttestation:
        (p.revisedAttestation as "strengthened" | "scope-adjusted" | "deferred-gap-added") ??
        "scope-adjusted",
    });
  }

  const SLA_DAYS: Record<string, number> = { critical: 30, high: 30, medium: 90 };
  const postApprovalFindings: PostApprovalFindingRow[] = [...findingsFold.entries()].map(
    ([fid, f]) => {
      const review = reviewsFold.get(fid);
      let status: PostApprovalFindingRow["status"];
      if (review) {
        status = "reviewed";
      } else {
        const slaDays = SLA_DAYS[f.severity] ?? 90;
        const msPerDay = 86_400_000;
        const daysSince = (Date.parse(nowIso) - Date.parse(f.discoveredAt)) / msPerDay;
        status = daysSince > slaDays ? "overdue" : "open";
      }
      return {
        findingId: fid,
        severity: f.severity,
        title: f.title,
        missedDimension: f.missedDimension,
        discoveredBy: f.discoveredBy,
        discoveredAt: f.discoveredAt,
        findingTrigger: f.findingTrigger,
        ...(review ? { review } : {}),
        status,
      };
    },
  );

  const attestedCount = dimensions.filter((d) => d.attestation.status !== "pending").length;

  const fxContractualTerms = buildFxContractualTerms(product, filEvents);

  return {
    product,
    dimensions,
    overview: buildProductOverview(product),
    variants: buildProductVariants(product),
    ...(fxContractualTerms ? { fxContractualTerms } : {}),
    componentGraph: buildComponentGraph(product),
    lenses: buildProductLenses(product, attestedCount, dimensions.length),
    journalEntries,
    accountingTreatment: buildAccountingTreatmentView(product),
    productChain,
    postApprovalFindings,
    asOf: nowIso,
  };
}

// ---------------------------------------------------------------------------
// Product chain assembler — anchors policies on the dimension hint union and
// scopes procedures + functions to those actually referenced by the product.
// ---------------------------------------------------------------------------

function buildProductChain(
  product: Product,
  journalEntries: LifecycleEventJournalRow[],
  repoRoot: string,
): DimensionPolicyChain {
  const policyHintSet = new Set<string>();
  for (const m of DIMENSION_METADATA) for (const h of m.policyHints) policyHintSet.add(h);

  // Declared functions on the product itself — CDM primitives, CDM
  // extensions, and posting-rule modules for events the product emits.
  const declared: ProductDeclaredFunction[] = [];
  const seenDeclared = new Set<string>();
  const pushDeclared = (name: string, status: "active" | "planned", source: string) => {
    const key = name.toLowerCase();
    if (seenDeclared.has(key)) return;
    seenDeclared.add(key);
    declared.push({ name, status, source });
  };
  for (const p of product.cdmComposition.primitives) {
    pushDeclared(p.module, "active", "product:cdm-primitive");
  }
  for (const ext of product.cdmComposition.extensions) {
    pushDeclared(ext.module, "active", `product:cdm-extension:${ext.name}`);
  }
  for (const row of journalEntries) {
    if (row.status === "present" && row.rule) {
      pushDeclared(row.rule.module, "active", `product:posting-rule:${row.rule.ruleId}`);
    }
  }

  // Product-relevance tokens — family + slug fragments from the productId.
  // For "prd:bank:fx:fx-spot-zar-usd" → ["fx", "fx-spot", "fx-spot-zar-usd"].
  const tokens = new Set<string>();
  tokens.add(product.family.toLowerCase());
  const idTail = product.productId.split(":").pop() ?? "";
  if (idTail) {
    tokens.add(idTail.toLowerCase());
    // Progressive prefixes: "fx-spot-zar-usd" → "fx-spot", "fx-spot-zar".
    const parts = idTail.split("-");
    for (let i = 2; i <= parts.length; i++) tokens.add(parts.slice(0, i).join("-").toLowerCase());
  }

  return resolveProductChain({
    repoRoot,
    policyHints: Array.from(policyHintSet),
    productTokens: Array.from(tokens),
    productLifecycleEvents: product.lifecycleEventFamily,
    declaredFunctions: declared,
  });
}
