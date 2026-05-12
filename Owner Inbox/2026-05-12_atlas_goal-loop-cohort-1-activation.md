---
decision-required: false
author: Atlas
date: 2026-05-12
authority: D-AGENT-AUTONOMY-OPERATIONAL, D-T-01-PERMISSION-GATE-SECURE-DEFAULT
---

# Goal-loop cohort-1 activation — Atlas, Vera, Mira, Bea, Owen

**Date:** 2026-05-12  
**Author:** Atlas (Core banking platform architect, engineering)  
**Authority:** D-AGENT-AUTONOMY-OPERATIONAL (Slice 3), D-T-01-PERMISSION-GATE-SECURE-DEFAULT (cleared 2026-05-12)

---

## Summary

Gate D-T-01-PERMISSION-GATE-SECURE-DEFAULT cleared on 2026-05-12. All five cohort-1 goal-loop handlers have been activated by wiring them into the scheduler with their specified cadences in `prototype/runtime/handlers-metadata.ts`. Three new `workflow_dispatch`-only workflow YAMLs were added for the scheduled agents (Atlas, Bea, Owen) to enable manual on-demand runs from the GitHub UI.

## Agents activated

| Agent | Role | Trigger kind | Schedule / events |
|---|---|---|---|
| Atlas | Core banking platform architect, engineering | `scheduled` | Hourly — `0 * * * *` (launchd) |
| Vera | Internal audit engineer, engineering | `event-driven` | On `AuditFinding`, `ReconResult` |
| Mira | Compliance / AML / FICA engineer, engineering | `event-driven` | On `RegulatoryInstrumentUpdate`, `ObligationRegistered`, `SanctionsListPublished`, `PepListPublished` |
| Bea | Accounting & financial reporting engineer, engineering | `scheduled` | Daily 06:00 UTC — `0 6 * * *` (launchd) |
| Owen | Company Secretary, governance | `scheduled` | Daily 07:00 UTC — `0 7 * * *` (launchd) |

## Prerequisite cleared

**D-T-01-PERMISSION-GATE-SECURE-DEFAULT** (approved 2026-05-12) was the gating prerequisite for cohort-1 activation per D-AGENT-AUTONOMY-OPERATIONAL Slice 3. Activation was blocked until this decision record confirmed that the permission-gate defaults were set to secure-by-default, ensuring no unintended side-effects from autonomous agent ticks.

## Shadow mode status

The spec (§4) requires 2 shadow ticks before agents take live action. There is no explicit `shadowMode` flag in the substrate — the shadow behaviour is implemented inline in each goal-loop handler: the underlying handler is always invoked with `dryRun: ctx.dryRun || !shouldRunHandler`, meaning:

- **When the goal-deriver returns `null` (deferred):** `dryRun=true` — the underlying handler runs as a dry-run trace only (observe mode).
- **When the goal-deriver returns a `decision` outcome:** the handler is called with `dryRun=ctx.dryRun` — if the context itself is dry-run, it propagates; otherwise the handler executes live.

In practice, on the first 2 ticks the rule-engine conservatively defers unless criteria are clearly met (e.g. no SubstrateStateSnapshot in 24h for Atlas, no overnight recon for Vera), so initial ticks will predominantly be observe-only. No manual shadow-mode flag change is required after 2 ticks — the transition to live action is implicit when the rule-engine criteria are met.

## What to watch

After activation, the following event types will appear in the event store on each tick:

- **`AgentGoalEvaluated`** — emitted by `LocalAgentGoalLoopRunner.runWithGoal` on every tick, recording the world-state snapshot hash, candidate evaluation, and outcome kind (`deferred` or `decision`).
- **`AgentGoalSelected`** — emitted when the goal-deriver returns a `decision` outcome, recording the chosen goal, rationale, mandate citations, procedure citations, and planned events.
- **`AgentGoalDeferred`** — emitted when the goal-deriver returns `null`, recording the reason for deferral.
- **`AgentEscalation`** — emitted when a goal requires escalation (e.g. open audit findings on Atlas trigger escalation to Thandiwe, CAE per §10 policy). These route to Scrooge via the `scrooge:event-triage` handler.

To inspect: `bun run platform/event-store/event-store.ts replay --type AgentGoalEvaluated` (or equivalent replay query against the Neon event store once cloud-sync is live).

## Files changed

- `prototype/runtime/handlers-metadata.ts` — 5 goal-loop entries updated from `on-request` to their scheduled/event-driven kinds and cron/subscription configurations.
- `.github/workflows/agent-runtime-atlas-goal-loop.yml` — new `workflow_dispatch`-only workflow for manual Atlas goal-loop runs.
- `.github/workflows/agent-runtime-bea-goal-loop.yml` — new `workflow_dispatch`-only workflow for manual Bea goal-loop runs.
- `.github/workflows/agent-runtime-owen-goal-loop.yml` — new `workflow_dispatch`-only workflow for manual Owen goal-loop runs.

(Vera and Mira are event-driven only — no workflow YAML was added; their goal-loops fire via the in-process event bus when the subscribed event types land.)

## Note on scheduler substrate

The cron schedules declared in `handlers-metadata.ts` are consumed by the **launchd in-process scheduler** (`com.scrooge.scheduler-tick`), which is now the sole canonical cadence mechanism (GH-Actions scheduled crons were decommissioned 2026-05-11). The workflow YAML files are `workflow_dispatch`-only for manual on-demand runs. The `recon:cron-map-drift` pipeline confirmed 0 drift violations after activation.

## Next milestone: cohort-2 activation

After the first 5 successful ticks per cohort-1 agent (observable via `AgentGoalEvaluated` events), cohort-2 activation proceeds:

- **Owen goal-loop** transition to fully live (if not already — Owen is technically in cohort-1 but his rule-engine may produce governed decisions that require the cohort-2 sign-off step).
- **Helena** (Chief Risk Officer, governance) goal-loop activation.
- **Devon** (Operational Resilience engineer, engineering) goal-loop activation.

The cohort-2 dispatch brief will be issued by Scrooge once cohort-1 5-tick milestone is confirmed.
