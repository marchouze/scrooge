---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-28T06:02:11.047Z
decision-required: false
---

# Atlas — substrate state, 2026-05-28

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 91601 events across 155 types; 31/31 personas have operating specs; 125 runtime handlers registered; 482 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 91601

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 29927 | 2026-05-27 | 2026-05-27 |
| `InboundMessageReceived` | 13487 | 2026-05-23 | 2026-05-27 |
| `SubstrateAgentRunStarted` | 3993 | 2026-05-25 | 2026-05-28 |
| `BusDispatched` | 3957 | 2026-05-25 | 2026-05-28 |
| `SubstrateAgentRunCompleted` | 3872 | 2026-05-25 | 2026-05-28 |
| `GatewayCheckRequested` | 3172 | 2026-05-09 | 2026-05-20 |
| `SubLedgerPostingEmitted` | 2344 | 2026-05-09 | 2026-05-28 |
| `Decision` | 2170 | 2026-04-30 | 2026-05-28 |
| `GatewayCheckCompleted` | 1920 | 2026-05-17 | 2026-05-20 |
| `RiskRaised` | 1376 | 2025-12-01 | 2026-05-28 |
| `OrderProposed` | 1274 | 2026-05-09 | 2026-05-20 |
| `ISDACSAAssessmentCompleted` | 1226 | 2024-01-01 | 2026-05-20 |
| `CreditLimitLoaded` | 1080 | 2024-01-01 | 2026-05-21 |
| `CreditLimitApplicationSubmitted` | 1061 | 2024-01-01 | 2026-05-20 |
| `CreditLimitApproved` | 1061 | 2024-01-01 | 2026-05-20 |
| `LegacyFanoutShadowed` | 977 | 2026-05-25 | 2026-05-28 |
| `RecordFiled` | 939 | 2026-05-05 | 2026-05-28 |
| `CreditAnalysisCompleted` | 814 | 2024-01-01 | 2026-05-20 |
| `CreditLimitProposed` | 814 | 2024-01-01 | 2026-05-20 |
| `CcrReplacementCostComputed` | 708 | 2026-05-18 | 2026-05-20 |
| `BacktestRequested` | 634 | 2026-01-10 | 2026-01-10 |
| `BacktestRun` | 596 | 2026-05-09 | 2026-05-09 |
| `FxTradeExecuted` | 595 | 2026-05-17 | 2026-05-27 |
| `SubstrateAlert` | 593 | 2025-01-01 | 2026-05-28 |
| `WorkstreamRegistered` | 496 | 2026-05-07 | 2026-05-28 |
| `MarketsProjectionRefreshed` | 450 | 2026-05-09 | 2026-05-09 |
| `ReconResult` | 450 | 2026-05-07 | 2026-05-28 |
| `ScheduledTrigger` | 446 | 2026-05-25 | 2026-05-28 |
| `ClientCandidateRegistered` | 434 | 2026-05-25 | 2026-05-27 |
| `OfficialMarkAdopted` | 405 | 2026-05-28 | 2026-05-28 |
| `FxPositionRevalued` | 405 | 2026-05-28 | 2026-05-28 |
| `CounterpartyFaisClassified` | 392 | 2026-05-01 | 2026-05-17 |
| `AgentGoalEvaluated` | 386 | 2026-05-25 | 2026-05-28 |
| `KYCIdentityCollected` | 382 | 2026-05-25 | 2026-05-27 |
| `KYCIdentityVerified` | 382 | 2026-05-25 | 2026-05-27 |
| `KYCSanctionsPEPScreened` | 382 | 2026-05-25 | 2026-05-27 |
| `KYCDecisionMade` | 381 | 2026-05-25 | 2026-05-27 |
| `ClientRejected` | 379 | 2026-05-25 | 2026-05-27 |
| `AgentGoalDeferred` | 339 | 2026-05-25 | 2026-05-28 |
| `DashboardProjectionRefreshed` | 307 | 2026-05-25 | 2026-05-28 |
| `FxSettlementInstructed` | 284 | 2026-05-23 | 2026-05-27 |
| `ClientAccepted` | 281 | 2026-05-13 | 2026-05-27 |
| `KYCUBOResolved` | 277 | 2026-05-25 | 2026-05-27 |
| `KYCRiskRated` | 277 | 2026-05-25 | 2026-05-27 |
| `CcrEadComputed` | 271 | 2026-05-18 | 2026-05-20 |
| `LawfulProcessingRegistered` | 242 | 2026-05-25 | 2026-05-27 |
| `AgentRunCompleted` | 190 | 2026-05-10 | 2026-05-28 |
| `AgentBriefIssued` | 186 | 2026-05-10 | 2026-05-28 |
| `AgentRunStarted` | 183 | 2026-05-10 | 2026-05-28 |
| `AuditFinding` | 157 | 2026-05-07 | 2026-05-27 |
| `M1CitationTrancheRegistered` | 148 | 2026-05-09 | 2026-05-09 |
| `IrsPositionRevalued` | 148 | 2026-05-19 | 2026-05-20 |
| `PermissionPolicyPublished` | 141 | 2026-05-25 | 2026-05-27 |
| `ProductDimensionAttested` | 128 | 2026-05-26 | 2026-05-27 |
| `IRRBBChecked` | 120 | 2026-05-26 | 2026-05-28 |
| `SubstrateAgentRunFailed` | 116 | 2026-05-25 | 2026-05-28 |
| `DecisionRequested` | 111 | 2026-05-10 | 2026-05-10 |
| `EquityTradeBooked` | 111 | 2026-05-09 | 2026-05-09 |
| `IfrsClassificationApplied` | 111 | 2026-05-09 | 2026-05-09 |
| `IrsTradeBooked` | 111 | 2026-05-20 | 2026-05-20 |
| `KYCEDDInitiated` | 104 | 2026-05-25 | 2026-05-27 |
| `KYCEDDCompleted` | 104 | 2026-05-25 | 2026-05-27 |
| `PrincipalPayment` | 101 | 2026-05-23 | 2026-05-28 |
| `IntradayHQLAStressProjection` | 96 | 2026-05-26 | 2026-05-28 |
| `CdmBindingsRegenerated` | 92 | 2026-05-09 | 2026-05-26 |
| `IdentityKeyRotated` | 90 | 2026-05-25 | 2026-05-27 |
| `OrderApprovedAtGateway` | 90 | 2026-05-17 | 2026-05-17 |
| `OrderRejectedAtGateway` | 90 | 2026-05-17 | 2026-05-17 |
| `AgentEscalation` | 76 | 2026-05-07 | 2026-05-26 |
| `CreditLimitBreached` | 74 | 2026-05-22 | 2026-05-22 |
| `CreditLimitBreachDisposed` | 74 | 2026-05-23 | 2026-05-23 |
| `LiquidityLimitBreached` | 74 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 74 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 74 | 2026-05-10 | 2026-05-10 |
| `PartyRelationshipAsserted` | 73 | 2026-05-19 | 2026-05-26 |
| `DocumentRegistered` | 72 | 2026-05-11 | 2026-05-25 |
| `MessageCorrelated` | 65 | 2026-05-23 | 2026-05-23 |
| `SubstrateStateSnapshot` | 62 | 2026-05-07 | 2026-05-28 |
| `AgentPerformanceEvaluated` | 60 | 2026-05-25 | 2026-05-28 |
| `AgentFeedbackIssued` | 60 | 2026-05-25 | 2026-05-28 |
| `SettlementConfirmed` | 57 | 2026-05-23 | 2026-05-28 |
| `DailyPnLReportGenerated` | 52 | 2026-05-25 | 2026-05-28 |
| `SanctionsClearancePassed` | 52 | 2026-05-13 | 2026-05-13 |
| `PEPScreeningCompleted` | 52 | 2026-05-13 | 2026-05-13 |
| `BeneficialOwnerResolved` | 52 | 2026-05-13 | 2026-05-13 |
| `RiskRatingAssigned` | 52 | 2026-05-13 | 2026-05-13 |
| `ConflictOfInterestDisclosed` | 47 | 2026-05-17 | 2026-05-17 |
| `AgentGoalSelected` | 47 | 2026-05-25 | 2026-05-28 |
| `BestExecutionVerified` | 46 | 2026-05-17 | 2026-05-17 |
| `FxTradeCancelled` | 44 | 2026-05-21 | 2026-05-21 |
| `AgentRegistered` | 42 | 2026-05-25 | 2026-05-27 |
| `FaisClassificationSuitabilityChecked` | 41 | 2026-05-17 | 2026-05-17 |
| `BestExecutionBreached` | 39 | 2026-05-17 | 2026-05-17 |
| `DataProjectionSnapshot` | 39 | 2026-05-07 | 2026-05-28 |
| `InboxHygieneSweep` | 39 | 2026-05-07 | 2026-05-28 |
| `PopiaConsentRecorded` | 39 | 2026-05-13 | 2026-05-13 |
| `CreditLimitAnnualReviewCompleted` | 37 | 2026-05-21 | 2026-05-21 |
| `LexUtilisationComputed` | 37 | 2026-05-20 | 2026-05-20 |
| `BriefSuperseded` | 37 | 2026-05-10 | 2026-05-10 |
| `EquitySettlementInstructed` | 37 | 2026-05-13 | 2026-05-13 |
| `PaNotificationSubmitted` | 37 | 2026-05-11 | 2026-05-11 |
| `CreditLimitWithdrawn` | 37 | 2026-05-12 | 2026-05-12 |
| `OrderAccepted` | 37 | 2026-05-13 | 2026-05-13 |
| `PartyRegistered` | 37 | 2026-05-23 | 2026-05-26 |
| `ObligationsRegisterSnapshot` | 34 | 2026-05-07 | 2026-05-28 |
| `SecuritySubstrateSnapshot` | 33 | 2026-05-07 | 2026-05-26 |
| `GovernanceCyclePrep` | 32 | 2026-05-07 | 2026-05-28 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `OutboundMessageDispatched` | 13 | 2026-05-23 | 2026-05-23 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `MtmRunCompleted` | 13 | 2026-05-26 | 2026-05-28 |
| `EddInitiated` | 13 | 2026-05-13 | 2026-05-13 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `LCRComputed` | 12 | 2026-05-26 | 2026-05-28 |
| `NSFRComputed` | 12 | 2026-05-26 | 2026-05-28 |
| `FtpCurvePublished` | 12 | 2026-05-26 | 2026-05-28 |
| `ALMRunCompleted` | 12 | 2026-05-26 | 2026-05-28 |
| `AgentEscalationDecided` | 12 | 2026-05-26 | 2026-05-27 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `AccountingReadinessSnapshot` | 9 | 2026-05-26 | 2026-05-28 |
| `CollateralInventorySnapshot` | 6 | 2026-05-26 | 2026-05-26 |
| `ModelValidationApproved` | 6 | 2026-05-27 | 2026-05-27 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `ProductProposalRegistered` | 5 | 2026-05-26 | 2026-05-26 |
| `ProductConceptualised` | 5 | 2026-05-26 | 2026-05-26 |
| `ProductDueDiligenceCompleted` | 5 | 2026-05-26 | 2026-05-26 |
| `ProductApproved` | 5 | 2026-05-26 | 2026-05-26 |
| `RiskAppetiteSnapshot` | 5 | 2026-05-27 | 2026-05-28 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `CounterpartyExposureCalculated` | 4 | 2026-05-18 | 2026-05-18 |
| `ModelSubmitted` | 3 | 2026-05-27 | 2026-05-27 |
| `ModelTierClassified` | 3 | 2026-05-27 | 2026-05-27 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `LCRRatioProjection` | 3 | 2026-05-28 | 2026-05-28 |
| `MLROAttestation` | 2 | 2026-05-26 | 2026-05-26 |
| `AgentOpsReadinessSnapshot` | 2 | 2026-05-26 | 2026-05-26 |
| `ConductObligationFlagged` | 2 | 2026-05-17 | 2026-05-17 |
| `AccountingPeriodOpened` | 2 | 2026-05-01 | 2026-05-28 |
| `TrialBalanceSnapshotted` | 2 | 2026-05-15 | 2026-06-01 |
| `InterbankLoanPlaced` | 2 | 2026-05-27 | 2026-05-27 |
| `CollateralInventorySnapshotted` | 2 | 2026-05-28 | 2026-05-28 |
| `AgentDecision` | 1 | 2026-05-07 | 2026-05-07 |
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

Substrate is broadly operational: 91,601 events across 155 typed shapes, 31/31 personas with operating specs, 125 runtime handlers registered, Claude narrative integration rolled out across the seven core handlers. The projection-cache and citation-gate gaps closed last week stayed closed; what remains load-bearing is largely scheduler-resilience and Neon-hardening, plus the slow burn of an Owner Inbox at 482 deliverables.

Three changes dominate the week. First, Nadia's validation cycle came online end-to-end — `ModelRegistered`, `ModelTierClassified`, `ModelSubmitted`, `ValidationMethodologyPublished`, `ValidationFindingRaised`, `ModelValidationApproved` all appear for the first time on 2026-05-27, giving the bank a typed model-risk spine where previously there was none. Second, the escalation loop closed its return path: `AgentEscalationDecided` is now emitting (12 events, 2026-05-26/27) against the existing 76 `AgentEscalation` events — Vera's audit pipelines #14/#15 now have both halves of the conversation in canonical form. Third, a 29,927-event `ProvenanceReclassified` burst on 2026-05-27 — a one-shot reclassification pass that I should flag for Vera to verify rather than treat as steady-state throughput. Also worth naming: `ScheduledTrigger` is now firing (446 events from 2026-05-25), so A2.1's substrate scheduler is partially materialised even while cron files still drive the actual workflow_dispatch.

Ranked by downstream impact, the remaining gaps are: (1) **GitHub Actions cron as the scheduling substrate** — `ScheduledTrigger` events exist but the Bun-process scheduler emitting them authoritatively does not, so the off-the-hour pinning from 2026-05-08 is still the only thing between us and another silent drop; every scheduled handler depends on this. (2) **Neon hardening conditions §5.1 (role downgrade) and §5.2 (IP allowlist)** under exception `TM-NEON-EVENT-STORE-001` — deferred while events are non-sensitive, but load-bearing on any KYC, PII, or client-decision payload landing in the store; with 382 `KYCIdentityCollected` and 242 `LawfulProcessingRegistered` events already flowing, the "non-sensitive" framing is getting thin. (3) **Cross-process event-bus** — event-driven dispatch is in-process only, which caps Anya's projection-refresh and any future fan-out at single-workflow boundaries until M8.

Next: stand up A2.1 — make the Bun scheduler authoritative for `ScheduledTrigger` and demote the cron YAML to shims.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
