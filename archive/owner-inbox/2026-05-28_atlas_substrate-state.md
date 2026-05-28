---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-28T05:44:49.882Z
decision-required: false
---

# Atlas — substrate state, 2026-05-28

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 88213 events across 151 types; 31/31 personas have operating specs; 125 runtime handlers registered; 470 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 88213

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 29927 | 2026-05-27 | 2026-05-27 |
| `InboundMessageReceived` | 13487 | 2026-05-23 | 2026-05-27 |
| `SubstrateAgentRunStarted` | 3432 | 2026-05-25 | 2026-05-28 |
| `BusDispatched` | 3397 | 2026-05-25 | 2026-05-28 |
| `SubstrateAgentRunCompleted` | 3326 | 2026-05-25 | 2026-05-28 |
| `GatewayCheckRequested` | 3172 | 2026-05-09 | 2026-05-20 |
| `Decision` | 2170 | 2026-04-30 | 2026-05-28 |
| `GatewayCheckCompleted` | 1920 | 2026-05-17 | 2026-05-20 |
| `SubLedgerPostingEmitted` | 1832 | 2026-05-09 | 2026-05-26 |
| `RiskRaised` | 1369 | 2025-12-01 | 2026-05-26 |
| `OrderProposed` | 1274 | 2026-05-09 | 2026-05-20 |
| `ISDACSAAssessmentCompleted` | 1226 | 2024-01-01 | 2026-05-20 |
| `CreditLimitLoaded` | 1080 | 2024-01-01 | 2026-05-21 |
| `CreditLimitApplicationSubmitted` | 1061 | 2024-01-01 | 2026-05-20 |
| `CreditLimitApproved` | 1061 | 2024-01-01 | 2026-05-20 |
| `LegacyFanoutShadowed` | 961 | 2026-05-25 | 2026-05-28 |
| `RecordFiled` | 905 | 2026-05-05 | 2026-05-27 |
| `CreditAnalysisCompleted` | 814 | 2024-01-01 | 2026-05-20 |
| `CreditLimitProposed` | 814 | 2024-01-01 | 2026-05-20 |
| `CcrReplacementCostComputed` | 708 | 2026-05-18 | 2026-05-20 |
| `BacktestRequested` | 634 | 2026-01-10 | 2026-01-10 |
| `BacktestRun` | 596 | 2026-05-09 | 2026-05-09 |
| `FxTradeExecuted` | 595 | 2026-05-17 | 2026-05-27 |
| `SubstrateAlert` | 554 | 2025-01-01 | 2026-05-27 |
| `WorkstreamRegistered` | 488 | 2026-05-07 | 2026-05-26 |
| `MarketsProjectionRefreshed` | 450 | 2026-05-09 | 2026-05-09 |
| `ReconResult` | 450 | 2026-05-07 | 2026-05-28 |
| `ScheduledTrigger` | 439 | 2026-05-25 | 2026-05-28 |
| `ClientCandidateRegistered` | 434 | 2026-05-25 | 2026-05-27 |
| `CounterpartyFaisClassified` | 392 | 2026-05-01 | 2026-05-17 |
| `KYCIdentityCollected` | 382 | 2026-05-25 | 2026-05-27 |
| `KYCIdentityVerified` | 382 | 2026-05-25 | 2026-05-27 |
| `KYCSanctionsPEPScreened` | 382 | 2026-05-25 | 2026-05-27 |
| `KYCDecisionMade` | 381 | 2026-05-25 | 2026-05-27 |
| `ClientRejected` | 379 | 2026-05-25 | 2026-05-27 |
| `AgentGoalEvaluated` | 324 | 2026-05-25 | 2026-05-28 |
| `DashboardProjectionRefreshed` | 298 | 2026-05-25 | 2026-05-26 |
| `FxSettlementInstructed` | 284 | 2026-05-23 | 2026-05-27 |
| `ClientAccepted` | 281 | 2026-05-13 | 2026-05-27 |
| `AgentGoalDeferred` | 280 | 2026-05-25 | 2026-05-28 |
| `KYCUBOResolved` | 277 | 2026-05-25 | 2026-05-27 |
| `KYCRiskRated` | 277 | 2026-05-25 | 2026-05-27 |
| `CcrEadComputed` | 271 | 2026-05-18 | 2026-05-20 |
| `LawfulProcessingRegistered` | 242 | 2026-05-25 | 2026-05-27 |
| `AgentRunCompleted` | 189 | 2026-05-10 | 2026-05-27 |
| `AgentBriefIssued` | 186 | 2026-05-10 | 2026-05-28 |
| `AgentRunStarted` | 183 | 2026-05-10 | 2026-05-28 |
| `AuditFinding` | 157 | 2026-05-07 | 2026-05-27 |
| `M1CitationTrancheRegistered` | 148 | 2026-05-09 | 2026-05-09 |
| `IrsPositionRevalued` | 148 | 2026-05-19 | 2026-05-20 |
| `PermissionPolicyPublished` | 141 | 2026-05-25 | 2026-05-27 |
| `ProductDimensionAttested` | 128 | 2026-05-26 | 2026-05-27 |
| `DecisionRequested` | 111 | 2026-05-10 | 2026-05-10 |
| `EquityTradeBooked` | 111 | 2026-05-09 | 2026-05-09 |
| `IfrsClassificationApplied` | 111 | 2026-05-09 | 2026-05-09 |
| `IrsTradeBooked` | 111 | 2026-05-20 | 2026-05-20 |
| `KYCEDDInitiated` | 104 | 2026-05-25 | 2026-05-27 |
| `KYCEDDCompleted` | 104 | 2026-05-25 | 2026-05-27 |
| `PrincipalPayment` | 101 | 2026-05-23 | 2026-05-28 |
| `SubstrateAgentRunFailed` | 101 | 2026-05-25 | 2026-05-27 |
| `IRRBBChecked` | 100 | 2026-05-26 | 2026-05-26 |
| `CdmBindingsRegenerated` | 92 | 2026-05-09 | 2026-05-26 |
| `IdentityKeyRotated` | 90 | 2026-05-25 | 2026-05-27 |
| `OrderApprovedAtGateway` | 90 | 2026-05-17 | 2026-05-17 |
| `OrderRejectedAtGateway` | 90 | 2026-05-17 | 2026-05-17 |
| `IntradayHQLAStressProjection` | 80 | 2026-05-26 | 2026-05-26 |
| `AgentEscalation` | 76 | 2026-05-07 | 2026-05-26 |
| `CreditLimitBreached` | 74 | 2026-05-22 | 2026-05-22 |
| `CreditLimitBreachDisposed` | 74 | 2026-05-23 | 2026-05-23 |
| `LiquidityLimitBreached` | 74 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 74 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 74 | 2026-05-10 | 2026-05-10 |
| `PartyRelationshipAsserted` | 73 | 2026-05-19 | 2026-05-26 |
| `DocumentRegistered` | 72 | 2026-05-11 | 2026-05-25 |
| `MessageCorrelated` | 65 | 2026-05-23 | 2026-05-23 |
| `SubstrateStateSnapshot` | 61 | 2026-05-07 | 2026-05-26 |
| `SettlementConfirmed` | 57 | 2026-05-23 | 2026-05-28 |
| `SanctionsClearancePassed` | 52 | 2026-05-13 | 2026-05-13 |
| `PEPScreeningCompleted` | 52 | 2026-05-13 | 2026-05-13 |
| `BeneficialOwnerResolved` | 52 | 2026-05-13 | 2026-05-13 |
| `RiskRatingAssigned` | 52 | 2026-05-13 | 2026-05-13 |
| `DailyPnLReportGenerated` | 51 | 2026-05-25 | 2026-05-28 |
| `ConflictOfInterestDisclosed` | 47 | 2026-05-17 | 2026-05-17 |
| `BestExecutionVerified` | 46 | 2026-05-17 | 2026-05-17 |
| `FxTradeCancelled` | 44 | 2026-05-21 | 2026-05-21 |
| `AgentGoalSelected` | 44 | 2026-05-25 | 2026-05-28 |
| `AgentRegistered` | 42 | 2026-05-25 | 2026-05-27 |
| `FaisClassificationSuitabilityChecked` | 41 | 2026-05-17 | 2026-05-17 |
| `BestExecutionBreached` | 39 | 2026-05-17 | 2026-05-17 |
| `PopiaConsentRecorded` | 39 | 2026-05-13 | 2026-05-13 |
| `CreditLimitAnnualReviewCompleted` | 37 | 2026-05-21 | 2026-05-21 |
| `LexUtilisationComputed` | 37 | 2026-05-20 | 2026-05-20 |
| `BriefSuperseded` | 37 | 2026-05-10 | 2026-05-10 |
| `EquitySettlementInstructed` | 37 | 2026-05-13 | 2026-05-13 |
| `PaNotificationSubmitted` | 37 | 2026-05-11 | 2026-05-11 |
| `CreditLimitWithdrawn` | 37 | 2026-05-12 | 2026-05-12 |
| `OrderAccepted` | 37 | 2026-05-13 | 2026-05-13 |
| `PartyRegistered` | 37 | 2026-05-23 | 2026-05-26 |
| `DataProjectionSnapshot` | 36 | 2026-05-07 | 2026-05-26 |
| `InboxHygieneSweep` | 36 | 2026-05-07 | 2026-05-26 |
| `ObligationsRegisterSnapshot` | 33 | 2026-05-07 | 2026-05-26 |
| `SecuritySubstrateSnapshot` | 33 | 2026-05-07 | 2026-05-26 |
| `GovernanceCyclePrep` | 31 | 2026-05-07 | 2026-05-07 |
| `AgentPerformanceEvaluated` | 29 | 2026-05-25 | 2026-05-25 |
| `AgentFeedbackIssued` | 29 | 2026-05-25 | 2026-05-25 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `OutboundMessageDispatched` | 13 | 2026-05-23 | 2026-05-23 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `EddInitiated` | 13 | 2026-05-13 | 2026-05-13 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `AgentEscalationDecided` | 12 | 2026-05-26 | 2026-05-27 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `MtmRunCompleted` | 10 | 2026-05-26 | 2026-05-26 |
| `FtpCurvePublished` | 10 | 2026-05-26 | 2026-05-26 |
| `ALMRunCompleted` | 10 | 2026-05-26 | 2026-05-26 |
| `CollateralInventorySnapshot` | 6 | 2026-05-26 | 2026-05-26 |
| `AccountingReadinessSnapshot` | 6 | 2026-05-26 | 2026-05-26 |
| `LCRComputed` | 6 | 2026-05-26 | 2026-05-26 |
| `NSFRComputed` | 6 | 2026-05-26 | 2026-05-26 |
| `ModelValidationApproved` | 6 | 2026-05-27 | 2026-05-27 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `ProductProposalRegistered` | 5 | 2026-05-26 | 2026-05-26 |
| `ProductConceptualised` | 5 | 2026-05-26 | 2026-05-26 |
| `ProductDueDiligenceCompleted` | 5 | 2026-05-26 | 2026-05-26 |
| `ProductApproved` | 5 | 2026-05-26 | 2026-05-26 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `CounterpartyExposureCalculated` | 4 | 2026-05-18 | 2026-05-18 |
| `ModelSubmitted` | 3 | 2026-05-27 | 2026-05-27 |
| `ModelTierClassified` | 3 | 2026-05-27 | 2026-05-27 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `MLROAttestation` | 2 | 2026-05-26 | 2026-05-26 |
| `AgentOpsReadinessSnapshot` | 2 | 2026-05-26 | 2026-05-26 |
| `ConductObligationFlagged` | 2 | 2026-05-17 | 2026-05-17 |
| `TrialBalanceSnapshotted` | 2 | 2026-05-15 | 2026-06-01 |
| `RiskAppetiteSnapshot` | 2 | 2026-05-27 | 2026-05-27 |
| `InterbankLoanPlaced` | 2 | 2026-05-27 | 2026-05-27 |
| `AgentDecision` | 1 | 2026-05-07 | 2026-05-07 |
| `RegulatoryInstrumentRegistered` | 1 | 2026-05-25 | 2026-05-25 |
| `RegulatoryInstrumentContextualised` | 1 | 2026-05-25 | 2026-05-25 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `RasLimitSchedulePublished` | 1 | 2026-05-14 | 2026-05-14 |
| `ValidationFindingRaised` | 1 | 2026-05-27 | 2026-05-27 |
| `BalanceSheetProjected` | 1 | 2026-05-27 | 2026-05-27 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |
| `AccountingPeriodOpened` | 1 | 2026-05-01 | 2026-05-01 |
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

The substrate is past the "scaffolding" phase and into the "load-bearing" phase: 88,213 events across 151 distinct types, 31/31 personas with operating specs, 125 runtime handlers registered, and all three trigger kinds (scheduled, event-driven, on-request) first-class in `runtime/run.ts`. The event store is now cloud-shared via Neon Postgres under Senna's `TM-NEON-EVENT-STORE-001` exception, with bidirectional sync framing every workflow. What's closing fast is the agent-runtime layer itself — `SubstrateAgentRunStarted`/`Completed`/`Failed` (3,432 / 3,326 / 101), `BusDispatched` (3,397), and `AgentGoalEvaluated` / `Selected` / `Deferred` are now the highest-volume operational signals after the message and provenance pipes. What's still blocking is the cron substrate (interim pinning only) and the Neon hardening conditions §5.1/§5.2, which gate any sensitive-data event flow.

The three most consequential shifts visible in this snapshot: first, `AgentPromptOptimizationApplied` (13 events, 2026-05-27) and `AgentPerformanceEvaluated` / `AgentFeedbackIssued` (29 each, 2026-05-25) — Sade's fleet-optimisation and efficiency-advisory loops are now writing back into the substrate, closing the agent-self-improvement feedback path. Second, `ModelSubmitted` / `ModelTierClassified` / `ModelRegistered` / `ValidationMethodologyPublished` / `ModelValidationApproved` / `ValidationFindingRaised` — Nadia's validation cycle has substrate, not just a spec. Third, `LegacyFanoutShadowed` is now at 961 events since 2026-05-25, which means the in-process event-driven fanout in `runtime/run.ts` has a shadow trace ready for the M8 cross-process bus cut-over.

On load-bearing gaps: `AgentEscalation` is live at 76 events with `AgentEscalationDecided` at 12 — Vera's audit pipelines #14/#15 are unblocked on the producing side and now gated on her consumer wiring, not on Atlas. `WorkstreamRegistered` is at 488 events, so the dashboard's curated-seed retirement is substrate-complete; the remaining work is downstream of Anya's projection runtime, not here. The genuinely load-bearing residual is the GitHub Actions cron substrate — ten scheduled workflows still depend on cron minutes-pinning rather than a typed `ScheduledTrigger` emitter, and `ScheduledTrigger` already exists in the store (439 events) from the on-request and event-driven paths, which makes A2.1 a wiring job rather than a design one. Owner Inbox sits at 470 deliverables, which is a Scrooge/Devon throughput question, not a substrate-shape one.

Next: cut A2.1 — promote `ScheduledTrigger` from observed event to authoritative scheduler emission and retire the off-the-hour cron pinning.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
