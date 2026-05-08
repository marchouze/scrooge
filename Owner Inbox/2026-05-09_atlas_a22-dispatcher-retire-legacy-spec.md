---
title: A2.2 dispatcher — cutover spec to retire the legacy in-process fan-out
author: Atlas
date: 2026-05-09
summary: Cutover plan to retire the legacy in-process fan-out in `runtime/run.ts:132–199` once the A2.2 LocalEventTriggerBus has been observed in steady state. Three phases — bus-canonical/legacy-shadow → legacy retire → observe — with named gating criteria, named failure modes, and a single-commit rollback. Decision asked: authorise Phase 1 on the gating criteria.
decision-required: true
decision-id: D-A22-RETIRE-LEGACY
decision-category: near-term
decision-owner: Atlas (substrate build) · Devon (governance — operational resilience)
decision-for-ceo: Authorise the cutover sequence to retire the legacy in-process fan-out from `runtime/run.ts`, starting with Phase 1 (bus-canonical, legacy-shadow) on the named gating criteria.
decision-recommendation: Approve as drafted. Phase 1 is reversible inside one commit; Phase 2 has named gating; the cutover surfaces three substrate gaps (scheduler-bus coupling, cross-workflow dispatch ceiling, recon-pipeline parity) that the retire itself doesn't close — those are tracked, not hidden.
---

# A2.2 dispatcher — cutover spec to retire the legacy in-process fan-out

**Author:** Atlas (Core banking platform architect)
**Reports through:** Devon (COO)
**Contributors / dependencies:** Vera (Wave-4 #11 runtime-handler-sync; Wave-4 #13 inactivity reconciliation; new Wave-4 #13b parallel-dispatch-divergence pipeline proposed here), Senna (zero-trust posture for the bus identity), Anya (semantic-layer entries for `BusDispatched`), Devon (operational-resilience treatment of the bus), Scrooge (CEO-decision-record handler picks up the resolved decision).
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority:**
- `D-AGENT-RUNTIME-AUTHORIZE` (resolved 2026-05-07; approves A0–A3 substrate build)
- `D-FLEET-ROLLOUT-SEQUENCING` (resolved 2026-05-08; sequences A1–A4 build)
- `D-MARKETS-SCHEMA-FOUNDATION` (resolved 2026-05-07; A0 schema freeze that included `BusDispatched`)
- Principle 1 (events as truth — `BusDispatched` is the canonical dispatch record)
- Principle 4 (security designed in — the cutover preserves zero-trust for the bus identity)
- Principle 6 (no orphan capability — retiring the legacy fan-out removes a capability with no procedure-binding)
- Principle 7 (autonomous by default — the bus runs unattended; the retire removes a step that required parent-process co-residency)
**Status:** Specification only — no code change at this stage. Build of Phase 1 follows under Atlas; Phase 2 + 3 gated on Phase 1 evidence.

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer: it sequences the retirement of one substrate path that has been superseded by another. No new principle-level substance. Cites the runtime substrate spec, the A2.2 PR (`prototype/platform/event-trigger-bus/bus.ts`), the legacy fan-out (`prototype/runtime/run.ts:132–199`), and the runtime-handler-sync recon pipeline.

---

## 1. Why now

A2.2 — the `LocalEventTriggerBus` + `bus:tick` CLI + `BusDispatched` audit-event-based idempotency — landed via PR #6 on 2026-05-08. The bus has been live for ~1 day. The fleet has fired ≥1 cycle on the bus path and the first observable `BusDispatched` events are in the store. The legacy in-process fan-out (`runtime/run.ts:132–199`) still runs whenever a parent run appends events that subscribers care about — so today every event-driven dispatch happens **twice**:

1. Once via the legacy fan-out, inline inside the parent run that emitted the trigger event.
2. Once via the bus, on the next `bun run bus:tick` invocation.

The double-dispatch is **safe by design** — each event-driven handler is event-sourced and idempotent, so the second invocation is a no-op for outcome (the handler reads the event store, sees its own prior projection-refresh / decision-record / follow-on already happened, exits clean). But it is **not free**:

- **Cost surface 1 — wall-clock + LLM cost.** Every event-driven handler that runs twice doubles the latency budget and (where the handler invokes Claude) the LLM token spend. Per the auto-memory entry on Anthropic API spend, that token cost is the bank's largest current real expense.
- **Cost surface 2 — log noise.** Each handler emits an `AgentRunStarted` / `AgentRunCompleted` pair on each invocation. The Vera-pipeline #13 inactivity-reconciliation reads this stream; doubled run-events distort the inactivity-SLA derivative without changing the conclusion (we're noisier, not wrong).
- **Cost surface 3 — divergence-window risk.** While both paths run, there is a window in which they could diverge. Today the divergence is detectable but not asserted by recon; the parallel-dispatch-divergence pipeline (proposed here as Wave-4 #13b) is the harness that turns the assertion on.
- **Cost surface 4 — substrate-narrative drift.** The agent-runtime substrate spec (`2026-05-07_atlas_agent-runtime-substrate-spec.md` §3.3) names the bus as the canonical event-driven dispatcher. While the legacy path co-exists, the substrate spec and the running code disagree. Principle 6 tolerance for this kind of drift is short.

The pacing question is not "can we retire" but "how do we retire safely, with rollback, and with the *right* observation window in between." This brief is the answer.

> **Pacing note.** The bus has been live for ~1 day. We do **not** propose to flip the cutover today. Phase 1 below (bus-canonical, legacy-shadow) is itself the observation window. We propose to *authorise* Phase 1 today; we *enter* Phase 1 only when the gating criteria in §2 are met. The expected window from authorisation to Phase-1 entry is in the range of a few agent cycles.

---

## 2. What "observed working" means — gating criteria for Phase 1 entry

Before flipping into Phase 1, the bus must demonstrate **steady-state correctness** against the legacy path it is about to displace. The gating criteria are typed and event-derivable — Vera's pipelines compute them; no human judgement at the gate.

| # | Criterion | Pipeline | Threshold |
|---|---|---|---|
| G1 | **Zero-divergence on dispatch set.** Over the gating window, the set of (eventId, handlerKey) pairs that the legacy fan-out invoked equals the set that the bus would invoke if it ticked at the same boundary. | New Wave-4 #13b — `parallel-dispatch-divergence` (described in §4.3) | 0 divergence rows over ≥ 3 fleet-cycles |
| G2 | **Recon green.** All existing recon harnesses (especially `recon:dashboard`, `recon:runtime-handler-sync`, `recon:cron-map-drift`) green over the window. | `bun run recon:all` | green over the same window |
| G3 | **No bus-attributable integrity alerts.** No `SubstrateAlert{alertClass:"integrity"}` events exist whose `agentUrn` is the bus actor and whose payload references a dispatch failure. | Event-store query (`type=SubstrateAlert` × `actor.id=agent:atlas:event-trigger-bus`) | 0 events |
| G4 | **`BusDispatched` is plausibly-complete.** For every event-driven handler invocation observed via the legacy fan-out's logs in the window, a corresponding `BusDispatched{outcome:"ok"}` exists in the store with the matching `(eventId, handlerKey)`. | Wave-4 #13b output cross-section | 100 % match |
| G5 | **Bus tick-cadence floor.** The bus has ticked at least once per fleet-cycle. (Today the bus is invoked manually; the cadence floor is what Phase 1 must mechanically guarantee — see §3.1.) | Manual tick log + `BusDispatched` density | Achieved by hooking the bus into the scheduler tick (Phase 1 build step) |

The window is **3 fleet-cycles** (the smallest window where divergence has had an opportunity to manifest across the full handler set without being noisy enough to delay the cutover indefinitely). A fleet-cycle is the period over which all scheduled handlers fire at least once at their declared cadence — today, dominated by the daily handlers, that is ~24h; the gating window is therefore approximately 3 days of agent-time.

If any criterion fails, the cause is investigated and fixed before retrying. The investigation is itself a substrate-evidence event — the `SubstrateAlert` or recon-failure record carries the citation.

### 2.1 What "fleet-cycle" means precisely

A fleet-cycle is the smallest interval that contains at least one firing of every scheduled handler in `runtime/handlers-metadata.ts`. Today the longest-cadence scheduled handler is weekly (Atlas substrate-state, Owen governance-cycle-prep, Senna security-substrate-state, etc.); a strict reading would set the fleet-cycle to one week. We propose the **practical** reading: the cadence-weighted majority of scheduled handlers fire on a daily cadence, and the daily handlers are the ones that emit the events most likely to trigger event-driven follow-ons. Three calendar days therefore captures three full daily-cycle iterations and at least three sample points on the weekly handlers' between-fire windows. This is sufficient for divergence detection; we do not need to wait three weeks.

If the operational record over those three days shows a weekly handler emitting an event that triggered a follow-on in only one of the two paths, that is a G1 failure and the gate stays closed until the cause is resolved.

---

## 3. Cutover sequence

Three phases. Each phase has a specific build step, a specific runtime topology, and named exit criteria for the next phase. The phases are reversible up to the start of Phase 2; from Phase 2 onward, rollback is a single revert commit (§5).

### 3.1 Phase 1 — bus-canonical, legacy-shadow (~3 days of agent-time)

**Topology.** The bus is the **canonical** event-driven dispatcher. The legacy in-process fan-out is preserved in code but switched to **shadow mode**: it logs what it *would have* dispatched, but does **not** invoke the handler. Every event-driven handler invocation happens exactly once, via the bus.

**Build step.** Three changes, all in `prototype/runtime/run.ts` and a single new scheduler hook.

1. **Shadow flag in the legacy fan-out.** A constant `LEGACY_FANOUT_MODE: "active" | "shadow" = "shadow"` at the top of `run.ts`. When `"shadow"`, the fan-out walks the new-events set, computes the `triggered` handler keys exactly as today, and emits a typed `LegacyFanoutShadowed` event per (parent run, triggered handler key) row — but does **not** call `tEntry.handler(tCtx)`. The shadow event is the substrate's own evidence that the legacy path *would* have dispatched, recorded for divergence assertion.
2. **Bus hooked into scheduler tick.** Today the bus runs only via `bun run bus:tick`. To make the bus the canonical dispatcher, it must run on a cadence that catches every event-driven trigger inside its response-SLA. The simplest sufficient hook is to call `bus.tick(...)` at the end of every `runAgent(...)` invocation (after the parent run completes, before the function returns). This piggybacks on the existing scheduler — the bus ticks whenever any agent runs — without introducing a separate poller. A subsequent slice (separately specified) lifts the bus into a free-standing scheduler-driven tick at sub-minute cadence; for Phase 1 the run-coupled tick is sufficient because the only events that need dispatching are those emitted by the parent run that just completed, and the bus is invoked immediately after that run completes.
3. **`LegacyFanoutShadowed` event type.** New event in `platform/event-store/event-types.ts`. Payload: `{ parentAgent, parentTrigger, triggeredHandlerKey, triggeringEventTypes, suppressedAtSequence }`. Emitter: `agent:atlas:legacy-fanout-shadow`. This is short-lived — it disappears entirely at Phase 2.

**Vera assertion in Phase 1.** New recon pipeline `parallel-dispatch-divergence` (Wave-4 #13b — see §4.3) reconciles `LegacyFanoutShadowed` events against `BusDispatched` events. They must agree on the same set of (eventId, handlerKey) pairs, modulo a small timing window for the bus tick.

**Phase 1 exit criteria.**
- 0 divergence rows over ≥ 3 fleet-cycles (G1, on the new typed events).
- 0 `SubstrateAlert{alertClass:"integrity"}` from the bus (G3).
- All recon green (G2).
- Anya's projection-refresh has fired ≥ once via the bus path (it is the most-frequent event-driven handler — high signal).
- Scrooge's `ceo-decision-record` and `follow-on-router` handlers — both event-driven, both load-bearing — have each fired ≥ once via the bus path.

**If Phase 1 exit criteria fail.** The shadow flag flips back to `"active"`, the bus stays running but the bus-tick hook is removed, and the cause is investigated. The cost of the rollback is one commit. Restart of the gating window is from the failure-resolution commit, not from authorisation.

### 3.2 Phase 2 — legacy retire (entry: ~1 week after Phase 1 green; ~1 day to execute)

**Topology.** The legacy in-process fan-out is **deleted** from `runtime/run.ts`. The shadow-flag and `LegacyFanoutShadowed` event type are deleted. The bus is the only event-driven dispatcher.

**Build step.** Single PR touching three files.

1. **`runtime/run.ts:132–199` deleted.** The block from "Event-driven fan-out: …" through the end of the `if (entry.metadata.kind !== "event-driven" && !ctx.dryRun)` body is removed. The `seqBefore = eventStore.count()` capture is also removed (no longer needed). The bus-tick hook installed in Phase 1 stays in place.
2. **Shadow flag + `LegacyFanoutShadowed` event type deleted.** No longer needed; their purpose was Phase 1 evidence.
3. **`parallel-dispatch-divergence` recon retired (or repointed).** With no legacy path to compare against, the divergence pipeline has nothing to assert. Two options: (a) retire it cleanly; (b) repoint it as a `bus-coverage` pipeline that asserts every event-driven handler that *should* have fired (per `runtime/handlers-metadata.ts`'s `subscribesTo` declarations) has a matching `BusDispatched` row in the store. We propose (b) — the new pipeline is cheap and forward-compatible with cross-workflow dispatch (M8). Naming: Wave-4 #13b stays as `bus-dispatch-coverage`.

**Phase 2 exit criteria — the "did the retire stick" gate.**
- Recon green for the first 24h after the retire (especially `recon:dashboard` and the repointed Wave-4 #13b).
- No `SubstrateAlert{alertClass:"integrity"}` from any source.
- Anya's projection-refresh and Scrooge's two event-driven handlers continue to fire on schedule with no degraded-mode flags.

**Why the ~1 week wait between Phase 1 green and Phase 2 entry.** Three reasons:
1. **Soak time.** Phase 1 may surface a low-frequency edge case that the 3-fleet-cycle window did not. Holding Phase 1 for an additional week gives those edges a chance to manifest while rollback is still trivial.
2. **Cadence-weighted observation.** The weekly handlers (Atlas substrate-state, Owen governance-cycle-prep, Senna security-substrate-state) only fire once per week. A single weekly firing inside Phase 1's window is sufficient evidence on the daily handlers but only *one* sample on the weekly handlers. Holding for a second weekly cycle doubles the weekly-handler evidence at near-zero cost.
3. **Decision-cadence alignment.** Marc's CEO-decision review cadence is event-driven, not periodic. Phase 2 entry is itself a `CeoDecision` event; by waiting the additional week, Phase 2 is presented for a yes/no on Phase-1 evidence rather than presented for authorisation now on speculative future evidence.

### 3.3 Phase 3 — observe (~1 week after Phase 2; passive)

**Topology.** Same as Phase 2 — the bus is the only dispatcher. No code changes.

**Purpose.** Continuous green over a second observation window confirms the retire was clean. After this phase the cutover is complete; the substrate spec and the running code agree; the substrate-narrative drift identified in §1 is closed.

**Phase 3 exit criteria.**
- Recon green over the full week.
- No `SubstrateAlert{alertClass:"integrity"}` over the full week.
- Vera's quarterly substrate-discipline opinion (next firing) reflects the cleaned-up topology.

**Phase 3 carries no further commits.** It is purely an observation phase; the work is the watching, not the changing.

---

## 4. What can go wrong — three named failure modes with mitigations

### 4.1 Failure mode F1 — bus tick-frequency too low → handler latency increases

**Risk.** In Phase 1, if the bus ticks only at the end of an agent run (the proposed hook), an event-driven handler that subscribes to an event emitted by a long-running parent run incurs the parent run's wall-clock as added latency vs the legacy fan-out, which dispatched inline. For most event types this is fine (the parent run is sub-second once Claude latency is excluded). For Anya's projection-refresh subscribing to events emitted near the end of a Claude-heavy parent run, it could be tens of seconds.

**Mitigation in Phase 1.** The bus-tick hook fires *after* the parent run's `AgentRunCompleted` event but *before* the function returns. The added latency is therefore bounded by the bus tick's own duration (single-digit milliseconds for the dispatch-set computation; the dispatched handler then runs sequentially, exactly as the legacy fan-out did). Net latency change: ~0.

**Mitigation in steady state (Phase 2+).** The run-coupled tick is sufficient as long as **every** event-driven trigger has a parent-run that ticks the bus. In today's topology this is true: every event-driven handler subscribes to an event emitted by a scheduled or on-request parent. The risk surfaces if a future event-driven handler subscribes to events emitted by *another event-driven handler* (a chain). The mitigation there is the separately-specified scheduler-driven bus tick at sub-minute cadence (see §6) — this brief does not require it, but flags it as a substrate gap §7.

**Detection.** A new-handler-coverage gate in Wave-4 #13b: every event-driven handler in `handlers-metadata.ts` must have at least one parent-emit lineage that traces to a scheduled-or-on-request handler within one bus-tick boundary. Failure surfaces as a recon finding, not a runtime alert.

### 4.2 Failure mode F2 — bus dedup races → handler invoked twice

**Risk.** The bus's idempotency is keyed on `(eventId, handlerKey)` and recorded as a `BusDispatched` event. The dedup lookup happens at the start of `tick()`; the `BusDispatched` write happens after the handler returns. If two `tick()` invocations overlap on the same `(eventId, handlerKey)` pair — both load the dedup set before either appends `BusDispatched` — the handler runs twice.

**Mitigation in Phase 1.** Today the bus is single-threaded (one Bun process per `bus:tick` invocation) and the run-coupled tick is sequential within `runAgent`. There is no realistic concurrent-tick path in Phase 1.

**Mitigation in steady state.** A free-standing scheduler-driven bus tick (separately specified) introduces the concurrent-tick path. Two options at that point: (a) a single-instance scheduler lock (the scheduler component already enforces this for scheduled handlers); (b) move the `BusDispatched` write to *before* the handler invocation (with `outcome:"in-flight"`), and update on completion. We propose (a) for the scheduler-driven bus tick when it lands; this brief does not require choosing.

**Detection.** Wave-4 #13b cross-section assertion: for every `(eventId, handlerKey)`, at most one `BusDispatched{outcome:"ok"}` row. Multiple rows on the same pair surface as a recon finding.

**Why this is not blocking for Phase 1.** The race only manifests with concurrent ticks. Phase 1 has no concurrent ticks. The mitigation can be designed at the same time as the scheduler-driven tick.

### 4.3 Failure mode F3 — bus down → no dispatch → inactivity-SLA alerts

**Risk.** If the bus throws or the bus-tick hook fails silently, event-driven handlers do not fire. The downstream effect is that handlers that *should* have responded to a triggering event never do; their inactivity-SLA crosses; Vera's pipeline #13 emits `SubstrateAlert{alertClass:"inactivity"}`.

**Mitigation in Phase 1.** The bus-tick hook is wrapped in a try/catch that emits `SubstrateAlert{alertClass:"integrity"}` on failure (already the behaviour of `LocalEventTriggerBus.tick` — failures inside `runner` already emit alerts; failures of `tick` itself are logged but not yet typed). We extend the alert path to also emit when `tick()` itself throws. The shadow path's evidence (still recorded in Phase 1) catches the missed dispatch via Wave-4 #13b divergence.

**Mitigation in Phase 2+.** Same alert path. Without the shadow evidence, the detection lag is bounded by the inactivity-SLA window — ~1 fleet-cycle for a daily handler. This is acceptable; the mitigation is to **shorten the inactivity-SLA** for handlers whose triggering parent-events fire at sub-daily cadence. Vera's pipeline #13 already supports per-handler SLA; the configuration update is part of the Phase 2 PR.

**Detection.**
- Phase 1: Wave-4 #13b divergence flags missing-dispatch inside the gating window.
- Phase 2+: `SubstrateAlert{alertClass:"inactivity"}` from Vera's pipeline #13.

**Worst-case manifestation.** The bus has been wedged for ~24h on the busiest handler before the alert fires. The handler's deliverables are stale. **No data is lost** — every event the handler would have consumed is still in the event store; on restart, the bus replays and dispatches the missed ones (idempotent by design). This is the strongest property of the event-sourced topology and the reason the worst-case impact is "stale dashboard" rather than "lost work."

### 4.4 Failure mode catalogue — what we are *not* claiming to mitigate

For completeness, the following failure modes exist but are **out of scope** for this cutover:

- **Cross-workflow dispatch.** If the parent run lives in GitHub Actions workflow A and a subscriber needs to fire in workflow B, the run-coupled tick does not bridge the workflow boundary. This is the cross-workflow event bus gap — gap #4 in the substrate-gap inventory of `2026-05-08_atlas-scrooge_fleet-rollout-sequencing.md` — and is deferred to M8 (Azure Event Hubs + Service Bus). The bus today, like the legacy fan-out yesterday, operates in-process within a single workflow. The cutover does not change that ceiling.
- **Permission-policy violations on dispatched handlers.** A dispatched handler that emits an event outside its permission policy is rejected at the event-store gate (A1.2). The bus does not validate permissions — that is the gate's responsibility. Failure surfaces at append time, not at dispatch time. Status quo behaviour preserved by the cutover.
- **Backpressure / per-agent in-flight cap.** A2.2 ships without backpressure. If a single tick has thousands of dispatchable rows, the bus runs them sequentially, blocking the caller. This is the in-flight-cap gap noted in the runtime substrate spec §3.3 — separately scheduled, not addressed by this brief.

---

## 5. Rollback

### 5.1 Rolling back from Phase 1

Single commit reverts: the shadow flag flips back to `"active"`, the bus-tick hook is removed, and the `LegacyFanoutShadowed` event type stays in the schema (event-store schemas are append-only — removing the type would invalidate replay of past events). Net effect: legacy fan-out runs as it does today; the bus continues to run via manual `bun run bus:tick` only; the divergence pipeline keeps emitting findings until the gating-window investigation closes the cause and we re-enter Phase 1.

**Cost:** one commit, ~30 minutes of build-engineering time.

### 5.2 Rolling back from Phase 2

The retire is a single commit. Rollback is a `git revert` of that commit, which reinstates `runtime/run.ts:132–199`, the shadow flag, and the `LegacyFanoutShadowed` event type. The bus stays running (the bus-tick hook stays in place); the legacy fan-out is re-enabled in **active** mode (not shadow), so both paths run again exactly as in the pre-A2.2 state. The Wave-4 #13b pipeline is repointed back to divergence-mode.

**Cost:** one revert commit, ~2 hours of build-engineering time (allow for the Wave-4 #13b repoint and the test-suite re-run).

**Trigger for Phase 2 rollback.** Any of the Phase 2 exit criteria failing within the 24h post-retire observation window. The decision is event-typed (`CeoDecision` rolling back the cutover) but does not require re-authorisation — Atlas executes the revert under the standing change-management procedure (`Procedures/by-policy/change-management.md`, owner Atlas) on observation of the failure.

### 5.3 What is *not* rolled back

The bus itself (PR #6) is **not** rolled back at any point. The bus is a substrate component that exists independently of the cutover; rolling back the bus would require its own decision (`D-A22-RETIRE-BUS`, hypothetical). The cutover is about *which dispatcher is canonical*, not whether the bus exists at all.

The `BusDispatched` events accumulated during Phase 1 and after also stay in the store. They are append-only audit; rolling them back would require destructive store surgery, which is forbidden by the substrate's "events are the only source of truth" principle.

---

## 6. What is NOT in scope for this brief

The cutover is narrowly scoped to **retiring the legacy fan-out**. The following are explicitly **out of scope** and remain on Atlas's substrate roadmap as separate slices:

- **A2.2 evolution — filter expressions.** The bus today dispatches on `eventType` match alone. Adding `filterExpression` (per the runtime substrate spec §3.3) is a follow-on slice. The cutover does not depend on it.
- **A2.2 evolution — backpressure / per-agent in-flight cap.** Not in this brief.
- **A2.2 evolution — sub-minute scheduler-driven tick.** The run-coupled tick is sufficient for Phase 1 and Phase 2 given today's handler topology. The free-standing scheduler-driven tick is a separately-specified slice; it becomes load-bearing if and when an event-driven handler subscribes to events emitted by another event-driven handler (a chain).
- **Cross-workflow dispatch.** Deferred to M8 (Azure cloud lift). The cutover preserves the in-process / single-workflow ceiling that the legacy fan-out had.
- **Bus identity hardening.** Today the bus actor is `agent:atlas:event-trigger-bus` — a software-issued identity. HSM-backed signing keys for the bus identity land at A1.2 (already authorised) and are independent of the cutover.
- **Permission policy for the bus.** The bus dispatches *to* handlers; the handlers themselves are subject to permission policy. The bus's own permissions (it must be able to append `BusDispatched` and `SubstrateAlert`, read every stream for its dedup-set computation) are configured at A1.2.
- **Procedure binding for the cutover itself.** A new procedure `Procedures/by-policy/dispatcher-cutover.md` (owner Atlas, source policy Change Management Policy) is *not* required for the cutover to proceed — the existing change-management procedure covers it. A *new* procedure `Procedures/by-policy/event-trigger-bus-operations.md` covering the bus's standing operations (tick cadence, dedup invariants, alert thresholds) is owed by Atlas at the next IAF reading; that is a Phase 3-time deliverable, not a Phase 1 prerequisite.

---

## 7. Substrate gaps the cutover surfaces but does not close

The cutover is itself a closure of substrate gap #3 from `2026-05-08_atlas-scrooge_fleet-rollout-sequencing.md` (cross-process event-trigger bus). But it surfaces three new gaps in the process:

| # | Gap | Owner | Closes at |
|---|---|---|---|
| New-1 | **Scheduler-driven bus tick at sub-minute cadence.** Today the bus tick is run-coupled (Phase 1 hook). This is sufficient for the current handler topology but ceilings any event-driven-to-event-driven chain at "next parent-run" latency. | Atlas | Separate slice, post-Phase 3 |
| New-2 | **Cross-workflow dispatch ceiling unchanged.** Both the legacy fan-out and the bus today operate in-process within a single workflow. The cutover does not lift the ceiling; the M8 cloud lift does. | Atlas | M8 (post-licence) |
| New-3 | **Recon-pipeline parity at retire.** The `parallel-dispatch-divergence` (Wave-4 #13b) pipeline retires or repoints at Phase 2. Vera's pipeline catalogue must be updated to reflect the change in the same PR; otherwise the audit-evidence claim "Wave-4 has 13 + parallel-dispatch-divergence pipelines" drifts from reality. | Vera | Phase 2 PR |

These are tracked, not hidden. Each becomes a roadmap item at the time the cutover lands.

The gap inventory from `2026-05-08_atlas-scrooge_fleet-rollout-sequencing.md` §7 is otherwise unchanged by this brief — no new domain gaps surface.

---

## 8. Procedure binding (Principle 6 — upward)

The cutover binds to:

- **`Procedures/by-policy/change-management.md`** — owner Atlas. Source policy: Change Management Policy. The cutover is a change to a substrate component; the standing procedure governs it. The Phase 1, Phase 2, and rollback transitions are each `ChangeRequestSubmitted` / `ChangeApproved` / `ChangeImplemented` event tuples in the event store.
- **`Procedures/by-policy/event-schema-evolution.md`** — owner Atlas (planned, per `2026-05-07_atlas_agent-runtime-substrate-spec.md` §7). The introduction (Phase 1) and removal (Phase 2) of `LegacyFanoutShadowed` is a schema evolution and follows this procedure.
- **`Procedures/by-policy/secure-sdlc.md`** — owner Atlas + Senna. The Phase 1 PR carries the threat-model gate for the new event type and the bus-tick hook (the threat-surface is small — the hook adds no new external entry point; the new event type is internal-only — but the gate must record that finding rather than skip it).
- **`Procedures/by-policy/event-trigger-bus-operations.md`** — owner Atlas (new, planned). Covers the bus's standing operations once the cutover completes. Bound to the Information Security Policy and the Change Management Policy. Tabled at the IAF reading after Phase 3.

The existing `Procedures/by-policy/agent-runtime-deploy.md` (planned, per the substrate spec §7) is the parent procedure under which the cutover-specific procedure sits; the cutover does not require the parent to land first — change-management and secure-sdlc are sufficient.

---

## 9. Dependencies on other personas

| Dependency | Persona | What I need from them, and by when |
|---|---|---|
| Wave-4 #13b — parallel-dispatch-divergence pipeline | Vera | Build the pipeline before Phase 1 entry. Spec is in §4.3 above; pipeline path `prototype/platform/recon/parallel-dispatch-divergence.ts`. Repoint to `bus-dispatch-coverage` at Phase 2. |
| `LegacyFanoutShadowed` event type review | Vera + Anya | Schema review before Phase 1 PR — Vera's audit-event hooks must consume it; Anya adds it to the semantic layer. Short-lived (deleted at Phase 2) but real for Phase 1's duration. |
| Threat-model gate for the bus-tick hook | Senna + Rashida | One-line confirmation that the run-coupled bus-tick hook adds no new external attack surface (the hook calls an internal function on an internal event-store handle) before Phase 1 PR. |
| Operational-resilience treatment | Devon | Confirm the bus is BCP/DR-tier-classified the same as the runtime itself. The retire does not change the tier; just confirm the inventory still reflects reality. |
| CEO-decision lift | Scrooge | Run `agent:anya-projection-refresh` after this brief is committed so the dashboard projection lifts `D-A22-RETIRE-LEGACY` into the open-decisions queue. |
| Procedure tabling | Owen | Add `event-trigger-bus-operations.md` to `Procedures/_index.md` for the IAF reading after Phase 3. |
| Substrate-state snapshot at Phase 3 close | Atlas (self) | First substrate-state run after Phase 3 close confirms the cutover landed; substrate-gap inventory updated to remove gap #3 and add New-1 + New-2 + New-3. |

---

## 10. The decision asked

**D-A22-RETIRE-LEGACY — authorise the cutover sequence to retire the legacy in-process fan-out, starting with Phase 1 (bus-canonical, legacy-shadow) on the named gating criteria.**

If approved as drafted:

1. Vera builds Wave-4 #13b (`parallel-dispatch-divergence` recon pipeline). One short slice.
2. Atlas adds the `LegacyFanoutShadowed` event type to the schema and implements the shadow flag + bus-tick hook in `runtime/run.ts`. One slice; Senna's threat-model gate runs in parallel.
3. The gating window opens. We wait for ≥ 3 fleet-cycles of green G1–G5.
4. At gate-green, we enter Phase 1. The cutover *runs* through Phase 1; no further authorisation needed for Phase 2 entry **iff** Phase 1 exit criteria green.
5. Phase 2 entry is a `CeoDecision` event type record produced by Scrooge's `ceo-decision-record` handler — surfaced for Marc's yes/no, presented with the Phase 1 evidence pack — but it is the *same* decision (`D-A22-RETIRE-LEGACY`) being carried forward, not a new one. (Decision-status moves from `phase-1-authorised` to `phase-2-confirmed` on the new event.)
6. Phase 3 carries no further commits — pure observation. Gate-close on quarterly substrate-discipline opinion.

If a different sequence is preferred (e.g. extending the gating window from 3 fleet-cycles to a full week, or requiring Phase 2 to be a separately-authorised decision rather than a confirmation of this one), Atlas re-sequences and re-publishes.

If the cutover is **not** authorised, the cost surfaces in §1 continue to accumulate. The largest single line is the LLM token spend on doubled invocations of Anya's `projection-refresh` (the highest-volume event-driven handler). The cost is not catastrophic but it is real and it grows linearly with the fleet.

---

## 11. Open items routed elsewhere

- **To Vera:** build Wave-4 #13b before Phase 1 entry (spec in §4.3). Repoint at Phase 2 to `bus-dispatch-coverage` (one-line config; no logic change).
- **To Senna + Rashida:** threat-model gate for the bus-tick hook + `LegacyFanoutShadowed` event type. Short — the surface is small.
- **To Anya:** `LegacyFanoutShadowed` and `BusDispatched` event types added to the semantic layer; consumed-projection schemas reviewed.
- **To Devon:** confirm operational-resilience tier of the bus (no change expected; just inventory hygiene).
- **To Owen:** schedule `event-trigger-bus-operations.md` procedure for the IAF reading after Phase 3.
- **To Scrooge:** run `agent:anya-projection-refresh` after this brief lands so the dashboard lifts `D-A22-RETIRE-LEGACY`. Pick up the resolved decision via `ceo-decision-record` when Marc decides; route Phase 1 build to Atlas's next slice via `follow-on-router`.
- **To Marc (CEO):** the decision in §10. Authorise Phase 1 on the gating criteria, or counter-propose a different sequence.

—Atlas
