---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-27T17:45:43.472Z
decision-required: false
---

# Atlas — substrate state, 2026-05-27

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 715418 events across 70 types; 31/31 personas have operating specs; 125 runtime handlers registered; 469 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `.local/event.db` · Total events: 715418

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `SubstrateAlert` | 699089 | 2026-05-09 | 2026-05-27 |
| `EntityReclassified` | 4159 | 2026-05-26 | 2026-05-26 |
| `SubstrateAgentRunStarted` | 2171 | 2026-05-20 | 2026-05-27 |
| `BusDispatched` | 2169 | 2026-05-20 | 2026-05-27 |
| `SubstrateAgentRunCompleted` | 2065 | 2026-05-20 | 2026-05-27 |
| `RecordFiled` | 916 | 2026-05-05 | 2026-05-27 |
| `ScheduledTrigger` | 856 | 2026-05-20 | 2026-05-27 |
| `ReconResult` | 540 | 2026-05-20 | 2026-05-27 |
| `AgentGoalEvaluated` | 511 | 2026-05-20 | 2026-05-28 |
| `Decision` | 471 | 2026-05-01 | 2026-05-25 |
| `AgentGoalDeferred` | 442 | 2026-05-20 | 2026-05-27 |
| `LegacyFanoutShadowed` | 377 | 2026-05-20 | 2026-05-27 |
| `AgentPerformanceEvaluated` | 229 | 2026-05-20 | 2026-05-27 |
| `AgentFeedbackIssued` | 229 | 2026-05-20 | 2026-05-27 |
| `IRRBBChecked` | 140 | 2026-05-20 | 2026-05-27 |
| `IntradayHQLAStressProjection` | 112 | 2026-05-20 | 2026-05-27 |
| `SubstrateAgentRunFailed` | 104 | 2026-05-20 | 2026-05-27 |
| `DashboardProjectionRefreshed` | 81 | 2026-05-20 | 2026-05-27 |
| `WorkstreamRegistered` | 72 | 2026-05-20 | 2026-05-27 |
| `AgentGoalSelected` | 69 | 2026-05-20 | 2026-05-28 |
| `RiskRaised` | 63 | 2026-05-20 | 2026-05-27 |
| `PartyRegistered` | 35 | 2026-05-22 | 2026-05-24 |
| `PartyRelationshipAsserted` | 35 | 2026-05-19 | 2026-05-24 |
| `AgentRegistered` | 30 | 2026-05-22 | 2026-05-22 |
| `PermissionPolicyPublished` | 29 | 2026-05-22 | 2026-05-22 |
| `ObligationRegistered` | 24 | 2026-05-09 | 2026-05-09 |
| `AccountingReadinessSnapshot` | 22 | 2026-05-20 | 2026-05-27 |
| `CreditLimitApplicationSubmitted` | 22 | 2024-01-01 | 2026-05-20 |
| `CreditAnalysisCompleted` | 22 | 2024-01-01 | 2026-05-20 |
| `ISDACSAAssessmentCompleted` | 22 | 2024-01-01 | 2026-05-20 |
| `CreditLimitProposed` | 22 | 2024-01-01 | 2026-05-20 |
| `CreditLimitApproved` | 22 | 2024-01-01 | 2026-05-20 |
| `CreditLimitLoaded` | 21 | 2024-01-01 | 2026-05-20 |
| `LCRComputed` | 20 | 2026-05-20 | 2026-05-27 |
| `NSFRComputed` | 20 | 2026-05-20 | 2026-05-27 |
| `AuditFinding` | 17 | 2026-05-20 | 2026-05-23 |
| `GatewayCheckRequested` | 16 | 2026-05-09 | 2026-05-09 |
| `CollateralInventorySnapshot` | 15 | 2026-05-20 | 2026-05-27 |
| `AgentEscalation` | 14 | 2026-05-20 | 2026-05-26 |
| `DataProjectionSnapshot` | 14 | 2026-05-20 | 2026-05-27 |
| `InboxHygieneSweep` | 14 | 2026-05-20 | 2026-05-27 |
| `FtpCurvePublished` | 14 | 2026-05-20 | 2026-05-27 |
| `ALMRunCompleted` | 14 | 2026-05-20 | 2026-05-27 |
| `DailyPnLReportGenerated` | 12 | 2026-05-24 | 2026-05-24 |
| `CcrReplacementCostComputed` | 11 | 2026-05-20 | 2026-05-20 |
| `SubstrateStateSnapshot` | 9 | 2026-05-20 | 2026-05-27 |
| `MtmRunCompleted` | 9 | 2026-05-21 | 2026-05-26 |
| `AgentBriefIssued` | 5 | 2026-05-18 | 2026-05-18 |
| `AgentDecision` | 4 | 2026-05-20 | 2026-05-23 |
| `SubLedgerPostingEmitted` | 4 | 2026-05-23 | 2026-05-23 |
| `ObligationsRegisterSnapshot` | 3 | 2026-05-20 | 2026-05-27 |
| `M1CitationTrancheRegistered` | 3 | 2026-05-09 | 2026-05-09 |
| `GovernanceCyclePrep` | 2 | 2026-05-20 | 2026-05-26 |
| `SecuritySubstrateSnapshot` | 2 | 2026-05-20 | 2026-05-21 |
| `MLROAttestation` | 2 | 2026-05-20 | 2026-05-25 |
| `CdmBindingsRegenerated` | 2 | 2026-05-20 | 2026-05-25 |
| `AgentOpsReadinessSnapshot` | 2 | 2026-05-20 | 2026-05-22 |
| `InterbankLoanPlaced` | 2 | 2026-05-23 | 2026-05-23 |
| `OrderProposed` | 2 | 2026-05-09 | 2026-05-09 |
| `CreditLimitBreached` | 2 | 2026-05-22 | 2026-05-22 |
| `CreditLimitBreachDisposed` | 2 | 2026-05-23 | 2026-05-23 |
| `LiquidityLimitBreached` | 2 | 2026-05-21 | 2026-05-23 |
| `LiquidityLimitBreachDisposed` | 2 | 2026-05-22 | 2026-05-24 |
| `AccountingPeriodOpened` | 1 | 2026-05-20 | 2026-05-20 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `IdentityKeyRotated` | 1 | 2026-05-22 | 2026-05-22 |
| `RepoTradeOpened` | 1 | 2026-05-23 | 2026-05-23 |
| `DepositTaken` | 1 | 2026-05-23 | 2026-05-23 |
| `CreditLimitAnnualReviewCompleted` | 1 | 2026-05-21 | 2026-05-21 |
| `LexUtilisationComputed` | 1 | 2026-05-20 | 2026-05-20 |

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

_Narrative generation failed (api error undefined: Connection error.)._

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
