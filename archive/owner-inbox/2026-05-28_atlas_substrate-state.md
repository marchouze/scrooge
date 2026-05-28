---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-28T10:00:42.181Z
decision-required: false
---

# Atlas — substrate state, 2026-05-28

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 103570 events across 156 types; 31/31 personas have operating specs; 125 runtime handlers registered; 484 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 103570

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 37591 | 2026-05-27 | 2026-05-28 |
| `InboundMessageReceived` | 13423 | 2026-05-25 | 2026-05-28 |
| `SubstrateAgentRunStarted` | 4384 | 2026-05-25 | 2026-05-28 |
| `BusDispatched` | 4344 | 2026-05-25 | 2026-05-28 |
| `SubstrateAgentRunCompleted` | 4256 | 2026-05-25 | 2026-05-28 |
| `GatewayCheckRequested` | 3564 | 2026-05-09 | 2026-05-20 |
| `SubLedgerPostingEmitted` | 2445 | 2026-05-09 | 2026-05-28 |
| `Decision` | 2384 | 2026-04-30 | 2026-05-28 |
| `GatewayCheckCompleted` | 2176 | 2026-05-17 | 2026-05-20 |
| `RiskRaised` | 1575 | 2025-12-01 | 2026-05-28 |
| `OrderProposed` | 1440 | 2026-05-09 | 2026-05-20 |
| `ISDACSAAssessmentCompleted` | 1325 | 2024-01-01 | 2026-05-20 |
| `CreditLimitLoaded` | 1177 | 2024-01-01 | 2026-05-21 |
| `CreditLimitApplicationSubmitted` | 1158 | 2024-01-01 | 2026-05-20 |
| `CreditLimitApproved` | 1158 | 2024-01-01 | 2026-05-20 |
| `LegacyFanoutShadowed` | 1019 | 2026-05-25 | 2026-05-28 |
| `RecordFiled` | 966 | 2026-05-05 | 2026-05-28 |
| `CreditAnalysisCompleted` | 880 | 2024-01-01 | 2026-05-20 |
| `CreditLimitProposed` | 880 | 2024-01-01 | 2026-05-20 |
| `CcrReplacementCostComputed` | 773 | 2026-05-18 | 2026-05-20 |
| `BacktestRequested` | 721 | 2026-01-10 | 2026-01-10 |
| `BacktestRun` | 679 | 2026-05-09 | 2026-05-09 |
| `FxTradeExecuted` | 630 | 2026-05-17 | 2026-05-28 |
| `SubstrateAlert` | 591 | 2025-01-01 | 2026-05-28 |
| `WorkstreamRegistered` | 568 | 2026-05-07 | 2026-05-28 |
| `MarketsProjectionRefreshed` | 510 | 2026-05-09 | 2026-05-09 |
| `ClientCandidateRegistered` | 489 | 2026-05-25 | 2026-05-28 |
| `ReconResult` | 486 | 2026-05-07 | 2026-05-28 |
| `ScheduledTrigger` | 465 | 2026-05-25 | 2026-05-28 |
| `CounterpartyFaisClassified` | 440 | 2026-05-01 | 2026-05-17 |
| `KYCIdentityCollected` | 437 | 2026-05-25 | 2026-05-28 |
| `KYCIdentityVerified` | 437 | 2026-05-25 | 2026-05-28 |
| `KYCSanctionsPEPScreened` | 437 | 2026-05-25 | 2026-05-28 |
| `KYCDecisionMade` | 436 | 2026-05-25 | 2026-05-28 |
| `OfficialMarkAdopted` | 405 | 2026-05-28 | 2026-05-28 |
| `FxPositionRevalued` | 405 | 2026-05-28 | 2026-05-28 |
| `ClientRejected` | 399 | 2026-05-25 | 2026-05-28 |
| `AgentGoalEvaluated` | 392 | 2026-05-25 | 2026-05-28 |
| `DashboardProjectionRefreshed` | 352 | 2026-05-25 | 2026-05-28 |
| `AgentGoalDeferred` | 339 | 2026-05-25 | 2026-05-28 |
| `KYCUBOResolved` | 317 | 2026-05-25 | 2026-05-28 |
| `KYCRiskRated` | 317 | 2026-05-25 | 2026-05-28 |
| `ClientAccepted` | 316 | 2026-05-13 | 2026-05-28 |
| `CcrEadComputed` | 299 | 2026-05-18 | 2026-05-20 |
| `LawfulProcessingRegistered` | 277 | 2026-05-25 | 2026-05-28 |
| `FxSettlementInstructed` | 260 | 2026-05-25 | 2026-05-28 |
| `AgentRunCompleted` | 211 | 2026-05-10 | 2026-05-28 |
| `AgentBriefIssued` | 206 | 2026-05-10 | 2026-05-28 |
| `AgentRunStarted` | 203 | 2026-05-10 | 2026-05-28 |
| `AuditFinding` | 177 | 2026-05-07 | 2026-05-27 |
| `ProductDimensionAttested` | 170 | 2026-05-26 | 2026-05-28 |
| `M1CitationTrancheRegistered` | 160 | 2026-05-09 | 2026-05-09 |
| `IrsPositionRevalued` | 160 | 2026-05-19 | 2026-05-20 |
| `PermissionPolicyPublished` | 141 | 2026-05-25 | 2026-05-27 |
| `IRRBBChecked` | 130 | 2026-05-26 | 2026-05-28 |
| `SubstrateAgentRunFailed` | 123 | 2026-05-25 | 2026-05-28 |
| `DecisionRequested` | 120 | 2026-05-10 | 2026-05-10 |
| `EquityTradeBooked` | 120 | 2026-05-09 | 2026-05-09 |
| `IfrsClassificationApplied` | 120 | 2026-05-09 | 2026-05-09 |
| `IrsTradeBooked` | 120 | 2026-05-20 | 2026-05-20 |
| `KYCEDDInitiated` | 119 | 2026-05-25 | 2026-05-28 |
| `KYCEDDCompleted` | 119 | 2026-05-25 | 2026-05-28 |
| `CdmBindingsRegenerated` | 104 | 2026-05-09 | 2026-05-26 |
| `IntradayHQLAStressProjection` | 104 | 2026-05-26 | 2026-05-28 |
| `OrderApprovedAtGateway` | 102 | 2026-05-17 | 2026-05-17 |
| `OrderRejectedAtGateway` | 102 | 2026-05-17 | 2026-05-17 |
| `IdentityKeyRotated` | 89 | 2026-05-25 | 2026-05-27 |
| `CreditLimitBreached` | 80 | 2026-05-22 | 2026-05-22 |
| `CreditLimitBreachDisposed` | 80 | 2026-05-23 | 2026-05-23 |
| `LiquidityLimitBreached` | 80 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 80 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 80 | 2026-05-10 | 2026-05-10 |
| `AgentEscalation` | 77 | 2026-05-07 | 2026-05-28 |
| `PartyRelationshipAsserted` | 76 | 2026-05-19 | 2026-05-26 |
| `SubstrateStateSnapshot` | 71 | 2026-05-07 | 2026-05-28 |
| `DocumentRegistered` | 71 | 2026-05-11 | 2026-05-25 |
| `AgentPerformanceEvaluated` | 60 | 2026-05-25 | 2026-05-28 |
| `AgentFeedbackIssued` | 60 | 2026-05-25 | 2026-05-28 |
| `SettlementConfirmed` | 57 | 2026-05-19 | 2026-05-28 |
| `DailyPnLReportGenerated` | 55 | 2026-05-25 | 2026-05-28 |
| `AgentGoalSelected` | 53 | 2026-05-25 | 2026-05-28 |
| `PrincipalPayment` | 52 | 2026-05-23 | 2026-05-28 |
| `SanctionsClearancePassed` | 52 | 2026-05-13 | 2026-05-13 |
| `PEPScreeningCompleted` | 52 | 2026-05-13 | 2026-05-13 |
| `BeneficialOwnerResolved` | 52 | 2026-05-13 | 2026-05-13 |
| `RiskRatingAssigned` | 52 | 2026-05-13 | 2026-05-13 |
| `FxTradeCancelled` | 50 | 2026-05-21 | 2026-05-28 |
| `ConflictOfInterestDisclosed` | 50 | 2026-05-17 | 2026-05-17 |
| `BestExecutionVerified` | 49 | 2026-05-17 | 2026-05-17 |
| `FaisClassificationSuitabilityChecked` | 44 | 2026-05-17 | 2026-05-17 |
| `DataProjectionSnapshot` | 43 | 2026-05-07 | 2026-05-28 |
| `InboxHygieneSweep` | 43 | 2026-05-07 | 2026-05-28 |
| `BestExecutionBreached` | 42 | 2026-05-17 | 2026-05-17 |
| `AgentRegistered` | 41 | 2026-05-26 | 2026-05-27 |
| `CreditLimitAnnualReviewCompleted` | 40 | 2026-05-21 | 2026-05-21 |
| `LexUtilisationComputed` | 40 | 2026-05-20 | 2026-05-20 |
| `BriefSuperseded` | 40 | 2026-05-10 | 2026-05-10 |
| `EquitySettlementInstructed` | 40 | 2026-05-13 | 2026-05-13 |
| `PaNotificationSubmitted` | 40 | 2026-05-11 | 2026-05-11 |
| `CreditLimitWithdrawn` | 40 | 2026-05-12 | 2026-05-12 |
| `OrderAccepted` | 40 | 2026-05-13 | 2026-05-13 |
| `PopiaConsentRecorded` | 39 | 2026-05-13 | 2026-05-13 |
| `ObligationsRegisterSnapshot` | 38 | 2026-05-07 | 2026-05-28 |
| `SecuritySubstrateSnapshot` | 38 | 2026-05-07 | 2026-05-28 |
| `PartyRegistered` | 37 | 2026-05-23 | 2026-05-26 |
| `GovernanceCyclePrep` | 36 | 2026-05-07 | 2026-05-28 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `MtmRunCompleted` | 13 | 2026-05-26 | 2026-05-28 |
| `FtpCurvePublished` | 13 | 2026-05-26 | 2026-05-28 |
| `ALMRunCompleted` | 13 | 2026-05-26 | 2026-05-28 |
| `AgentEscalationDecided` | 13 | 2026-05-26 | 2026-05-28 |
| `EddInitiated` | 13 | 2026-05-13 | 2026-05-13 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `LCRComputed` | 12 | 2026-05-26 | 2026-05-28 |
| `NSFRComputed` | 12 | 2026-05-26 | 2026-05-28 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `AccountingReadinessSnapshot` | 11 | 2026-05-26 | 2026-05-28 |
| `ProductProposalRegistered` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductConceptualised` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductDueDiligenceCompleted` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductApproved` | 8 | 2026-05-26 | 2026-05-28 |
| `WorkstreamCompleted` | 7 | 2026-05-28 | 2026-05-28 |
| `CollateralInventorySnapshot` | 6 | 2026-05-26 | 2026-05-26 |
| `ModelValidationApproved` | 6 | 2026-05-27 | 2026-05-27 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `RiskAppetiteSnapshot` | 5 | 2026-05-27 | 2026-05-28 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `CounterpartyExposureCalculated` | 4 | 2026-05-18 | 2026-05-18 |
| `AgentDecision` | 3 | 2026-05-07 | 2026-05-28 |
| `ModelSubmitted` | 3 | 2026-05-27 | 2026-05-27 |
| `ModelTierClassified` | 3 | 2026-05-27 | 2026-05-27 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `CollateralInventorySnapshotted` | 3 | 2026-05-28 | 2026-05-28 |
| `LCRRatioProjection` | 3 | 2026-05-28 | 2026-05-28 |
| `MLROAttestation` | 2 | 2026-05-26 | 2026-05-26 |
| `AgentOpsReadinessSnapshot` | 2 | 2026-05-26 | 2026-05-26 |
| `ConductObligationFlagged` | 2 | 2026-05-17 | 2026-05-17 |
| `AccountingPeriodOpened` | 2 | 2026-05-01 | 2026-05-28 |
| `TrialBalanceSnapshotted` | 2 | 2026-05-15 | 2026-06-01 |
| `InterbankLoanPlaced` | 2 | 2026-05-27 | 2026-05-27 |
| `RegulatoryInstrumentRegistered` | 1 | 2026-05-25 | 2026-05-25 |
| `RegulatoryInstrumentContextualised` | 1 | 2026-05-25 | 2026-05-25 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `RasLimitSchedulePublished` | 1 | 2026-05-14 | 2026-05-14 |
| `ValidationFindingRaised` | 1 | 2026-05-27 | 2026-05-27 |
| `BalanceSheetProjected` | 1 | 2026-05-27 | 2026-05-27 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |
| `AccountingPeriodClosed` | 1 | 2026-06-01 | 2026-06-01 |
| `RepoTradeOpened` | 1 | 2026-05-27 | 2026-05-27 |
| `DepositTaken` | 1 | 2026-05-27 | 2026-05-27 |
| `FundingLineDrawn` | 1 | 2026-05-27 | 2026-05-27 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `LiquiditySnapshot` | 1 | 2026-05-28 | 2026-05-28 |
| `FXPositionBreach` | 1 | 2026-05-28 | 2026-05-28 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

125 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

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

Substrate is operationally dense and broadening: 103,570 events across 156 types, 31/31 personas spec'd, 125 runtime handlers registered across 30 agents. The shape on the ground matches the design — event-sourced substrate carrying real KYC, FX, ALM, credit-limit, gateway, and governance flows, with Claude-narrated runtime handlers on top. What's still partial is the *scheduling* and *bus* layer: GitHub Actions cron remains the trigger of record outside in-process fan-out, and there is no cross-workflow event bus yet. Nothing is structurally blocking, but the substrate is now leaning hard on interim machinery in places it shouldn't long-term.

The consequential moves this week: (1) `AgentEscalationDecided` is now flowing (13 events, first seen 2026-05-26) — Zara/Owen escalation closure has substrate, which means Vera's audit pipelines #14/#15 are no longer gated on a missing event type, only on adoption volume; (2) the full ALM/liquidity stack landed — `MtmRunCompleted`, `FtpCurvePublished`, `ALMRunCompleted`, `LCRComputed`, `NSFRComputed`, `IntradayHQLAStressProjection`, `LiquiditySnapshot`, `BalanceSheetProjected` — Ravi and Eitan are now emitting real readiness signal rather than placeholder; (3) the product-approval chain (`ProductProposalRegistered` → `ProductConceptualised` → `ProductDueDiligenceCompleted` → `ProductApproved`, 8 of each) and the model-governance chain (`ModelSubmitted` → `ModelTierClassified` → `ModelRegistered` → `ModelValidationApproved`, with one `ValidationFindingRaised`) are both live end-to-end through Nadia and Niko.

Load-bearing gaps, ranked. **First: the GitHub Actions cron substrate.** Ten scheduled workflows are pinned to off-the-hour minutes as an interim against silent drops; everything time-sensitive (Vera recon, Anya projection, Scrooge hygiene, the weekly governance loop) depends on cron firing. Until A2.1 lands a Bun-process scheduler emitting typed `ScheduledTrigger` events, the substrate's *time* dimension is hosted off-substrate. `ScheduledTrigger` is already appearing in-store (465 events) but as a record of fired triggers, not as the dispatch source. **Second: cross-process event bus.** Event-driven dispatch is in-process fan-out only; M8 cloud lift is the gating work for any handler that needs to react to an event appended by a different workflow run. The Owner Inbox at 484 deliverables is partly a symptom — work that should be routed by event subscription is queuing as human-shaped artefacts instead. **Third: `AgentEscalation` adoption.** The type is defined and 77 events exist, but volume relative to 591 `SubstrateAlert` and 1,575 `RiskRaised` says most agents are still raising via the older shapes. Vera's #14/#15 will only bite once escalation flow is the default, not the exception.

Next: ship A2.1 (substrate scheduler with typed `ScheduledTrigger` dispatch) so cron stops being load-bearing — every other gap is downstream of that or of M8.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
