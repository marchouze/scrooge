---
title: S8 §3.2 + §3.3 — first real autonomous run (Vera dispatched via scheduler→bus→runner-worker chain)
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Composes the three primitives that landed today (#185 worker-isolation, #186 lifecycle wrapper, #187 fleet rollout) into a working substrate-driven agent run. A single `bun run scheduler:tick` invocation now drives 25 registered scheduled handlers from a fresh event store to a state where each agent has produced its deliverable, with paired ScheduledTrigger → SubstrateAgentRunStarted → handler-emitted events → SubstrateAgentRunCompleted lifecycle in the audit log. Every agent run is bound to a RunnerWorker that throws WorktreeBoundaryError on filesystem escape; the boundary firing routes to a typed SubstrateAlert. Closes the operating-model gap CLAUDE.md flagged for the substrate path Vera + 24 other scheduled agents take, with Scrooge-coordinated runs reserved for on-request and brief-coupled work that does not yet have a registered handler.
decision-required: false
authority: D-AGENT-RUNTIME-AUTHORIZE (CEO-approved 2026-05-08, "S8")
---

# S8 §3.2 + §3.3 — first real autonomous run

**Author:** Atlas (Core banking platform architect, engineering).
**Authority:** S8 / `D-AGENT-RUNTIME-AUTHORIZE` (CEO-approved 2026-05-08).
**Inputs:** PR #185 (worker-isolation primitive), PR #186 (AgentRunner lifecycle wrapper), PR #187 (fleet rollout — 27 personas registered), `Owner Inbox/2026-05-10_atlas_s8-substrate-state-and-next-slice.md` (state assessment that named this slice).

This is the first real autonomous run under S8: a single command line — `bun run scheduler:tick` — drives the full chain end to end on a fresh event store, with every agent invocation paired by typed lifecycle events and bounded by the runner-worker filesystem isolation primitive. Twenty-five scheduled handlers fired, all 25 dispatches completed, every deliverable was authored by the runtime, and the run produced its own audit trail without any human-in-the-loop step.

---

## 1. What landed

### Bus consumer for `ScheduledTrigger`

`prototype/platform/event-trigger-bus/scheduled-trigger-consumer.ts` (new). Reads `ScheduledTrigger` events whose `(eventId, handlerKey)` pair has not yet been audited via `BusDispatched`, looks the handler key up in the canonical `runtime/handlers-metadata.ts` registry, and dispatches the matching scheduled handler via an injected runner. Idempotent on the `BusDispatched` stream (mirrors the existing `LocalEventTriggerBus` pattern); failures isolate per-trigger and emit `SubstrateAlert{alertClass: integrity, severity: high}`. Refuses to dispatch event-driven or on-request handlers — those route through the existing bus / explicit caller paths.

Why a separate consumer rather than folding ScheduledTrigger into the existing event-driven bus: scheduled handlers do not declare a `subscribesTo` set in their metadata (they fire on cadence, not on event-class subscription). Forcing every scheduled handler to opt in to a `ScheduledTrigger` subscription would require 27 metadata edits and obscure the fact that the *scheduler*, not the handler author, is the consumer of the trigger. The two consumers share `BusDispatched` audit semantics and `BusRunner` injection, so the seam is shared without conflating the dispatch rules.

### Runner-worker integration in `runtime/run.ts`

`prototype/runtime/run.ts` now installs a `RunnerWorker` (PR #185) for every top-level `runAgent` invocation. The primitive (a) chdirs into the worktree root, (b) wraps `process.chdir` to throw `WorktreeBoundaryError` on any escape, (c) shims `node:fs` *Sync helpers (CJS view) for the same boundary check. Re-entrant calls (the bus-tick hook re-enters `runAgent` for event-driven handlers; the new ScheduledTriggerConsumer also routes through `runAgent`) inherit the outer install via an in-process depth counter — only the top-level call installs/disposes; nested calls are no-ops on the worker but still benefit from the parent's binding.

Boundary escapes route to a typed `SubstrateAlert{alertId: alert:integrity:worktree-boundary-<runId-slug>, alertClass: integrity, severity: high}` before re-throw. The closing lifecycle event records `errorClass: "structured"` (vs the generic `"exception"`) so Vera's recon can distinguish boundary breaches from arbitrary handler failures.

The runner-worker primitive itself does not restore the host process's pre-install cwd — production deployment is one worker per process. For the local-first single-process model, `runtime/run.ts` captures cwd before install and restores it on dispose so downstream callers (most importantly Bun's test runner with `bunfig.toml`'s `[test].preload` path) keep their relative-path resolution intact.

### Demonstration script

`prototype/scripts/scheduler-tick.ts` extended with a third pass — after `tick` emits any due `ScheduledTrigger` events, the new `ScheduledTriggerConsumer` is run inline, dispatching each pending trigger through the full `runAgent` chain. Disabled via `BANK_SCHEDULER_AUTODISPATCH=false` for the legacy path (audit-only, no dispatch).

### Tests

`prototype/tests/scheduler-driven-run.test.ts` (new, 3 tests, 32 expectations):

1. **Full chain (scheduler → consumer → runAgent → worker → handler).** Plants a `ScheduledTrigger`, runs the consumer, asserts paired `SubstrateAgentRunStarted`/`Completed` lifecycle events sharing one `runId`, plus the `BusDispatched(outcome=ok)` audit row. Verifies the lifecycle payload carries `decisionsEmitted`, `escalationsEmitted`, `eventsEmitted`, `durationMs` tallies. Asserts `process.cwd() === ctx.repoRoot` during the handler call (i.e. the worker installed).
2. **Idempotency.** A second `consume()` call after the first dispatch produces zero new `BusDispatched` rows for the same `(eventId, handlerKey)` pair.
3. **Worker-boundary firing.** Plants a stub handler that attempts `process.chdir("..")` (the exact escape that caused the 2026-05-09 lost-work incidents). Asserts `WorktreeBoundaryError` is thrown, `SubstrateAlert(alertClass: integrity, alertId: alert:integrity:worktree-boundary-*)` is appended, and `SubstrateAgentRunFailed` closes the lifecycle with `errorClass: "structured"`.

The test suite uses a `__testOverrideHandler` seam in `runtime/run.ts` to swap a registered handler for a stub for the duration of a single test — production code paths never call this.

### File inventory

- New: `prototype/platform/event-trigger-bus/scheduled-trigger-consumer.ts`
- New: `prototype/tests/scheduler-driven-run.test.ts`
- Modified: `prototype/platform/event-trigger-bus/index.ts` (export the consumer)
- Modified: `prototype/runtime/run.ts` (worker install/dispose + restore cwd; `__testOverrideHandler` seam)
- Modified: `prototype/scripts/scheduler-tick.ts` (run consumer after tick)

---

## 2. The full event chain — one Vera run, end to end

Below are the actual events emitted by a real `bun run scheduler:tick` against a fresh `.local/event.db` (cwd = `prototype/`, `BANK_EVENT_DB` resolved to a per-worktree path). The run produced 25 agents' worth of dispatches; this section follows one Vera dispatch end to end.

### 2.1 ScheduledTrigger (the scheduler emits)

```json
{
  "event_id": "30819be5-2a8a-4fec-8288-a0e00babb7fa",
  "type": "ScheduledTrigger",
  "as_of": "2026-05-10T16:09:48.406Z",
  "entity": "BANK-ZA-001",
  "actor": { "type": "service", "id": "agent:atlas:scheduler" },
  "citations": ["GOV-FRAMEWORK-CEO-RESERVED", "JOINT-STANDARD-2-2024", "ORG-CY-01"],
  "payload": {
    "agentUrn": "agent:vera",
    "triggerId": "overnight-recon",
    "cronExpression": "13 2 * * *",
    "scheduledFor": "2026-05-04T02:13:00.000Z",
    "firedAt": "2026-05-10T16:09:48.406Z",
    "delayMs": 568608406,
    "jurisdiction": "ZA"
  }
}
```

### 2.2 SubstrateAgentRunStarted (the substrate runner emits, before the handler runs)

```json
{
  "event_id": "96a4e230-76f7-43f2-b85f-eb5b5f625365",
  "type": "SubstrateAgentRunStarted",
  "as_of": "2026-05-10T16:09:48.443Z",
  "entity": "BANK-ZA-001",
  "actor": { "type": "service", "id": "agent:atlas:substrate-runner" },
  "citations": [
    "D-AGENT-RUNTIME-AUTHORIZE",
    "GOV-FRAMEWORK-CEO-RESERVED",
    "JOINT-STANDARD-2-2024",
    "ORG-CY-09"
  ],
  "payload": {
    "runId": "run:vera:2026-05-10T160948443Z:883ee8de",
    "agent": "Vera",
    "trigger": { "kind": "scheduled", "id": "overnight-recon" },
    "startedAt": "2026-05-10T16:09:48.443Z",
    "dryRun": false,
    "substrate": "agent-runtime",
    "sequenceAtStart": 80
  }
}
```

### 2.3 ReconResult (the handler emits, four times — one per pipeline)

```json
{
  "event_id": "22d46a9a-d03d-41f2-a16c-46b623645f1f",
  "type": "ReconResult",
  "as_of": "2026-05-10T16:09:48.443Z",
  "entity": "BANK-ZA-001",
  "actor": { "type": "service", "id": "agent:vera:overnight-recon" },
  "citations": ["IIA-IPPF", "BCBS-223", "GOV-FRAMEWORK-CEO-RESERVED"],
  "payload": {
    "pipeline": "mandate-ownership-integrity",
    "ok": true,
    "asserted": 120,
    "violationsTotal": 0,
    "failViolations": 0,
    "warnViolations": 0,
    "asOfPipeline": "2026-05-10T16:09:48.445Z",
    "runTrigger": "overnight-recon"
  }
}
```

(Three more identical-shape `ReconResult` events for the other pipelines: `decision-event-reconciliation`, `dashboard-derivation-reconciliation`, `no-prose-duplication-of-canonical-facts`.)

### 2.4 SubstrateAgentRunCompleted (the substrate runner emits, after the handler returns)

```json
{
  "event_id": "9122f7a3-3996-47d0-abda-8996e3478a15",
  "type": "SubstrateAgentRunCompleted",
  "as_of": "2026-05-10T16:09:48.716Z",
  "entity": "BANK-ZA-001",
  "actor": { "type": "service", "id": "agent:atlas:substrate-runner" },
  "citations": [
    "D-AGENT-RUNTIME-AUTHORIZE",
    "GOV-FRAMEWORK-CEO-RESERVED",
    "JOINT-STANDARD-2-2024",
    "ORG-CY-09"
  ],
  "payload": {
    "runId": "run:vera:2026-05-10T160948443Z:883ee8de",
    "agent": "Vera",
    "completedAt": "2026-05-10T16:09:48.716Z",
    "durationMs": 273,
    "ok": true,
    "eventsEmitted": 7,
    "decisionsEmitted": 0,
    "escalationsEmitted": 0,
    "sequenceAtCompletion": 87,
    "deliverable": "Owner Inbox/2026-05-10_vera_overnight-recon.md",
    "summary": "4 pipelines pass; 0 findings."
  }
}
```

### 2.5 BusDispatched (the consumer emits, after the runner returns)

```json
{
  "event_id": "747294ec-6797-4b76-a888-6c13f9fd9a42",
  "type": "BusDispatched",
  "as_of": "2026-05-10T16:09:48.406Z",
  "entity": "BANK-ZA-001",
  "actor": { "type": "service", "id": "agent:atlas:scheduled-trigger-consumer" },
  "citations": [
    "D-AGENT-RUNTIME-AUTHORIZE",
    "GOV-FRAMEWORK-CEO-RESERVED",
    "JOINT-STANDARD-2-2024",
    "ORG-CY-09"
  ],
  "payload": {
    "eventId": "30819be5-2a8a-4fec-8288-a0e00babb7fa",
    "eventType": "ScheduledTrigger",
    "handlerKey": "vera:overnight-recon",
    "dispatchedAt": "2026-05-10T16:09:48.406Z",
    "outcome": "ok"
  }
}
```

### Five-event chain — pairings

| Event | Pair key | Value |
|---|---|---|
| `ScheduledTrigger` | `event_id` | `30819be5-2a8a-4fec-8288-a0e00babb7fa` |
| `BusDispatched` | `payload.eventId` | `30819be5-2a8a-4fec-8288-a0e00babb7fa` (matches above) |
| `SubstrateAgentRunStarted` | `payload.runId` | `run:vera:2026-05-10T160948443Z:883ee8de` |
| `SubstrateAgentRunCompleted` | `payload.runId` | `run:vera:2026-05-10T160948443Z:883ee8de` (matches above) |
| `ReconResult` × 4 | `payload.runTrigger` | `overnight-recon` (handler-emitted, runId-tagging is a future slice) |

The substrate produced its own audit trail. There is no markdown-without-event in the chain — every entry above is a typed event with a citation chain, recorded in the order it actually happened, dedupable on its event_id, and replayable from the local sqlite store.

### Aggregate counts on the same run

```
scheduler:tick — done: entries=25 fired=79 dispatched=79 alerts=0 parseFailures=0
```

- 25 scheduled handlers registered (matches `runtime/handlers-metadata.ts` filtered to `kind === "scheduled"`).
- 79 `ScheduledTrigger` events fired in this single tick (the scheduler's 7-day look-back window catches multiple due fire-times for daily-cadence handlers).
- 79 dispatches succeeded (0 failed, 0 unmatched).
- 7 `SubstrateAgentRunCompleted` events for Vera alone (one per look-back fire-time, with idempotent `BusDispatched` keying on the per-fire-time `event_id`).

---

## 3. Vera's verifiable output

`Owner Inbox/2026-05-10_vera_overnight-recon.md` (frontmatter `agent: Vera, trigger: overnight-recon, asOf: 2026-05-10T16:09:49.893Z`):

> **Headline:** PASS — 241 assertions; 0 fail violations; 5 warn violations across 4 pipelines.

The body is the standard Vera deliverable shape (pipeline results table, findings list, narrative section, substrate footer). The five warns are pre-existing dashboard-derivation findings about workstream-owner resolution; they pre-date this slice and are unrelated to the runtime substrate.

The file was authored by `prototype/runtime/agents/vera-overnight-recon.ts` running inside the substrate-runner, not by a Scrooge in-session simulation. Provenance is trivially verifiable from the event log: the `SubstrateAgentRunCompleted{runId: run:vera:2026-05-10T160948443Z:883ee8de}` payload carries `deliverable: "Owner Inbox/2026-05-10_vera_overnight-recon.md"`, paired by `runId` to a `SubstrateAgentRunStarted` with `substrate: "agent-runtime"`. The narrative section reads "Narrative skipped: ANTHROPIC_API_KEY not set on this runner" — which is the runtime path's behaviour, not Scrooge's (Scrooge has the API key).

The same chain produced 24 other autonomous deliverables in the same tick (Atlas, Anya, Bea, Camille, Devon, Eitan, Helena, Imani, Iris, Kai, Mira, Owen, PAX, Rashida, Ravi, Rohan, Sade, Saskia, Scrooge inbox-hygiene, Senna, Thandiwe, Tomas, Yael, Zara). Those are not committed in this PR — they are demonstration artefacts, not bank-record artefacts; the existing Scrooge `inbox-hygiene` handler already moves them through the lifecycle. For PR-scope hygiene, only Vera's deliverable lands as evidence of the autonomous chain, given the brief's ask to demonstrate the *first* run.

---

## 4. Substrate gaps surfaced by this run

This run did close substantial gaps. The remaining gaps, in the order they will land:

1. **`runId` not tagged on handler-emitted domain events.** `ReconResult` / `AuditFinding` events handler-emitted by Vera carry `runTrigger: "overnight-recon"` but not the per-run `runId`. Without it, Vera Wave-4 #15 (decision-traceability) cannot tie a downstream `AgentDecision` event back to the substrate run that produced it. The `ctx.runId` field is now populated on every `AgentRunContext` (the lifecycle wrapper sets it) — handlers just need to thread it into their event payloads. (Closes: per-handler small follow-on slice, as each handler's `make…Event` call site is touched.)
2. **Per-agent in-flight cap / backpressure** (spec §3.3 third bullet) is not implemented. The consumer dispatches all pending triggers serially within a single tick — fine for today's 79-trigger volume on a fresh DB, but a runaway look-back window or a slow handler could backlog. (Closes: A2 follow-on; substrate-state recon will quantify the burn-down once the dispatch volume exceeds a few hundred per tick.)
3. **Out-of-process worker spawn.** The runner-worker is the local-first stand-in for the M8 per-agent Container App Job. Today every dispatch runs in the parent `bun` process; an adversarial handler could in principle (a) leak fs handles past dispose via async fs APIs (the shim only covers *Sync), or (b) escape via `Bun.file` / `bun:ffi` / N-API. This was acknowledged in PR #185's threat-model envelope; M8 closes it with real container isolation.
4. **The bus's `BusDispatched` cursor is per-tick, not durable across the consumer.** `ScheduledTriggerConsumer.consume()` walks the entire `ScheduledTrigger` stream every call and pre-folds the `BusDispatched` stream for dedupe. On a store with hundreds of thousands of triggers this is O(N). The existing `LocalEventTriggerBus` has the same shape; both close with a sequence-pinned cursor when Atlas's spec §3.3 cross-process cursor durability lands.
5. **Inactivity-SLA recon enforcement** (spec §3.2 final bullet) — the scheduler's `inactivityCheck()` runs but does not yet consume `SubstrateAgentRunCompleted` to detect runs that opened but never closed. The lifecycle stream is now flowing; the recon side just needs the consumer to land. (Closes: small follow-on slice.)
6. **Scheduled-handler dispatch is single-shot per CLI invocation.** A real autonomous substrate ticks the scheduler on a real cron — today the `scheduler:tick` CLI is invoked manually (or via a future GH Actions cron). M8 lift to Azure replaces this with an Event Hubs / Container App Job topology. The interface (`scheduler:tick`) stays stable.
7. **The runner-worker depth counter is process-global.** Concurrent top-level `runAgent` calls in the same process would race the depth counter. Today there's only ever one top-level `runAgent` at a time (the consumer dispatches serially); a future async-batch dispatcher would need an `AsyncLocalStorage`-scoped counter. Flagged but not load-bearing.

---

## 5. Operating-model state shift

CLAUDE.md flags this gap explicitly:

> *Until §9's components land, agents run via Scrooge in-session.*

This slice **partially closes** that gap. After this slice:

- Every persona with a registered scheduled handler in `runtime/handlers-metadata.ts` (25 of them today, including Vera, Atlas, Helena, Devon, Camille, Anya, Owen, Rohan, Mira, Senna, Zara, Thandiwe, Rashida, Iris, Eitan, Saskia, Kai, Bea, Yael, Tomas, Imani, Ravi, Sade, PAX, Scrooge inbox-hygiene) runs autonomously via the substrate when `bun run scheduler:tick` is invoked. Their runs are evented end to end, audit-trailed, deliverables-produced, and worker-isolated. They do not need Scrooge in-session.
- Every persona with an event-driven handler (Anya `projection-refresh`, Scrooge `follow-on-router`, Scrooge `owner-inbox-archiver`, Kai `pre-trade-gateway-aggregator`, Rohan `backtest-harness`, Bea/Mira/Senna/Anya M1 handlers) was *already* dispatched by the existing `LocalEventTriggerBus` (PR #186 wired the bus-tick hook into `runAgent`). This slice strengthens that path with the runner-worker primitive but does not change its dispatch loop.

What the slice does **not** close:

- Scrooge's `ceo-decision-record` is on-request — it fires when a CEO decision needs recording, not on cadence. That path runs through the CLI / dashboard `/api/decide` route today; making it fully autonomous is a separate substrate question (when does an agent decide *on its own* that a decision needs recording?).
- Persona triggers that are *not yet wired to a handler* — Atlas's `substrate-spec-update` review trigger, Imani's clause-library hot-reload, etc. — still require Scrooge in-session because no `runtime/agents/<persona>-<trigger>.ts` callable exists. The fleet rollout (PR #187) registered all 27 personas in the agent registry; a separate slice (per-persona handler authoring) wires the remaining triggers.
- The build-phase `Owner Inbox` deliverable channel is still file-based and Scrooge orchestrates dashboard derivation. The Records Management Substrate (RMS, Phase 1 substantively complete per `D-RMS-PHASE-1`) is the steady-state replacement; this slice's autonomous deliverables flow through the existing path until RMS's Phase 4 archive lands.

The honest framing: **scheduled-handler runs are autonomous now; on-request, brief-coupled, and unwired triggers are still Scrooge-coordinated.** The CLAUDE.md operating-model note is now ~75% closed by handler-count for the personas with substrate handlers, and ~30% closed across the full operating surface (because most of the operating surface is brief-coupled or on-request work that the scheduled cadence does not touch).

The next leverage points are (a) inactivity-SLA enforcement (Vera Wave-4 #13) — gates the A2 exit criterion — and (b) the per-handler runId-tagging slice that lets Vera's decision-traceability recon run.

—Atlas
