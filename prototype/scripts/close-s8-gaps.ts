#!/usr/bin/env bun
// Close S8 substrate gaps 2–7 + A2.1 with WorkstreamCompleted events.
// All gaps are functionally implemented; this records formal closure.
// Authority: D-AGENT-RUNTIME-AUTHORIZE (approved), D-S8-A4-CLOSE (approved).
import { EventStore } from "../platform/event-store/store.ts";
import { makeWorkstreamCompleted } from "../platform/event-store/event-types/agent-substrate-extended.ts";
import { resolveEventDbPath } from "../platform/event-store/resolve-event-db.ts";

const db = new EventStore(resolveEventDbPath().path);
const now = new Date().toISOString();

const GAPS: Array<{
  workstreamId: string;
  title: string;
  deliverableSummary: string;
}> = [
  {
    workstreamId: "workstream:atlas:substrate-gap-2",
    title: "Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered",
    deliverableSummary:
      "All typed payload schemas live in platform/event-store/event-types/agent-substrate-extended.ts. AgentEscalation, AgentDecision, WorkstreamRegistered, WorkstreamCompleted, SubstrateAlert, ScheduledTrigger, AgentPerformanceEvaluated all carry z.object schemas and makeXxx factory functions. Registry validated by event-type-coverage recon gate.",
  },
  {
    workstreamId: "workstream:atlas:substrate-gap-3",
    title: "Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class",
    deliverableSummary:
      "All three trigger kinds implemented: (1) scheduled — LocalScheduler + ScheduledTriggerConsumer emit and consume ScheduledTrigger events; (2) event-driven — EventTriggerBus routes events to subscribed handlers; (3) on-request — runAgent() callable directly. Handler metadata carries cronExpression for scheduled triggers. BunWorkerBusRunner provides isolation per-trigger.",
  },
  {
    workstreamId: "workstream:atlas:substrate-gap-4",
    title: "Claude API integration for agent-narrative output: ROLLED OUT",
    deliverableSummary:
      "Claude Sonnet API integrated via Anthropic SDK; agent handlers call the API for narrative generation. Used in atlas-substrate-state, goal-deriver, and other narrative-producing handlers. API key resolved from ~/.config/bank/.env.",
  },
  {
    workstreamId: "workstream:atlas:substrate-gap-5",
    title: "Projection-cache persistence: closed by anya:projection-refresh",
    deliverableSummary:
      "anya:projection-refresh handler subscribes to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision events and re-derives the dashboard projection, writing to prototype/.local/dashboard-state.json. D-EVENT-STORE-SCALING Slice 3a (PR #138) split this off the seed; Slice 3b removed the committed cache entirely.",
  },
  {
    workstreamId: "workstream:atlas:substrate-gap-6",
    title: "Citation gate: now wrapped as mira:citation-gate (on-request)",
    deliverableSummary:
      "Citation gate wrapped as mira:citation-gate handler. Runs as on-request trigger via bun run citation-gate; also wired into CI gate. Zero-violation enforcement active on every PR push (pre-push hook + ci:core). Authority: D-DATA-QUALITY-GOLDEN-SOURCE-V1.",
  },
  {
    workstreamId: "workstream:atlas:substrate-gap-7",
    title: "GitHub Actions cron: scheduler-tick dispatched on Actions schedule",
    deliverableSummary:
      "substrate-scheduler.yml workflow runs scheduler-tick on Actions cron schedule. 42 agent-runtime workflows exist covering all registered agents. Cron-map-drift recon gate asserts workflow cron expressions match handlers-metadata.ts derivedCronMap(). Pre-run/post-run event store sync via BANK_EVENT_DB_URL Neon secret. Cron unreliability on lid-close is launchd-specific; Actions cron is the production surface.",
  },
  {
    workstreamId: "A2.1-substrate-scheduler",
    title: "A2.1 — Substrate scheduler: Bun process emitting typed ScheduledTrigger events",
    deliverableSummary:
      "LocalScheduler (platform/scheduler/scheduler.ts) fully operational. scheduler-tick CLI: syncRegistry from registered-agent stream + handler metadata, tick() emits ScheduledTrigger events for due fire-times, ScheduledTriggerConsumer dispatches handlers idempotently via BusDispatched. Inactivity SLA check and escalation enforcement also run per tick. Auto-commits archive outputs with 5-attempt push retry.",
  },
];

let emitted = 0;
for (const gap of GAPS) {
  const evt = makeWorkstreamCompleted({
    asOf: now,
    entity: "bank",
    actor: { type: "system", id: "atlas" },
    citations: ["D-AGENT-RUNTIME-AUTHORIZE", "D-S8-A4-CLOSE"],
    payload: {
      workstreamId: gap.workstreamId,
      title: gap.title,
      owner: "Atlas (Core banking platform architect)",
      completedAt: now,
      outcome: "delivered",
      deliverableSummary: gap.deliverableSummary,
    },
  });
  db.append(evt);
  console.log(`✓ WorkstreamCompleted: ${gap.workstreamId}`);
  emitted++;
}

console.log(`\nEmitted ${emitted} WorkstreamCompleted events. S8 substrate gaps 2–7 + A2.1 formally closed.`);
