// platform/event-store/registry/index.ts
//
// F-021 (Atlas, 2026-05-12): thin barrel re-exporting all registry types,
// constants, domain arrays, and utility functions.
//
// This barrel preserves the original `registry.ts` public surface so no
// callers need to change their import paths. The monolithic `registry.ts`
// becomes a shim that re-exports from here.
//
// Domain modules:
//   - types.ts       — shared interfaces and retention constants
//   - runtime.ts     — RUNTIME_EVENT_TYPES, GOAL_LOOP_EVENT_TYPES
//   - model-risk.ts  — MODEL_REGISTRY_EVENT_TYPES
//   - markets.ts     — MARKETS_EVENT_TYPES, BANK_ACCOUNT_EVENT_TYPES,
//                      PERIOD_CLOSE_EVENT_TYPES, CUSTOMER_LIFECYCLE_EVENT_TYPES
//   - governance.ts  — GOVERNANCE_EVENT_TYPES, AUDIT_EVENT_TYPES,
//                      LEGAL_ENTITY_EVENT_TYPES, PARTY_EVENT_TYPES_REGISTRY,
//                      PRODUCT_LIFECYCLE_EVENT_TYPES, RMS_EVENT_TYPES,
//                      RAS_EVENT_TYPES, READINESS_SNAPSHOT_EVENT_TYPES

export type {
  ArchivalTier,
  EventTypeMetadata,
  EventTypeStatus,
  ReplayFold,
  RetentionMetadata,
  SnapshotCadence,
} from "./types";

export {
  DEFAULT_SNAPSHOT_CADENCE,
  RETENTION_ACCOUNTING_7Y,
  RETENTION_BANKING_5Y,
  RETENTION_CONSERVATIVE_DEFAULT,
  RETENTION_FIC_5Y,
  RETENTION_GOVERNANCE_7Y,
  RETENTION_JSE_TRADE_7Y,
  RETENTION_RUNTIME_1Y,
} from "./types";

export {
  AGENT_DECISION_REQUEST_EVENT_TYPES,
  AGENT_OPS_EVENT_TYPES,
  GOAL_LOOP_EVENT_TYPES,
  RUNTIME_EVENT_TYPES,
} from "./runtime";
export { MODEL_REGISTRY_EVENT_TYPES } from "./model-risk";
// D-TRUSTED-FIGURES-PROGRAM-V1 — seed-management events (objective 1).
export { SEED_MANAGEMENT_EVENT_TYPES } from "./seed-management";
export {
  BANK_ACCOUNT_EVENT_TYPES,
  CUSTOMER_LIFECYCLE_EVENT_TYPES,
  MARKETS_EVENT_TYPES,
  PERIOD_CLOSE_EVENT_TYPES,
} from "./markets";
export {
  ANALYTICS_EVENT_TYPES,
  AUDIT_EVENT_TYPES,
  GOVERNANCE_EVENT_TYPES,
  LEGAL_ENTITY_EVENT_TYPES,
  PARTY_EVENT_TYPES_REGISTRY,
  PERFORMANCE_EVENT_TYPES,
  PRODUCT_LIFECYCLE_EVENT_TYPES,
  RAS_EVENT_TYPES,
  READINESS_SNAPSHOT_EVENT_TYPES,
  RMS_EVENT_TYPES,
} from "./governance";
export { REGULATORY_EVENT_TYPES } from "./regulatory";
export { REGULATORY_REPORTING_EVENT_TYPES } from "./regulatory-reporting";
export { INTRANET_EVENT_TYPES_REGISTRY } from "./intranet";
export { MISSING_EVENT_TYPES } from "./missing-types";
export { PAYMENTS_EVENT_TYPES_REGISTRY } from "./payments";
// M3 Slice 9 — conduct events (FSCA/FSR Act market conduct framework).
export { CONDUCT_EVENT_TYPES } from "./conduct";
// M3 Slice 10 — counterparty-exposure events (large-exposure framework).
export { COUNTERPARTY_EXPOSURE_EVENT_TYPES } from "./counterparty-exposure";
// WS-CREDIT-LIMIT-ENGINE — credit-limit lifecycle events.
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
export { CREDIT_LIMIT_EVENT_TYPES_REGISTRY } from "./credit-limit";
// WS-CREDIT-LIMIT-ENGINE — SA-CCR / LEX computation outputs.
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD; BCBS 279; BCBS 283; RRB Reg 23.
export { COUNTERPARTY_CREDIT_RISK_EVENT_TYPES_REGISTRY } from "./counterparty-credit-risk";
// Regulator-notification event types (PaNotificationSubmitted; PA / FSCA / FIC).
// Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Banks Act §§ 60A + 73; FIC Act §§ 28A + 29.
export { REGULATORY_PA_EVENT_TYPES_REGISTRY } from "./regulatory-pa";
// D-KYC-ONBOARDING-BUILD — KYC gateway lifecycle events.
export { KYC_EVENT_TYPES_REGISTRY } from "./kyc";
// D-TRADE-LIFECYCLE-IFRS-CHAIN — JSE bond lifecycle accounting events.
export { BOND_ACCOUNTING_EVENT_TYPES_REGISTRY } from "./bonds";
// D-TRADE-LIFECYCLE-IFRS-CHAIN — JSE equity lifecycle accounting events.
export { EQUITY_ACCOUNTING_EVENT_TYPES_REGISTRY } from "./equities";
// D-TRADE-LIFECYCLE-IFRS-CHAIN — OTC IRD swap lifecycle accounting events.
export { IRD_ACCOUNTING_EVENT_TYPES_REGISTRY } from "./ird-swaps";
// D-RAS-CLIMATE-SCENARIO-FRAMEWORK — climate-risk scenario and daily proxy events.
export { CLIMATE_RISK_EVENT_TYPES_REGISTRY } from "./climate-risk";
// D-TREASURY-GAPS-WAVE1 — collateral inventory substrate (HQLA tracking).
export { COLLATERAL_EVENT_TYPES_REGISTRY } from "./collateral";
// D-TREASURY-GAPS-WAVE1 — settlement instruction outflow substrate (LCR §23).
// Authority: BA 325 §23; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.
export { SETTLEMENT_EVENT_TYPES_REGISTRY } from "./settlement";
// D-TREASURY-GAPS-WAVE1 — balance-sheet projection (NSFR ASF/RSF substrate).
// Authority: BA 326; BCBS D396; Banks Act Reg 26A; D-TREASURY-GAPS-WAVE1.
export { BALANCE_SHEET_EVENT_TYPES_REGISTRY } from "./balance-sheet";
// D-TREASURY-GAPS-WAVE1 — liquidity projection engine (LCR/NSFR).
export { LIQUIDITY_EVENT_TYPES_REGISTRY } from "./liquidity";
// WS-LIQUIDITY-LIMIT-ENGINE — liquidity-limit lifecycle events.
// Authority: D-RAS; LRM Policy v1; PROC-RISK-LLM-01.
export { LIQUIDITY_LIMIT_EVENT_TYPES_REGISTRY } from "./liquidity-limit";
// D-TREASURY-GAPS-WAVE1 — ILAAP engine (stress scenarios + survival horizon).
export { ILAAP_EVENT_TYPES_REGISTRY } from "./ilaap";
// D-TREASURY-GAPS-WAVE1 — ALCO pack event types.
export { ALCO_EVENT_TYPES_REGISTRY } from "./alco";
// Product Control — daily FX P&L report event.
export { PRODUCT_CONTROL_EVENT_TYPES_REGISTRY } from "./product-control";
// Market-data domain control-plane events (stale-data alerts, model validation).
export { MARKET_DATA_EVENT_TYPES_REGISTRY } from "./market-data";
// MTM engine event-type registry rows.
export { MTM_EVENT_TYPES_REGISTRY } from "./mtm";
// D-EVENT-VIEW-BOUNDARY-WIRE Slice A — policy-version-in-force registry row.
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
export { POLICY_ACTIVATION_EVENT_TYPES_REGISTRY } from "./policy-activation";
// D-EVENT-VIEW-BOUNDARY-WIRE Slice B — OfficialMarkAdopted registry row.
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
export { VALUATION_EVENT_TYPES_REGISTRY } from "./valuation";
// D-EVENT-VIEW-BOUNDARY-WIRE Slice C — PeriodClosed registry row.
// Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
export { CLOSE_MANAGEMENT_EVENT_TYPES_REGISTRY } from "./close-management";
// WS-IFRS-POLICY-VALIDATION — IFRS quantitative-threshold approval events.
// SicrThresholdApproved (§3.2.2) + MaterialityBenchmarkApproved (§3.5.2)
// per FIN-ACCT-01 v1.3. Authority: brief:bea:register-sicrthresholdapproved-
// materialitybenchm:2026-05-21; D-TRADE-LIFECYCLE-IFRS-CHAIN.
export { IFRS_POLICY_THRESHOLDS_EVENT_TYPES_REGISTRY } from "./ifrs-policy-thresholds";
// WS-OBLIGATION-REVIEW-SUBSTRATE — obligation-review events emitted by
// Mira's LLM-extraction pipeline and reviewed by governance seats.
// Authority: D-OBLIGATION-REVIEW-SUBSTRATE; D-KG-GRAPHITI-ADOPT;
//   P2-SINGLE-GRAPH-DISCIPLINE.
export { OBLIGATION_REVIEW_EVENT_TYPES_REGISTRY } from "./obligation-review";
// D-FINANCIAL-INSTRUMENT-ENTITY — FinancialInstrument master-record lifecycle
// events (Defined / Classified / Decomposed / Reconstituted).
// Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22);
//   IFRS-9; ACTUS v1.1; BA 325.
export { FINANCIAL_INSTRUMENT_EVENT_TYPES_REGISTRY } from "./financial-instrument";
// WS1-PR1a — Repo / Money Market Deposit / Funding Line / Interbank Loan
// event types (20 events across 4 treasury instrument families).
// Authority: WS1-PR1a; D-MARKETS-SCHEMA-FOUNDATION; IFRS 9; IAS 39 §27;
//   Banks Act 94/1990 Reg 26/27; BA 325; BA 326; BCBS d365.
export { REPO_MMD_IBL_EVENT_TYPES_REGISTRY } from "./repo-mmd-ibl";
// D-IFRS9-STAGING-V1 — IFRS 9 impairment stage classification events.
// Authority: D-IFRS9-STAGING-V1 (CEO-approved 2026-05-28);
//   IFRS 9 §5.5; Regulations Relating to Banks Reg 23.
export { IFRS9_STAGING_EVENT_TYPES_REGISTRY } from "./ifrs9-staging";
// D-CAE-QUARTERLY-RUN-G5 — CAE quarterly autonomous run event types.
// AuditPlanUpdated, AuditIssueTrackerReviewed, QaipAttestationFiled,
// ThirdLineOpinionFiled, GovernanceSeatRunCompleted.
// Authority: D-CAE-QUARTERLY-RUN-G5 (2026-05-28); IIA Standards §1300/§2010/§2600;
//   Banks Act 94/1990 §73; BCBS 239 Principles I, III, IX, XIV.
export { CAE_GOVERNANCE_EVENT_TYPES_REGISTRY } from "./cae-governance";
// D-CCO-GOVERNANCE-SEAT-G5 — CCO/CISO/CAE periodic-run event types.
// GovernanceSeatRunCompleted + GovernanceAttestationFiled +
// SuspiciousActivityQueueReviewed + AmlRiskAssessmentCompleted + EddQueueReviewed.
// Authority: FIC Act 38/2001; Banks Act 94/1990 §60A; POL-AML-001; RMCP v1;
//   D-CCO-GOVERNANCE-SEAT-G5 (CEO-approved).
export { GOVERNANCE_SEAT_RUNS_EVENT_TYPES_REGISTRY } from "./governance-seat-runs";
// CISO quarterly governance run events — JS-2 attestation, SBOM review,
// threat-model gate, key-ceremony attestation, governance-seat-run completion.
// Authority: PA/FSCA Joint Standard 2 of 2024; POPIA s.19–22; Principle 4.
export { CISO_GOVERNANCE_EVENT_TYPES_REGISTRY } from "./ciso-governance";
// WS-ODP-ISDA-ANNEXURES — ISDA Schedule + CSA elections + non-IRS OTC confirms.
// IsdaScheduleElected, IsdaCsaElected, IsdaCsaSuperseded,
//   FraTradeBooked, SwaptionTradeBooked, BasisSwapTradeBooked,
//   CrossCurrencySwapTradeBooked.
// Authority: ORG-ODP-COND-005; urn:regulation:odp:cs-2-2018; BCBS d317.
export {
  ISDA_SCHEDULE_CSA_EVENT_TYPES_REGISTRY,
  OTC_CONFIRMATIONS_EVENT_TYPES_REGISTRY,
} from "./isda-odp";
// WS-ODP-PORTFOLIO-RECON — portfolio reconciliation substrate events.
// 5 recon-run events + 3 break/dispute lifecycle events (8 total).
// Authority: ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9.
export { ODP_PORTFOLIO_RECON_EVENT_TYPES_REGISTRY } from "./odp-portfolio-recon";
// WS-ODP-COLLATERAL-SEGREGATION — collateral segregation enforcement events.
// CollateralSegregationLocked, CollateralSegregationReleased,
//   CollateralSubstitutionRequested, CollateralSubstitutionApproved,
//   CollateralSubstitutionRejected, CollateralSufficiencyChecked,
//   CollateralSegregationBreachRaised.
// Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12.
export { ODP_COLLATERAL_SEGREGATION_EVENT_TYPES_REGISTRY } from "./odp-collateral-segregation";
// WS-ODP-UMOJA-UTI — UTI allocation + submission lifecycle + repo-recon events.
// TradeUtiAllocated + OdpTradeReportPrepared + OdpReportSubmissionAttempted/Accepted/Rejected +
//   OdpReportAmendmentRequested/Submitted + OdpRepoReconRun + OdpRepoReconBreakRaised +
//   OdpRepoReconDisputeOpened/Resolved + UmojaPortalTokenRefreshed (12 total).
// Authority: ORG-ODP-RPT-003; ORG-MK-RPT-002; urn:regulation:odp:cs-3-2018;
//   urn:regulation:odp:jn-2-2024; ISO 23602:2020.
export { ODP_UMOJA_UTI_EVENT_TYPES_REGISTRY } from "./odp-umoja-uti";

// ---------------------------------------------------------------------------
// Combined registry — re-assembly of all domain arrays into the flat list
// that the original registry.ts exported as EVENT_TYPE_REGISTRY.
// ---------------------------------------------------------------------------

import { ALCO_EVENT_TYPES_REGISTRY } from "./alco";
import { BALANCE_SHEET_EVENT_TYPES_REGISTRY } from "./balance-sheet";
import { BOND_ACCOUNTING_EVENT_TYPES_REGISTRY } from "./bonds";
import { CAE_GOVERNANCE_EVENT_TYPES_REGISTRY } from "./cae-governance";
import { CISO_GOVERNANCE_EVENT_TYPES_REGISTRY } from "./ciso-governance";
import { CLIMATE_RISK_EVENT_TYPES_REGISTRY } from "./climate-risk";
import { CLOSE_MANAGEMENT_EVENT_TYPES_REGISTRY } from "./close-management";
import { COLLATERAL_EVENT_TYPES_REGISTRY } from "./collateral";
import { CONDUCT_EVENT_TYPES } from "./conduct";
import { COUNTERPARTY_CREDIT_RISK_EVENT_TYPES_REGISTRY } from "./counterparty-credit-risk";
import { COUNTERPARTY_EXPOSURE_EVENT_TYPES } from "./counterparty-exposure";
import { CREDIT_LIMIT_EVENT_TYPES_REGISTRY } from "./credit-limit";
import { EQUITY_ACCOUNTING_EVENT_TYPES_REGISTRY } from "./equities";
import { FINANCIAL_INSTRUMENT_EVENT_TYPES_REGISTRY } from "./financial-instrument";
import {
  ANALYTICS_EVENT_TYPES,
  AUDIT_EVENT_TYPES,
  GOVERNANCE_EVENT_TYPES,
  LEGAL_ENTITY_EVENT_TYPES,
  PARTY_EVENT_TYPES_REGISTRY,
  PERFORMANCE_EVENT_TYPES,
  PRODUCT_LIFECYCLE_EVENT_TYPES,
  RAS_EVENT_TYPES,
  READINESS_SNAPSHOT_EVENT_TYPES,
  RMS_EVENT_TYPES,
} from "./governance";
import { GOVERNANCE_SEAT_RUNS_EVENT_TYPES_REGISTRY } from "./governance-seat-runs";
import { IFRS_POLICY_THRESHOLDS_EVENT_TYPES_REGISTRY } from "./ifrs-policy-thresholds";
import { IFRS9_STAGING_EVENT_TYPES_REGISTRY } from "./ifrs9-staging";
import { ILAAP_EVENT_TYPES_REGISTRY } from "./ilaap";
import { INTRANET_EVENT_TYPES_REGISTRY } from "./intranet";
import { IRD_ACCOUNTING_EVENT_TYPES_REGISTRY } from "./ird-swaps";
import {
  ISDA_SCHEDULE_CSA_EVENT_TYPES_REGISTRY,
  OTC_CONFIRMATIONS_EVENT_TYPES_REGISTRY,
} from "./isda-odp";
import { KYC_EVENT_TYPES_REGISTRY } from "./kyc";
import { LIQUIDITY_EVENT_TYPES_REGISTRY } from "./liquidity";
import { LIQUIDITY_LIMIT_EVENT_TYPES_REGISTRY } from "./liquidity-limit";
import { MARKET_DATA_EVENT_TYPES_REGISTRY } from "./market-data";
import {
  BANK_ACCOUNT_EVENT_TYPES,
  CUSTOMER_LIFECYCLE_EVENT_TYPES,
  MARKETS_EVENT_TYPES,
  PERIOD_CLOSE_EVENT_TYPES,
} from "./markets";
import { MISSING_EVENT_TYPES } from "./missing-types";
import { MODEL_REGISTRY_EVENT_TYPES } from "./model-risk";
import { MTM_EVENT_TYPES_REGISTRY } from "./mtm";
import { OBLIGATION_REVIEW_EVENT_TYPES_REGISTRY } from "./obligation-review";
import { ODP_COLLATERAL_SEGREGATION_EVENT_TYPES_REGISTRY } from "./odp-collateral-segregation";
import { ODP_PORTFOLIO_RECON_EVENT_TYPES_REGISTRY } from "./odp-portfolio-recon";
import { ODP_UMOJA_UTI_EVENT_TYPES_REGISTRY } from "./odp-umoja-uti";
import { PAYMENTS_EVENT_TYPES_REGISTRY } from "./payments";
import { POLICY_ACTIVATION_EVENT_TYPES_REGISTRY } from "./policy-activation";
import { PRODUCT_CONTROL_EVENT_TYPES_REGISTRY } from "./product-control";
import { REGULATORY_EVENT_TYPES } from "./regulatory";
import { REGULATORY_PA_EVENT_TYPES_REGISTRY } from "./regulatory-pa";
import { REGULATORY_REPORTING_EVENT_TYPES } from "./regulatory-reporting";
import { REPO_MMD_IBL_EVENT_TYPES_REGISTRY } from "./repo-mmd-ibl";
import {
  AGENT_DECISION_REQUEST_EVENT_TYPES,
  AGENT_OPS_EVENT_TYPES,
  GOAL_LOOP_EVENT_TYPES,
  RUNTIME_EVENT_TYPES,
} from "./runtime";
import { SEED_MANAGEMENT_EVENT_TYPES } from "./seed-management";
import { SETTLEMENT_EVENT_TYPES_REGISTRY } from "./settlement";
import type { EventTypeMetadata, EventTypeStatus } from "./types";
import { VALUATION_EVENT_TYPES_REGISTRY } from "./valuation";

/**
 * Full registry — flat list. Keep RUNTIME / GOVERNANCE / AUDIT split
 * above for readability; the consumer-facing surface is this combined
 * array.
 */
export const EVENT_TYPE_REGISTRY: readonly EventTypeMetadata[] = [
  ...RUNTIME_EVENT_TYPES,
  ...MODEL_REGISTRY_EVENT_TYPES,
  ...SEED_MANAGEMENT_EVENT_TYPES,
  ...MARKETS_EVENT_TYPES,
  ...GOVERNANCE_EVENT_TYPES,
  ...AUDIT_EVENT_TYPES,
  ...LEGAL_ENTITY_EVENT_TYPES,
  ...PARTY_EVENT_TYPES_REGISTRY,
  ...PRODUCT_LIFECYCLE_EVENT_TYPES,
  ...RMS_EVENT_TYPES,
  ...BANK_ACCOUNT_EVENT_TYPES,
  ...PERIOD_CLOSE_EVENT_TYPES,
  ...RAS_EVENT_TYPES,
  ...READINESS_SNAPSHOT_EVENT_TYPES,
  ...GOAL_LOOP_EVENT_TYPES,
  ...CUSTOMER_LIFECYCLE_EVENT_TYPES,
  ...REGULATORY_EVENT_TYPES,
  ...REGULATORY_REPORTING_EVENT_TYPES,
  ...PERFORMANCE_EVENT_TYPES,
  ...ANALYTICS_EVENT_TYPES,
  ...INTRANET_EVENT_TYPES_REGISTRY,
  ...AGENT_OPS_EVENT_TYPES,
  ...AGENT_DECISION_REQUEST_EVENT_TYPES,
  ...MISSING_EVENT_TYPES,
  // Typed payments registry — placed AFTER MISSING_EVENT_TYPES so that
  // the schema-bearing rows win over the placeholder rows in missing-types.ts
  // (Map deduplication: last entry for a given key wins).
  ...PAYMENTS_EVENT_TYPES_REGISTRY,
  // M3 Slice 9 — conduct events. Placed after MISSING_EVENT_TYPES so that
  // typed schema rows override any placeholder rows from missing-types.ts.
  ...CONDUCT_EVENT_TYPES,
  // M3 Slice 10 — counterparty-exposure events. Placed after MISSING_EVENT_TYPES
  // so that typed schema rows override any placeholder rows.
  ...COUNTERPARTY_EXPOSURE_EVENT_TYPES,
  // WS-CREDIT-LIMIT-ENGINE — credit-limit lifecycle events. Placed after
  // MISSING_EVENT_TYPES so typed schema rows override any placeholder rows.
  // Authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20).
  ...CREDIT_LIMIT_EVENT_TYPES_REGISTRY,
  // WS-CREDIT-LIMIT-ENGINE — SA-CCR / LEX computation outputs.
  // Authority: D-CREDIT-LIMIT-ENGINE-BUILD; BCBS 279; BCBS 283; RRB Reg 23.
  ...COUNTERPARTY_CREDIT_RISK_EVENT_TYPES_REGISTRY,
  // Regulator-notification events (PaNotificationSubmitted) — PA / FSCA / FIC.
  // Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Banks Act §§ 60A + 73; FIC Act §§ 28A + 29.
  ...REGULATORY_PA_EVENT_TYPES_REGISTRY,
  // D-KYC-ONBOARDING-BUILD — KYC gateway lifecycle events. Placed last so
  // typed schema rows override any placeholder rows from missing-types.ts.
  ...KYC_EVENT_TYPES_REGISTRY,
  // D-TRADE-LIFECYCLE-IFRS-CHAIN — JSE bond lifecycle accounting events.
  // Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18).
  ...BOND_ACCOUNTING_EVENT_TYPES_REGISTRY,
  // D-TRADE-LIFECYCLE-IFRS-CHAIN — JSE equity lifecycle accounting events.
  // Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18).
  ...EQUITY_ACCOUNTING_EVENT_TYPES_REGISTRY,
  // D-TRADE-LIFECYCLE-IFRS-CHAIN — OTC IRD swap lifecycle accounting events.
  // Authority: D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18).
  ...IRD_ACCOUNTING_EVENT_TYPES_REGISTRY,
  // D-RAS-CLIMATE-SCENARIO-FRAMEWORK — climate-risk scenario and daily proxy events.
  // Authority: D-RAS-CLIMATE-SCENARIO-FRAMEWORK (CEO-approved 2026-05-19).
  ...CLIMATE_RISK_EVENT_TYPES_REGISTRY,
  // D-TREASURY-GAPS-WAVE1 — collateral inventory substrate (HQLA tracking).
  // Authority: BA 325 Annex 1; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.
  ...COLLATERAL_EVENT_TYPES_REGISTRY,
  // D-TREASURY-GAPS-WAVE1 — settlement instruction outflow substrate (LCR §23).
  // Authority: BA 325 §23; Banks Act Reg 26; D-TREASURY-GAPS-WAVE1.
  ...SETTLEMENT_EVENT_TYPES_REGISTRY,
  // D-TREASURY-GAPS-WAVE1 — balance-sheet projection (NSFR ASF/RSF substrate).
  // Authority: BA 326; BCBS D396; Banks Act Reg 26A; D-TREASURY-GAPS-WAVE1.
  ...BALANCE_SHEET_EVENT_TYPES_REGISTRY,
  // D-TREASURY-GAPS-WAVE1 — liquidity projection engine (LCR/NSFR).
  // Authority: D-TREASURY-GAPS-WAVE1; BANKS-ACT-94-1990; BA 325; BA 326.
  ...LIQUIDITY_EVENT_TYPES_REGISTRY,
  // WS-LIQUIDITY-LIMIT-ENGINE — liquidity-limit breach lifecycle events.
  // Authority: D-RAS; LRM Policy v1; PROC-RISK-LLM-01.
  ...LIQUIDITY_LIMIT_EVENT_TYPES_REGISTRY,
  // D-TREASURY-GAPS-WAVE1 — ILAAP engine (stress scenarios + survival horizon).
  // Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; BA 325; PA ILAAP guidance.
  ...ILAAP_EVENT_TYPES_REGISTRY,
  // D-TREASURY-GAPS-WAVE1 — ALCO pack event types.
  // Authority: D-TREASURY-GAPS-WAVE1; BA 325; BA 326; BCBS d365.
  ...ALCO_EVENT_TYPES_REGISTRY,
  // Product Control — daily FX P&L report event.
  // Authority: D-FX-SALES-TRADING-FRONTEND; IFRS 9 §5.7.1.
  ...PRODUCT_CONTROL_EVENT_TYPES_REGISTRY,
  // Market-data domain control-plane events (stale-data alerts, model validation).
  // Authority: D-MARKETS-SCHEMA-FOUNDATION; Policies/valuation-policy-v1.md §5.
  ...MARKET_DATA_EVENT_TYPES_REGISTRY,
  // MTM engine events — MtmRunCompleted, IpvExceptionRaised.
  // Authority: D-MARKETS-SCHEMA-FOUNDATION; D-FX-SALES-TRADING-FRONTEND; IFRS-9-§5.7.1.
  ...MTM_EVENT_TYPES_REGISTRY,
  // D-EVENT-VIEW-BOUNDARY-WIRE Slice A — policy-version-in-force registry row.
  // PolicyVersionActivated (generic umbrella covering valuation / accounting-
  // IFRS / fx-translation). Authority: D-EVENT-VIEW-BOUNDARY-WIRE.
  ...POLICY_ACTIVATION_EVENT_TYPES_REGISTRY,
  // D-EVENT-VIEW-BOUNDARY-WIRE Slice B — OfficialMarkAdopted registry row.
  // The valuation engine's elected mark per (instrumentKey, markAsOf,
  // policyVersionRef). Authority: D-EVENT-VIEW-BOUNDARY-WIRE.
  ...VALUATION_EVENT_TYPES_REGISTRY,
  // D-EVENT-VIEW-BOUNDARY-WIRE Slice C — PeriodClosed registry row.
  // CFO attestation pinning policyVersionRefs + codeSha + statement hashes.
  // Authority: D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20).
  ...CLOSE_MANAGEMENT_EVENT_TYPES_REGISTRY,
  // WS-IFRS-POLICY-VALIDATION — IFRS quantitative-threshold approval events.
  // SicrThresholdApproved (§3.2.2) + MaterialityBenchmarkApproved (§3.5.2)
  // per FIN-ACCT-01 v1.3. Authority: brief:bea:register-sicrthresholdapproved-
  // materialitybenchm:2026-05-21; D-TRADE-LIFECYCLE-IFRS-CHAIN.
  ...IFRS_POLICY_THRESHOLDS_EVENT_TYPES_REGISTRY,
  // WS-OBLIGATION-REVIEW-SUBSTRATE — obligation-review events emitted by
  // Mira's LLM-extraction pipeline and closed by governance seats.
  // Authority: D-OBLIGATION-REVIEW-SUBSTRATE; D-KG-GRAPHITI-ADOPT;
  //   P2-SINGLE-GRAPH-DISCIPLINE.
  ...OBLIGATION_REVIEW_EVENT_TYPES_REGISTRY,
  // D-FINANCIAL-INSTRUMENT-ENTITY — FinancialInstrument master-record lifecycle
  // events (Defined / Classified / Decomposed / Reconstituted).
  // Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22);
  //   IFRS-9; ACTUS v1.1; BA 325.
  ...FINANCIAL_INSTRUMENT_EVENT_TYPES_REGISTRY,
  // WS1-PR1a — Repo / Money Market Deposit / Funding Line / Interbank Loan
  // event types (20 events across 4 treasury instrument families).
  // Authority: WS1-PR1a; D-MARKETS-SCHEMA-FOUNDATION (CEO-approved);
  //   IFRS 9; IAS 39 §27; Banks Act 94/1990 Reg 26/27; BA 325; BA 326; BCBS d365.
  ...REPO_MMD_IBL_EVENT_TYPES_REGISTRY,
  // D-IFRS9-STAGING-V1 — IFRS 9 impairment stage classification events.
  // Placed last so typed schema rows override any placeholder rows.
  // Authority: D-IFRS9-STAGING-V1 (CEO-approved 2026-05-28);
  //   IFRS 9 §5.5; Regulations Relating to Banks Reg 23.
  ...IFRS9_STAGING_EVENT_TYPES_REGISTRY,
  // D-CAE-QUARTERLY-RUN-G5 — CAE quarterly autonomous run event types.
  // AuditPlanUpdated, AuditIssueTrackerReviewed, QaipAttestationFiled,
  // ThirdLineOpinionFiled, GovernanceSeatRunCompleted.
  // Authority: D-CAE-QUARTERLY-RUN-G5 (2026-05-28); IIA Standards §1300/§2010/§2600;
  //   Banks Act 94/1990 §73; BCBS 239 Principles I, III, IX, XIV.
  ...CAE_GOVERNANCE_EVENT_TYPES_REGISTRY,
  // D-CCO-GOVERNANCE-SEAT-G5 — CCO/CISO/CAE periodic-run event types.
  // GovernanceSeatRunCompleted, GovernanceAttestationFiled,
  // SuspiciousActivityQueueReviewed, AmlRiskAssessmentCompleted, EddQueueReviewed.
  // Authority: FIC Act 38/2001; Banks Act 94/1990 §60A; POL-AML-001; RMCP v1.
  ...GOVERNANCE_SEAT_RUNS_EVENT_TYPES_REGISTRY,
  // CISO quarterly governance run events — JS-2 attestation, SBOM review,
  // threat-model gate, key-ceremony attestation, governance-seat-run completion.
  // Authority: PA/FSCA Joint Standard 2 of 2024; POPIA s.19–22; Principle 4.
  ...CISO_GOVERNANCE_EVENT_TYPES_REGISTRY,
  // WS-ODP-ISDA-ANNEXURES — ISDA Schedule + CSA elections.
  // IsdaScheduleElected, IsdaCsaElected, IsdaCsaSuperseded.
  // Authority: ORG-ODP-COND-005; urn:regulation:odp:cs-2-2018; BCBS d317.
  ...ISDA_SCHEDULE_CSA_EVENT_TYPES_REGISTRY,
  // WS-ODP-ISDA-ANNEXURES — non-IRS OTC confirmation events.
  // FraTradeBooked, SwaptionTradeBooked, BasisSwapTradeBooked,
  //   CrossCurrencySwapTradeBooked.
  // Authority: ORG-ODP-COND-005; ISDA 2006/2000 Definitions; BCBS d317.
  ...OTC_CONFIRMATIONS_EVENT_TYPES_REGISTRY,
  // WS-ODP-PORTFOLIO-RECON — ODP portfolio reconciliation substrate events.
  // 5 recon-run events + 3 break/dispute lifecycle events (8 total).
  // Authority: ORG-ODP-COND-007; urn:regulation:odp:cs-2-2018 §9.
  ...ODP_PORTFOLIO_RECON_EVENT_TYPES_REGISTRY,
  // WS-ODP-COLLATERAL-SEGREGATION — collateral segregation enforcement events.
  // 7 events: lock/release/substitution(3)/sufficiency/breach.
  // Authority: ORG-ODP-COND-010; urn:regulation:odp:cs-2-2018 §12.
  ...ODP_COLLATERAL_SEGREGATION_EVENT_TYPES_REGISTRY,
  // WS-ODP-UMOJA-UTI — UTI allocation + submission lifecycle + repo-recon events.
  // 12 events: TradeUtiAllocated through UmojaPortalTokenRefreshed.
  // Authority: ORG-ODP-RPT-003; ORG-MK-RPT-002; urn:regulation:odp:cs-3-2018;
  //   urn:regulation:odp:jn-2-2024; ISO 23602:2020.
  ...ODP_UMOJA_UTI_EVENT_TYPES_REGISTRY,
];

const REGISTRY_BY_TYPE: ReadonlyMap<string, EventTypeMetadata> = new Map(
  EVENT_TYPE_REGISTRY.map((m) => [m.type, m]),
);

/**
 * Look up a type's registered metadata. Returns undefined for types
 * that aren't in the registry (which is fine in build phase — the
 * envelope-only path still validates and appends them).
 *
 * The returned record normalises `status` to `"active"` when the row
 * was authored before the `status` field was introduced (D-PARTY-REGISTER
 * PR 4, 2026-05-11) so callers can always compare
 * `meta.status === "deprecated"` without an undefined guard.
 */
export function lookupEventType(
  type: string,
): (EventTypeMetadata & { status: EventTypeStatus }) | undefined {
  const meta = REGISTRY_BY_TYPE.get(type);
  if (!meta) return undefined;
  return { ...meta, status: meta.status ?? "active" };
}

/**
 * Validate a payload against the registered schema for `type`.
 *
 * Behaviour:
 *   - Type registered with payloadSchema → schema.parse() throws on bad
 *     payload (caller propagates as append failure).
 *   - Type registered without payloadSchema → no-op (envelope-only).
 *   - Type not in registry → no-op (build-phase forward compat). Will
 *     tighten to fail-closed once Vera's #11 / #12 pipelines assert
 *     the registry is complete.
 *
 * The top-level `eventSchema` envelope is validated separately by the
 * EventStore's append; this is the type-dispatched layer on top.
 */
export function validatePayload(type: string, payload: Record<string, unknown>): void {
  const meta = REGISTRY_BY_TYPE.get(type);
  if (!meta || !meta.payloadSchema) return;
  meta.payloadSchema.parse(payload);
}

/**
 * Issuer/subscriber matrix view — used by the dashboard health page,
 * Atlas's permission-policy generator (A2), and Vera's coverage recon.
 *
 * Returns an array of {issuer, eventTypes} groups. Stable sort: issuer
 * name then event-type name.
 */
export function issuerMatrix(): ReadonlyArray<{
  readonly issuer: string;
  readonly eventTypes: readonly string[];
}> {
  const grouped = new Map<string, string[]>();
  for (const m of EVENT_TYPE_REGISTRY) {
    const arr = grouped.get(m.issuer) ?? [];
    arr.push(m.type);
    grouped.set(m.issuer, arr);
  }
  return [...grouped.entries()]
    .map(([issuer, eventTypes]) => ({ issuer, eventTypes: eventTypes.slice().sort() }))
    .sort((a, b) => a.issuer.localeCompare(b.issuer));
}

/**
 * Per-subscriber view — every event type a given subscriber agent (or
 * "external" / "audit" / "dashboard") consumes. Symmetric to
 * issuerMatrix(); needed for permission-policy event-subscribe
 * allow-lists.
 */
export function subscriberMatrix(): ReadonlyArray<{
  readonly subscriber: string;
  readonly eventTypes: readonly string[];
}> {
  const grouped = new Map<string, string[]>();
  for (const m of EVENT_TYPE_REGISTRY) {
    for (const s of m.subscribers) {
      const arr = grouped.get(s) ?? [];
      arr.push(m.type);
      grouped.set(s, arr);
    }
  }
  return [...grouped.entries()]
    .map(([subscriber, eventTypes]) => ({ subscriber, eventTypes: eventTypes.slice().sort() }))
    .sort((a, b) => a.subscriber.localeCompare(b.subscriber));
}
