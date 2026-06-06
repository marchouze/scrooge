---
agent: Atlas
trigger: substrate-state
asOf: 2026-06-06T19:00:12.239Z
decision-required: false
---

# Atlas — substrate state, 2026-06-06

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 76481 events across 154 types; 31/31 personas have operating specs; 130 runtime handlers registered; 641 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `/Users/marc/.local/share/bank/event.db` · Total events: 76481

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ProvenanceReclassified` | 11478 | 2026-05-27 | 2026-05-29 |
| `SubstrateAgentRunStarted` | 11434 | 2026-05-25 | 2026-06-06 |
| `SubstrateAgentRunCompleted` | 11264 | 2026-05-25 | 2026-06-06 |
| `BusDispatched` | 9923 | 2026-05-25 | 2026-06-06 |
| `LegacyFanoutShadowed` | 6541 | 2026-05-25 | 2026-06-06 |
| `Decision` | 2663 | 2026-04-30 | 2026-06-06 |
| `RiskRaised` | 2468 | 2025-12-01 | 2026-06-02 |
| `WorkstreamRegistered` | 2092 | 2026-05-07 | 2026-06-06 |
| `DashboardProjectionRefreshed` | 2035 | 2026-05-25 | 2026-06-06 |
| `RecordFiled` | 1507 | 2026-05-05 | 2026-06-06 |
| `CalculationPerformed` | 1242 | 2026-06-01 | 2026-06-06 |
| `SubstrateAlert` | 1178 | 2025-01-01 | 2026-06-06 |
| `ScheduledTrigger` | 972 | 2026-05-25 | 2026-06-06 |
| `BacktestRequested` | 797 | 2026-01-10 | 2026-01-10 |
| `AgentGoalEvaluated` | 789 | 2026-05-25 | 2026-06-06 |
| `ReconResult` | 774 | 2026-05-07 | 2026-06-06 |
| `BacktestRun` | 751 | 2026-05-09 | 2026-05-09 |
| `MarketsProjectionRefreshed` | 555 | 2026-05-09 | 2026-05-09 |
| `IdentityKeyRotated` | 550 | 2026-05-25 | 2026-06-02 |
| `OfficialMarkAdopted` | 524 | 2026-05-28 | 2026-06-05 |
| `AgentGoalDeferred` | 482 | 2026-05-25 | 2026-06-06 |
| `ObligationAdopted` | 418 | 2026-06-04 | 2026-06-04 |
| `AgentPerformanceEvaluated` | 339 | 2026-05-25 | 2026-06-06 |
| `AgentFeedbackIssued` | 339 | 2026-05-25 | 2026-06-06 |
| `PermissionPolicyPublished` | 325 | 2026-05-25 | 2026-06-01 |
| `AgentRunCompleted` | 310 | 2026-05-10 | 2026-06-06 |
| `AgentGoalSelected` | 307 | 2026-05-25 | 2026-06-06 |
| `AgentBriefIssued` | 302 | 2026-05-10 | 2026-06-06 |
| `AgentRunStarted` | 299 | 2026-05-10 | 2026-06-06 |
| `SubstrateStateSnapshot` | 261 | 2026-05-07 | 2026-06-06 |
| `AuditFindingClosed` | 227 | 2026-06-02 | 2026-06-02 |
| `AuditFinding` | 222 | 2026-05-07 | 2026-05-30 |
| `SubLedgerPostingEmitted` | 185 | 2026-06-01 | 2026-06-06 |
| `M1CitationTrancheRegistered` | 176 | 2026-05-09 | 2026-05-09 |
| `ProductDimensionAttested` | 170 | 2026-05-26 | 2026-05-28 |
| `SubstrateAgentRunFailed` | 165 | 2026-05-26 | 2026-06-06 |
| `DecisionRequested` | 132 | 2026-05-10 | 2026-05-10 |
| `CdmBindingsRegenerated` | 114 | 2026-05-09 | 2026-06-01 |
| `DailyPnLReportGenerated` | 114 | 2026-06-01 | 2026-06-06 |
| `LiquidityLimitBreached` | 88 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 88 | 2026-05-22 | 2026-05-24 |
| `Feedback` | 88 | 2026-05-10 | 2026-05-10 |
| `AgentEscalation` | 77 | 2026-05-07 | 2026-06-02 |
| `DocumentRegistered` | 71 | 2026-05-11 | 2026-05-25 |
| `PartyRegistered` | 65 | 2026-05-23 | 2026-06-01 |
| `AgentRegistered` | 60 | 2026-05-26 | 2026-06-01 |
| `DataProjectionSnapshot` | 55 | 2026-05-07 | 2026-06-06 |
| `InboxHygieneSweep` | 55 | 2026-05-07 | 2026-06-06 |
| `ConflictOfInterestDisclosed` | 54 | 2026-05-17 | 2026-05-17 |
| `IRRBBChecked` | 50 | 2026-06-02 | 2026-06-06 |
| `BriefSuperseded` | 48 | 2026-05-10 | 2026-05-31 |
| `ClientCandidateRegistered` | 48 | 2026-06-01 | 2026-06-01 |
| `PaNotificationSubmitted` | 44 | 2026-05-11 | 2026-05-11 |
| `ObligationsRegisterSnapshot` | 42 | 2026-05-07 | 2026-06-03 |
| `SecuritySubstrateSnapshot` | 42 | 2026-05-07 | 2026-06-04 |
| `FxSettlementInstructed` | 42 | 2026-06-01 | 2026-06-04 |
| `GovernanceCyclePrep` | 40 | 2026-05-07 | 2026-06-02 |
| `IntradayHQLAStressProjection` | 40 | 2026-06-02 | 2026-06-06 |
| `PartyRelationshipAsserted` | 36 | 2026-06-01 | 2026-06-01 |
| `PartyAttributeChanged` | 36 | 2026-06-01 | 2026-06-02 |
| `ValuationAdjustmentComputed` | 36 | 2026-06-01 | 2026-06-05 |
| `FxTradeExecuted` | 34 | 2026-06-01 | 2026-06-04 |
| `PrincipalPayment` | 30 | 2026-06-02 | 2026-06-06 |
| `ModelValidationApproved` | 26 | 2026-05-27 | 2026-05-29 |
| `KYCIdentityCollected` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCIdentityVerified` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCSanctionsPEPScreened` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCUBOResolved` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCRiskRated` | 26 | 2026-06-01 | 2026-06-01 |
| `KYCDecisionMade` | 26 | 2026-06-01 | 2026-06-01 |
| `ClientAccepted` | 26 | 2026-06-01 | 2026-06-01 |
| `LawfulProcessingRegistered` | 26 | 2026-06-01 | 2026-06-01 |
| `AccountingReadinessSnapshot` | 24 | 2026-05-26 | 2026-06-06 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `RiskAppetiteSnapshot` | 24 | 2026-05-27 | 2026-06-06 |
| `FxPositionRevalued` | 24 | 2026-06-02 | 2026-06-05 |
| `FtpCurvePublished` | 23 | 2026-05-26 | 2026-06-06 |
| `ModelSubmitted` | 23 | 2026-05-27 | 2026-05-29 |
| `ModelTierClassified` | 23 | 2026-05-27 | 2026-05-29 |
| `FxTradeCancelled` | 21 | 2026-06-01 | 2026-06-01 |
| `AgentEscalationDecided` | 17 | 2026-05-26 | 2026-06-03 |
| `ALMReadinessSnapshot` | 17 | 2026-05-29 | 2026-06-06 |
| `SettlementConfirmed` | 15 | 2026-06-02 | 2026-06-06 |
| `RegulatoryConceptExtracted` | 13 | 2026-05-25 | 2026-05-25 |
| `AgentPromptOptimizationApplied` | 13 | 2026-05-27 | 2026-05-27 |
| `FinancialInstrumentDefined` | 13 | 2026-06-02 | 2026-06-02 |
| `ObligationCandidateProposed` | 11 | 2026-05-25 | 2026-05-25 |
| `InboundMessageReceived` | 11 | 2026-06-01 | 2026-06-02 |
| `MessageCorrelated` | 10 | 2026-06-01 | 2026-06-02 |
| `LiquiditySnapshot` | 10 | 2026-06-02 | 2026-06-06 |
| `PaymentsReadinessSnapshot` | 9 | 2026-05-29 | 2026-06-06 |
| `FinancialInstrumentClassified` | 9 | 2026-06-02 | 2026-06-02 |
| `SlaRulePublished` | 9 | 2026-06-06 | 2026-06-06 |
| `SlaRuleApproved` | 9 | 2026-06-06 | 2026-06-06 |
| `ProductProposalRegistered` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductConceptualised` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductDueDiligenceCompleted` | 8 | 2026-05-26 | 2026-05-28 |
| `ProductApproved` | 8 | 2026-05-26 | 2026-05-28 |
| `LCRComputed` | 8 | 2026-06-02 | 2026-06-05 |
| `NSFRComputed` | 8 | 2026-06-02 | 2026-06-05 |
| `RiskRunCompleted` | 8 | 2026-06-02 | 2026-06-06 |
| `WorkstreamCompleted` | 7 | 2026-05-28 | 2026-05-28 |
| `MtmRunCompleted` | 7 | 2026-06-01 | 2026-06-05 |
| `PnLAttributionGenerated` | 7 | 2026-06-01 | 2026-06-05 |
| `RiskResolved` | 7 | 2026-06-02 | 2026-06-02 |
| `RealisedPnlRecognised` | 7 | 2026-06-03 | 2026-06-05 |
| `PrudentValuationAvaAggregated` | 6 | 2026-06-01 | 2026-06-05 |
| `DecisionComment` | 6 | 2026-06-05 | 2026-06-06 |
| `AgentDecision` | 5 | 2026-05-28 | 2026-06-05 |
| `PnLSignedOff` | 5 | 2026-06-01 | 2026-06-05 |
| `ALMRunCompleted` | 5 | 2026-06-02 | 2026-06-06 |
| `CollateralInventorySnapshotted` | 5 | 2026-06-02 | 2026-06-06 |
| `AgentOpsReadinessSnapshot` | 4 | 2026-05-26 | 2026-06-05 |
| `ThreatModelDimensionRegistered` | 4 | 2026-05-08 | 2026-05-08 |
| `ValidationMethodologyPublished` | 4 | 2026-05-27 | 2026-05-27 |
| `IrsPositionRevalued` | 4 | 2026-06-02 | 2026-06-05 |
| `PnLFlashRecorded` | 4 | 2026-06-03 | 2026-06-05 |
| `PnLFlashActualReconciled` | 4 | 2026-06-03 | 2026-06-05 |
| `MLROAttestation` | 3 | 2026-05-26 | 2026-06-01 |
| `MarketsProjectionRegistered` | 3 | 2026-05-09 | 2026-05-09 |
| `ModelRegistered` | 3 | 2026-05-27 | 2026-05-27 |
| `RoleResearchQueueSnapshot` | 2 | 2026-05-29 | 2026-06-05 |
| `LegalReadinessSnapshot` | 2 | 2026-05-29 | 2026-06-05 |
| `OperationalResilienceSnapshot` | 2 | 2026-05-29 | 2026-06-01 |
| `CyberResilienceSnapshot` | 2 | 2026-05-29 | 2026-06-04 |
| `POPIAControlsSnapshot` | 2 | 2026-05-29 | 2026-06-03 |
| `AuditCommitteePackPrepped` | 2 | 2026-05-29 | 2026-06-02 |
| `TaxReadinessSnapshot` | 2 | 2026-05-29 | 2026-06-04 |
| `MarketsReadinessSnapshot` | 2 | 2026-05-29 | 2026-06-01 |
| `DepositTaken` | 2 | 2026-06-01 | 2026-06-02 |
| `InterbankLoanPlaced` | 2 | 2026-06-01 | 2026-06-01 |
| `BondTradeExecuted` | 2 | 2026-06-01 | 2026-06-02 |
| `OutboundMessageDispatched` | 2 | 2026-06-01 | 2026-06-02 |
| `MarketRiskMeasureComputed` | 2 | 2026-06-03 | 2026-06-03 |
| `RegulatoryInstrumentRegistered` | 1 | 2026-05-25 | 2026-05-25 |
| `RegulatoryInstrumentContextualised` | 1 | 2026-05-25 | 2026-05-25 |
| `SecurityGateRegistered` | 1 | 2026-05-08 | 2026-05-08 |
| `RasLimitSchedulePublished` | 1 | 2026-05-14 | 2026-05-14 |
| `ValidationFindingRaised` | 1 | 2026-05-27 | 2026-05-27 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `PartyClassified` | 1 | 2026-06-01 | 2026-06-01 |
| `RepoTradeOpened` | 1 | 2026-06-01 | 2026-06-01 |
| `FundingLineDrawn` | 1 | 2026-06-01 | 2026-06-01 |
| `BalanceSheetProjected` | 1 | 2026-05-27 | 2026-05-27 |
| `SeedDescoped` | 1 | 2026-06-01 | 2026-06-01 |
| `CapitalEvent` | 1 | 2026-06-01 | 2026-06-01 |
| `LCRRatioProjection` | 1 | 2026-06-02 | 2026-06-02 |
| `AccountingPeriodOpened` | 1 | 2026-06-02 | 2026-06-02 |
| `IrsTradeBooked` | 1 | 2026-06-02 | 2026-06-02 |
| `FundingDrawnDown` | 1 | 2026-06-02 | 2026-06-02 |
| `SettlementInstructionIssued` | 1 | 2026-06-02 | 2026-06-02 |
| `BankModePolicySet` | 1 | 2026-06-03 | 2026-06-03 |
| `ObligationLifecycleTransitioned` | 1 | 2026-06-04 | 2026-06-04 |

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

_Narrative generation failed (auth failed (check ANTHROPIC_API_KEY): 401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011CbnXD4vt4VfCEqF9Nb8Fy"})._

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
