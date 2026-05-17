---
agent: Atlas
trigger: substrate-state
asOf: 2026-05-11T05:51:46.363Z
decision-required: false
---

# Atlas — substrate state, 2026-05-11

Autonomous run of Atlas's weekly substrate-state snapshot per `Team/Atlas.md` operating spec § 6 (Cadence) and § 11 (Outputs). Run by the agent runtime; no human-in-the-loop.

**Headline:** 329 events across 12 types; 29/29 personas have operating specs; 37 runtime handlers registered; 269 files in /Owner Inbox/; 7 substrate gaps tracked.

## Event store

Path: `.local/event.db` · Total events: 329

| Event type | Count | Earliest | Latest |
|---|---|---|---|
| `ScheduledTrigger` | 80 | 2026-05-11 | 2026-05-11 |
| `ReconResult` | 49 | 2026-05-11 | 2026-05-11 |
| `CeoDecision` | 48 | 2026-05-07 | 2026-05-11 |
| `AgentRegistered` | 27 | 2026-05-11 | 2026-05-11 |
| `IdentityKeyRotated` | 27 | 2026-05-11 | 2026-05-11 |
| `PermissionPolicyPublished` | 27 | 2026-05-11 | 2026-05-11 |
| `AuditFinding` | 27 | 2026-05-11 | 2026-05-11 |
| `SubstrateAlert` | 18 | 2026-05-11 | 2026-05-11 |
| `SubstrateAgentRunStarted` | 9 | 2026-05-11 | 2026-05-11 |
| `SubstrateAgentRunCompleted` | 8 | 2026-05-11 | 2026-05-11 |
| `BusDispatched` | 8 | 2026-05-11 | 2026-05-11 |
| `RasLineCalibrated` | 1 | 2026-05-10 | 2026-05-10 |

## Personas — operating-spec coverage

29 of 29 persona files declare an operating-spec section (Triggers / Cadence / Decisions in scope / etc.).

## Runtime handlers

37 agent run handlers registered in `runtime/run.ts`. Each can be invoked locally via `bun run agent:<slug>` and on cron via `.github/workflows/agent-runtime-*.yml`.

| Agent | Trigger |
|---|---|
| Vera | `overnight-recon` |
| Vera | `codebase-quality-review` |
| Atlas | `substrate-state` |
| Helena | `risk-appetite-watch` |
| Devon | `operational-resilience-snapshot` |
| Camille | `financial-position-snapshot` |
| Anya | `projection-drift` |
| Anya | `projection-refresh` |
| Scrooge | `inbox-hygiene` |
| Scrooge | `ceo-decision-record` |
| Scrooge | `follow-on-router` |
| Owen | `governance-cycle-prep` |
| Rohan | `risk-run` |
| Mira | `obligations-snapshot` |
| Mira | `citation-gate` |
| Senna | `security-substrate-state` |
| Zara | `mlro-supervision` |
| Thandiwe | `audit-committee-prep` |
| Rashida | `cyber-resilience-snapshot` |
| Iris | `popia-controls-snapshot` |
| Eitan | `liquidity-snapshot` |
| Saskia | `markets-readiness-snapshot` |
| Kai | `m1-cdm-typescript-bindings` |
| Kai | `pre-trade-gateway-aggregator` |
| Bea | `accounting-readiness` |
| Yael | `tax-readiness` |
| Tomas | `payments-readiness` |
| Imani | `legal-readiness` |
| Ravi | `alm-readiness` |
| Sade | `agentops-readiness` |
| PAX | `role-research-queue` |
| Rohan | `backtest-harness` |
| Anya | `m1-projection-runtime-mapping` |
| Bea | `m1-ifrs-classification-rules` |
| Mira | `m1-regulator-citation-urns` |
| Senna | `m1-trading-stack-threat-model` |
| Scrooge | `owner-inbox-archiver` |

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

_Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Substrate snapshot above stands on its own._

## Provenance

Event-store snapshot via `@platform/composition`'s `eventStore.replay()`. Persona coverage by reading `/Team/*.md`. Runtime handlers from `runtime/run.ts`'s static registry. Substrate-gap list curated; V2 will read from a substrate-gap register once one exists (per Vera spec § 16, planned recon pipeline #13).
