// platform/scheduler/index.ts
//
// A2.1 — Scheduler component interface.
//
// Wakes scheduled agents per their persona-spec §6 cadence. Implemented
// as a deterministic event-emitting clock per Atlas runtime spec §3.2:
// each tick reads the schedule registry (derived from registered
// agents — A1.1), computes "next-due-at" via cron, and emits a
// `ScheduledTrigger` event when due. The scheduler also runs an
// inactivity-SLA check that emits `SubstrateAlert` when an agent's
// expected event hasn't landed within window.
//
// Per Principle 1 (events as truth), the scheduler holds NO authoritative
// in-memory state across processes. Re-derivation on every invocation
// is the discipline; the event log records `ScheduledTrigger`,
// `SubstrateAlert`, and (for the schedule registry) reads from the
// `AgentRegistered` stream A1.1 maintains. Stored projections, if any,
// are caches reproducible from the event log.
//
// Substrate seams (Atlas runtime spec §5):
//   - Local: Bun-process polling SQLite (this file's `LocalScheduler`).
//   - Cloud (M8): Azure Container Apps Jobs (cron) + Logic Apps for
//     natural-language schedules. Same `Scheduler` interface; swap the
//     implementation in composition.ts.
//
// What this slice does NOT do (deferred):
//   - Dispatch the agent handler. The scheduler emits the event;
//     A2.2's event-trigger bus reads `ScheduledTrigger` and fans to
//     the runtime handler. Until A2.2 lands, the GH Actions cron files
//     keep firing handlers in parallel — A2.1's events are an audit-
//     trail record + a stepping stone.
//   - Cross-process scheduling. The local scheduler is single-process
//     today; multi-process coordination (leader-election / lease) lands
//     with the cloud-bus migration.
//   - Variable-date holidays (Easter / Family Day) — see calendar.ts.
//
// Author: Atlas (A2.1)
//
// Interface definitions live in ./types.ts (extracted to break the
// barrel → implementation → barrel cycle; F-019 fix). Re-exported here
// for back-compat with existing callers.

export type {
  FiredTrigger,
  InactivityCheckResult,
  InactivityFinding,
  InactivityFindingClass,
  ScheduleEntry,
  Scheduler,
  SyncResult,
  TickResult,
} from "./types";

export type { ParsedCron } from "./cron-parse";
export { LocalScheduler } from "./scheduler";
