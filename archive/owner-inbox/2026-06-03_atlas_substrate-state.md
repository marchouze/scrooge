---
agent: Atlas
trigger: substrate-state
asOf: 2026-06-03T12:00:19.229Z
decision-required: false
---

# Atlas — substrate state, 2026-06-03

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 64333 events across 148 types; 31/31 personas have operating specs; 130 runtime handlers registered; 590 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 64333

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 11478 | 2026-05-27 | 2026-05-29 |
| `SubstrateAgentRunStarted` | 9117 | 2026-05-25 | 2026-06-03 |
| `SubstrateAgentRunCompleted` | 8948 | 2026-05-25 | 2026-06-03 |
| `BusDispatched` | 7604 | 2026-05-25 | 2026-06-03 |
| `LegacyFanoutShadowed` | 4384 | 2026-05-25 | 2026-06-03 |
| `Decision` | 2724 | 2026-04-30 | 2026-06-03 |
| `RiskRaised` | 2511 | 2025-12-01 | 2026-06-02 |
| `WorkstreamRegistered` | 1596 | 2026-05-07 | 2026-06-03 |
| `DashboardProjectionRefreshed` | 1459 | 2026-05-25 | 2026-06-03 |
| `RecordFiled` | 1395 | 2026-05-05 | 2026-06-03 |
| `SubstrateAlert` | 1168 | 2025-01-01 | 2026-06-03 |
| `BacktestRequested` | 816 | 2026-01-10 | 2026-01-10 |
| `ScheduledTrigger` | 810 | 2026-05-25 | 2026-06-03 |
| `CalculationPerformed` | 798 | 2026-06-01 | 2026-06-03 |
| `BacktestRun` | 769 | 2026-05-09 | 2026-05-09 |
| `ReconResult` | 693 | 2026-05-07 | 2026-06-03 |
| `AgentGoalEvaluated` | 665 | 2026-05-25 | 2026-06-03 |
| `MarketsProjectionRefreshed` | 585 | 2026-05-09 | 2026-05-09 |
| `IdentityKeyRotated` | 550 | 2026-05-25 | 2026-06-02 |
| `OfficialMarkAdopted` | 488 | 2026-05-28 | 2026-06-02 |
| `AgentGoalDeferred` | 447 | 2026-05-25 | 2026-06-03 |
| `PermissionPolicyPublished` | 325 | 2026-05-25 | 2026-06-01 |
| `AgentRunCompleted` | 291 | 2026-05-10 | 2026-06-02 |
| `AgentBriefIssued` | 284 | 2026-05-10 | 2026-06-03 |
| `AgentRunStarted` | 280 | 2026-05-10 | 2026-06-02 |
| `AgentPerformanceEvaluated` | 246 | 2026-05-25 | 2026-06-03 |
| `AgentFeedbackIssued` | 246 | 2026-05-25 | 2026-06-03 |
| `AuditFinding` | 227 | 2026-05-07 | 2026-05-30 |
| `AuditFindingClosed` | 227 | 2026-06-02 | 2026-06-02 |
| `AgentGoalSelected` | 218 | 2026-05-25 | 2026-06-03 |
| `SubstrateStateSnapshot` | 199 | 2026-05-07 | 2026-06-03 |
| `M1CitationTrancheRegistered` | 180 | 2026-05-09 | 2026-05-09 |
| `ProductDimensionAttested` | 170 | 2026-05-26 | 2026-05-28 |
| `SubstrateAgentRunFailed` | 164 | 2026-05-25 | 2026-06-03 |
| `DecisionRequested` | 135 | 2026-05-10 | 2026-05-10 |
| `CdmBindingsRegenerated` | 120 | 2026-05-09 | 2026-06-01 |
| `SubLedgerPostingEmitted` | 91 | 2026-06-01 | 2026-06-03 |
| `LiquidityLimitBreached` | 90 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 90 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 90 | 2026-05-10 | 2026-05-10 |
| `AgentEscalation` | 81 | 2026-05-07 | 2026-06-02 |
| `DailyPnLReportGenerated` | 72 | 2026-06-01 | 2026-06-03 |
| `DocumentRegistered` | 71 | 2026-05-11 | 2026-05-25 |
| `PartyRegistered` | 65 | 2026-05-23 | 2026-06-01 |
| `AgentRegistered` | 60 | 2026-05-26 | 2026-06-01 |
| `ConflictOfInterestDisclosed` | 55 | 2026-05-17 | 2026-05-17 |
| `DataProjectionSnapshot` | 54 | 2026-05-07 | 2026-06-03 |
| `InboxHygieneSweep` | 54 | 2026-05-07 | 2026-06-03 |
| `BriefSuperseded` | 49 | 2026-05-10 | 2026-05-31 |
| `ClientCandidateRegistered` | 48 | 2026-06-01 | 2026-06-01 |
| `PaNotificationSubmitted` | 45 | 2026-05-11 | 2026-05-11 |
| `ObligationsRegisterSnapshot` | 44 | 2026-05-07 | 2026-06-03 |
| `SecuritySubstrateSnapshot` | 43 | 2026-05-07 | 2026-05-28 |
| `GovernanceCyclePrep` | 42 | 2026-05-07 | 2026-06-02 |
| `FxSettlementInstructed` | 38 | 2026-06-01 | 2026-06-03 |
| `PartyRelationshipAsserted` | 36 | 2026-06-01 | 2026-06-01 |
| `PartyAttributeChanged` | 36 | 2026-06-01 | 2026-06-02 |
| `FxTradeExecuted` | 32 | 2026-06-01 | 2026-06-03 |
| `ModelValidationApproved` | 26 | 2026-05-27 | 2026-05-29 |
| `KYCIdentityCollected` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCIdentityVerified` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCSanctionsPEPScreened` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCUBOResolved` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCRiskRated` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCDecisionMade` | 26 | 2026-06-01 | 2026-06-01 |
| `ClientAccepted` | 26 | 2026-06-01 | 2026-06-01 |
| `LawfulProcessingRegistered` | 26 | 2026-06-01 | 2026-06-01 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `ModelSubmitted` | 23 | 2026-05-27 | 2026-05-29 |
| `ModelTierClassified` | 23 | 2026-05-27 | 2026-05-29 |
| `FxTradeCancelled` | 21 | 2026-06-01 | 2026-06-01 |
| `AccountingReadinessSnapshot` | 20 | 2026-05-26 | 2026-06-03 |
| `FtpCurvePublished` | 20 | 2026-05-26 | 2026-06-03 |
| `IRRBBChecked` | 20 | 2026-06-02 | 2026-06-03 |
| `RiskAppetiteSnapshot` | 18 | 2026-05-27 | 2026-06-03 |
| `ValuationAdjustmentComputed` | 18 | 2026-06-01 | 2026-06-02 |
| `AgentEscalationDecided` | 16 | 2026-05-26 | 2026-06-02 |
| `IntradayHQLAStressProjection` | 16 | 2026-06-02 | 2026-06-03 |
| `PrincipalPayment` | 14 | 2026-06-02 | 2026-06-03 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `FinancialInstrumentDefined` | 13 | 2026-06-02 | 2026-06-02 |
| `FxPositionRevalued` | 12 | 2026-06-02 | 2026-06-02 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `ALMReadinessSnapshot` | 11 | 2026-05-29 | 2026-06-03 |
| `InboundMessageReceived` | 11 | 2026-06-01 | 2026-06-02 |
| `MessageCorrelated` | 10 | 2026-06-01 | 2026-06-02 |
| `FinancialInstrumentClassified` | 9 | 2026-06-02 | 2026-06-02 |
| `ProductProposalRegistered` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductConceptualised` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductDueDiligenceCompleted` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductApproved` | 8 | 2026-05-26 | 2026-05-28 |
| `WorkstreamCompleted` | 7 | 2026-05-28 | 2026-05-28 |
| `SettlementConfirmed` | 7 | 2026-06-02 | 2026-06-03 |
| `RiskResolved` | 7 | 2026-06-02 | 2026-06-02 |
| `PaymentsReadinessSnapshot` | 6 | 2026-05-29 | 2026-06-03 |
| `MarketsProjectionRegistered` | 5 | 2026-05-09 | 2026-05-09 |
| `AgentDecision` | 5 | 2026-05-07 | 2026-05-30 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `MtmRunCompleted` | 4 | 2026-06-01 | 2026-06-02 |
| `LCRComputed` | 4 | 2026-06-02 | 2026-06-03 |
| `NSFRComputed` | 4 | 2026-06-02 | 2026-06-03 |
| `RiskRunCompleted` | 4 | 2026-06-02 | 2026-06-03 |
| `LiquiditySnapshot` | 4 | 2026-06-02 | 2026-06-03 |
| `MLROAttestation` | 3 | 2026-05-26 | 2026-06-01 |
| `AgentOpsReadinessSnapshot` | 3 | 2026-05-26 | 2026-05-29 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `PrudentValuationAvaAggregated` | 3 | 2026-06-01 | 2026-06-02 |
| `OperationalResilienceSnapshot` | 2 | 2026-05-29 | 2026-06-01 |
| `POPIAControlsSnapshot` | 2 | 2026-05-29 | 2026-06-03 |
| `AuditCommitteePackPrepped` | 2 | 2026-05-29 | 2026-06-02 |
| `MarketsReadinessSnapshot` | 2 | 2026-05-29 | 2026-06-01 |
| `DepositTaken` | 2 | 2026-06-01 | 2026-06-02 |
| `InterbankLoanPlaced` | 2 | 2026-06-01 | 2026-06-01 |
| `BondTradeExecuted` | 2 | 2026-06-01 | 2026-06-02 |
| `OutboundMessageDispatched` | 2 | 2026-06-01 | 2026-06-02 |
| `PnLAttributionGenerated` | 2 | 2026-06-01 | 2026-06-03 |
| `PnLSignedOff` | 2 | 2026-06-01 | 2026-06-03 |
| `ALMRunCompleted` | 2 | 2026-06-02 | 2026-06-03 |
| `CollateralInventorySnapshotted` | 2 | 2026-06-02 | 2026-06-03 |
| `RegulatoryInstrumentRegistered` | 1 | 2026-05-25 | 2026-05-25 |
| `RegulatoryInstrumentContextualised` | 1 | 2026-05-25 | 2026-05-25 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `RasLimitSchedulePublished` | 1 | 2026-05-14 | 2026-05-14 |
| `ValidationFindingRaised` | 1 | 2026-05-27 | 2026-05-27 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `RoleResearchQueueSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `LegalReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `CyberResilienceSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `TaxReadinessSnapshot` | 1 | 2026-05-29 | 2026-05-29 |
| `PartyClassified` | 1 | 2026-06-01 | 2026-06-01 |
| `RepoTradeOpened` | 1 | 2026-06-01 | 2026-06-01 |
| `FundingLineDrawn` | 1 | 2026-06-01 | 2026-06-01 |
| `BalanceSheetProjected` | 1 | 2026-05-27 | 2026-05-27 |
| `SeedDescoped` | 1 | 2026-06-01 | 2026-06-01 |
| `CapitalEvent` | 1 | 2026-06-01 | 2026-06-01 |
| `LCRRatioProjection` | 1 | 2026-06-02 | 2026-06-02 |
| `AccountingPeriodOpened` | 1 | 2026-06-02 | 2026-06-02 |
| `IrsTradeBooked` | 1 | 2026-06-02 | 2026-06-02 |
| `IrsPositionRevalued` | 1 | 2026-06-02 | 2026-06-02 |
| `FundingDrawnDown` | 1 | 2026-06-02 | 2026-06-02 |
| `SettlementInstructionIssued` | 1 | 2026-06-02 | 2026-06-02 |
| `PnLFlashRecorded` | 1 | 2026-06-03 | 2026-06-03 |
| `PnLFlashActualReconciled` | 1 | 2026-06-03 | 2026-06-03 |
| `BankModePolicySet` | 1 | 2026-06-03 | 2026-06-03 |
| `MarketRiskMeasureComputed` | 1 | 2026-06-03 | 2026-06-03 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

130 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

| Agent | Trigger |
|---|---|
| Vera | `overnight-recon` |
| Vera | `codebase-quality-review` |
| Vera | `goal-loop` |
| Vera | `event-triage` |
| Vera | `issues-tracker` |
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
| Bea | `product-control-daily` |
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
- Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised + closure family (RiskResolved / RiskAccepted / RiskMitigated) — DEFINED in `platform/event-store/event-types/risk.ts` + `.../event-types.ts` with Zod payload schemas and typed `make<Type>` factories. Substrate gaps surface on the SubstrateStateSnapshot `gaps[]` status inventory + per-gap WorkstreamRegistered events; they are NOT risk-register findings, so Atlas no longer emits RiskRaised for them (WS-RISK-REGISTER-CLOSURE). The closure family lets goal-loops resolve a risk register by riskId pairing. Vera's audit pipelines #14/#15 and the dashboard's curated-seed retirement now have substrate to consume.
- Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class in `runtime/run.ts`. Event-driven dispatch fans out in-process from a parent run when the parent appended an event type a downstream handler subscribes to; cross-process / cross-workflow event-bus is M8 cloud-lift work. On-request handlers are dispatched via `bun run agent:<slug>` or workflow_dispatch with no schedule (first example: `mira:citation-gate`).
- Claude API integration for agent-narrative output: ROLLED OUT. All seven runtime handlers (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge) call `tryGenerateNarrative` after their mechanical pass. Each has a stable persona-grounded system prompt cached as the prefix; per-run state is the volatile suffix. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.
- Projection-cache persistence: closed by `anya:projection-refresh`, an event-driven handler subscribed to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision. Re-derives the dashboard projection from canonical sources + the live event store and writes it to the runtime cache `prototype/.local/dashboard-state.json` (gitignored). D-EVENT-STORE-SCALING Slice 3a (PR #138, 2026-05-10) split this runtime path off the previously-committed seed; Slice 3b (same day) removed the seed from the commit graph entirely — the recon harness now derives + asserts internal consistency at recon time rather than comparing against a stored cache.
- Citation gate: now wrapped as `mira:citation-gate` (on-request). Walks the event store, emits `CitationGatePassed` / `CitationGateFailed` and one `AuditFinding` per missing-citation event. Workflow at `.github/workflows/agent-runtime-mira-citation-gate.yml` (workflow_dispatch only — the gate is also still part of the `ci` script for synchronous CI verification).
- GitHub Actions cron unreliability — interim substrate. GH Actions silently dropped Anya 03:00 UTC + Scrooge 04:00 UTC daily slots overnight 2026-05-07/08; Vera 02:00 UTC fired 2h46m late. All ten scheduled workflows re-pinned 2026-05-08 to off-the-hour distinct minutes (Vera 02:13, Anya 03:17, Scrooge 04:27, Helena 04:30, Devon Mon 05:23, Zara Mon 05:30, Atlas Mon 06:19, Owen Tue 07:31, Mira Wed 07:29, Senna Thu 07:37). Permanent fix is A2.1 — substrate scheduler emitting typed `ScheduledTrigger` events from a Bun process — at which point cron files become thin shims or retire entirely.

## Atlas's narrative

The substrate is operationally dense and converging: 64,333 events across 148 types, all 31 personas have operating specs, and 130 runtime handlers are registered across scheduled, event-driven, and on-request triggers. The structural gaps that gated downstream work a month ago — typed escalation/decision/risk payloads, projection-cache persistence, the citation gate as an on-request handler, Claude-narrative integration across the runtime — are all closed. What remains soft is mostly operational: GH Actions cron drift papered over with off-the-hour pinning, Neon-on-Postgres event store running under Senna's `TM-NEON-EVENT-STORE-001` exception with §5.1/§5.2 hardening deferred until sensitive payloads flow, and the M8 cross-process event bus still pending.

Most consequential signal in this snapshot: the new product/balance-sheet machinery has gone live. `FxTradeExecuted` (32), `IrsTradeBooked`, `RepoTradeOpened`, `FundingDrawnDown`, `SubLedgerPostingEmitted` (91), `MtmRunCompleted`, `LCRComputed`/`NSFRComputed`, `PnLFlashRecorded`/`PnLFlashActualReconciled`, and a fresh `MarketRiskMeasureComputed` (today) are all present alongside a full KYC chain (`KYCIdentityCollected` → `ClientAccepted`, 26 each on 2026-06-01) and 227 `AuditFindingClosed` events on 2026-06-02 — Thandiwe and Nadia have begun systematically draining the finding backlog. `BankModePolicySet` appeared today (1 event), which is a new control-plane primitive worth watching.

On load-bearing gaps: with `AgentEscalation` at 81 events and `AgentEscalationDecided` at 16, the typed escalation substrate Vera's audit pipelines #14/#15 depend on is no longer the bottleneck — pipeline coverage is. `WorkstreamRegistered` at 1,596 / `WorkstreamCompleted` at 7 means the curated-seed retirement is unblocked at the substrate layer but the completion-event discipline is thin; Anya's dashboard can derive, but workstream lifecycle closure is the missing signal. The two genuinely load-bearing residuals are (a) GH Actions scheduler reliability — A2.1's substrate scheduler emitting `ScheduledTrigger` from a Bun process would retire ten cron files and make Sade's fleet-optimisation telemetry trustworthy; `ScheduledTrigger` is already at 810 events so the event shape exists, the dispatcher does not — and (b) cross-process event-bus, which gates anything wanting to react to another workflow's events rather than its own parent run.

Next: ship A2.1 — substrate-owned scheduler emitting `ScheduledTrigger` — and retire cron as a control plane.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
