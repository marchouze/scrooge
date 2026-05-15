---
title: Agent autonomy — operational status + delta brief (D-AGENT-AUTONOMY-OPERATIONAL)
author: Atlas (Core banking platform architect; substrate)
date: 2026-05-11
summary: A0–A4 of the 2026-05-07 substrate spec are substantially built (registry, identity, scheduler, bus, lifecycle, oversight UI, fleet of 27 registered) — but four operational gaps still keep Principle 7 session-simulated rather than production-true. Asking for authorisation of three slices that close Gaps 1, 3, and frame Gap 4; deferring Gap 2 (persistent host) into the Azure-day workstream.
decision-required: true
decision-id: D-AGENT-AUTONOMY-OPERATIONAL
decision-category: near-term
decision-owner: Atlas (build) · Devon (Chief Operating Officer, governance — operational accountability)
decision-for-ceo: Approve the residual-only build plan to close the four operational gaps that prevent Principle 7 from holding in production; supersede the open D-AGENT-RUNTIME-AUTHORIZE brief by retiring it to actioned/ as superseded.
decision-recommendation: Approve Slice 1 (local launchd cron + scheduler-tick driver) and Slice 2 (trigger-wiring symmetry recon + remediation) for immediate dispatch; approve Slice 3 (per-persona goal-loop substrate) as spec-only under this decision with per-persona build dispatched separately. Retire 2026-05-07 spec to actioned/ marked SUPERSEDED.
---

# Agent autonomy — operational status + delta brief (D-AGENT-AUTONOMY-OPERATIONAL)

**Author:** Atlas (Core banking platform architect; substrate)
**Reports through:** Devon (Chief Operating Officer, governance)
**Co-routed:** Senna (Security engineer), Rashida (Chief Information Security Officer, governance), Anya (Data substrate engineer), Vera (Internal audit / continuous-assurance engineer), Bea (Dashboard / observability engineer), Owen (Company Secretary, governance), Imani (Legal-as-code engineer), Mira (Compliance / RegTech engineer)
**Date:** 2026-05-11
**For:** Marc (CEO)
**Authority:** Principle 7 (CLAUDE.md) — autonomous by default; humans oversee the residual. Standing CEO decisions referenced in §2 below.
**Predecessor (superseded by approval of this brief):** [`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`](2026-05-07_atlas_agent-runtime-substrate-spec.md)

> **Derivation note (Principle 6 — downward).** This brief is a *standard*-layer status + delta on an in-flight substrate. It cites the Information Security Policy, Cyber Resilience Policy, Change Management Policy, Operational Risk Policy. Source regulations: Joint Standard 1 of 2024 (cyber resilience), Joint Standard 2 of 2024 (operational risk), BCBS principles on operational resilience.

---

## 1. Executive summary

The 2026-05-07 spec authorised A0 (schemas) → A5 (audit cycle) + M8 (Azure lift). Under the omnibus S8 decision (CEO-approved 2026-05-08) and downstream `D-A22-RETIRE-LEGACY` (Phase 1 cutover, 2026-05-08), A0 → A4 substantially shipped: schemas frozen, registry live, identity issuer + permission-policy publisher live, scheduler ticking, event-trigger bus canonical-dispatcher (A22 Phase 1), AgentRunner lifecycle wrapper landed (S8 Tier 1, PR #189), 27 personas registered, oversight UI shipped (`prototype/dashboard/oversight.ts`).

**But Principle 7 still doesn't hold in production**, because four operational gaps remain: (1) **no daemon** — `scripts/scheduler-tick.ts` is one-shot; the only thing keeping agents firing today is 27 separate GitHub Actions cron workflows, each invoking exactly one handler with no inter-tick state; (2) **no persistent host** for the local substrate — laptop sleep / dashboard-down means escalation deadlines and inactivity-SLA recon stop; (3) **partial trigger wiring** — persona specs declare 110 `Triggers:` rows across 29 specs; `handlers-metadata.ts` wires only 37 (≈34%); (4) **no goal-pursuit** — even with cadence + triggers wired, an agent's "what should I do given world state?" loop is still Scrooge in-session.

**Recommendation.** Approve three independently-shippable slices: Slice 1 (local launchd-driven scheduler-tick — closes Gap 1 in build-phase form, Gap 2's build-phase fixture), Slice 2 (trigger-wiring symmetry recon + remediation batch — closes Gap 3), Slice 3 (per-persona goal-loop substrate — *spec-only* under this decision, frames Gap 4). Defer Gap 2's licence-day target to the existing Azure-migration workstream. Retire 2026-05-07 spec to `actioned/` marked superseded.

---

## 2. Audit — what shipped against the 2026-05-07 A0–A5 plan

Each tickbox cites a real file path checkable from the repo root. Sub-rows quote the spec.

### A0 — Schema freeze

- [x] **Substrate event types defined.** `prototype/platform/event-store/event-types.ts` exports `makeAgentRegistered`, `makeAgentRetired`, `makeIdentityKeyRotated`, `makePermissionPolicyPublished`, `makeScheduledTrigger`, `makeSubstrateAgentRunStarted`, `makeSubstrateAgentRunCompleted`, `makeSubstrateAgentRunFailed`, `makeSubstrateAlert`, `makeAgentDecision`, `makeAgentEscalation`, `makeAgentEscalationAcknowledged`, `makeAgentEscalationDecided`, `makeAgentEscalationDelegated`, `makeAgentEscalationOverdue`, `makeBusDispatched`, `makeLegacyFanoutShadowed` — full §4 set plus the Phase-1 dispatch + shadow events.
- [x] **Permission-policy derivation rule defined.** `prototype/platform/agent-identity/permission-policy.ts` (`LocalPermissionPolicyPublisher`).
- [x] **Vera Wave-4 #10–#13 pipelines** — referenced in `prototype/platform/recon/` (mandate-coverage + permission-policy + lifecycle-pair recon, registered in the recon harness).
- *Verdict: A0 complete.*

### A1 — Identity primitives

- [x] **Agent registry.** `prototype/platform/agent-runtime/registry.ts` (`LocalAgentRegistry`).
- [x] **Identity issuer (software-backed Ed25519 local).** `prototype/platform/agent-identity/issuer.ts` (`LocalAgentIdentityIssuer` — `issue`, `rotate`, `verify`, `signAs`).
- [x] **Permission policy publisher.** `prototype/platform/agent-identity/permission-policy.ts` (publishes `PermissionPolicyPublished` per agent at registration).
- [x] **Spec parser (Path A — Gap #2 closed for typed-event subscriptions).** `prototype/platform/agent-runtime/spec-parser.ts` per [`2026-05-10_atlas_s8-a4-fleet-rollout.md`](2026-05-10_atlas_s8-a4-fleet-rollout.md).
- [/] **Permission gate.** `prototype/platform/event-store/permission-gate.ts` exists, but **`BANK_PERMISSION_GATE_ENABLED=false` by default** (Senna+Rashida T-01 Critical, threat model 2026-05-10). Closure routed via `D-T-01-PERMISSION-GATE-SECURE-DEFAULT` (separate decision; not in scope of this brief).
- *Verdict: A1 substantially complete; T-01 known.*

### A2 — Permission policy + scheduler

- [x] **A2.1 Scheduler.** `prototype/platform/scheduler/scheduler.ts` (`LocalScheduler` — `syncRegistry`, `tick`, `inactivityCheck`); cron parsing in `cron-parse.ts`; calendar awareness (SA holidays) in `calendar.ts`.
- [x] **A2.2 retire-legacy dispatcher Phase 1 (CEO-approved as `D-A22-RETIRE-LEGACY`, 2026-05-08).** Bus is canonical dispatcher (`prototype/runtime/run.ts` const `BUS_CANONICAL = true`); legacy fan-out runs in shadow mode emitting `LegacyFanoutShadowed` events for Vera #13b parallel-dispatch-divergence recon. Phase 2 (delete the shadow path) remains downstream.
- [x] **Event-trigger bus.** `prototype/platform/event-trigger-bus/bus.ts` (`LocalEventTriggerBus`); scheduled-trigger consumer in `scheduled-trigger-consumer.ts`.
- [x] **Cron map consolidation (2026-05-10).** Single source: `cronExpression` field on each `HandlerMetadata` row in `prototype/runtime/handlers-metadata.ts`; `derivedCronMap()` re-renders the legacy export. `recon:cron-map-drift` asserts `.github/workflows/agent-runtime-*.yml` agree.
- [x] **`scheduler-tick` end-to-end chain.** Per [`2026-05-10_atlas_s8-substrate-state-v2.md`](2026-05-10_atlas_s8-substrate-state-v2.md) §0: a clean `bun run scheduler:tick` produces 25 schedule entries → 79 firings → 79/79 dispatched → 47 lifecycle-paired runs.
- *Verdict: A2 substantially complete; daemon driver is Gap 1 below.*

### A3 — Run lifecycle

- [x] **AgentRunner lifecycle wrapper (S8 Tier 1, PR #189 — see `project_session_2026_05_10` memory).** `prototype/runtime/run.ts` `runAgent()` emits `SubstrateAgentRunStarted` / `SubstrateAgentRunCompleted` / `SubstrateAgentRunFailed` around every handler invocation.
- [x] **Worker isolation primitive.** `prototype/platform/agent-runtime/runner-worker.ts` (`createRunnerWorker`, `WorktreeBoundaryError`) — worktree boundary enforcement landed alongside the lifecycle wrapper.
- [x] **Inactivity-SLA recon enforcement.** `LocalScheduler.inactivityCheck()` reads lifecycle pairs and emits `SubstrateAlert` per overdue agent. Persona Inactivity-SLA lines parsed at tick-time in `prototype/scripts/scheduler-tick.ts` `buildSlaResolver()`.
- *Verdict: A3 complete.*

### A4 — Escalation channel + fleet rollout

- [x] **Escalation channel typed end-to-end.** `prototype/platform/escalation/channel.ts` + `index.ts`; events `AgentEscalation`, `AgentEscalationAcknowledged`, `AgentEscalationDecided`, `AgentEscalationDelegated`, `AgentEscalationOverdue` per spec §3.5 schema.
- [x] **Fleet rollout — 27 personas registered (S8 §3.1, A4).** `prototype/scripts/register-fleet.ts` walks `Team/_team-roster.json`; per [`2026-05-10_atlas_s8-a4-fleet-rollout.md`](2026-05-10_atlas_s8-a4-fleet-rollout.md), idempotent boot-time registration wired into dashboard server boot.
- [x] **Sealed-escalation routing (fraud / whistleblowing / popia-incident).** `prototype/platform/escalation/channel.ts` (sealed payload; routing to CAE+CEO+CoSec for fraud per spec §3.5).
- *Verdict: A4 complete.*

### A5 — Oversight UI

- [x] **Inbox view.** `prototype/dashboard/oversight.ts` `listEscalations()` — open `AgentEscalation` events sorted by deadline, with one-click decision actions emitting `AgentEscalationDecided`.
- [x] **Fleet-status view.** `oversight.ts` `buildFleetStatus()` — agent-by-agent last-run / next-run / in-flight / pending escalations.
- [x] **Decision drill-down.** `oversight.ts` `buildDecisionDrillDown()` — citation chain, owning procedure, agent-spec-entry that authorised.
- [x] **POPIA s.71 standing notice.** Iris's standing template rendered into the UI (referenced in Senna+Rashida threat model §Scope).
- [x] **Substrate-gap inventory tile.** `prototype/dashboard/substrate-gaps.ts` (Vera Wave-4 #13 surface).
- *Verdict: A5 v1 complete; Wave-5 capability-creep recon remains the next assurance slice (out of this brief's scope).*

### A2.1 Sub-deferred (post-S8 cuts)

- [ ] **ML platform substrate.** Deferred under S8 named-cuts.
- [ ] **Advanced detection (deception, UBA).** Deferred under S8 named-cuts.
- [ ] **A2.2 Phase 2 (delete shadow path).** Pending re-confirmation per `D-A22-RETIRE-LEGACY` gating criteria.
- [ ] **M8 Azure lift.** Deferred to post-licence (per spec §6 + `project_cloud_target_azure` memory).

---

## 3. The four operational gaps

### Gap 1 — No daemon process

**Evidence.** `prototype/scripts/scheduler-tick.ts:178-181`:

```ts
if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
```

This is a one-shot CLI. Nothing keeps it firing on a cadence. The only thing currently driving cadence is 27 separate GitHub Actions cron workflows in `.github/workflows/agent-runtime-*.yml`, each of which invokes exactly **one** handler (e.g. `agent-runtime-vera-overnight-recon.yml` runs `bun run agent:vera-overnight` at `13 2 * * *`) — bypassing the scheduler→bus chain entirely for the 32 scheduled handlers and 9 event-driven handlers. The substrate's own `scheduler-tick` consumer (which would dispatch lifecycle-paired runs through the canonical bus) has no driver.

**Why this matters.** The 27 GH-Actions cron workflows are not equivalent to the substrate firing through its own canonical chain. Each workflow:
- Bypasses `LocalEventTriggerBus.dispatch()` and goes straight to `runAgent()`.
- Does not produce a `ScheduledTrigger` event before firing — only the lifecycle pair.
- Does not drive `inactivityCheck()` between runs (each workflow is stateless w.r.t. peers).
- Cannot drive event-driven handlers at all (no `eventType` triggers fire — they only run when the *upstream* GH workflow happens to emit that event, which it doesn't, because scheduler-tick is the producer).

**Closure.** A long-running tick driver that calls `bun run scheduler:tick` on a fixed cadence (1m or 5m) and runs locally as a build-phase fixture. Local: macOS `launchd` plist (or equivalent on Linux). Cloud: Azure Container Apps Jobs (per spec §6). Slice 1 below.

### Gap 2 — No persistent host

**Evidence.** Even with Gap 1 closed, the substrate's host is Marc's laptop. Laptop sleep, dashboard process down, or `bun run dashboard:dev` not running means: scheduler stops, escalation deadlines stop being enforced, inactivity-SLA recon stops emitting `SubstrateAlert`, the bus stops draining `ScheduledTrigger` events. Per [`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`](2026-05-07_atlas_agent-runtime-substrate-spec.md) §6 the licence-day target is Azure (Container Apps Jobs + Logic Apps), but no build-phase always-on fixture exists — `prototype/dashboard/server.ts` is a foreground process bound to terminal lifetime.

**Why this matters.** Principle 7 says "autonomous by default; humans oversee the residual". Today the laptop closing IS a human-in-the-loop step (the substrate stops until Marc reopens). This is build-phase-acceptable for a session-simulated cadence; it is not acceptable as a production stance.

**Closure (split).** Build-phase fixture is bundled with Slice 1 (the launchd plist runs even when the dashboard is down — `launchd` is the persistent host). Production target (always-on Azure deployment) is **deferred** to the existing Azure-migration workstream when that gets scheduled. Honest framing: licence-day binds production-grade availability; build-phase only requires "does not stop when terminal closes".

### Gap 3 — Partial trigger wiring

**Evidence.** Quantified by parsing the §7 Triggers table across `Team/*.md`:

```
$ for f in Team/*.md; do … awk '/^## 7. Triggers/,/^## 8./' … done
Total declared triggers across 29 persona specs: 110
Total entries in handlers-metadata: 37
Coverage: ≈34%
```

Breakdown by handler `kind` in `prototype/runtime/handlers-metadata.ts`:
- 32 `scheduled` handlers (cadence-driven, `cronExpression` set).
- 9 `event-driven` handlers (subscribe to typed events).
- ⇒ ≈73 declared triggers across the fleet have **no corresponding handler-metadata row**.

Examples (sampled):
- Eitan declares 6 triggers in `/Team/Eitan.md` §7; only 1 (`liquidity-snapshot`, scheduled) is in `handlers-metadata.ts`.
- Rohan declares 6 triggers; 2 wired (`risk-run` scheduled, `backtest-harness` event-driven).
- Sade declares 5 triggers; 1 wired (`agentops-readiness` scheduled).
- Mira declares 1 trigger in §7 (per file content) but 2 are wired in metadata (`obligations-snapshot`, `m1-regulator-citation-urns`) — direction-of-drift cuts both ways.

**Why this matters.** Permission policies derived under A1's Path A only cover the typed-event subscriptions the spec parser can find (per [`2026-05-10_atlas_s8-a4-fleet-rollout.md`](2026-05-10_atlas_s8-a4-fleet-rollout.md)). Triggers declared but not wired produce `eventSubscribeAllowList` rows with no corresponding consumer — the permission policy authorises something that can never fire. Vera's mandate-coverage recon will eventually flag this; a recon pipeline that asserts symmetry now is the durable fix.

**Closure.** A new recon pipeline (`recon:trigger-spec-handler-symmetry`) that diffs the §7 table against `HANDLERS_METADATA` per agent and emits an `AuditFinding` per missing pair, plus a remediation batch authored by the persona-owners (or auto-generated stub handlers that no-op pending real implementation). Slice 2 below.

### Gap 4 — No goal-pursuit

**Evidence.** Even with Gaps 1 and 3 closed, an agent's behaviour is reactive: scheduled-tick wakes it, it runs one handler, it terminates. There is no loop in any agent that reads its own `## 9 Decisions in scope`, `## 11 Outputs`, `## 13 Procedures owned` sections from its `Team/<Name>.md` spec, queries world state (event store, projections, registers), and decides "given my mandate and the world right now, what should I do that I have not already done?". That decision is currently made by Scrooge (Chief of Staff / Orchestrator) in-session, dispatching the agent against a brief Marc has approved.

**Concrete demonstration.** No file in `prototype/platform/agent-runtime/` or `prototype/runtime/agents/` reads section 9, 11, or 13 of any persona spec. The spec parser (`prototype/platform/agent-runtime/spec-parser.ts`) extracts triggers and inactivity-SLA only.

**Why this matters.** This is the largest gap and the one with the most uncertainty. It is the difference between "the substrate runs handlers we tell it to run" and "agents pursue their mandate autonomously". Until this lands, every novel piece of work still requires Scrooge to spot the need and dispatch — which means Marc's session-attention is still the trigger for everything novel.

**Closure.** Per-persona goal loops driven by their operating-spec sections 9 / 11 / 13. The substrate provides:
1. A typed read API into world state (registers, event store, recon findings, open escalations addressed-to-this-agent).
2. A goal-derivation loop hook on the runner: "given (mandate, world-state, recent-runs), produce the next `AgentDecision` or `AgentEscalation`".
3. A planning trace recorded as events for audit (Vera reads).

The substrate provides the loop; each persona's run-handler implements its own goal-derivation logic (LLM-backed, rule-based, or hybrid). Slice 3 below — *spec-only* under this decision.

---

## 4. Slice plan — what to authorise now

### Slice 1 — Local cron driver + scheduler-tick + build-phase persistent host (closes Gap 1; bundles Gap 2 build-phase fixture)

**Scope.** Add a `launchd` plist (macOS) that runs `bun run scheduler:tick` from the prototype directory every 1 minute, with stdout/stderr piped to a rotating log under `~/Library/Logs/scrooge/scheduler-tick.log`. Equivalent `systemd` user unit for Linux. Plist under version control at `prototype/scripts/launchd/com.scrooge.scheduler-tick.plist` with install / uninstall scripts. Documented in `prototype/scripts/README.md` so the install is reproducible.

**Acceptance criteria.**
1. `launchctl bootstrap gui/$(id -u) /path/to/plist` registers the job; `launchctl print` confirms it.
2. After 5 minutes, the log shows ≥4 successful `scheduler:tick — done` lines (one per minute).
3. Closing the dashboard process (`prototype/dashboard/server.ts`) does NOT stop the scheduler tick (proves Gap 2 build-phase fixture).
4. After 30 minutes, querying the event store shows ≥30 `ScheduledTrigger` audit events with timestamps spaced ≈1 min apart, and lifecycle-paired runs for any handler whose `cronExpression` fired.
5. `inactivityCheck()` emits a `SubstrateAlert` if any agent's lifecycle-pair gap exceeds its declared inactivity SLA.

**Estimated PR count.** 1 PR (plist + install scripts + README + scheduler-tick log-rotation flag if needed).

**Owner-recommendation.** Atlas (substrate). Co-routed: Devon (operational accountability — laptop-as-build-phase-host is a Devon ops decision); Senna (review the logging surface for credential leakage).

**Caveat.** The 27 existing GH-Actions cron workflows continue to run in parallel. They are stateless w.r.t. the local scheduler-tick; the new fixture adds a path, doesn't replace one. A separate (later) decision can deprecate the GH-Actions workflows once the launchd driver has stable telemetry — that's a follow-on, not Slice 1 scope.

### Slice 2 — Trigger-spec ↔ handler-metadata symmetry recon + remediation batch (closes Gap 3)

**Scope.** Author `prototype/platform/recon/trigger-spec-handler-symmetry.ts` modelled on existing recon pipelines (e.g. `prototype/platform/recon/cron-map-drift.ts`). Pipeline parses each `Team/<Name>.md` §7 table, extracts triggers (typed-event names + cadence-row labels), diffs against `HANDLERS_METADATA` per agent, emits one `AuditFinding` per missing-handler row and one per handler-without-spec-row. Remediation batch follows: for each missing-handler, either author the handler stub (if the persona-owner agent can be dispatched) or downgrade the spec row to `[deferred]` to record intent.

**Acceptance criteria.**
1. `bun run recon:trigger-spec-handler-symmetry` runs against current `main` and produces a numeric finding count matching the audit in §3 above (≈73 missing-handlers).
2. Pipeline registered in the recon harness; `bun run recon:all` includes it.
3. Vera's overnight-recon picks it up automatically (it walks the harness).
4. Remediation batch closes ≥80% of findings within 1 substrate cadence (definition: stub handler exists; metadata row exists; permission policy reissues to include the new row).
5. Residual findings (the ≤20%) carry an explicit `[deferred-by-persona-owner]` annotation in the spec row.

**Estimated PR count.** 1 PR (recon pipeline) + N small per-agent stub PRs (auto-fanout via the existing agent-dispatch path; ≈8–12 PRs).

**Owner-recommendation.** Atlas (the recon pipeline) + Vera (review the finding shape against Wave-4 mandate-coverage). Per-persona stubs dispatched to the persona owner.

### Slice 3 — Per-persona goal-loop substrate (closes Gap 4 — *spec-only* under this decision)

**Scope.** *Spec only* under this decision. The spec covers:
1. The typed read-API into world state — `AgentWorldStateReader` interface in `prototype/platform/agent-runtime/world-state.ts` (or named seam).
2. The goal-derivation hook on `AgentRunner` — `runWithGoal({ agent, worldState, recentRuns }) → AgentDecision | AgentEscalation | null`.
3. The planning-trace event shapes — `AgentGoalEvaluated`, `AgentGoalSelected`, `AgentGoalDeferred` (audit-readable).
4. The contract for an agent's run-handler implementation — what it MUST consume (mandate from §9/§11/§13), what it MUST emit (decision/escalation events), what's optional (LLM call vs rule engine).
5. Per-persona dispatch plan — which 4–6 personas get goal-loops first (recommend: Vera, Mira, Owen, Bea, Atlas — the personas whose mandate is most-clearly typed against existing event streams).

**Acceptance criteria for Slice 3 *spec*.**
1. Spec landed at `Owner Inbox/<date>_atlas_per-persona-goal-loop-substrate.md` with frontmatter + §1–§10 (purpose, principles applied, interface seams, world-state read-API, goal-derivation contract, per-persona phasing, threat-model gate routed to Senna+Rashida, Vera audit-event shapes, dependencies, open items).
2. Senna+Rashida gate the spec before any build (Principle 4 — designed-in).
3. Vera reviews the planning-trace event shapes for Wave-5 capability-creep recon compatibility.
4. Each per-persona build is a separate dispatch under per-persona authorisation; no part of Slice 3 ships agent goal-loops under THIS decision.

**Why spec-only.** Goal-loops are the substrate's largest design risk. Wrong primitives here = capability creep, undetected misaligned action, or worse, autonomous operation outside any procedure (Principle 6 violation). The spec is the gate; the build is per-persona work that Marc can size individually.

**Estimated PR count.** 1 PR (the spec file). Build PRs follow under per-persona dispatches and are not in scope here.

**Owner-recommendation.** Atlas (substrate spec) co-authored with Senna (security primitives), Rashida (CISO sign-off), Vera (audit-event shapes), Anya (world-state read-API ↔ semantic layer).

### Gap 2 — split treatment

- **Build-phase fixture:** bundled into Slice 1 (launchd persistence).
- **Licence-day production host:** **deferred** under this decision; re-routed via the existing Azure-migration workstream when that is scheduled. Per `project_cloud_target_azure` memory, Azure is the eventual production cloud; per `project_ai_driven_bank` memory, real always-on infra binds at licence-day, not build-phase. Honest framing: build-phase doesn't need cloud; licence-day does; the seam between is owned by the Azure-migration workstream, not by this brief.

---

## 5. Supersession recommendation

This brief **supersedes** [`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`](2026-05-07_atlas_agent-runtime-substrate-spec.md). The original spec authored A0–A5 + M8 as one omnibus; the work substantively shipped under the standing CEO decisions S8 (`D-AGENT-RUNTIME-AUTHORIZE`, 2026-05-08), `D-A22-RETIRE-LEGACY` (2026-05-08), and the S7-Targeted batch (2026-05-08). The 2026-05-07 brief carrying `decision-required: true` in its frontmatter is **stale** — the dashboard surfaces it as an open decision when the underlying scope is actioned.

**Recommended action on CEO approval of THIS brief:**
1. Move `Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md` → `Owner Inbox/actioned/2026-05-07_atlas_agent-runtime-substrate-spec_[SUPERSEDED-BY-D-AGENT-AUTONOMY-OPERATIONAL].md`.
2. Append a footer note to the moved file: *"Superseded 2026-05-11 by D-AGENT-AUTONOMY-OPERATIONAL. A0–A5 substantively shipped under S8 + D-A22-RETIRE-LEGACY + S8 Tier 1 (PR #189); residual operational gaps re-scoped under the superseding brief."*
3. Emit a `CeoDecision` event for `D-AGENT-AUTONOMY-OPERATIONAL` per Principle 1 (events as truth) — Scrooge's `ceo-decision-record` handler does this on chat-intake of the CEO's approval.

The original D-AGENT-RUNTIME-AUTHORIZE decision-id was effectively answered by S8 in practice; this brief makes the supersession explicit and gives the residual work its own decision-id.

---

## 6. Substrate gaps surfaced (Principle 7 inventory transparency)

| Gap | Owner | Trigger to close |
|---|---|---|
| No always-on local daemon driving `scheduler:tick` (Gap 1) | Atlas | CEO approval of Slice 1; launchd plist committed; install verified |
| Build-phase persistent host beyond terminal lifetime (Gap 2 build-phase) | Atlas (build) · Devon (Chief Operating Officer, governance) | Slice 1 (launchd survives terminal close) |
| Production-grade always-on host (Gap 2 licence-day) | Atlas (substrate) · Devon (operational accountability) | Azure-migration workstream scheduling (out of this brief) |
| Trigger-spec ↔ handler-metadata symmetry (Gap 3) | Atlas (recon) · per-persona owners (remediation) | CEO approval of Slice 2; recon pipeline + remediation batch lands |
| Per-persona goal-pursuit substrate (Gap 4) | Atlas (substrate spec) · Senna + Rashida (threat-model gate) · per-persona owners (build) | CEO approval of Slice 3 spec; threat-model gate clears; per-persona builds dispatched separately |
| Permission gate default-off (T-01 Critical, Senna+Rashida threat model 2026-05-10) | Atlas (substrate) · Senna · Rashida | Separate decision `D-T-01-PERMISSION-GATE-SECURE-DEFAULT` (already routed) |
| A2.2 Phase 2 (delete legacy fan-out) | Atlas | Re-confirmation per `D-A22-RETIRE-LEGACY` Phase-2 gating criteria; out of this brief |
| 27 GH-Actions cron workflows continue in parallel with launchd driver | Atlas · Devon | Follow-on decision after Slice 1 stabilises (≥1 substrate cadence of clean telemetry) |
| Spec-parser does not capture scheduled / natural-language triggers (Gap #2 from S8 §3.1) | Atlas | Bundled into Slice 2 remediation (parser extends to non-typed triggers) |
| Vera Wave-5 capability-creep recon | Vera · Atlas | Vera's separate Wave-5 dispatch; out of this brief |

---

## 7. Citation chain

**Standing principles** — `CLAUDE.md` Principles 1, 2, 3, 4, 6, 7 (full text in `/Principles/`):
- `Principles/1-events-are-truth.md`
- `Principles/2-citation-discipline.md`
- `Principles/3-cloud-native.md`
- `Principles/4-security-designed-in.md`
- `Principles/6-single-graph-discipline.md`
- `Principles/7-autonomous-by-default.md`

**Original spec (superseded by approval of this brief):**
- [`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`](2026-05-07_atlas_agent-runtime-substrate-spec.md)

**Approved decisions referenced:**
- `D-AGENT-RUNTIME-AUTHORIZE` (S8) — CEO-approved 2026-05-08 — record at [`Owner Inbox/2026-05-08_scrooge_ceo-decision-record_s8.md`](2026-05-08_scrooge_ceo-decision-record_s8.md).
- `S7` (substrate-completeness budget) — CEO-approved 2026-05-08 — record at [`Owner Inbox/2026-05-08_scrooge_ceo-decision-record_s7.md`](2026-05-08_scrooge_ceo-decision-record_s7.md).
- `D-A22-RETIRE-LEGACY` (Phase 1 cutover) — CEO-approved 2026-05-08 — record at [`Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-a22-retire-legacy.md`](2026-05-08_scrooge_ceo-decision-record_d-a22-retire-legacy.md); spec at [`Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md`](2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md).

**Predecessor substrate-state runs:**
- [`Owner Inbox/2026-05-10_atlas_s8-substrate-state-and-next-slice.md`](2026-05-10_atlas_s8-substrate-state-and-next-slice.md) (v1).
- [`Owner Inbox/2026-05-10_atlas_s8-substrate-state-v2.md`](2026-05-10_atlas_s8-substrate-state-v2.md) (v2).
- [`Owner Inbox/2026-05-10_atlas_s8-a4-fleet-rollout.md`](2026-05-10_atlas_s8-a4-fleet-rollout.md) (fleet rollout / 27 personas registered).
- [`Owner Inbox/2026-05-10_atlas_agent-runner-worker-isolation-spike.md`](2026-05-10_atlas_agent-runner-worker-isolation-spike.md) (worker isolation primitive).

**Threat model (Principle 4 designed-in):**
- [`Owner Inbox/2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md`](2026-05-10_senna-rashida_agent-runtime-substrate-threat-model.md) (12 threats; T-01 Critical permission-gate default-off).

**Memory anchors (CLAUDE.md user memory):**
- `project_ai_driven_bank` — bank is real SARB-licensed institution; build-phase has defined endpoint at pre-licence go-live readiness gate; capital / customers / employees only at licence-day.
- `project_cloud_target_azure` — Microsoft Azure is the bank's eventual production cloud; local dev built lift-compatible.
- `project_session_2026_05_10` — S8 Tier 1 (PRs #185–#187 + #188) — fleet of 27 personas registered, AgentRunner lifecycle wrapper, worker-isolation primitive, dashboard CeoDecision backfill.
- `feedback_pre_dispatch_merge_check` — pre-dispatch live-check (this brief was authored after verifying the predecessor briefs are still live and not actioned).

**Source policies:**
- Information Security Policy (`ORG-CY-*` rows in `Regulations/_obligations-register.md`).
- Cyber Resilience Policy (Joint Standard 1 of 2024 — `JS1/2024`).
- Operational Risk Policy (Joint Standard 2 of 2024 — `JS2/2024`).
- Change Management Policy (the substrate change cadence binds here).
- Secure SDLC Policy (the threat-model gate and signed-builds requirement).

**Source regulations:**
- Banks Act 94 of 1990 (the substrate hosts the operational realisation of the AI-bank's labour force).
- Joint Standard 1 of 2024 (cyber resilience — the substrate must operate under this once licence-day binds).
- Joint Standard 2 of 2024 (operational risk — the substrate is an operational-resilience-relevant capability, per spec §8).
- BCBS principles on operational resilience.
- POPIA s.71 (automated decisioning — the oversight UI carries the standing notice).

—Atlas (Core banking platform architect; substrate)
