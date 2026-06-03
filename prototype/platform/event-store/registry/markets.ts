// platform/event-store/registry/markets.ts
//
// F-021 (Atlas, 2026-05-12): markets event-type registry rows.
//
// Covers:
//   - Core trade/settlement family: TradeExecuted, OrderProposed, GatewayCheck*,
//     OrderApproved/RejectedAtGateway, PreTradeLimitChanged
//   - CRM / counterparty eligibility: CounterpartyEligibility*
//   - Switch-test family: SwitchTestActivated, SwitchTestEnded, SwitchTestReport
//   - IFRS / sub-ledger: IfrsClassificationApplied, SubLedgerPostingEmitted
//   - CDM equity events: EquityTradeBooked, EquitySettlementInstructed,
//     EquityCorporateActionApplied
//   - CDM FX events: FxTradeExecuted, FxSettlementInstructed
//   - CDM substrate: CdmBindingsRegenerated
//   - Accounting period-close: AccountingPeriodOpened, AccountingPeriodClosed,
//     TrialBalanceSnapshotted
//   - Bank account: BankAccountOpened, BankAccountConfigured, BankAccountClosed
//   - Customer lifecycle / onboarding Slice 2: CounterpartyFaisClassified,
//     BeneficialOwnerResolved, SanctionsClearancePassed, FatcaCrsClassified,
//     PopiaConsentRecorded, CreditAssessmentCompleted, AccountsSetupCompleted
//   - FX accounting: FxPositionRevalued
//   - Generic lifecycle terminal: TradeMatured (retired TradeMatured 2026-05-21)

import { z } from "zod";

import {
  equityCorporateActionAppliedPayloadSchema,
  equityPositionRevaluedPayloadSchema,
  equitySettlementConfirmedPayloadSchema,
  equitySettlementInstructedPayloadSchema,
  equityTradeBookedPayloadSchema,
  equityTradeExecutedPayloadSchema,
} from "../../markets/cdm/equity";
import {
  fxSettlementInstructedPayloadSchema,
  fxTradeExecutedPayloadSchema,
  ndfFixingObservedPayloadSchema,
  principalPaymentPayloadSchema,
  settlementConfirmedPayloadSchema,
  settlementRealisedPnlCorrectedPayloadSchema,
} from "../../markets/cdm/fx";
import {
  irsCouponPaymentInstructedPayloadSchema,
  irsCouponScheduleGeneratedPayloadSchema,
  irsCouponSettlementConfirmedPayloadSchema,
  irsPositionRevaluedPayloadSchema,
  irsTradeBookedPayloadSchema,
} from "../../markets/cdm/ird";
import {
  accountingPeriodClosedPayloadSchema,
  accountingPeriodOpenedPayloadSchema,
  bankAccountClosedPayloadSchema,
  bankAccountConfiguredPayloadSchema,
  bankAccountOpenedPayloadSchema,
  counterpartyEligibilityBreachedPayloadSchema,
  counterpartyEligibilityRevalidatedPayloadSchema,
  counterpartyEligibilityScreenedPayloadSchema,
  gatewayCheckCompletedPayloadSchema,
  gatewayCheckRequestedPayloadSchema,
  marketRiskMeasureComputedPayloadSchema,
  orderAcceptedPayloadSchema,
  orderApprovedAtGatewayPayloadSchema,
  orderProposedPayloadSchema,
  orderRejectedAtGatewayPayloadSchema,
  orderRejectedPayloadSchema,
  preTradeLimitChangedPayloadSchema,
  quoteRespondedPayloadSchema,
  rasLimitSchedulePublishedPayloadSchema,
  rfqRequestedPayloadSchema,
  switchTestActivatedPayloadSchema,
  switchTestEndedPayloadSchema,
  switchTestReportPayloadSchema,
  trialBalanceSnapshottedPayloadSchema,
} from "../event-types";
import { cdmBindingsRegeneratedPayloadSchema } from "../event-types-cdm";
import {
  baReturnGenerationTriggeredPayloadSchema,
  balanceSheetSubstantiationCompletedPayloadSchema,
  manualJournalEntryPayloadSchema,
  subLedgerPostingRemediationRecordedPayloadSchema,
} from "../event-types/accounting";
import { ifrsClassificationAppliedPayloadSchema } from "../event-types/agent-substrate-extended";
import {
  accountsSetupCompletedPayloadSchema,
  beneficialOwnerResolvedPayloadSchema,
  counterpartyFaisClassifiedPayloadSchema,
  creditAssessmentCompletedPayloadSchema,
  fatcaCrsClassifiedPayloadSchema,
  popiaConsentRecordedPayloadSchema,
  sanctionsClearancePassedPayloadSchema,
} from "../event-types/customer";
import {
  ftpAttributionRecordedPayloadSchema,
  ftpCurvePublishedPayloadSchema,
} from "../event-types/ftp";
import { tradeExecutedPayloadSchema } from "../event-types/markets-trading-extended";
import {
  type EventTypeMetadata,
  RETENTION_ACCOUNTING_7Y,
  RETENTION_FIC_5Y,
  RETENTION_GOVERNANCE_7Y,
  RETENTION_JSE_TRADE_7Y,
} from "./types";

// Build-phase passthrough schema for polymorphic types with no single factory yet.
const PT = z.object({}).passthrough();

// Markets lifecycle event types from A0 §5. Today only TradeExecuted
// is registered; the remaining 23 land as Kai's M4 / M5 work and the
// other product families (M1 listed equity, M2 SAGB, M3 corporate
// bonds, M5 IRS) build out.
//
// Per-product variants of these payloads live under
// `platform/markets/cdm/events/` (e.g. TradeExecuted-FxSpot.ts).
// `payloadSchema` here is left undefined because the registry holds
// one schema per type and these events are polymorphic on the
// embedded `contract` shape — the per-product variant validates at
// the factory, and Vera's planned cross-validator (Wave-4) will
// reconcile the registry view to the per-variant schemas.
export const MARKETS_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "TradeExecuted",
    class: "markets",
    // Polymorphic on the embedded `contract` shape — per-product variants
    // validate at factory level. Base schema validates envelope fields;
    // Vera Wave-4 cross-validator will reconcile against per-variant schemas.
    payloadSchema: tradeExecutedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Position", "Bea", "Rohan", "Mira", "Tomas"],
    replay: "latest-wins-per-key",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "ORG-FC-13"],
    // JSE trade record — 7y per JSE Equities Rules retention norms.
    retention: RETENTION_JSE_TRADE_7Y,
    source: "A0 freeze §5 #2; per-product variants in platform/markets/cdm/events/",
  },
  // Pre-trade gateway family — gates Saskia+Kai's S7-Targeted #5 envelope.
  // Per `Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md`
  // §3 + §5.1. Each check handler is separately-registered; permission-policy
  // scopes each handler's event-stream access (Principle 4).
  {
    type: "OrderProposed",
    class: "markets",
    payloadSchema: orderProposedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Kai", "Saskia", "Mira", "Rohan", "Eitan", "Imani", "Senna", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "FIC-ACT-38-2001"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3; Team/Kai.md §11",
  },
  {
    type: "GatewayCheckRequested",
    class: "markets",
    payloadSchema: gatewayCheckRequestedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Mira", "Rohan", "Eitan", "Imani", "Senna", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5"],
    retention: RETENTION_JSE_TRADE_7Y,
    source: "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3, §5.1",
  },
  {
    type: "GatewayCheckCompleted",
    class: "markets",
    payloadSchema: gatewayCheckCompletedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Kai", "Saskia", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5"],
    retention: RETENTION_JSE_TRADE_7Y,
    source: "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3, §5.1",
  },
  {
    type: "OrderApprovedAtGateway",
    class: "markets",
    payloadSchema: orderApprovedAtGatewayPayloadSchema,
    issuer: "Kai",
    subscribers: ["Saskia", "Bea", "Vera", "dashboard"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_JSE_TRADE_7Y,
    source: "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3, §5.1",
  },
  {
    type: "OrderRejectedAtGateway",
    class: "markets",
    payloadSchema: orderRejectedAtGatewayPayloadSchema,
    issuer: "Kai",
    subscribers: ["Saskia", "Mira", "Niko", "Imani", "Vera", "dashboard"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "FIC-ACT-38-2001"],
    retention: RETENTION_JSE_TRADE_7Y,
    source: "Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md §3, §5.1",
  },
  {
    // OrderAccepted — counterparty-facing acceptance event emitted after
    // gateway clearance. Risk-attracting from the counterparty perspective;
    // Vera's `recon:credit-limit-no-trade-without-loaded` asserts a
    // CreditLimitLoaded exists for the counterparty prior to OrderAccepted.
    // Authority: D-CREDIT-LIMIT-ENGINE-BUILD; Credit Risk Policy §7 line 255.
    type: "OrderAccepted",
    class: "markets",
    payloadSchema: orderAcceptedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Saskia", "Helena", "Rohan", "Bea", "Vera", "dashboard"],
    replay: "pair-coupled",
    citationsHint: [
      "JSE-RULES-EQUITIES",
      "FMA-S5",
      "BANKS-ACT-94-1990-S73",
      "POLICY:credit-risk-policy-v1-S7",
    ],
    retention: RETENTION_JSE_TRADE_7Y,
    source: "platform/event-store/event-types/trading.ts",
  },
  {
    type: "PreTradeLimitChanged",
    class: "markets",
    payloadSchema: preTradeLimitChangedPayloadSchema,
    issuer: "any-agent",
    subscribers: ["Kai", "Saskia", "Helena", "Rohan", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "RAS-B7"],
    // Pre-trade-limit changes are governance decisions over the
    // trading franchise — Companies Act / RAS retention 7y.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Team/Kai.md §11, §15",
  },
  // CRM lifecycle — counterparty institutional-eligibility screening
  // (Niko, v0). D-FSP-LICENCE-NECESSITY confirm-A binds Posture A:
  // every counterparty must clear an institutional-eligibility test
  // anchoring FAIS scope-of-services to institutional product set.
  // Citation hint references Mira's PR #70 FAIS Posture A URN cluster;
  // sub-section refs of FAIS s.45 carry [citation: TBC pending counsel].
  {
    type: "CounterpartyEligibilityScreened",
    class: "markets",
    payloadSchema: counterpartyEligibilityScreenedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Saskia", "Zara", "Imani", "Mira", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: [
      "FAIS-ACT-37-2002",
      "urn:obligation:bank:fais:general-code-of-conduct:v1",
      "ORG-CD-01",
      "ORG-CD-04",
    ],
    // Counterparty CDD-equivalent records: 5y per FIC Act s.22.
    retention: RETENTION_FIC_5Y,
    source:
      "Procedures/by-policy/counterparty-institutional-eligibility-screening.md (PROC-CRM-CIE-01); Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md (PR #62)",
  },
  {
    type: "CounterpartyEligibilityRevalidated",
    class: "markets",
    payloadSchema: counterpartyEligibilityRevalidatedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Saskia", "Zara", "Imani", "Mira", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: [
      "FAIS-ACT-37-2002",
      "urn:obligation:bank:fais:general-code-of-conduct:v1",
      "ORG-CD-01",
      "ORG-CD-04",
    ],
    retention: RETENTION_FIC_5Y,
    source:
      "Procedures/by-policy/counterparty-institutional-eligibility-screening.md (PROC-CRM-CIE-01)",
  },
  {
    type: "CounterpartyEligibilityBreached",
    class: "markets",
    payloadSchema: counterpartyEligibilityBreachedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Saskia", "Zara", "Imani", "Mira", "Kai", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "FAIS-ACT-37-2002",
      "urn:obligation:bank:fais:general-code-of-conduct:v1",
      "ORG-CD-01",
      "ORG-CD-04",
    ],
    retention: RETENTION_FIC_5Y,
    source:
      "Procedures/by-policy/counterparty-institutional-eligibility-screening.md (PROC-CRM-CIE-01)",
  },
  // Switch-test event family — opens/closes/reports the quarterly +
  // triggered switch-test window during which a configurable fraction
  // of `primary`-tagged FX traffic is routed via the backup
  // correspondent. Per Devon (COO, governance) + Tomas (Operations &
  // payments engineer) named-correspondent-pair proposal §4 (PR #58)
  // and D-FX-CORRESPONDENT-PAIR-NAMING (CEO approved 2026-05-09; PR #59).
  {
    type: "SwitchTestActivated",
    class: "markets",
    payloadSchema: switchTestActivatedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Saskia", "Devon", "Helena", "Rohan", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["BCBS-239-2013", "GOV-FRAMEWORK-CEO-RESERVED"],
    // Operational-resilience attestations — governance retention 7y.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md §4 (PR #58)",
  },
  {
    type: "SwitchTestEnded",
    class: "markets",
    payloadSchema: switchTestEndedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Saskia", "Devon", "Helena", "Rohan", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["BCBS-239-2013"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md §4 (PR #58)",
  },
  {
    type: "SwitchTestReport",
    class: "markets",
    payloadSchema: switchTestReportPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Saskia", "Devon", "Helena", "Rohan", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["BCBS-239-2013", "RAS-B7"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md §4 (PR #58)",
  },
  // M1 IFRS-classification + sub-ledger family — emitted by Bea's
  // m1-ifrs-classification-rules handler under D-MARKETS-SCHEMA-FOUNDATION
  // (CEO approved 2026-05-07). `IfrsClassificationApplied` records the
  // IFRS-9 / IFRS-13 / IAS-21 dispatch outcome per equity trade
  // (category, hierarchy level, FX flag, business model, SPPI result);
  // `SubLedgerPostingEmitted` records the trade-date / settlement-date
  // / dividend-accrual posting derived from the classification. Both
  // are append-only-audit: the accounting record is forensic — a
  // re-classification or correction posts a new event, never an
  // overwrite (Principle 1; matches the audit-trail expectation under
  // IAS 1 / Companies Act 71/2008 s.28-30 accounting records).
  // Retention floor is 7 years (SA accounting + tax retention norm:
  // Companies Act 71/2008 s.24 record-retention period for accounting
  // records and supporting documents). Subscribers: Anya consumes for
  // GL-projection assembly; Camille (CFO) + Bea consume for the
  // close engine; Vera for the IFRS-classification recon.
  {
    type: "IfrsClassificationApplied",
    class: "markets",
    payloadSchema: ifrsClassificationAppliedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Anya", "Camille", "Bea", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "IFRS-9-§4.1.1",
      "IFRS-9-§4.1.2",
      "IFRS-9-§5.7.5",
      "IFRS-13-§72-90",
      "IAS-21-§23",
      "ORG-AC-01",
      "ORG-AC-05",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    // Retention floor: ≥7 years — Companies Act 71/2008 s.24
    // (accounting-records retention) covers IFRS-classification
    // outputs as supporting accounting documents. The bank's
    // Principle-1 default retains the append-only log indefinitely;
    // the 7-year floor is the regulator-mandated minimum.
    source:
      "runtime/agents/bea-m1-ifrs-classification-rules.ts; Team Inbox/2026-05-07_brief_bea_m1-ifrs-classification-rules.md; D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md §5 (retention floor: Companies Act 71/2008 s.24 accounting records, ≥7y)",
  },
  {
    type: "SubLedgerPostingEmitted",
    class: "markets",
    // PT passthrough: postingType enum in the typed schema covers ["trade-booking",
    // "revaluation", "settlement", "reversal"] but existing test code and scenarios
    // also use "trade-date-booking" and "settlement-confirmation". Using PT here
    // satisfies the F-032 coverage gate while preserving compatibility with existing
    // callers. A follow-up task should align the enum across schema + callers.
    payloadSchema: PT,
    issuer: "Bea",
    subscribers: ["Anya", "Camille", "Bea", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "IFRS-9-§4.1.1",
      "IAS-1",
      "IAS-21-§23",
      "ORG-AC-01",
      "ORG-AC-08",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    // Retention floor: ≥7 years — Companies Act 71/2008 s.24
    // (accounting-records retention period for company financial
    // records and supporting documentation). Sub-ledger postings are
    // the accounting record; the GL projection (Anya) is a derived
    // cache. Principle-1 default keeps the log indefinitely.
    source:
      "runtime/agents/bea-m1-ifrs-classification-rules.ts; Team Inbox/2026-05-07_brief_bea_m1-ifrs-classification-rules.md; D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md §5 (retention floor: Companies Act 71/2008 s.24 accounting records, ≥7y)",
  },
  // M1 CDM equity events — schemas live at platform/markets/cdm/equity.ts
  // (their natural domain home); referenced from the registry to satisfy
  // F-032 event-type-registry-coverage. Issuer is `Kai` (M1 OMS / EMS
  // bookings) with the M1-tranche subscriber set already exercising the
  // payloads through `m1-projection-runtime-mapping` (Anya) and
  // `m1-ifrs-classification-rules` (Bea).
  {
    type: "EquityTradeBooked",
    class: "markets",
    payloadSchema: equityTradeBookedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Anya", "Bea", "Rohan", "Mira", "Tomas", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["JSE-RULES-EQUITIES", "FMA-S5", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/equity.ts (Kai M1 bindings); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  {
    type: "EquitySettlementInstructed",
    class: "markets",
    payloadSchema: equitySettlementInstructedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Tomas", "Bea", "Anya", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["JSE-RULES-EQUITIES", "STRATE-RULES", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/equity.ts (Kai M1 bindings); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  {
    type: "EquityCorporateActionApplied",
    class: "markets",
    payloadSchema: equityCorporateActionAppliedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Anya", "Bea", "Rohan", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["JSE-RULES-EQUITIES", "IFRS-9-§5.7.5", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/equity.ts (Kai M1 bindings); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  // M3 CDM Equity events (M3 slice, Kai 2026-05-17) — extended equity lifecycle:
  // EquityTradeExecuted, EquitySettlementConfirmed, EquityPositionRevalued.
  // Schemas at platform/markets/cdm/equity.ts. Exercised by scenario 08.
  {
    type: "EquityTradeExecuted",
    class: "markets",
    payloadSchema: equityTradeExecutedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Anya", "Bea", "Rohan", "Mira", "Tomas", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["JSE-EQUITIES-RULES", "IFRS-9-§4.1", "D-MARKETS-SCHEMA-FOUNDATION"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/equity.ts (Kai M3 equity lifecycle); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); scenarios/08-equity-trade.ts",
  },
  {
    type: "EquitySettlementConfirmed",
    class: "markets",
    payloadSchema: equitySettlementConfirmedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Anya", "Bea", "Kai", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["STRATE-RULE-7", "JSE-EQUITIES-RULES", "D-MARKETS-SCHEMA-FOUNDATION"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/equity.ts (Kai M3 equity lifecycle); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); scenarios/08-equity-trade.ts",
  },
  {
    type: "EquityPositionRevalued",
    class: "markets",
    payloadSchema: equityPositionRevaluedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Bea", "Anya", "Rohan", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["IFRS-9-§5.7.1", "IFRS-9-§4.1", "JSE-EQUITIES-RULES"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/equity.ts (Kai M3 equity lifecycle); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); scenarios/08-equity-trade.ts",
  },
  // M3 CDM FX events — schemas at platform/markets/cdm/fx.ts. Today
  // exercised by the FX end-to-end rehearsal scenario + dashboard widget;
  // registry rows close the F-032 surface so the typed payload contract
  // is enforced at append-time regardless of caller.
  {
    type: "FxTradeExecuted",
    class: "markets",
    payloadSchema: fxTradeExecutedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Anya", "Bea", "Rohan", "Tomas", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["FMA-S5", "EXCON-SARB-CIRC-3-2020", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/fx.ts (Kai M3 FX bindings); scenarios/03-fx-end-to-end-rehearsal.ts; Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  {
    type: "FxSettlementInstructed",
    class: "markets",
    payloadSchema: fxSettlementInstructedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Tomas", "Bea", "Anya", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["FMA-S5", "EXCON-SARB-CIRC-3-2020", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/fx.ts (Kai M3 FX bindings); scenarios/03-fx-end-to-end-rehearsal.ts; Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md §5",
  },
  // PrincipalPayment — emitted when the correspondent actions a settlement leg
  // (deliver or receive). Two per FX Spot trade (one per currency leg). Closes
  // the instruction loop opened by FxSettlementInstructed. Per D-FX-CLS-MEMBERSHIP
  // correspondent-routing decision. Retention: 7y (trade-record retention norm).
  {
    type: "PrincipalPayment",
    class: "markets",
    payloadSchema: principalPaymentPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Bea", "Anya", "Mira", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["D-FX-CLS-MEMBERSHIP", "D-FX-AD-STATUS", "EXCON-SARB-CIRC-3-2020"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/fx.ts (Kai M4 FX settlement lifecycle); scenarios/06-fx-spot-trade.ts; D-FX-CLS-MEMBERSHIP; D-MARKETS-SCHEMA-FOUNDATION",
  },
  // SettlementConfirmed — final lifecycle event for an FX Spot (or Forward/Swap)
  // trade; closes the trade lifecycle once both principal payments are confirmed.
  // Carries realised P&L delta and optional FinSurv reference.
  {
    type: "SettlementConfirmed",
    class: "markets",
    payloadSchema: settlementConfirmedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Bea", "Anya", "Mira", "Rohan", "Vera"],
    replay: "idempotent-terminal",
    citationsHint: [
      "D-FX-CLS-MEMBERSHIP",
      "D-FX-AD-STATUS",
      "EXCON-SARB-CIRC-3-2020",
      "IAS-21-§23",
    ],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/fx.ts (Kai M4 FX settlement lifecycle); scenarios/06-fx-spot-trade.ts; D-FX-CLS-MEMBERSHIP; D-MARKETS-SCHEMA-FOUNDATION",
  },
  // SettlementRealisedPnlCorrected — corrective event for SettlementConfirmed
  // events that were historically emitted with realisedPnlDelta: 0 (substrate
  // gap: the post-trade lifecycle emitter did not compute realised P&L at
  // emission time). Option A per the brief: new event type, not in-place
  // mutation (Principle 1 — events immutable). Folded by the daily-pnl
  // projection to supersede the zero.
  //
  // Authority: IAS 21 §28; PR-FX-LIFECYCLE-CLOSE; D-FX-QUOTING-CONVENTION.
  // Author: Bea (Accounting & financial reporting engineer, engineering).
  {
    type: "SettlementRealisedPnlCorrected",
    class: "markets",
    payloadSchema: settlementRealisedPnlCorrectedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Anya", "Rohan", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["IAS-21-§28", "PR-FX-LIFECYCLE-CLOSE", "D-FX-QUOTING-CONVENTION"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "scripts/backfill-fx-settlement-realised-pnl.ts; platform/product-control/daily-pnl.ts; IAS 21 §28",
  },
  // NdfFixingObserved — FX-Forward NDF variant only. Records the observed
  // fixing rate and the resulting net cash settlement amount on the fixing
  // date. Replaces the gross-principal exchange of a deliverable forward.
  // Per D-MARKETS-SCHEMA-FOUNDATION + D-FX-AD-STATUS (FinSurv reporting on
  // NDF cross-border flows). Retention: 7y (trade-record retention norm).
  {
    type: "NdfFixingObserved",
    class: "markets",
    payloadSchema: ndfFixingObservedPayloadSchema,
    issuer: "Saskia",
    subscribers: ["Tomas", "Bea", "Anya", "Mira", "Rohan", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["D-FX-AD-STATUS", "ORG-EXCON-ODP-001", "IFRS-9-§3.2.3"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/cdm/fx.ts (Saskia M4 FX forwards lifecycle); scenarios/07-fx-forward-trade.ts; D-MARKETS-SCHEMA-FOUNDATION",
  },
  // CDM substrate — bindings-regeneration self-test, emitted by Kai's
  // m1-cdm-typescript-bindings handler after inventory + round-trip. The
  // payload records the surface inventory + self-test outcome; downstream
  // subscribers re-validate their mappings on the latest event per stream.
  {
    type: "CdmBindingsRegenerated",
    class: "markets",
    payloadSchema: cdmBindingsRegeneratedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Anya", "Bea", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["GOV-FRAMEWORK-CEO-RESERVED", "ISDA-CDM"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/event-store/event-types-cdm.ts; runtime/agents/kai-m1-cdm-typescript-bindings.ts; D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07)",
  },
  // ---------------------------------------------------------------------------
  // Slice 5 — pre-trade risk controls
  //
  // `OrderRejected` — emitted when a pre-trade limit check (RAS cluster B1–B5)
  // blocks an order at the notional/exposure limit. Distinct from
  // `OrderRejectedAtGateway` (check-level rejection). Retention: 7 years per
  // ORG-JSE-IRC-01 (JSE Integrated Risk Controls record-retention).
  // Authors: Kai (Markets engineer) + Helena (CRO) + Rohan (Risk engineer).
  //
  // `RasLimitSchedulePublished` — Helena publishes the active RAS limit
  // schedule; feeds the LimitUtilisationProjection denominator per cluster.
  // Governance-grade 7-year retention (RAS decisions are board-level records).
  //
  // Authority: D-MARKETS-SCHEMA-FOUNDATION, Slice 5.
  // ---------------------------------------------------------------------------
  {
    type: "OrderRejected",
    class: "markets",
    payloadSchema: orderRejectedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Helena", "Rohan", "Saskia", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["ORG-JSE-IRC-01", "JSE-RULES-EQUITIES", "FMA-S5"],
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "D-MARKETS-SCHEMA-FOUNDATION Slice 5; platform/projections/markets/limit-utilisation.ts; ORG-JSE-IRC-01",
  },
  {
    type: "RasLimitSchedulePublished",
    class: "markets",
    payloadSchema: rasLimitSchedulePublishedPayloadSchema,
    issuer: "Helena",
    subscribers: ["Rohan", "Kai", "Saskia", "Camille", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["ORG-PR-19", "ORG-PR-48", "GOV-FRAMEWORK-CEO-RESERVED"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "D-MARKETS-SCHEMA-FOUNDATION Slice 5; platform/projections/markets/limit-utilisation.ts; Helena RAS mandate",
  },
  {
    // `MarketRiskMeasureComputed` — VaR / SVaR / ES surfaced from the market-risk
    // engine as the risk-calibrated rung of the appetite stack (RAS B3 review R8 /
    // D-B3-5). Separate line from the B3 NOP position limit; closes the semantic
    // gap behind vera:mr-1-fx-var-projection-gap. Latest-wins per entity+day.
    //
    // Authority: D-B3-5 (R8); D-BRC-INTERIM-MR-1-FX; D-MARKETS-SCHEMA-FOUNDATION.
    // Authors: Rohan (Risk engineer) + Helena (Chief Risk Officer, governance).
    type: "MarketRiskMeasureComputed",
    class: "markets",
    payloadSchema: marketRiskMeasureComputedPayloadSchema,
    issuer: "Rohan",
    subscribers: ["Helena", "Saskia", "Camille", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["D-BRC-INTERIM-MR-1-FX", "WS-MARKET-RISK-PROCEDURES", "BCBS-D457-MAR33"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "D-B3-5 (R8); platform/market-risk/var-engine.ts; platform/projections/markets/market-risk-measure.ts",
  },
  // ---------------------------------------------------------------------------
  // M5 OTC IRS lifecycle events — CDM schemas at platform/markets/cdm/ird.ts.
  // Exercised by scenario 10. Retention: 7y governance (OTC derivative records
  // under Companies Act s.24 + ISDA-2002-MASTER audit trail).
  //
  // Authority: D-MARKETS-SCHEMA-FOUNDATION; ISDA-2002-MASTER; IFRS-9-§4.1;
  //            ORG-PR-11; BCBS-D365-IRRBB.
  // Authors: Eitan (IRRBB / derivatives engineer, engineering)
  // ---------------------------------------------------------------------------
  {
    type: "IrsTradeBooked",
    class: "markets",
    payloadSchema: irsTradeBookedPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Anya", "Bea", "Rohan", "Mira", "Tomas", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: ["D-MARKETS-SCHEMA-FOUNDATION", "ISDA-2002-MASTER", "IFRS-9-§4.1", "ORG-PR-11"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "platform/markets/cdm/ird.ts (Eitan M5 IRS lifecycle); D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07); scenarios/10-irs-trade.ts",
  },
  {
    type: "IrsCouponScheduleGenerated",
    class: "markets",
    payloadSchema: irsCouponScheduleGeneratedPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Anya", "Bea", "Rohan", "Tomas", "Vera"],
    replay: "latest-wins-per-key",
    citationsHint: [
      "D-MARKETS-SCHEMA-FOUNDATION",
      "ISDA-2002-MASTER",
      "ISDA-2006-DEFINITIONS",
      "IFRS-9-§4.1",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "platform/markets/cdm/ird.ts (Eitan M5 IRS lifecycle); platform/markets/ird/coupon-schedule.ts; scenarios/10-irs-trade.ts",
  },
  {
    type: "IrsCouponPaymentInstructed",
    class: "markets",
    payloadSchema: irsCouponPaymentInstructedPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Tomas", "Bea", "Anya", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["D-MARKETS-SCHEMA-FOUNDATION", "ISDA-2002-MASTER", "ORG-PR-11"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/markets/cdm/ird.ts (Eitan M5 IRS lifecycle); scenarios/10-irs-trade.ts",
  },
  {
    type: "IrsCouponSettlementConfirmed",
    class: "markets",
    payloadSchema: irsCouponSettlementConfirmedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Bea", "Anya", "Eitan", "Rohan", "Vera"],
    replay: "pair-coupled",
    citationsHint: ["D-MARKETS-SCHEMA-FOUNDATION", "ISDA-2002-MASTER"],
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/markets/cdm/ird.ts (Eitan M5 IRS lifecycle); scenarios/10-irs-trade.ts",
  },
  {
    type: "IrsPositionRevalued",
    class: "markets",
    payloadSchema: irsPositionRevaluedPayloadSchema,
    issuer: "Eitan",
    subscribers: ["Bea", "Anya", "Rohan", "Vera"],
    replay: "append-only-audit",
    citationsHint: ["IFRS-9-§4.1", "BCBS-D365-IRRBB", "D-MARKETS-SCHEMA-FOUNDATION"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "platform/markets/cdm/ird.ts (Eitan M5 IRS lifecycle); platform/markets/eod/irs-revaluation.ts; scenarios/10-irs-trade.ts",
  },
];

// ===========================================================================
// Bank-account event family — D-BANK-ACCOUNT-SUBSTRATE.
//
// Standing authority: D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10),
// which adopted D-BANK-ACCOUNT-SUBSTRATE as a sub-decision under its
// umbrella per pack §6 brief #A1. No new CEO approval required.
//
// Three events govern the lifecycle of a bank-owned account (nostro / vostro
// / capital / SARB-operational / clearing / internal-suspense). Every
// posting in the bank's sub-ledger ultimately dispatches against an account
// in this family — the account-master + account-balance projections are the
// typed input to every BA-return cell and AFS line that decomposes into a
// `Balance` semantic-layer query.
//
// Class is `governance` because account opening / closing decisions are
// regulator-relevant under Banks Act + the bank's own Records Management
// Policy (account openings feed BA-return composition and the chart-of-
// accounts mapping is itself a board-approved register). Retention is
// 7-year governance + a citation chain into the chart-of-accounts.
//
// Authors: Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; lead) · Atlas (Core banking platform architect, engineering
//   — substrate consult) · Bea (Accounting & financial reporting engineer,
//   engineering — reports to Camille CFO; chart-of-accounts integration).
// ===========================================================================

export const BANK_ACCOUNT_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "BankAccountOpened",
    class: "governance",
    payloadSchema: bankAccountOpenedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea", "Eitan", "Anya", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: [
      "D-FIRST-DRY-RUN-SCENARIO",
      "D-BANK-ACCOUNT-SUBSTRATE",
      "INTERNAL-FINANCE-CHART-OF-ACCOUNTS",
    ],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md §6 #A1; D-BANK-ACCOUNT-SUBSTRATE",
  },
  {
    type: "BankAccountConfigured",
    class: "governance",
    payloadSchema: bankAccountConfiguredPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea", "Helena", "Eitan", "Vera", "dashboard"],
    replay: "cumulative-fold",
    citationsHint: ["D-FIRST-DRY-RUN-SCENARIO", "D-BANK-ACCOUNT-SUBSTRATE"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md §6 #A1; D-BANK-ACCOUNT-SUBSTRATE",
  },
  {
    type: "BankAccountClosed",
    class: "governance",
    payloadSchema: bankAccountClosedPayloadSchema,
    issuer: "Tomas",
    subscribers: ["Tomas", "Bea", "Eitan", "Anya", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: ["D-FIRST-DRY-RUN-SCENARIO", "D-BANK-ACCOUNT-SUBSTRATE"],
    retention: RETENTION_GOVERNANCE_7Y,
    source:
      "Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md §6 #A1; D-BANK-ACCOUNT-SUBSTRATE",
  },
];

// ===========================================================================
// Period-close event family — D-REPORTING-CAPABILITY-SLICE-2.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 2. Three event types govern accounting-period
// close per entity (per pack §6 Q2: each Hoz entity closes independently).
// ===========================================================================

export const PERIOD_CLOSE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "AccountingPeriodOpened",
    class: "markets", // accounting events sit in the same class as M1 sub-ledger postings
    payloadSchema: accountingPeriodOpenedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Anya", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-2",
      "IAS-1",
      "IAS-21-§9",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md §6 Slice 2; D-REPORTING-CAPABILITY-SLICE-2",
  },
  {
    type: "AccountingPeriodClosed",
    class: "markets",
    payloadSchema: accountingPeriodClosedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Anya", "Helena", "Eitan", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-2",
      "IAS-1",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md §6 Slice 2; D-REPORTING-CAPABILITY-SLICE-2",
  },
  {
    type: "TrialBalanceSnapshotted",
    class: "markets",
    payloadSchema: trialBalanceSnapshottedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Anya", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "D-REPORTING-CAPABILITY-SLICE-2",
      "IAS-1",
      "COMPANIES-ACT-71-2008-S24",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md §6 Slice 2; D-REPORTING-CAPABILITY-SLICE-2",
  },
  {
    // Emitted by Bea (Accounting & financial reporting engineer) at the end
    // of each monthly balance-sheet substantiation run. Every
    // AccountingPeriodClosed must be followed within 2 agent ticks by this
    // event (Vera-enforced). Registry row added under F-032 (Atlas,
    // 2026-05-16) — factory shipped earlier without a row, leaving the
    // payload schema unenforced at append-time.
    type: "BalanceSheetSubstantiationCompleted",
    class: "markets",
    payloadSchema: balanceSheetSubstantiationCompletedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Anya", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: [
      "PROC-FIN-BSS-01",
      "IAS-1",
      "COMPANIES-ACT-71-2008-S28",
      "COMPANIES-ACT-71-2008-S29",
      "COMPANIES-ACT-71-2008-S30",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "platform/event-store/event-types/accounting.ts (factory); PROC-FIN-BSS-01 — Procedures/balance-sheet-substantiation.md",
  },
  {
    // MC14 trigger — emitted by the month-end close engine after PeriodClosed
    // to kick off BA-return generation (PROC-FIN-BA-01). The idempotency check
    // in ba-return-trigger.ts prevents duplicate triggers per (period, entity).
    // PA submission deadline: 20 calendar days after month-end (Banks Act s90;
    // PA BA return submission requirements).
    type: "BAReturnGenerationTriggered",
    class: "markets",
    payloadSchema: baReturnGenerationTriggeredPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Mira", "Vera", "dashboard"],
    replay: "idempotent-terminal",
    citationsHint: [
      "PROC-FIN-MC-01",
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "BANKS-ACT-94-1990-S90",
      "IAS-1",
    ],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "platform/accounting/ba-return-trigger.ts; PROC-FIN-MC-01 §5 MC14; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
  },
  {
    // ManualJournalEntry — an authorised agent or human posts a manual
    // double-entry journal to the GL. Carries balanced legs (debits = credits
    // per currency). Consumed by the GL projection (gl-projection.ts) to
    // build the ledger view at any asOf.
    //
    // Authority: General-ledger substrate (Devon COO, engineering).
    // Issuers: Bea (Accounting & financial reporting engineer, engineering);
    //          authorised human via the dashboard POST /api/gl/journal.
    type: "ManualJournalEntry",
    class: "markets",
    payloadSchema: manualJournalEntryPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["IAS-1", "IAS-8", "PROC-FIN-MC-01"],
    retention: RETENTION_ACCOUNTING_7Y,
    source: "platform/accounting/gl-projection.ts; dashboard/gl-view.ts",
  },
  {
    // SubLedgerPostingRemediationRecorded — append-only remediation record that
    // closes orphaned SubLedgerPostingEmitted fixtures whose sourceEventId no
    // longer resolves (retired primary events). Enumerates every remediated
    // source-event-id (no silent cap) and names the balanced reversal postings
    // that neutralise the orphans. Consulted by recon:posting-source-id-canonical.
    //
    // Surfaced by: BalanceSheetSubstantiationCompleted 7175ebcb (2026-05-SEED);
    // SubstrateAlert alert:integrity:bss-posting-noncanonical-source-ids.
    // Authority: PROC-FIN-BSS-01 §3a; FIN-BSS-01; Principles/1-events-are-truth.md.
    // Author: Atlas (Core banking platform architect, engineering).
    type: "SubLedgerPostingRemediationRecorded",
    class: "markets",
    payloadSchema: subLedgerPostingRemediationRecordedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Bea", "Camille", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["PROC-FIN-BSS-01", "FIN-BSS-01", "IAS-8"],
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "platform/event-store/event-types/accounting.ts (factory); scripts/remediate-seed-orphan-postings.ts; PROC-FIN-BSS-01 §3a",
  },
];

// ---------------------------------------------------------------------------
// Customer lifecycle event types — Onboarding Slice 2
//
// 7 new phase event types completing the 21-phase institutional counterparty
// onboarding model. KYC/CDD records have long retention under FIC Act
// s.22 (5 years minimum); FAIS + POPIA records mirror that floor;
// credit-assessment and account-setup records treated as governance
// retention (7 years) for audit-trail integrity.
//
// Authority: FAIS-ACT-37-2002, FIC-ACT-38-2001, AML-CFT-POLICY-V1,
//            POPIA-S11, RT-CR.CP, TRADING-MANDATE-V1
// Issuer: Niko (Client lifecycle, sales) primary;
//         Zara (MLRO) for SanctionsClearancePassed.
// ---------------------------------------------------------------------------

export const CUSTOMER_LIFECYCLE_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "CounterpartyFaisClassified",
    class: "markets",
    payloadSchema: counterpartyFaisClassifiedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Zara", "Mira", "Imani", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: [
      "FAIS-ACT-37-2002",
      "urn:obligation:bank:fais:general-code-of-conduct:v1",
      "ORG-CD-01",
    ],
    // FAIS classification record: 5y per FIC Act s.22 CDD-equivalent floor.
    retention: RETENTION_FIC_5Y,
    source: "platform/lifecycle/onboarding-orchestrator.ts; D-LIFECYCLE-SLICE-2",
  },
  {
    type: "BeneficialOwnerResolved",
    class: "markets",
    payloadSchema: beneficialOwnerResolvedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Zara", "Mira", "Imani", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1", "ORG-FC-05"],
    // UBO chain is a FIC Act s.22 CDD record — 5y minimum floor.
    retention: RETENTION_FIC_5Y,
    source: "platform/lifecycle/onboarding-orchestrator.ts; D-LIFECYCLE-SLICE-2",
  },
  {
    type: "SanctionsClearancePassed",
    class: "markets",
    payloadSchema: sanctionsClearancePassedPayloadSchema,
    issuer: "Zara",
    subscribers: ["Niko", "Mira", "Helena", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["FIC-ACT-38-2001", "AML-CFT-POLICY-V1", "ORG-FC-05", "ORG-FC-06"],
    // Sanctions screening record: FIC Act s.28A + FAFT Recommendation 6 —
    // treated as governance-grade 7y for audit-trail integrity.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/lifecycle/onboarding-orchestrator.ts; D-LIFECYCLE-SLICE-2",
  },
  {
    type: "FatcaCrsClassified",
    class: "markets",
    payloadSchema: fatcaCrsClassifiedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Zara", "Yael", "Mira", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["FIC-ACT-38-2001", "ORG-FC-05"],
    // FATCA/CRS tax-residency record: FIC Act s.22 floor + OECD CRS
    // reporting obligations — governance-grade 7y.
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/lifecycle/onboarding-orchestrator.ts; D-LIFECYCLE-SLICE-2",
  },
  {
    type: "PopiaConsentRecorded",
    class: "markets",
    payloadSchema: popiaConsentRecordedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Iris", "Mira", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["POPIA-S11", "ORG-PP-01"],
    // POPIA processing consent: governance-grade 7y for audit-trail
    // integrity (POPIA s.14 right of access; deletion challenge window).
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/lifecycle/onboarding-orchestrator.ts; D-LIFECYCLE-SLICE-2",
  },
  {
    type: "CreditAssessmentCompleted",
    class: "markets",
    payloadSchema: creditAssessmentCompletedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Helena", "Camille", "Saskia", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["TRADING-MANDATE-V1", "RAS-FRAMEWORK-2026-05-06-B3", "RT-CR.CP"],
    // Credit-assessment record: governance-grade 7y (Banks Act / RAS
    // director-decision retention; RT-CR.CP audit trail).
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/lifecycle/onboarding-orchestrator.ts; D-LIFECYCLE-SLICE-2",
  },
  {
    type: "AccountsSetupCompleted",
    class: "markets",
    payloadSchema: accountsSetupCompletedPayloadSchema,
    issuer: "Niko",
    subscribers: ["Tomas", "Bea", "Saskia", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["TRADING-MANDATE-V1", "ORG-OP-01"],
    // Account-setup record: governance-grade 7y (accounting-records
    // retention under Companies Act s.24).
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/lifecycle/onboarding-orchestrator.ts; D-LIFECYCLE-SLICE-2",
  },
  // ---------------------------------------------------------------------------
  // FTP (Funds Transfer Pricing) event family.
  //
  // FtpCurvePublished — Ravi publishes a new ZAR FTP curve each morning via
  //   ravi:ftp-curve-publish. The curve maps tenors to rates; consumed by the
  //   FTP attribution engine and Eitan's ALCO NII-at-risk dashboard.
  //
  // FtpAttributionRecorded — per-transaction spread attribution record emitted
  //   by ravi:ftp-attribution on each trade/loan event. Enables ALCO to assess
  //   true transaction profitability relative to the bank's cost of funds.
  //
  // Authority: D-MARKETS-SCHEMA-FOUNDATION.
  // Authors: Ravi (Treasury/ALM Engineer, engineering) + Eitan (Treasurer, governance).
  // ---------------------------------------------------------------------------
  {
    type: "FtpCurvePublished",
    class: "markets",
    payloadSchema: ftpCurvePublishedPayloadSchema,
    issuer: "Ravi",
    subscribers: ["Eitan", "Ravi", "Camille", "Vera", "dashboard"],
    replay: "latest-wins-per-key",
    citationsHint: ["BANKS-ACT-94-1990", "BANKS-REG-26", "BANKS-REG-27", "BCBS-D365-IRRBB"],
    // FTP curve: governance-grade 7y (ALCO decision record; NII-at-risk audit trail).
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/platform/ftp/; D-MARKETS-SCHEMA-FOUNDATION; Team/Ravi.md",
  },
  {
    type: "FtpAttributionRecorded",
    class: "markets",
    payloadSchema: ftpAttributionRecordedPayloadSchema,
    issuer: "Ravi",
    subscribers: ["Eitan", "Camille", "Rohan", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["BANKS-ACT-94-1990", "BANKS-REG-26", "BCBS-D365-IRRBB"],
    // Attribution record: governance-grade 7y (ALCO / NII-at-risk audit trail).
    retention: RETENTION_GOVERNANCE_7Y,
    source: "platform/ftp/attribution.ts; D-MARKETS-SCHEMA-FOUNDATION; Team/Ravi.md",
  },
  // ---------------------------------------------------------------------------
  // FX desk Slice 3 — RFQ lifecycle events (Kai, 2026-05-18)
  //
  // RfqRequested — emitted when the FX desk receives an RFQ from a counterparty.
  //   Precedes QuoteResponded and FxTradeExecuted in the trade lifecycle.
  //
  // QuoteResponded — emitted when the seed-data pricer (v1) responds with a
  //   bid/offer/mid. Slice 3 replaces the fixed-spread stub with a market-
  //   data-driven quote sourced from seeds/fx-rates.json.
  //
  // Authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10)
  // Authors: Kai (Trading systems engineer, engineering) + Saskia (Head of
  //          Global Markets, governance) + Rohan (Risk engineer)
  // ---------------------------------------------------------------------------
  {
    type: "RfqRequested",
    class: "markets",
    payloadSchema: rfqRequestedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Saskia", "Rohan", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-FX-SALES-TRADING-FRONTEND", "ORG-JSE-IRC-01", "FIC-ACT-38-2001"],
    // JSE trade record — 7y per JSE Integrated Risk Controls record-retention
    // obligations (ORG-JSE-IRC-01).
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "dashboard/markets-fx-trade.ts; D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10); Slice 3",
  },
  {
    type: "QuoteResponded",
    class: "markets",
    payloadSchema: quoteRespondedPayloadSchema,
    issuer: "Kai",
    subscribers: ["Saskia", "Rohan", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-FX-SALES-TRADING-FRONTEND", "ORG-JSE-IRC-01"],
    // JSE trade record — 7y per JSE Integrated Risk Controls record-retention
    // obligations (ORG-JSE-IRC-01). Quote audit trail for best-execution review.
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "dashboard/markets-fx-trade.ts; D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10); Slice 3",
  },
];
