---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-21T07:00:53.634Z
decision-required: false
---

# Atlas — substrate state, 2026-05-21

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 3899 events across 38 types; 31/31 personas have operating specs; 120 runtime handlers registered; 396 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `.local/event.db` · Total events: 3899

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `SubstrateAgentRunStarted` | 650 | 2026-05-20 | 2026-05-21 |
| `BusDispatched` | 649 | 2026-05-20 | 2026-05-21 |
| `SubstrateAgentRunCompleted` | 589 | 2026-05-20 | 2026-05-21 |
| `ScheduledTrigger` | 378 | 2026-05-20 | 2026-05-21 |
| `SubstrateAlert` | 342 | 2026-05-20 | 2026-05-21 |
| `AgentGoalEvaluated` | 285 | 2026-05-20 | 2026-05-21 |
| `AgentGoalDeferred` | 274 | 2026-05-20 | 2026-05-21 |
| `ReconResult` | 135 | 2026-05-20 | 2026-05-21 |
| `LegacyFanoutShadowed` | 85 | 2026-05-20 | 2026-05-21 |
| `IRRBBChecked` | 80 | 2026-05-20 | 2026-05-21 |
| `IntradayHQLAStressProjection` | 64 | 2026-05-20 | 2026-05-21 |
| `RecordFiled` | 64 | 2026-05-20 | 2026-05-21 |
| `SubstrateAgentRunFailed` | 60 | 2026-05-20 | 2026-05-21 |
| `AgentPerformanceEvaluated` | 56 | 2026-05-20 | 2026-05-21 |
| `AgentFeedbackIssued` | 56 | 2026-05-20 | 2026-05-21 |
| `LCRComputed` | 12 | 2026-05-20 | 2026-05-21 |
| `NSFRComputed` | 12 | 2026-05-20 | 2026-05-21 |
| `AgentGoalSelected` | 11 | 2026-05-20 | 2026-05-21 |
| `AuditFinding` | 10 | 2026-05-20 | 2026-05-21 |
| `AccountingReadinessSnapshot` | 10 | 2026-05-20 | 2026-05-21 |
| `DashboardProjectionRefreshed` | 9 | 2026-05-20 | 2026-05-20 |
| `CollateralInventorySnapshot` | 9 | 2026-05-20 | 2026-05-21 |
| `WorkstreamRegistered` | 8 | 2026-05-20 | 2026-05-20 |
| `DataProjectionSnapshot` | 8 | 2026-05-20 | 2026-05-21 |
| `InboxHygieneSweep` | 8 | 2026-05-20 | 2026-05-21 |
| `FtpCurvePublished` | 8 | 2026-05-20 | 2026-05-21 |
| `ALMRunCompleted` | 8 | 2026-05-20 | 2026-05-21 |
| `RiskRaised` | 7 | 2026-05-20 | 2026-05-20 |
| `AgentEscalation` | 2 | 2026-05-20 | 2026-05-20 |
| `ObligationsRegisterSnapshot` | 2 | 2026-05-20 | 2026-05-20 |
| `SubstrateStateSnapshot` | 1 | 2026-05-20 | 2026-05-20 |
| `AgentDecision` | 1 | 2026-05-20 | 2026-05-20 |
| `AccountingPeriodOpened` | 1 | 2026-05-20 | 2026-05-20 |
| `GovernanceCyclePrep` | 1 | 2026-05-20 | 2026-05-20 |
| `SecuritySubstrateSnapshot` | 1 | 2026-05-20 | 2026-05-20 |
| `MLROAttestation` | 1 | 2026-05-20 | 2026-05-20 |
| `CdmBindingsRegenerated` | 1 | 2026-05-20 | 2026-05-20 |
| `AgentOpsReadinessSnapshot` | 1 | 2026-05-20 | 2026-05-20 |

## Personas — operating-spec coverage

31 of 31 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

120 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

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

The substrate is materially complete for the bank's current non-sensitive-event operating envelope: 38 event types across 3,899 events in `.local/event.db`, 120 runtime handlers registered against 31/31 spec'd personas, and the event-driven trigger kind now first-class alongside scheduled and on-request in `runtime/run.ts`. The cloud-shared event store via Neon is live under Senna's `TM-NEON-EVENT-STORE-001` exception, projection-cache persistence is closed end-to-end through `anya:projection-refresh`, and Claude-API narrative output is rolled out across all seven narrative-emitting handlers. The two visible drags are operational rather than structural: 60 `SubstrateAgentRunFailed` against 650 starts (~9% failure rate) and an Owner Inbox at 396 deliverables, which Scrooge's hygiene sweep is not yet draining faster than it fills.

The consequential movement this week is that the four typed payload schemas defined in `platform/event-store/event-types.ts` have begun firing for real, not just existing as types. `RiskRaised` is at 7 events — Atlas now emits one per tracked substrate gap on the weekly run, which both exercises the schema and gives Helena's risk-appetite-watch something canonical to read. `AgentEscalation` is at 2 events and `WorkstreamRegistered` at 8, which means the two previously load-bearing gaps — Vera's audit pipelines #14/#15 gated on `AgentEscalation`, and the dashboard's curated-seed retirement gated on `WorkstreamRegistered` — both now have substrate flowing through them rather than waiting on it. `AgentDecision` remains at 1; handlers with a real decision path have not yet adopted it.

The load-bearing gap that remains is A2.1 — the substrate scheduler emitting typed `ScheduledTrigger` events from a Bun process. The 378 `ScheduledTrigger` events in store come via the off-the-hour cron shims pinned after the 2026-05-07/08 GH Actions drops; until A2.1 lands, every scheduled handler is one silent cron miss away from a gap in the audit timeline, and Vera cannot assert schedule-completeness from the event store alone. Secondary but pending: Neon hardening §5.1 (role downgrade to SELECT+INSERT) and §5.2 (IP allowlist) are required before any sensitive-data event flows, and must close before M8 cloud lift carries customer-bearing payloads. Next: build A2.1 and stand up failure-mode triage on the 9% `SubstrateAgentRunFailed` rate before adding new event types.

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
