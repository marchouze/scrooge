---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-25T06:19:50.022Z
decision-required: false
---

# Atlas — substrate state, 2026-05-25

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 408126 events across 52 types; 31/31 personas have operating specs; 123 runtime handlers registered; 440 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `.local/event.db` · Total events: 408126

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `SubstrateAlert` | 398880 | 2026-05-17 | 2026-05-25 |
| `SubstrateAgentRunStarted` | 1649 | 2026-05-20 | 2026-05-25 |
| `BusDispatched` | 1647 | 2026-05-20 | 2026-05-25 |
| `SubstrateAgentRunCompleted` | 1559 | 2026-05-20 | 2026-05-25 |
| `RecordFiled` | 801 | 2026-05-05 | 2026-05-25 |
| `ScheduledTrigger` | 742 | 2026-05-20 | 2026-05-25 |
| `AgentGoalEvaluated` | 429 | 2026-05-20 | 2026-05-25 |
| `AgentGoalDeferred` | 386 | 2026-05-20 | 2026-05-25 |
| `ReconResult` | 360 | 2026-05-20 | 2026-05-25 |
| `Decision` | 276 | 2026-05-01 | 2026-05-23 |
| `LegacyFanoutShadowed` | 269 | 2026-05-20 | 2026-05-25 |
| `AgentPerformanceEvaluated` | 171 | 2026-05-20 | 2026-05-25 |
| `AgentFeedbackIssued` | 171 | 2026-05-20 | 2026-05-25 |
| `IRRBBChecked` | 120 | 2026-05-20 | 2026-05-25 |
| `IntradayHQLAStressProjection` | 96 | 2026-05-20 | 2026-05-25 |
| `SubstrateAgentRunFailed` | 88 | 2026-05-20 | 2026-05-25 |
| `DashboardProjectionRefreshed` | 45 | 2026-05-20 | 2026-05-24 |
| `AgentGoalSelected` | 43 | 2026-05-20 | 2026-05-25 |
| `WorkstreamRegistered` | 40 | 2026-05-20 | 2026-05-24 |
| `RiskRaised` | 35 | 2026-05-20 | 2026-05-24 |
| `PartyRegistered` | 35 | 2026-05-22 | 2026-05-24 |
| `PartyRelationshipAsserted` | 34 | 2026-05-24 | 2026-05-24 |
| `AgentRegistered` | 30 | 2026-05-22 | 2026-05-22 |
| `PermissionPolicyPublished` | 29 | 2026-05-22 | 2026-05-22 |
| `AccountingReadinessSnapshot` | 18 | 2026-05-20 | 2026-05-25 |
| `AuditFinding` | 17 | 2026-05-20 | 2026-05-23 |
| `LCRComputed` | 16 | 2026-05-20 | 2026-05-25 |
| `NSFRComputed` | 16 | 2026-05-20 | 2026-05-25 |
| `CollateralInventorySnapshot` | 12 | 2026-05-20 | 2026-05-24 |
| `DataProjectionSnapshot` | 12 | 2026-05-20 | 2026-05-25 |
| `InboxHygieneSweep` | 12 | 2026-05-20 | 2026-05-25 |
| `FtpCurvePublished` | 12 | 2026-05-20 | 2026-05-25 |
| `ALMRunCompleted` | 12 | 2026-05-20 | 2026-05-25 |
| `DailyPnLReportGenerated` | 12 | 2026-05-24 | 2026-05-24 |
| `AgentEscalation` | 10 | 2026-05-20 | 2026-05-24 |
| `MtmRunCompleted` | 7 | 2026-05-21 | 2026-05-22 |
| `SubstrateStateSnapshot` | 5 | 2026-05-20 | 2026-05-24 |
| `AgentBriefIssued` | 5 | 2026-05-18 | 2026-05-18 |
| `AgentDecision` | 4 | 2026-05-20 | 2026-05-23 |
| `SubLedgerPostingEmitted` | 4 | 2026-05-23 | 2026-05-23 |
| `ObligationsRegisterSnapshot` | 2 | 2026-05-20 | 2026-05-20 |
| `SecuritySubstrateSnapshot` | 2 | 2026-05-20 | 2026-05-21 |
| `MLROAttestation` | 2 | 2026-05-20 | 2026-05-25 |
| `AgentOpsReadinessSnapshot` | 2 | 2026-05-20 | 2026-05-22 |
| `InterbankLoanPlaced` | 2 | 2026-05-23 | 2026-05-23 |
| `AccountingPeriodOpened` | 1 | 2026-05-20 | 2026-05-20 |
| `GovernanceCyclePrep` | 1 | 2026-05-20 | 2026-05-20 |
| `CdmBindingsRegenerated` | 1 | 2026-05-20 | 2026-05-20 |
| `PolicyVersionActivated` | 1 | 2026-05-19 | 2026-05-19 |
| `IdentityKeyRotated` | 1 | 2026-05-22 | 2026-05-22 |
| `RepoTradeOpened` | 1 | 2026-05-23 | 2026-05-23 |
| `DepositTaken` | 1 | 2026-05-23 | 2026-05-23 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

123 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

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

Substrate is materially complete and load-bearing: 408,126 events across 52 types, 31/31 personas with operating specs, 123 runtime handlers registered, event store cloud-shared via Neon under Senna's approved exception, and Claude narrative generation rolled out to all seven narrating handlers. What is closing is the typed-payload work — `RiskRaised`, `AgentEscalation`, `AgentDecision`, `WorkstreamRegistered` are now defined with Zod schemas and typed factories in `platform/event-store/event-types.ts`. What is blocking is adoption: those schemas exist, but only Atlas is emitting `RiskRaised` (35 events, one per gap on the weekly pass). The other three are substrate-without-traffic.

The consequential change this cycle is that Atlas's weekly run now exercises the typed `RiskRaised` schema end-to-end, which proves the make-factory + Zod path works under live conditions. Beyond that: `AgentEscalation` has 10 events in the store and `WorkstreamRegistered` has 40 — both are real, both are sparse. The dominant signal in the snapshot is `SubstrateAlert` at 398,880 events (97.7% of total), which is not healthy distribution and almost certainly indicates an over-eager emitter or absent dedup; it warrants a triage pass before it distorts downstream projection costs.

Load-bearing gaps, ranked: (1) `AgentEscalation` adoption — Vera's audit pipelines #14/#15 have substrate to consume but no traffic to consume from; until handlers actually emit on their escalation paths, those pipelines are dark. (2) `WorkstreamRegistered` adoption — 40 events exist, which is enough for the dashboard's curated-seed retirement to proceed, but the type needs to become the default surface for new workstreams, not an occasional one. (3) `SubstrateAlert` volume — at this ratio it is effectively a log stream, not an event type, and it will eventually pressure the projection runtime. (4) GH Actions cron remains interim substrate; A2.1 (Bun-process scheduler emitting typed `ScheduledTrigger` events — already 742 in store, so the type is live) is the permanent fix and the cron shims should retire behind it.

Next: triage the `SubstrateAlert` emitter and land A2.1 so `ScheduledTrigger` becomes the canonical schedule surface rather than a shadow of cron.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
