---
title: S8 substrate state + highest-leverage next slice — substrate AgentRunner lifecycle
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Audit of the agent-runtime substrate (D-AGENT-RUNTIME-AUTHORIZE / S8) against the spec at `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`. A0 schemas are frozen and most A1–A2 components are merged. The highest-leverage missing slice is the **substrate AgentRunner lifecycle wrapper** — `runtime/run.ts` orchestrates handlers but does not emit `AgentRunStarted` / `AgentRunCompleted` / `AgentRunFailed` for non-brief runs, so Vera Wave-4 #13 inactivity-SLA recon, the oversight UI fleet-status view, and the substrate-gap inventory have nothing to read. This slice ships a typed `Substrate*` lifecycle event family + lifecycle wrapper inside `runAgent`, with tests.
decision-required: false
authority: D-AGENT-RUNTIME-AUTHORIZE (CEO-approved 2026-05-08, "S8")
---

# S8 substrate state + highest-leverage next slice

**Author:** Atlas (Core banking platform architect, engineering).
**Authority:** S8 / `D-AGENT-RUNTIME-AUTHORIZE` (CEO-approved 2026-05-08) — A0–A4 sequence with named cuts (defer ML platform; defer advanced detection; minimum-viable runtime first).
**Spec:** `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`.
**Run substrate:** Scrooge-coordinated in-session run (Principle 7 fallback). Substrate gaps surfaced in §4.

---

## 1. Component-by-component audit

Each row maps a §3 spec component to the merged code on `main` as of 2026-05-10 (commit `26f6a56`).

### 1.1 Agent identity & permissioning (spec §3.1)

**What's built.**

- `prototype/platform/agent-identity/issuer.ts` (447 lines). Exports `LocalAgentIdentityIssuer` implementing `AgentIdentityIssuer`. Ed25519 keypair generation via `node:crypto.generateKeyPairSync`; per-agent JSON keystore under `.local/keys/<urn>.json` (mode 0600); idempotent on `specHash`; emits `IdentityKeyRotated` with `reason: "initial" | "spec-change" | "scheduled" | "compromise"`. Sign / verify against canonicalised payload.
- `prototype/platform/agent-identity/permission-policy.ts` (271 lines). Exports `derivePermissionPolicy(spec)` and `LocalPermissionPolicyPublisher`. Capability allow-list, event-emit allow-list derived from §11/§12 of the agent spec. Idempotent on `policyHash`; emits `PermissionPolicyPublished`.
- `prototype/platform/event-store/permission-gate.ts` (T-01 closed 2026-05-10). Default-on; consults `PermissionPolicyResolver` at `.append()`; legacy-bypass for actors with no published policy yet, tracked via low-severity `SubstrateAlert`.

**What's missing or partial.**

- `eventSubscribeAllowList` and `registerWriteAllowList` derive to `[]` — the spec parser (§3.4) does not capture the typed event subscriptions on §7 trigger rows or the registers-maintained list on §11 (see `permission-policy.ts` lines 88–106). Wave-4 #11 event-subscribe-coverage will tighten when the parser is widened.
- HSM-backed signing (M8) — out of scope for this build phase; software-backed today; clean seam preserved.
- `signAs` (used by tests today) is the canonical sign path. Production agents do not yet sign their typed event-store appends — the gate trusts the actor envelope alone. Senna threat-model T-02..T-12 still open.

**Blocker / sequencing.** None for the headline path. `eventSubscribeAllowList` widening is parser-bound, not gate-bound.

### 1.2 Scheduler (spec §3.2)

**What's built.**

- `prototype/platform/scheduler/scheduler.ts` (501 lines). `LocalScheduler` implementing `Scheduler`. Persists schedule entries via `ScheduleRegistered` events; `tick(now)` emits `ScheduledTrigger` per due entry; idempotent within a tick.
- `prototype/platform/scheduler/cron-parse.ts` (327 lines). Cron + natural-language parser; subset suited to per-agent cadences.
- `prototype/platform/scheduler/calendar.ts` (274 lines). SA public-holiday calendar (P5 jurisdictional).

**What's missing or partial.**

- **Inactivity-SLA enforcement** is not wired (spec §3.2 final bullet). The scheduler can emit `SubstrateAlert` but does not consume run-completion events to detect a run that started but never completed. Cannot be wired until the runtime emits `Substrate*RunStarted/Completed` (the slice this brief ships).
- **Multi-jurisdiction calendar dispatch** — only SA today; per-jurisdiction extension is licence-day work.

**Blocker / sequencing.** Inactivity-SLA recon depends on §1.4 below.

### 1.3 Event-trigger bus (spec §3.3)

**What's built.**

- `prototype/platform/event-trigger-bus/bus.ts` (349 lines). `LocalEventTriggerBus` reads subscriptions from `runtime/handlers-metadata.ts`, walks events past a cursor, dispatches subscribers via an injected `BusRunner`. Emits `BusDispatched` (idempotent on `(eventId, handlerKey)`) and `SubstrateAlert` (severity high) on dispatch failure.
- Wired as canonical dispatcher under D-A22-RETIRE-LEGACY Phase 1 (CEO-approved 2026-05-08) — `runtime/run.ts` ticks the bus at the end of every parent run; legacy fan-out runs in shadow mode emitting `LegacyFanoutShadowed`.

**What's missing or partial.**

- **Per-agent in-flight cap / backpressure** (spec §3.3 third bullet) is not implemented. Best-effort dispatch today; no queue-depth alerting.
- **Sequence cursor durability across processes** — `bus:tick` uses `.local/bus-cursor.json`; the in-`runAgent` hook ticks per-run from `seqBefore`. Cross-process replay-on-crash is consistent (idempotent on `BusDispatched`) but the cursor file is not yet portable.

**Blocker / sequencing.** None. Backpressure can land independently.

### 1.4 Agent run lifecycle (spec §3.4) — **THE GAP**

**What's built.**

- `prototype/runtime/run.ts` (482 lines). Resolves the handler for `<agent>:<trigger>` from `HANDLER_CALLABLES`, builds an `AgentRunContext`, invokes the handler, ticks the bus, runs legacy-fanout-shadow. **Logs to stdout but emits no lifecycle events.**
- `prototype/runtime/types.ts` defines `AgentRunContext` and `AgentRunOutput`.
- RMS Phase 1 Slice 2 (2026-05-10) typed `AgentRunStarted` / `AgentRunCompleted` schemas with **brief-coupling required** (`briefId`, `runId`, `agent: rmsAgentRefSchema`, `outcome`, `deliverableDocumentHashes`, `substrateGapsSurfaced`, `followOnRoutes`).
- `prototype/platform/records/helpers.ts` provides `recordAgentRunStarted` / `recordAgentRunCompleted` for *brief-coupled* runs only.

**What's missing or partial.**

1. **`AgentRunFailed` has no payload schema and no `make…` constructor** — registry row at `event-store/registry.ts:535–545` is envelope-only. The event type cannot be appended in a typed way today.
2. **`runAgent` does not emit lifecycle events for non-brief runs.** Every scheduled tick, every event-driven dispatch, every CLI invocation produces zero substrate-level run record. Outcome:
   - Vera Wave-4 #13 inactivity-SLA recon has nothing to read.
   - The oversight-UI fleet-status view (spec §3.6) has no `lastRunAt` / `nextRunAt` data source.
   - The substrate-gap inventory cannot count Scrooge-coordinated runs vs autonomous runs without parsing logs.
   - The S8 **A2 exit criterion** ("Vera's pipelines run via the substrate, not via Scrooge in-session") cannot be evidenced.
3. **No `runId`** in `AgentRunContext` — handlers cannot tag domain events back to the run that produced them. Vera Wave-4 #15 (decision-traceability) wants this.
4. **No `Bun-worker` isolation primitive** — spec §3.4 calls for one Bun worker per agent. Today every handler runs in the main `runAgent` process. Out of scope for this slice (deferred to A4 fleet rollout); flagged.

**Blocker / sequencing.** This is the core gap — see §3 for the slice.

### 1.5 Escalation channel (spec §3.5)

**What's built.**

- `prototype/platform/escalation/channel.ts` (651 lines). `LocalEscalationChannel` with full lifecycle: `open` → `acknowledge` → `delegate` → `decide` → derived `overdue`. Sealed-escalation routing override. Status is computed by folding the event log (Principle 1).
- Typed schemas for all five escalation events live in `event-store/event-types.ts`; tests cover the lifecycle.
- `dashboard/oversight.ts` (363 lines) projects `EscalationView` and serves `/api/escalations` — sorted by deadline.
- `dashboard/derive.ts` lifts open `AgentEscalation` events into the dashboard Decisions tile.

**What's missing or partial.**

- **`AgentEscalationOverdue` is not auto-emitted by a substrate cron** — the channel exposes `markOverdue(now)`; nothing in the runtime calls it on a tick. Spec §3.5 final bullet binds.
- **Multi-overseer routing** — sealed escalations record `routedTo` but resolution-to-channel is still hardcoded to `human:marc@tgv.co.za` (build-phase discipline; Marc wears every hat). Licence-day work.

**Blocker / sequencing.** Overdue-cron wiring depends on a scheduler entry — small follow-on slice.

### 1.6 CEO oversight UI (spec §3.6)

**What's built.**

- `dashboard/oversight.ts` exposes `listEscalations`, `listFleetAgentStatus`, plus drill-down per `escalationId`. Server routes mounted in `dashboard/server.ts`.
- Inbox-style render is part of the existing dashboard; escalations surface as Decisions on the home tile.
- `dashboard/agent-runs.ts` exists for run projections.

**What's missing or partial.**

- **Fleet-status view has no `lastRunAt` / `nextRunAt` / `pendingEscalations` columns wired to substrate run-lifecycle events** — depends on §1.4. Today the projection reads RMS brief-coupled `AgentRunStarted/Completed`, which only fires for brief-driven runs.
- **POPIA discipline** — Iris's standing automated-decisioning notice template is referenced in §3.6 but not yet rendered for `AgentDecision` events that fall under POPIA s.71. Open dependency on Iris.
- **Decision drill-down chain (P2 citation chain → procedure (P6) → spec authority (P7))** — partial; obligations-view exists, end-to-end chain not knit.

**Blocker / sequencing.** Fleet-status view is gated on §1.4.

---

## 2. Highest-leverage missing slice — substrate AgentRunner lifecycle

**Decision: ship the substrate AgentRunner lifecycle wrapper.**

### 2.1 Why this slice

Compared to the alternatives the dispatch brief lists:

| Candidate slice | Leverage | Verdict |
|---|---|---|
| **Substrate AgentRunner lifecycle** | Unblocks Vera Wave-4 #13 inactivity-SLA recon, fleet-status view in oversight, the substrate-gap inventory's quantitative shape, and the A2 exit criterion. Every other slice's value compounds *through* this one. | **Ship.** |
| Oversight UI inbox view | Already merged for escalations. Fleet-status view exists but lacks data — gated on AgentRunner lifecycle. | Compounds with this slice; do after. |
| Permission-policy enforcement at append | Already merged + default-on (T-01 closed 2026-05-10). | Done. |
| Fleet rollout — register all 27 personas | The registry-sync CLI works for one agent today; running it for all 27 is mechanically easy. But **without §1.4's lifecycle events, registration alone tells us nothing about whether agents are running.** Compounds; do after. | Compounds with this slice; do after. |

The fail mode the lifecycle wrapper closes: every agent run today is invisible to the substrate. We say agents are autonomous (Principle 7); we have no event evidence of when they ran, how long they took, what they emitted, or whether they succeeded — only logger output that vanishes on process restart. Vera cannot audit a substrate that emits no audit-class events for the runs themselves.

### 2.2 What lands in this slice

S8/RMS overlap considerations: the existing `AgentRunStarted` / `AgentRunCompleted` event types were repurposed by RMS Slice 2 (Scrooge ruling, 2026-05-10) to mean "brief-coupled run lifecycle" — `briefId` is a required field. Most substrate runs (every `ScheduledTrigger`-driven tick, every event-driven dispatch, every CLI invocation) are **not** brief-coupled. We need a parallel event family for the substrate's own run lifecycle.

Per the standing S8 authority (`D-AGENT-RUNTIME-AUTHORIZE`, CEO-approved 2026-05-08) and consistent with the S8/RMS partitioning rule already established, this slice introduces:

- `SubstrateAgentRunStarted` — typed Zod payload schema + `make…` constructor.
- `SubstrateAgentRunCompleted` — same.
- `SubstrateAgentRunFailed` — closes the registry gap (envelope-only today, no payload schema).

These are emitted by the substrate runner unconditionally, regardless of whether a brief exists. RMS's `AgentRunStarted` / `AgentRunCompleted` continue to govern brief-coupled run lifecycle (records-of-agent-runs register).

The slice also wires `runtime/run.ts` to:

1. Mint a stable `runId` (`run:<agent>:<iso-utc>:<short-rand>`) and pass it on the `AgentRunContext`.
2. Emit `SubstrateAgentRunStarted` before invoking the handler.
3. Emit `SubstrateAgentRunCompleted` on success, with success/failure status, count of decisions emitted, count of escalations emitted, duration ms, count of new events appended.
4. Emit `SubstrateAgentRunFailed` if the handler throws or returns `ok: false`. Carries `errorClass`, `errorMessage` (truncated), duration ms.

Tests cover: typed schema parse, lifecycle event emission paired by `runId`, success / failure paths, dry-run skipping the lifecycle (because dry-runs are not real substrate work), permission-gate compatibility (the substrate runner's actor identity is on the legacy-bypass list).

### 2.3 Exit criterion (per spec §9 A2)

> *Vera's pipelines run via the substrate, not via Scrooge in-session.*

Before this slice: a Vera run via `runAgent` produces no lifecycle events, indistinguishable from a Scrooge in-session "simulation." After this slice: every `runAgent` invocation appends a paired `SubstrateAgentRunStarted` / `SubstrateAgentRunCompleted` (or `SubstrateAgentRunFailed`) — Vera's runs are now substrate-evidenced and the inactivity-SLA recon has a stream to fold.

The full A2 exit criterion ("inactivity-SLA recon enforcement live") follows in a small subsequent slice that wires the scheduler's inactivity check to consume `SubstrateAgentRunCompleted`.

### 2.4 Out of scope for this slice

- **Bun-worker isolation per agent** (spec §3.4 architectural seam, "Bun worker per agent"). Deferred to A4 fleet rollout — runs continue in the main process today. The lifecycle events are runner-architecture-neutral; A4 swaps the runner without changing event semantics.
- **Inactivity-SLA recon enforcement** — needs a scheduler-side consumer of `SubstrateAgentRunCompleted`. Small follow-on slice.
- **Migrating handlers to emit `AgentDecision` events** — the lifecycle wrapper merely *counts* decisions appended during the run; it does not retrofit handlers to emit them.
- **Fleet-status view wiring** in the oversight UI — mechanically simple after this slice; separate.

---

## 3. Slice — implementation

Files touched:

- `prototype/platform/event-store/event-types.ts` — adds three Zod schemas + three `make…` constructors at the bottom of the S8 runtime-events block, before the RMS block.
- `prototype/platform/event-store/registry.ts` — adds three rows to the `RUNTIME` event-class registry (or modifies the existing `AgentRunFailed` row to add the payload schema).
- `prototype/platform/event-store/permission-gate.ts` — adds the three new types to `LEGACY_PRE_A1_EVENT_TYPES` so the substrate-runner actor (`agent:atlas:agent-runner`) can emit them under the legacy-bypass while no permission policy is published for the substrate's own service identity. Per the T-01 substrate-bypass discipline (added 2026-05-10).
- `prototype/runtime/run.ts` — wraps `runAgent` in a try/finally lifecycle block. Mints `runId`, emits Started, observes success / failure, emits Completed or Failed.
- `prototype/runtime/types.ts` — extends `AgentRunContext` with `runId: string`.
- `prototype/tests/substrate-agent-runner-lifecycle.test.ts` — new test file.

Citations stamped on emitted lifecycle events:

- `GOV-FRAMEWORK-CEO-RESERVED` (D-AGENT-RUNTIME-AUTHORIZE / S8 standing authority).
- `JOINT-STANDARD-2-2024` (cyber-resilience runtime telemetry).
- `ORG-CY-09` (Cyber Resilience Policy — runtime auditability).

---

## 4. Substrate gaps surfaced by this run

This run was a Scrooge-coordinated in-session realisation of the Atlas persona, not a fully autonomous run. Gaps that prevented a fully-autonomous run, in the order they would close as A1–A4 land:

1. **No standing Atlas agent runtime hook** — Atlas's persona spec triggers (e.g. `substrate-spec-update`, `merged-PR review`) are not wired to a registered handler in `runtime/handlers-metadata.ts`. Today Atlas runs only when Scrooge dispatches him in-session. (Closes: A4 fleet rollout.)
2. **No `runId` on the existing `AgentRunContext`** — even when this run is wrapped in a future lifecycle, the deliverables it appends today (the assessment doc commit, the slice's PR) cannot be tied back to a `runId`. (Closes: this slice.)
3. **No `SubstrateAgentRunStarted` event for this run** — the assessment is being written without a paired substrate run record. The slice that lands now will retroactively make the *next* Atlas run substrate-evidenced. (Closes: this slice.)
4. **No autonomous spec-parser update** — to widen `eventSubscribeAllowList` derivation (spec §3.4), the parser needs a `triggerSubscriptions` field. Today this requires a Scrooge-dispatched human-in-the-loop pass. (Closes: A2 follow-on.)
5. **No Bun-worker process boundary** — this run shares a process with everything Scrooge orchestrates today. Compromise of the in-session process compromises every concurrent run. (Closes: A4 / M8.)

Gaps #2 and #3 close inside this slice; the remainder are tracked.

---

## 5. Open dependencies routed elsewhere

- **To Senna (security primitives, governance) + Rashida (CISO, governance):** T-02..T-12 from the agent-runtime substrate threat model (recorded 2026-05-10) remain open. The substrate-runner's actor identity (`agent:atlas:agent-runner`) signs nothing today — the permission-gate trusts the envelope. Threat-model resolution for runner-impersonation is post-T-12.
- **To Vera (Internal audit engineer, third-line):** Wave-4 #13 inactivity-SLA recon harness can be built now that this slice provides the event stream to fold. Confirm the `(SubstrateAgentRunStarted, SubstrateAgentRunCompleted/Failed)` pairing rule meets pipeline #13 needs.
- **To Iris (Privacy / POPIA, governance):** automated-decisioning notice template for `AgentDecision` events under POPIA s.71 — still owed.
- **To Owen (Company Secretary, governance):** procedure files `Procedures/by-policy/agent-runtime-deploy.md` and `Procedures/by-policy/event-schema-evolution.md` still owed; this slice's event-type additions tabling under the latter at the next IAF reading.

—Atlas
