---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-31T06:00:14.354Z
decision-required: false
---

# Atlas — substrate state, 2026-05-31

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 127712 events across 179 types; 31/31 personas have operating specs; 128 runtime handlers registered; 534 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 127712

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 44286 | 2026-05-27 | 2026-05-30 |
| `InboundMessageReceived` | 13423 | 2026-05-25 | 2026-05-28 |
| `SubstrateAgentRunStarted` | 6660 | 2026-05-25 | 2026-05-31 |
| `BusDispatched` | 6556 | 2026-05-25 | 2026-05-31 |
| `SubstrateAgentRunCompleted` | 6494 | 2026-05-25 | 2026-05-31 |
| `GatewayCheckRequested` | 4074 | 2026-05-09 | 2026-05-20 |
| `SubLedgerPostingEmitted` | 3934 | 2026-05-09 | 2026-05-30 |
| `Decision` | 2703 | 2026-04-30 | 2026-05-30 |
| `GatewayCheckCompleted` | 2496 | 2026-05-17 | 2026-05-20 |
| `LegacyFanoutShadowed` | 2439 | 2026-05-25 | 2026-05-31 |
| `RiskRaised` | 2175 | 2025-12-01 | 2026-05-31 |
| `OrderProposed` | 1650 | 2026-05-09 | 2026-05-20 |
| `ISDACSAAssessmentCompleted` | 1490 | 2024-01-01 | 2026-05-20 |
| `CreditLimitLoaded` | 1327 | 2024-01-01 | 2026-05-21 |
| `CreditLimitApplicationSubmitted` | 1308 | 2024-01-01 | 2026-05-20 |
| `CreditLimitApproved` | 1308 | 2024-01-01 | 2026-05-20 |
| `RecordFiled` | 1201 | 2026-05-05 | 2026-05-31 |
| `WorkstreamRegistered` | 1092 | 2026-05-07 | 2026-05-31 |
| `CreditAnalysisCompleted` | 990 | 2024-01-01 | 2026-05-20 |
| `CreditLimitProposed` | 990 | 2024-01-01 | 2026-05-20 |
| `DashboardProjectionRefreshed` | 892 | 2026-05-25 | 2026-05-31 |
| `CcrReplacementCostComputed` | 873 | 2026-05-18 | 2026-05-20 |
| `BacktestRequested` | 816 | 2026-01-10 | 2026-01-10 |
| `SubstrateAlert` | 783 | 2025-01-01 | 2026-05-31 |
| `BacktestRun` | 769 | 2026-05-09 | 2026-05-09 |
| `FxTradeExecuted` | 695 | 2026-05-17 | 2026-05-30 |
| `ScheduledTrigger` | 606 | 2026-05-25 | 2026-05-31 |
| `ReconResult` | 603 | 2026-05-07 | 2026-05-31 |
| `MarketsProjectionRefreshed` | 585 | 2026-05-09 | 2026-05-09 |
| `ClientCandidateRegistered` | 544 | 2026-05-25 | 2026-05-29 |
| `AgentGoalEvaluated` | 503 | 2026-05-25 | 2026-05-31 |
| `CounterpartyFaisClassified` | 500 | 2026-05-01 | 2026-05-17 |
| `KYCIdentityCollected` | 492 | 2026-05-25 | 2026-05-29 |
| `KYCIdentityVerified` | 492 | 2026-05-25 | 2026-05-29 |
| `KYCSanctionsPEPScreened` | 492 | 2026-05-25 | 2026-05-29 |
| `KYCDecisionMade` | 491 | 2026-05-25 | 2026-05-29 |
| `ClientRejected` | 419 | 2026-05-25 | 2026-05-29 |
| `FxPositionRevalued` | 418 | 2026-05-28 | 2026-05-30 |
| `OfficialMarkAdopted` | 416 | 2026-05-28 | 2026-05-30 |
| `AgentGoalDeferred` | 378 | 2026-05-25 | 2026-05-31 |
| `KYCUBOResolved` | 357 | 2026-05-25 | 2026-05-29 |
| `KYCRiskRated` | 357 | 2026-05-25 | 2026-05-29 |
| `ClientAccepted` | 351 | 2026-05-13 | 2026-05-29 |
| `CalculationPerformed` | 341 | 2026-05-29 | 2026-05-31 |
| `FxSettlementInstructed` | 340 | 2026-05-19 | 2026-05-28 |
| `CcrEadComputed` | 339 | 2026-05-18 | 2026-05-20 |
| `LawfulProcessingRegistered` | 312 | 2026-05-25 | 2026-05-29 |
| `IdentityKeyRotated` | 308 | 2026-05-25 | 2026-05-31 |
| `PrincipalPayment` | 276 | 2026-05-23 | 2026-05-30 |
| `AgentRunCompleted` | 265 | 2026-05-10 | 2026-05-31 |
| `AgentBriefIssued` | 261 | 2026-05-10 | 2026-05-31 |
| `AgentRunStarted` | 259 | 2026-05-10 | 2026-05-31 |
| `AuditFinding` | 227 | 2026-05-07 | 2026-05-30 |
| `M1CitationTrancheRegistered` | 180 | 2026-05-09 | 2026-05-09 |
| `IrsPositionRevalued` | 180 | 2026-05-19 | 2026-05-20 |
| `ProductDimensionAttested` | 170 | 2026-05-26 | 2026-05-28 |
| `SettlementConfirmed` | 170 | 2026-05-19 | 2026-05-30 |
| `SubstrateAgentRunFailed` | 161 | 2026-05-25 | 2026-05-31 |
| `IRRBBChecked` | 160 | 2026-05-26 | 2026-05-31 |
| `AgentPerformanceEvaluated` | 153 | 2026-05-25 | 2026-05-31 |
| `AgentFeedbackIssued` | 153 | 2026-05-25 | 2026-05-31 |
| `PermissionPolicyPublished` | 142 | 2026-05-25 | 2026-05-31 |
| `SubstrateStateSnapshot` | 136 | 2026-05-07 | 2026-05-31 |
| `DecisionRequested` | 135 | 2026-05-10 | 2026-05-10 |
| `EquityTradeBooked` | 135 | 2026-05-09 | 2026-05-09 |
| `IfrsClassificationApplied` | 135 | 2026-05-09 | 2026-05-09 |
| `IrsTradeBooked` | 135 | 2026-05-20 | 2026-05-20 |
| `KYCEDDInitiated` | 134 | 2026-05-25 | 2026-05-29 |
| `KYCEDDCompleted` | 134 | 2026-05-25 | 2026-05-29 |
| `IntradayHQLAStressProjection` | 128 | 2026-05-26 | 2026-05-31 |
| `AgentGoalSelected` | 125 | 2026-05-25 | 2026-05-31 |
| `CdmBindingsRegenerated` | 119 | 2026-05-09 | 2026-05-26 |
| `OrderApprovedAtGateway` | 117 | 2026-05-17 | 2026-05-17 |
| `OrderRejectedAtGateway` | 117 | 2026-05-17 | 2026-05-17 |
| `DailyPnLReportGenerated` | 105 | 2026-05-25 | 2026-05-31 |
| `CreditLimitBreached` | 90 | 2026-05-22 | 2026-05-22 |
| `CreditLimitBreachDisposed` | 90 | 2026-05-23 | 2026-05-23 |
| `LiquidityLimitBreached` | 90 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 90 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 90 | 2026-05-10 | 2026-05-10 |
| `PartyRelationshipAsserted` | 81 | 2026-05-19 | 2026-05-26 |
| `AgentEscalation` | 78 | 2026-05-07 | 2026-05-30 |
| `DocumentRegistered` | 71 | 2026-05-11 | 2026-05-25 |
| `FxTradeCancelled` | 56 | 2026-05-21 | 2026-05-30 |
| `ConflictOfInterestDisclosed` | 55 | 2026-05-17 | 2026-05-17 |
| `BestExecutionVerified` | 54 | 2026-05-17 | 2026-05-17 |
| `SanctionsClearancePassed` | 52 | 2026-05-13 | 2026-05-13 |
| `PEPScreeningCompleted` | 52 | 2026-05-13 | 2026-05-13 |
| `BeneficialOwnerResolved` | 52 | 2026-05-13 | 2026-05-13 |
| `RiskRatingAssigned` | 52 | 2026-05-13 | 2026-05-13 |
| `DataProjectionSnapshot` | 51 | 2026-05-07 | 2026-05-31 |
| `InboxHygieneSweep` | 51 | 2026-05-07 | 2026-05-31 |
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
| `AgentRegistered` | 43 | 2026-05-26 | 2026-05-31 |
| `GovernanceCyclePrep` | 41 | 2026-05-07 | 2026-05-28 |
| `PopiaConsentRecorded` | 39 | 2026-05-13 | 2026-05-13 |
| `PartyRegistered` | 38 | 2026-05-23 | 2026-05-30 |
| `ModelValidationApproved` | 25 | 2026-05-27 | 2026-05-29 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `ModelSubmitted` | 22 | 2026-05-27 | 2026-05-29 |
| `ModelTierClassified` | 22 | 2026-05-27 | 2026-05-29 |
| `AccountingReadinessSnapshot` | 17 | 2026-05-26 | 2026-05-31 |
| `MtmRunCompleted` | 16 | 2026-05-26 | 2026-05-30 |
| `FtpCurvePublished` | 16 | 2026-05-26 | 2026-05-31 |
| `ALMRunCompleted` | 16 | 2026-05-26 | 2026-05-31 |
| `LCRComputed` | 14 | 2026-05-26 | 2026-05-29 |
| `NSFRComputed` | 14 | 2026-05-26 | 2026-05-29 |
| `AgentEscalationDecided` | 14 | 2026-05-26 | 2026-05-30 |
| `BalanceSheetSubstantiationCompleted` | 14 | 2026-05-30 | 2026-05-30 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `EddInitiated` | 13 | 2026-05-13 | 2026-05-13 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `RiskAppetiteSnapshot` | 9 | 2026-05-27 | 2026-05-31 |
| `ProductProposalRegistered` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductConceptualised` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductDueDiligenceCompleted` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductApproved` | 8 | 2026-05-26 | 2026-05-28 |
| `WorkstreamCompleted` | 7 | 2026-05-28 | 2026-05-28 |
| `CollateralInventorySnapshot` | 6 | 2026-05-26 | 2026-05-26 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `AgentDecision` | 5 | 2026-05-07 | 2026-05-30 |
| `CollateralInventorySnapshotted` | 5 | 2026-05-28 | 2026-05-30 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `CounterpartyExposureCalculated` | 4 | 2026-05-18 | 2026-05-18 |
| `InterbankLoanPlaced` | 4 | 2026-05-27 | 2026-05-28 |
| `LCRRatioProjection` | 4 | 2026-05-28 | 2026-05-29 |
| `LiquiditySnapshot` | 4 | 2026-05-28 | 2026-05-30 |
| `ILAAPScenarioRun` | 4 | 2026-05-30 | 2026-05-30 |
| `AgentOpsReadinessSnapshot` | 3 | 2026-05-26 | 2026-05-29 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `RiskRunCompleted` | 3 | 2026-05-29 | 2026-05-31 |
| `ALMReadinessSnapshot` | 3 | 2026-05-29 | 2026-05-31 |
| `PaymentsReadinessSnapshot` | 3 | 2026-05-29 | 2026-05-31 |
| `MLROAttestation` | 2 | 2026-05-26 | 2026-05-26 |
| `ConductObligationFlagged` | 2 | 2026-05-17 | 2026-05-17 |
| `AccountingPeriodOpened` | 2 | 2026-05-01 | 2026-05-28 |
| `TrialBalanceSnapshotted` | 2 | 2026-05-15 | 2026-06-01 |
| `RepoTradeOpened` | 2 | 2026-05-27 | 2026-05-28 |
| `DepositTaken` | 2 | 2026-05-27 | 2026-05-28 |
| `RepoTradeTerminatedEarly` | 2 | 2026-05-28 | 2026-05-28 |
| `InterbankLoanRecalledEarly` | 2 | 2026-05-28 | 2026-05-28 |
| `ALCOPackGenerated` | 2 | 2026-05-30 | 2026-05-30 |
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
| `LegalReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `OperationalResilienceSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `CyberResilienceSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `POPIAControlsSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `AuditCommitteePackPrepped` | 1 | 2026-05-29 | 2026-05-29 |
| `TaxReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `MarketsReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `FinancialPositionSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `PartyClassified` | 1 | 2026-05-30 | 2026-05-30 |
| `SubLedgerPostingRemediationRecorded` | 1 | 2026-05-30 | 2026-05-30 |
| `ILAAPSummaryCompleted` | 1 | 2026-05-30 | 2026-05-30 |
| `IcaapIlaapInputReady` | 1 | 2026-05-30 | 2026-05-30 |

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

Substrate is dense and operational: 127,712 events across 179 types on this host, 31/31 personas specced, 128 runtime handlers registered across all personas. The shape is no longer "scaffolding plus seeds" — it is a live multi-agent runtime with `SubstrateAgentRunStarted`/`Completed` pairs in the thousands, `BusDispatched` carrying event-driven fanout, and `ScheduledTrigger` (606) showing the cron-shim layer is firing. What is closing: the agent operating loop itself — `AgentGoalSelected` (125), `AgentGoalEvaluated` (503), `AgentGoalDeferred` (378), `AgentPerformanceEvaluated`/`AgentFeedbackIssued` (153 each), and `AgentPromptOptimizationApplied` (13) are all flowing, meaning Sade's optimisation path has substrate to chew on. What is blocking: cross-process event bus (M8), and the two Senna hardening conditions on the Neon event store (§5.1 role downgrade, §5.2 IP allowlist) that gate any sensitive-data event flow.

Most consequential movement since prior snapshots: (1) `AgentEscalation` is no longer the missing primitive — 78 events, with `AgentEscalationDecided` (14) now closing the loop, so Vera's audit pipelines #14/#15 finally have real substrate to consume rather than waiting on a typed payload. (2) `WorkstreamRegistered` is at 1,092 and `WorkstreamCompleted` at 7 — workstream registration is now load-bearing, the curated-seed retirement path for the dashboard is operational via `anya:projection-refresh`, and the asymmetry between registered and completed is itself the next signal worth watching. (3) The accounting/ALM stack came online this week — `BalanceSheetSubstantiationCompleted`, `ALMRunCompleted`, `LCRComputed`/`NSFRComputed`, `FtpCurvePublished`, `ALCOPackGenerated`, `ILAAPSummaryCompleted`, `IcaapIlaapInputReady` all appear with low single-digit counts and late-May earliest dates, meaning Bea, Ravi, and Eitan have moved from spec to emission.

Ranked by downstream impact, the load-bearing gaps that remain: the Neon hardening conditions (§5.1/§5.2) — these are the gate on the entire substrate becoming sensitive-data-capable, and every persona handling client or position data is downstream of them; the cross-process event bus (M8 cloud lift) — in-process fanout works but `BusDispatched` cannot cross workflow boundaries, which caps how much of the agent fleet can react to each other in real time and keeps the cron-shim layer alive; and the `WorkstreamCompleted`-to-`WorkstreamRegistered` gap (7 vs 1,092), which is not a missing event type but a missing completion discipline — downstream reporting that assumes workstreams close will mis-read the substrate until that ratio improves.

Next: harden Neon to §5.1/§5.2 so the substrate can carry sensitive payloads, and stand up the cross-process event bus so `BusDispatched` is no longer bounded by a single runtime process.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
