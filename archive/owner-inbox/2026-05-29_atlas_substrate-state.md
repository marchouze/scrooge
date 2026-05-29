---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-29T23:00:23.238Z
decision-required: false
---

# Atlas — substrate state, 2026-05-29

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 119851 events across 172 types; 31/31 personas have operating specs; 128 runtime handlers registered; 508 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 119851

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 44284 | 2026-05-27 | 2026-05-29 |
| `InboundMessageReceived` | 13423 | 2026-05-25 | 2026-05-28 |
| `SubstrateAgentRunStarted` | 5500 | 2026-05-25 | 2026-05-29 |
| `BusDispatched` | 5406 | 2026-05-25 | 2026-05-29 |
| `SubstrateAgentRunCompleted` | 5338 | 2026-05-25 | 2026-05-29 |
| `GatewayCheckRequested` | 4074 | 2026-05-09 | 2026-05-20 |
| `SubLedgerPostingEmitted` | 2857 | 2026-05-09 | 2026-05-29 |
| `Decision` | 2677 | 2026-04-30 | 2026-05-29 |
| `GatewayCheckCompleted` | 2496 | 2026-05-17 | 2026-05-20 |
| `RiskRaised` | 1958 | 2025-12-01 | 2026-05-29 |
| `OrderProposed` | 1650 | 2026-05-09 | 2026-05-20 |
| `ISDACSAAssessmentCompleted` | 1490 | 2024-01-01 | 2026-05-20 |
| `LegacyFanoutShadowed` | 1352 | 2026-05-25 | 2026-05-29 |
| `CreditLimitLoaded` | 1327 | 2024-01-01 | 2026-05-21 |
| `CreditLimitApplicationSubmitted` | 1308 | 2024-01-01 | 2026-05-20 |
| `CreditLimitApproved` | 1308 | 2024-01-01 | 2026-05-20 |
| `RecordFiled` | 1076 | 2026-05-05 | 2026-05-29 |
| `CreditAnalysisCompleted` | 990 | 2024-01-01 | 2026-05-20 |
| `CreditLimitProposed` | 990 | 2024-01-01 | 2026-05-20 |
| `CcrReplacementCostComputed` | 873 | 2026-05-18 | 2026-05-20 |
| `WorkstreamRegistered` | 844 | 2026-05-07 | 2026-05-29 |
| `BacktestRequested` | 816 | 2026-01-10 | 2026-01-10 |
| `BacktestRun` | 769 | 2026-05-09 | 2026-05-09 |
| `FxTradeExecuted` | 685 | 2026-05-17 | 2026-05-28 |
| `DashboardProjectionRefreshed` | 613 | 2026-05-25 | 2026-05-29 |
| `SubstrateAlert` | 610 | 2025-01-01 | 2026-05-29 |
| `MarketsProjectionRefreshed` | 585 | 2026-05-09 | 2026-05-09 |
| `ReconResult` | 558 | 2026-05-07 | 2026-05-29 |
| `ClientCandidateRegistered` | 544 | 2026-05-25 | 2026-05-29 |
| `ScheduledTrigger` | 539 | 2026-05-25 | 2026-05-29 |
| `CounterpartyFaisClassified` | 500 | 2026-05-01 | 2026-05-17 |
| `KYCIdentityCollected` | 492 | 2026-05-25 | 2026-05-29 |
| `KYCIdentityVerified` | 492 | 2026-05-25 | 2026-05-29 |
| `KYCSanctionsPEPScreened` | 492 | 2026-05-25 | 2026-05-29 |
| `KYCDecisionMade` | 491 | 2026-05-25 | 2026-05-29 |
| `AgentGoalEvaluated` | 443 | 2026-05-25 | 2026-05-29 |
| `ClientRejected` | 419 | 2026-05-25 | 2026-05-29 |
| `FxPositionRevalued` | 408 | 2026-05-28 | 2026-05-29 |
| `OfficialMarkAdopted` | 406 | 2026-05-28 | 2026-05-29 |
| `KYCUBOResolved` | 357 | 2026-05-25 | 2026-05-29 |
| `KYCRiskRated` | 357 | 2026-05-25 | 2026-05-29 |
| `AgentGoalDeferred` | 357 | 2026-05-25 | 2026-05-29 |
| `ClientAccepted` | 351 | 2026-05-13 | 2026-05-29 |
| `CcrEadComputed` | 339 | 2026-05-18 | 2026-05-20 |
| `LawfulProcessingRegistered` | 312 | 2026-05-25 | 2026-05-29 |
| `PrincipalPayment` | 274 | 2026-05-23 | 2026-05-29 |
| `FxSettlementInstructed` | 260 | 2026-05-25 | 2026-05-28 |
| `AgentRunCompleted` | 246 | 2026-05-10 | 2026-05-29 |
| `AgentBriefIssued` | 241 | 2026-05-10 | 2026-05-29 |
| `AgentRunStarted` | 238 | 2026-05-10 | 2026-05-29 |
| `AuditFinding` | 218 | 2026-05-07 | 2026-05-29 |
| `IdentityKeyRotated` | 182 | 2026-05-25 | 2026-05-29 |
| `M1CitationTrancheRegistered` | 180 | 2026-05-09 | 2026-05-09 |
| `IrsPositionRevalued` | 180 | 2026-05-19 | 2026-05-20 |
| `ProductDimensionAttested` | 170 | 2026-05-26 | 2026-05-28 |
| `SettlementConfirmed` | 169 | 2026-05-19 | 2026-05-29 |
| `SubstrateAgentRunFailed` | 157 | 2026-05-25 | 2026-05-29 |
| `PermissionPolicyPublished` | 141 | 2026-05-25 | 2026-05-27 |
| `IRRBBChecked` | 140 | 2026-05-26 | 2026-05-29 |
| `DecisionRequested` | 135 | 2026-05-10 | 2026-05-10 |
| `EquityTradeBooked` | 135 | 2026-05-09 | 2026-05-09 |
| `IfrsClassificationApplied` | 135 | 2026-05-09 | 2026-05-09 |
| `IrsTradeBooked` | 135 | 2026-05-20 | 2026-05-20 |
| `KYCEDDInitiated` | 134 | 2026-05-25 | 2026-05-29 |
| `KYCEDDCompleted` | 134 | 2026-05-25 | 2026-05-29 |
| `CdmBindingsRegenerated` | 119 | 2026-05-09 | 2026-05-26 |
| `OrderApprovedAtGateway` | 117 | 2026-05-17 | 2026-05-17 |
| `OrderRejectedAtGateway` | 117 | 2026-05-17 | 2026-05-17 |
| `IntradayHQLAStressProjection` | 112 | 2026-05-26 | 2026-05-29 |
| `SubstrateStateSnapshot` | 105 | 2026-05-07 | 2026-05-29 |
| `AgentPerformanceEvaluated` | 91 | 2026-05-25 | 2026-05-29 |
| `AgentFeedbackIssued` | 91 | 2026-05-25 | 2026-05-29 |
| `CreditLimitBreached` | 90 | 2026-05-22 | 2026-05-22 |
| `CreditLimitBreachDisposed` | 90 | 2026-05-23 | 2026-05-23 |
| `LiquidityLimitBreached` | 90 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 90 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 90 | 2026-05-10 | 2026-05-10 |
| `AgentGoalSelected` | 86 | 2026-05-25 | 2026-05-29 |
| `PartyRelationshipAsserted` | 81 | 2026-05-19 | 2026-05-26 |
| `AgentEscalation` | 77 | 2026-05-07 | 2026-05-28 |
| `DailyPnLReportGenerated` | 73 | 2026-05-25 | 2026-05-29 |
| `DocumentRegistered` | 71 | 2026-05-11 | 2026-05-25 |
| `FxTradeCancelled` | 55 | 2026-05-21 | 2026-05-28 |
| `ConflictOfInterestDisclosed` | 55 | 2026-05-17 | 2026-05-17 |
| `BestExecutionVerified` | 54 | 2026-05-17 | 2026-05-17 |
| `SanctionsClearancePassed` | 52 | 2026-05-13 | 2026-05-13 |
| `PEPScreeningCompleted` | 52 | 2026-05-13 | 2026-05-13 |
| `BeneficialOwnerResolved` | 52 | 2026-05-13 | 2026-05-13 |
| `RiskRatingAssigned` | 52 | 2026-05-13 | 2026-05-13 |
| `DataProjectionSnapshot` | 49 | 2026-05-07 | 2026-05-29 |
| `InboxHygieneSweep` | 49 | 2026-05-07 | 2026-05-29 |
| `FaisClassificationSuitabilityChecked` | 49 | 2026-05-17 | 2026-05-17 |
| `BestExecutionBreached` | 47 | 2026-05-17 | 2026-05-17 |
| `CreditLimitAnnualReviewCompleted` | 45 | 2026-05-21 | 2026-05-21 |
| `LexUtilisationComputed` | 45 | 2026-05-20 | 2026-05-20 |
| `BriefSuperseded` | 45 | 2026-05-10 | 2026-05-10 |
| `EquitySettlementInstructed` | 45 | 2026-05-13 | 2026-05-13 |
| `PaNotificationSubmitted` | 45 | 2026-05-11 | 2026-05-11 |
| `CreditLimitWithdrawn` | 45 | 2026-05-12 | 2026-05-12 |
| `OrderAccepted` | 45 | 2026-05-13 | 2026-05-13 |
| `ObligationsRegisterSnapshot` | 43 | 2026-05-07 | 2026-05-28 |
| `SecuritySubstrateSnapshot` | 43 | 2026-05-07 | 2026-05-28 |
| `GovernanceCyclePrep` | 41 | 2026-05-07 | 2026-05-28 |
| `AgentRegistered` | 41 | 2026-05-26 | 2026-05-27 |
| `PopiaConsentRecorded` | 39 | 2026-05-13 | 2026-05-13 |
| `PartyRegistered` | 37 | 2026-05-23 | 2026-05-26 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `CalculationPerformed` | 21 | 2026-05-29 | 2026-05-29 |
| `ModelValidationApproved` | 19 | 2026-05-27 | 2026-05-29 |
| `ModelSubmitted` | 16 | 2026-05-27 | 2026-05-29 |
| `ModelTierClassified` | 16 | 2026-05-27 | 2026-05-29 |
| `MtmRunCompleted` | 15 | 2026-05-26 | 2026-05-29 |
| `LCRComputed` | 14 | 2026-05-26 | 2026-05-29 |
| `NSFRComputed` | 14 | 2026-05-26 | 2026-05-29 |
| `FtpCurvePublished` | 14 | 2026-05-26 | 2026-05-29 |
| `ALMRunCompleted` | 14 | 2026-05-26 | 2026-05-29 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `AccountingReadinessSnapshot` | 13 | 2026-05-26 | 2026-05-29 |
| `AgentEscalationDecided` | 13 | 2026-05-26 | 2026-05-28 |
| `EddInitiated` | 13 | 2026-05-13 | 2026-05-13 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `ProductProposalRegistered` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductConceptualised` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductDueDiligenceCompleted` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductApproved` | 8 | 2026-05-26 | 2026-05-28 |
| `RiskAppetiteSnapshot` | 7 | 2026-05-27 | 2026-05-29 |
| `WorkstreamCompleted` | 7 | 2026-05-28 | 2026-05-28 |
| `CollateralInventorySnapshot` | 6 | 2026-05-26 | 2026-05-26 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `CounterpartyExposureCalculated` | 4 | 2026-05-18 | 2026-05-18 |
| `InterbankLoanPlaced` | 4 | 2026-05-27 | 2026-05-28 |
| `CollateralInventorySnapshotted` | 4 | 2026-05-28 | 2026-05-29 |
| `LCRRatioProjection` | 4 | 2026-05-28 | 2026-05-29 |
| `AgentDecision` | 3 | 2026-05-07 | 2026-05-28 |
| `AgentOpsReadinessSnapshot` | 3 | 2026-05-26 | 2026-05-29 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `LiquiditySnapshot` | 3 | 2026-05-28 | 2026-05-29 |
| `MLROAttestation` | 2 | 2026-05-26 | 2026-05-26 |
| `ConductObligationFlagged` | 2 | 2026-05-17 | 2026-05-17 |
| `AccountingPeriodOpened` | 2 | 2026-05-01 | 2026-05-28 |
| `TrialBalanceSnapshotted` | 2 | 2026-05-15 | 2026-06-01 |
| `RepoTradeOpened` | 2 | 2026-05-27 | 2026-05-28 |
| `DepositTaken` | 2 | 2026-05-27 | 2026-05-28 |
| `RepoTradeTerminatedEarly` | 2 | 2026-05-28 | 2026-05-28 |
| `InterbankLoanRecalledEarly` | 2 | 2026-05-28 | 2026-05-28 |
| `RegulatoryInstrumentRegistered` | 1 | 2026-05-25 | 2026-05-25 |
| `RegulatoryInstrumentContextualised` | 1 | 2026-05-25 | 2026-05-25 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `RasLimitSchedulePublished` | 1 | 2026-05-14 | 2026-05-14 |
| `ValidationFindingRaised` | 1 | 2026-05-27 | 2026-05-27 |
| `BalanceSheetProjected` | 1 | 2026-05-27 | 2026-05-27 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |
| `AccountingPeriodClosed` | 1 | 2026-06-01 | 2026-06-01 |
| `FundingLineDrawn` | 1 | 2026-05-27 | 2026-05-27 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `FXPositionBreach` | 1 | 2026-05-28 | 2026-05-28 |
| `DepositWithdrawnEarly` | 1 | 2026-05-28 | 2026-05-28 |
| `RoleResearchQueueSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `RiskRunCompleted` | 1 | 2026-05-29 | 2026-05-29 |
| `ALMReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `PaymentsReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `LegalReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `OperationalResilienceSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `CyberResilienceSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `POPIAControlsSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `AuditCommitteePackPrepped` | 1 | 2026-05-29 | 2026-05-29 |
| `TaxReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `MarketsReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `FinancialPositionSnapshot` | 1 | 2026-05-29 | 2026-05-29 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

128 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

| Agent | Trigger |
|---|---|
| Vera | `overnight-recon` |
| Vera | `codebase-quality-review` |
| Vera | `goal-loop` |
| Vera | `event-triage` |
| Atlas | `substrate-state` |
| Atlas | `goal-loop` |
| Atlas | `event-triage` |
| Atlas | `permission-policy-refresh` |
| Atlas | `collateral-snapshot` |
| Atlas | `ilaap-run` |
| Atlas | `alco-pack` |
| Atlas | `product-narrative-fulfilment` |
| Bea | `goal-loop` |
| Bea | `accounting-readiness` |
| Bea | `fx-posting-engine` |
| Bea | `gl-posting-engine` |
| Bea | `m1-ifrs-classification-rules` |
| Bea | `event-triage` |
| Bea | `period-close` |
| Helena | `risk-appetite-watch` |
| Helena | `goal-loop` |
| Helena | `event-triage` |
| Devon | `operational-resilience-snapshot` |
| Devon | `goal-loop` |
| Devon | `event-triage` |
| Devon | `fx-rates-ingest` |
| Devon | `fx-twelvedata-ingest` |
| Camille | `financial-position-snapshot` |
| Camille | `goal-loop` |
| Camille | `event-triage` |
| Anya | `goal-loop` |
| Anya | `projection-drift` |
| Anya | `projection-refresh` |
| Anya | `m1-projection-runtime-mapping` |
| Anya | `event-triage` |
| Anya | `liquidity-projection` |
| Scrooge | `inbox-hygiene` |
| Scrooge | `ceo-decision-record` |
| Scrooge | `follow-on-router` |
| Scrooge | `owner-inbox-archiver` |
| Scrooge | `event-triage` |
| Owen | `goal-loop` |
| Owen | `governance-cycle-prep` |
| Owen | `event-triage` |
| Rohan | `risk-run` |
| Rohan | `daily-mtm` |
| Rohan | `goal-loop` |
| Rohan | `backtest-harness` |
| Rohan | `market-risk-limit-check` |
| Rohan | `event-triage` |
| Rohan | `conduct-risk-events` |
| Mira | `obligations-snapshot` |
| Mira | `citation-gate` |
| Mira | `goal-loop` |
| Mira | `m1-regulator-citation-urns` |
| Mira | `kyc-onboarding-gateway` |
| Mira | `sanctions-gateway-check` |
| Mira | `counterparty-eligibility-check` |
| Mira | `event-triage` |
| Senna | `security-substrate-state` |
| Senna | `goal-loop` |
| Senna | `m1-trading-stack-threat-model` |
| Senna | `event-triage` |
| Zara | `mlro-supervision` |
| Zara | `goal-loop` |
| Zara | `event-triage` |
| Thandiwe | `audit-committee-prep` |
| Thandiwe | `goal-loop` |
| Thandiwe | `event-triage` |
| Rashida | `goal-loop` |
| Rashida | `cyber-resilience-snapshot` |
| Rashida | `event-triage` |
| Iris | `popia-controls-snapshot` |
| Iris | `goal-loop` |
| Iris | `event-triage` |
| Eitan | `liquidity-snapshot` |
| Eitan | `goal-loop` |
| Eitan | `event-triage` |
| Env | `readiness` |
| Saskia | `markets-readiness-snapshot` |
| Saskia | `goal-loop` |
| Saskia | `event-triage` |
| Kai | `m1-cdm-typescript-bindings` |
| Kai | `pre-trade-gateway-aggregator` |
| Kai | `identity-gateway-check` |
| Kai | `suitability-gateway-check` |
| Kai | `credit-capital-funding-check` |
| Kai | `goal-loop` |
| Kai | `event-triage` |
| Yael | `tax-readiness` |
| Yael | `event-triage` |
| Tomas | `payments-readiness` |
| Tomas | `daily-reconciliation` |
| Tomas | `goal-loop` |
| Tomas | `event-triage` |
| Imani | `legal-readiness` |
| Imani | `goal-loop` |
| Imani | `event-triage` |
| Ravi | `alm-readiness` |
| Ravi | `ftp-curve-publish` |
| Ravi | `ftp-attribution` |
| Ravi | `alm-run` |
| Ravi | `intraday-stress` |
| Ravi | `jibar-fixing-ingest` |
| Ravi | `jibar-swap-curve-ingest` |
| Ravi | `repo-rate-ingest` |
| Ravi | `goal-loop` |
| Ravi | `event-triage` |
| Sade | `agentops-readiness` |
| Sade | `token-usage-analysis` |
| Sade | `efficiency-advisory` |
| Sade | `fleet-optimisation` |
| Sade | `event-triage` |
| Sade | `agent-retirement` |
| PAX | `role-research-queue` |
| PAX | `event-triage` |
| Nadia | `event-triage` |
| Nadia | `validation-cycle` |
| Niko | `event-triage` |
| Niko | `client-lifecycle` |
| Noa | `feature-shipped` |
| Noa | `design-review-complete` |
| Noa | `ux-finding-raised` |
| Noa | `ops-cycle` |
| Linnea | `event-triage` |
| Linnea | `ops-cycle` |
| Nolan | `event-triage` |
| Nolan | `hiring-cycle` |

## Substrate gaps

Tracked engineering items that block agents from running fully autonomously. Each closes when the corresponding substrate work lands.

- Event store: cloud-shared via Neon Postgres (`BANK_EVENT_DB_URL`); local sqlite remains canonical-shape on every host. Bidirectional sync runs before/after every agent workflow via `bun run event-store:sync`. Senna threat model APPROVED for build-phase use under exception `TM-NEON-EVENT-STORE-001` (Owen's substrate-exception register). Hardening conditions §5.1 (role downgrade to SELECT+INSERT) and §5.2 (IP allowlist) deferred while events remain non-sensitive; required before any sensitive-data event flows. M8 cloud lift swaps Neon for Neon-on-Azure or Azure Postgres without code change.
- Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised — DEFINED in `platform/event-store/event-types.ts` with Zod payload schemas and typed `make<Type>` factories. Atlas now emits one RiskRaised per substrate gap on his weekly run, exercising the schema. The remaining three types are available for handlers to adopt as their decision / escalation / workstream paths are wired; Vera's audit pipelines #14/#15 and the dashboard's curated-seed retirement now have substrate to consume.
- Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class in `runtime/run.ts`. Event-driven dispatch fans out in-process from a parent run when the parent appended an event type a downstream handler subscribes to; cross-process / cross-workflow event-bus is M8 cloud-lift work. On-request handlers are dispatched via `bun run agent:<slug>` or workflow_dispatch with no schedule (first example: `mira:citation-gate`).
- Claude API integration for agent-narrative output: ROLLED OUT. All seven runtime handlers (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge) call `tryGenerateNarrative` after their mechanical pass. Each has a stable persona-grounded system prompt cached as the prefix; per-run state is the volatile suffix. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.
- Projection-cache persistence: closed by `anya:projection-refresh`, an event-driven handler subscribed to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision. Re-derives the dashboard projection from canonical sources + the live event store and writes it to the runtime cache `prototype/.local/dashboard-state.json` (gitignored). D-EVENT-STORE-SCALING Slice 3a (PR #138, 2026-05-10) split this runtime path off the previously-committed seed; Slice 3b (same day) removed the seed from the commit graph entirely — the recon harness now derives + asserts internal consistency at recon time rather than comparing against a stored cache.
- Citation gate: now wrapped as `mira:citation-gate` (on-request). Walks the event store, emits `CitationGatePassed` / `CitationGateFailed` and one `AuditFinding` per missing-citation event. Workflow at `.github/workflows/agent-runtime-mira-citation-gate.yml` (workflow_dispatch only — the gate is also still part of the `ci` script for synchronous CI verification).
- GitHub Actions cron unreliability — interim substrate. GH Actions silently dropped Anya 03:00 UTC + Scrooge 04:00 UTC daily slots overnight 2026-05-07/08; Vera 02:00 UTC fired 2h46m late. All ten scheduled workflows re-pinned 2026-05-08 to off-the-hour distinct minutes (Vera 02:13, Anya 03:17, Scrooge 04:27, Helena 04:30, Devon Mon 05:23, Zara Mon 05:30, Atlas Mon 06:19, Owen Tue 07:31, Mira Wed 07:29, Senna Thu 07:37). Permanent fix is A2.1 — substrate scheduler emitting typed `ScheduledTrigger` events from a Bun process — at which point cron files become thin shims or retire entirely.

## Atlas's narrative

Substrate is dense and largely load-bearing: 119,851 events across 172 types, 31/31 personas specced, 128 runtime handlers registered, and the four typed payload schemas (`AgentEscalation`, `AgentDecision`, `WorkstreamRegistered`, `RiskRaised`) are now all producing real volume — `RiskRaised` at 1,958, `WorkstreamRegistered` at 844, `AgentEscalation` at 77. The Neon-shared event store is live with bidirectional sync and Senna's approved exception. What's closing fast is the runtime-telemetry layer; what's still blocking is hardening and durable scheduling.

Three consequential shifts since last week. First, `ScheduledTrigger` has gone from absent to 539 events (earliest 2026-05-25) — the A2.1 substrate scheduler is emitting, which means the GH Actions cron interim is no longer the sole timing substrate. Second, `ProvenanceReclassified` materialised at 44,284 events in 72 hours, now the single largest type in the store; that's a reclassification pass running at substrate scale and it deserves its own narrative from whoever owns it. Third, `SubstrateAgentRun{Started,Completed,Failed}` (5,500 / 5,338 / 157) now give us first-class run-level telemetry — the 157 `SubstrateAgentRunFailed` is a ~2.9% failure rate Sade should be reading off directly rather than reconstructing.

Load-bearing gaps, ranked. (1) Neon hardening §5.1 (role downgrade to SELECT+INSERT) and §5.2 (IP allowlist) remain deferred — this is fine while events are non-sensitive but it is the hard gate on any sensitive-data event type ever entering the store, and several candidates (KYC payloads, party data) are already being emitted in non-sensitive form. (2) `WorkstreamCompleted` is only 7 events against 844 `WorkstreamRegistered` — the lifecycle is registering but not closing in substrate, which starves the dashboard's curated-seed retirement of the signal it was meant to consume. (3) Owner Inbox at 508 deliverables is no longer a pile, it is a backlog; Scrooge's archiver is registered but the inflow rate is winning. What the substrate needs next: cut the cron shims over to `ScheduledTrigger` consumption so A2.1 becomes canonical, and wire `WorkstreamCompleted` emission into the handlers that already emit `WorkstreamRegistered`.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
