---
title: S8 substrate state v2 + next slice — inactivity-SLA recon on lifecycle pairs
author: Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Second audit of the agent-runtime substrate (D-AGENT-RUNTIME-AUTHORIZE / S8) post-PR-#189 (scheduler→bus→runner-worker chain landed; 47 lifecycle-evidenced runs per tick). v1's "highest-leverage missing slice" — substrate AgentRunner lifecycle wrapper — is closed. The next-most-leveraged slice is **inactivity-SLA recon enforcement on `SubstrateAgentRunStarted`/`Completed`/`Failed` pairs**, which closes the spec §9 A2 exit criterion ("inactivity-SLA recon enforcement live"). Fleet-status oversight UI wiring is a tight follow-on.
decision-required: false
authority: D-AGENT-RUNTIME-AUTHORIZE (CEO-approved 2026-05-08, "S8")
---

# S8 substrate state v2 + next slice

**Author:** Atlas (Core banking platform architect, engineering).
**Authority:** S8 / `D-AGENT-RUNTIME-AUTHORIZE` (CEO-approved 2026-05-08) — A0–A4 sequence with named cuts.
**Spec:** `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`.
**Run substrate:** Scrooge-coordinated in-session run (Principle 7 fallback). Substrate gaps surfaced in §4.
**Predecessor:** `Owner Inbox/2026-05-10_atlas_s8-substrate-state-and-next-slice.md` (v1).

---

## 0. Headline

PR #189 (`substrate(S8 §3.2 + §3.3): first real autonomous run`) merged to `main` at `c313b7e`. A clean `bun run scheduler:tick` against current main now produces 25 schedule entries → 79 firings → 79/79 dispatched → 47 actual agent runs, with paired `SubstrateAgentRunStarted` / `SubstrateAgentRunCompleted` lifecycle events for every run. Zero failures, zero alerts.

**v1's named gap (substrate AgentRunner lifecycle wrapper) is closed.** The lifecycle events stream now exists; the next slice is the first consumer of that stream — **the scheduler's `inactivityCheck` rewritten to fold lifecycle pairs**.

---

## 1. Component-by-component audit (post-#189)

Same shape as v1 §1; gaps re-checked against post-#189 main.

### 1.1 Agent identity & permissioning (spec §3.1) — unchanged from v1

- `agent-identity/issuer.ts`, `permission-policy.ts`, `event-store/permission-gate.ts` — still merged + default-on (T-01 closed 2026-05-10).
- **Crossed-off:** none. Gaps named in v1 §1.1 (HSM-backed signing M8; `eventSubscribeAllowList` parser widening; runner identity not signing) all still open.
- **New (v1 closure):** `SubstrateAgentRunStarted/Completed/Failed` are on the `LEGACY_PRE_A1_EVENT_TYPES` carve-out so the substrate-runner actor can emit lifecycle events under legacy-bypass. Tracked as substrate gap (the runner identity should publish a permission policy and emit signed lifecycle events; T-02..T-12 open with Senna).

### 1.2 Scheduler (spec §3.2) — partial closure

- **Closed since v1:** scheduler now ticks → fires → bus → runs end-to-end (PR #189). 25 entries, 79 firings, 79/79 dispatched on a clean tick.
- **Still open / re-stated:**
  - **Inactivity-SLA enforcement** is *partially* implemented (`inactivityCheck` exists in `scheduler.ts`) but keys off "any event by agent" — a heuristic that produces false-greens because the scheduler's own `SubstrateAlert` emission counts as activity. The post-#189 lifecycle-events stream is the right substrate input. **This is the slice §3 ships.**
  - Multi-jurisdiction calendar dispatch — still SA-only; licence-day work.

### 1.3 Event-trigger bus (spec §3.3) — partial closure

- **Closed since v1:** bus is canonical; `runtime/run.ts` ticks on every parent run; legacy fan-out in shadow mode (see #189 + D-A22-RETIRE-LEGACY).
- **Still open:** per-agent in-flight cap / backpressure (synchronous in-process today — moot for local-first; lands at M8 with Container Apps Jobs); cross-process cursor portability.

### 1.4 Agent run lifecycle (spec §3.4) — **CLOSED SINCE v1**

- **Closed since v1:**
  - `SubstrateAgentRunStarted`, `SubstrateAgentRunCompleted`, `SubstrateAgentRunFailed` typed Zod schemas + constructors live in `event-store/event-types.ts` (lines 949–1130).
  - `runtime/run.ts` mints a `runId`, emits Started, observes success/failure, emits Completed or Failed in a try/finally — every `runAgent` invocation is paired-coupled.
  - `AgentRunContext.runId` field exists and is propagated to handlers.
  - PR #185 (worker-isolation primitive) wraps `runAgent` with `RunnerWorker` — `process.chdir` + `fs *Sync` shimmed against worktree-boundary escape; emits `SubstrateAlert{integrity,high}` on attempted escape.
- **Still open:**
  - **No consumer of the lifecycle stream.** Vera Wave-4 #13 inactivity-SLA recon, fleet-status `lastRunAt`/`nextRunAt` columns, substrate-gap inventory all blocked on a fold that pairs Started↔Completed/Failed by `runId`. **This is the slice §3 ships.**
  - Bun-worker process boundary still local — A4 / M8 work.
  - Scrooge-coordinated runs (e.g. *this* assessment write) still don't pass through `runAgent` and therefore emit no lifecycle events — they remain substrate-invisible. Closes when Atlas's persona spec triggers wire to `runtime/handlers-metadata.ts` (A4 fleet rollout).

### 1.5 Escalation channel (spec §3.5) — unchanged from v1

- **Crossed-off:** none.
- **Still open:** `enforceOverdue(now)` exists on `LocalEscalationChannel` (channel.ts:598) but no scheduler entry calls it on a tick. **Small follow-on; not in this slice.** Multi-overseer routing licence-day.

### 1.6 CEO oversight UI (spec §3.6) — partial

- **Closed since v1:** `dashboard/oversight.ts` `buildFleetStatus` exposes a `/api/fleet` endpoint with `lastActivityAt` / `nextRunAt` columns.
- **Still open:** those columns are computed from `state.agents` mini-dashboard `lastActivityAt` (a heuristic), **not from `SubstrateAgentRunCompleted`**. The next slice after the one this brief ships will swap the source. Decision drill-down chain still partial; POPIA template still owed by Iris.

---

## 2. Highest-leverage missing slice — inactivity-SLA recon on lifecycle pairs

**Decision: ship the lifecycle-pair-keyed `inactivityCheck` rewrite.**

### 2.1 Why this slice

| Candidate slice | Leverage | Verdict |
|---|---|---|
| **Inactivity-SLA recon on lifecycle pairs** | Closes spec §9 **A2 exit criterion** ("inactivity-SLA recon enforcement live"); first consumer of the v1-shipped lifecycle stream; fixes a real false-green bug in the current heuristic; enables Vera Wave-4 #13 to land. Compounds with every other slice. | **Ship.** |
| Fleet-status oversight UI wiring (`lastRunAt`/`nextRunAt`/`pendingEscalations` from lifecycle events) | High leverage but mechanically downstream — once the inactivity-SLA recon proves the pair-fold pattern is right, the same fold powers the oversight columns. | Ship next, separate slice. |
| `AgentEscalationOverdue` auto-emit cron | Mechanically simple — `enforceOverdue(now)` already exists; just needs a scheduler entry. But: no live escalations exist today (escalations are Scrooge-coordinated), so the cron has nothing to fire on. Low leverage until escalation channel sees real traffic. | Defer to follow-on. |
| On-request triggers (RMS Brief → runtime dispatch) | High leverage when it lands — would replace Scrooge-coordinated dispatches end-to-end. But it's a large slice (RMS Brief register → dispatcher seam → permission policy for the dispatcher actor → tests across all 27 agents). Doesn't compound from inactivity-SLA. | Defer; size as its own multi-slice workstream. |
| Brief-coupled triggers (RMS `BriefRouted` → handler) | Same shape as on-request. Same answer. | Defer. |
| Unwired §7 triggers across persona specs | Requires spec-parser widening for `triggerSubscriptions` (already partial; spec-parser.ts:495) + per-handler authoring for ~30 unwired triggers across the fleet. A4 work. Compounds *after* lifecycle-evidenced runs make wiring decisions defensible. | Defer. |
| Per-agent in-flight cap / backpressure | Synchronous in-process model today — no in-flight slots. Moot pre-M8. | Defer to M8. |
| Senna T-02..T-12 (substrate-runner identity signs nothing; legacy-bypass) | Real threat-model items; needs Senna+Rashida. Not blocked on Atlas. | Routed elsewhere. |
| Fleet-status UI columns wired to lifecycle events | Same answer as candidate #2 above; ship after the inactivity-SLA recon validates the pair-fold pattern. | Ship next. |

The decisive argument: the lifecycle-events stream exists but has zero consumers. **One artefact emits, nothing reads** is the same pre-shipped-but-unused failure mode v1 was about to ship into. Closing the first read-side keeps the shipped artefact load-bearing rather than aspirational.

The fail mode this closes: today's `inactivityCheck` keys on `actor.id startsWith "agent:<name>"` for *any* event in the log. The scheduler's own `SubstrateAlert` emission, the bus's `BusDispatched` emission with `actor.id = "agent:atlas:event-trigger-bus"`, and the runner-worker's `SubstrateAlert{integrity}` emission all attribute back to `agent:atlas` and silently mask Atlas's true inactivity. Today the substrate self-greenlights.

### 2.2 What lands in this slice

Two tightly-scoped behaviour changes inside `prototype/platform/scheduler/scheduler.ts`:

1. **`inactivityCheck` rewrite** — instead of folding any-event-by-agent, fold the pair-coupled lifecycle stream:
   - For each `(agent, trigger)` schedule entry, find the most recent `SubstrateAgentRunCompleted` *or* `SubstrateAgentRunFailed` event whose `payload.agent.toLowerCase() === entry.agentUrn.replace("agent:", "")` and whose `payload.runId` matches a known `SubstrateAgentRunStarted` (i.e. it's a closing event of a complete pair).
   - Compute `hoursSinceLastCompletedRun = (now - lastClosedRun) / 3600000`. If `> SLA`, emit `SubstrateAlert{alertClass: "inactivity"}`.
   - Add a *separate* check: for each `SubstrateAgentRunStarted` with no matching closing event AND `(now - startedAt) > SLA`, emit `SubstrateAlert{alertClass: "inactivity", details: "...orphaned run..."}` (i.e. the run started but never reported back). This is the "started-without-completed" case the spec §3.2 final bullet calls out and v1 explicitly named as the inactivity-SLA leverage point.
   - Idempotency unchanged: `alertId` keyed on `(agentUrn, triggerId, alertSubclass)` skip re-emission.

2. **No-events case sharpened** — when no `SubstrateAgentRunStarted` for the agent has *ever* fired, still emit the inactivity alert (the agent has never run). This case already works today; it remains.

The slice does **not** ship:

- Fleet-status UI rewiring (next slice).
- `AgentEscalationOverdue` auto-emit cron (separate small slice).
- Spec-parser widening for `triggerSubscriptions` (parser-bound; A2 follow-on).
- Migration of any handler to emit `AgentDecision` events.

### 2.3 Exit criterion (per spec §9 A2)

> *Vera's pipelines run via the substrate, not via Scrooge in-session.* (Headline form.)
> *Inactivity-SLA recon enforcement live.* (Concrete form.)

Before this slice: inactivity SLA fires false-greens when the substrate's own infrastructure events (SubstrateAlert from scheduler, BusDispatched from bus, BoundaryEscape SubstrateAlert from runner-worker) attribute to an agent URN. The substrate cannot detect "this agent's *run* never closed."

After this slice: the pair-fold isolates *real* run lifecycle, ignoring all infrastructure noise. An agent that hasn't *run* in N hours emits an inactivity alert; an agent that started a run but never closed it emits an orphaned-run alert. Vera Wave-4 #13 has a typed input.

### 2.4 Out of scope for this slice (re-stated)

- Fleet-status UI columns wired to lifecycle events.
- `AgentEscalationOverdue` auto-emit cron.
- Bun-worker per-agent process isolation (A4 / M8).
- POPIA-by-design surfaces.
- Substrate-runner permission policy + signed lifecycle events (Senna T-02..T-12).

---

## 3. Slice — implementation

Files touched (estimate):

- `prototype/platform/scheduler/scheduler.ts` — replace the body of `inactivityCheck()`. Keep the existing public signature (`(now: Date) => InactivityCheckResult`) and the existing alertId keying. Add a small `LifecycleFold` helper that walks `SubstrateAgentRunStarted/Completed/Failed` once and returns `Map<agentUrn, { lastClosedAt, openRuns: Array<{runId, startedAt}> }>`.
- `prototype/platform/scheduler/index.ts` — extend `InactivityFinding` with an optional `findingClass: "no-runs" | "stale-runs" | "orphaned-run"` discriminator so callers (Vera Wave-4 #13 in particular) can filter.
- `prototype/tests/scheduler.test.ts` — add lifecycle-pair-keyed tests:
  - Recent paired Started+Completed → no alert.
  - Stale paired (last close > SLA) → `findingClass: "stale-runs"` alert.
  - Started without Completed/Failed within SLA → `findingClass: "orphaned-run"` alert.
  - No Started ever → `findingClass: "no-runs"` alert (existing behaviour preserved).
  - Idempotency: re-running `inactivityCheck` on the same event log appends no duplicate alerts.
  - **Regression guard:** the pre-existing "scheduler's own SubstrateAlert masks inactivity" false-green is now caught — emit a non-lifecycle event by the agent in question, run `inactivityCheck`, expect the alert to fire (proving the new fold ignores non-lifecycle events).

Citations stamped on emitted `SubstrateAlert` events (unchanged from v1):

- `D-AGENT-RUNTIME-AUTHORIZE` (S8 standing authority).
- `GOV-FRAMEWORK-CEO-RESERVED`.
- `JOINT-STANDARD-2-2024` (cyber-resilience runtime telemetry).
- `ORG-CY-09` (Cyber Resilience Policy — runtime auditability).

Worker-isolation, scaffold-commit-early, push-retry, citation-gate discipline per dispatch brief (CLAUDE.md "Dispatch discipline").

---

## 4. Substrate gaps surfaced by this run

This run is a Scrooge-coordinated in-session realisation of the Atlas persona, not a fully autonomous run. Gaps in order of A4-and-after closure:

1. **Atlas's persona spec triggers still unwired.** No `runtime/handlers-metadata.ts` row for "atlas:substrate-spec-update" or "atlas:merged-PR-review" — Atlas runs only when Scrooge dispatches him. (Closes: A4 fleet rollout — the first concrete trigger to wire would be `atlas:substrate-state-assessment` event-driven on `SubstrateAlert` to compose the next *substrate-state-vN* assessment when alerts cross a threshold, instead of waiting for Marc's prompt.)
2. **No autonomous spec-parser update.** §3.4's `eventSubscribeAllowList` derivation still scoped to §11/§12; widening to §7 trigger rows requires a Scrooge-dispatched human-in-the-loop pass. (Closes: A2 follow-on.)
3. **Scrooge-coordinated runs emit no `SubstrateAgentRun*` lifecycle events.** The slice this brief ships pairs `runAgent` invocations only — Scrooge's in-session orchestration runs by-passes the runner. Pair-counting therefore still under-counts the true substrate workload. (Closes: A4 — once every persona has a wired trigger, Scrooge orchestration becomes the exception, not the rule.)
4. **Substrate-runner identity signs nothing.** `agent:atlas:substrate-runner` is on the legacy-bypass; Senna T-02..T-12 open. (Closes: post-T-12, with Senna+Rashida.)
5. **Fleet-status UI columns still computed from heuristic `lastActivityAt`.** Next-slice work; gates the spec §3.6 oversight UI fleet-status view. (Closes: next slice.)
6. **`AgentEscalationOverdue` not auto-emitted on a tick.** Small scheduler-entry follow-on; no live escalations today, so leverage is low. (Closes: when escalation channel sees real traffic.)

Gaps #1 and #5 are the two most consequential remaining substrate gaps; this slice unblocks #5 and partially de-risks the wiring patterns #1 will need.

---

## 5. Open dependencies routed elsewhere (delta from v1)

Delta from v1 §5:

- **To Vera (Internal audit engineer, third-line):** Wave-4 #13 inactivity-SLA recon harness can now land downstream of this slice — the `findingClass` discriminator on `InactivityFinding` is the typed input. Confirm the three subclasses (`no-runs`, `stale-runs`, `orphaned-run`) cover the pipeline's needs.
- **To Senna (Security primitives, governance) + Rashida (CISO, governance):** T-02..T-12 still open; the lifecycle stream is now load-bearing for inactivity-SLA, which sharpens the impersonation-risk surface (a forged `SubstrateAgentRunCompleted` would mask a real outage). Adds urgency to runner-identity signing.
- **To Iris (Privacy / POPIA, governance):** automated-decisioning notice template still owed; unblocks oversight UI POPIA surface.
- **To Owen (Company Secretary, governance):** procedure files `Procedures/by-policy/agent-runtime-deploy.md` and `Procedures/by-policy/event-schema-evolution.md` still owed; this slice's behaviour change tabling under the latter at the next IAF reading.

—Atlas
