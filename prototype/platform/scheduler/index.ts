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

import type { ParsedCron } from "./cron-parse";

/**
 * One entry in the schedule registry. Derived from a registered
 * agent's persona spec §6 cadence + the runtime's handlers-metadata
 * (which carries the cron expression today as the canonical source —
 * the persona spec's cadence text is human-readable).
 */
export interface ScheduleEntry {
  /** URN of the agent the schedule fires for. */
  readonly agentUrn: string;
  /** Trigger id from the persona spec § 7 / handlers-metadata. */
  readonly triggerId: string;
  /** The cron expression that produces fire times. */
  readonly cronExpression: string;
  /** Pre-parsed form. */
  readonly parsed: ParsedCron;
  /** Calendar context — P5 jurisdiction code. */
  readonly jurisdiction: string;
  /**
   * Whether the schedule should fire on a public holiday. Default
   * false (skip + shift).
   */
  readonly runOnHoliday: boolean;
}

/**
 * Outcome of `syncRegistry`. Idempotent — re-running with no changes
 * yields zero diffs.
 */
export interface SyncResult {
  readonly entries: readonly ScheduleEntry[];
  /** Number of entries derived (one per scheduled handler). */
  readonly count: number;
  /** Cron expressions that failed to parse, with reasons. */
  readonly parseFailures: readonly { agentUrn: string; triggerId: string; reason: string }[];
}

/** A `ScheduledTrigger` event emitted by `tick`. */
export interface FiredTrigger {
  readonly agentUrn: string;
  readonly triggerId: string;
  readonly cronExpression: string;
  readonly scheduledFor: string;
  readonly firedAt: string;
  readonly delayMs: number;
  readonly jurisdiction: string;
  readonly holidayShiftedFrom?: string;
}

export interface TickResult {
  readonly firings: readonly FiredTrigger[];
  /**
   * Entries the tick considered but didn't fire (already-fired-for-
   * this-fire-time, not yet due, etc.). Useful for diagnostic logs.
   */
  readonly considered: number;
}

export interface InactivityFinding {
  readonly agentUrn: string;
  readonly triggerId: string;
  readonly alertId: string;
  readonly slaHours: number;
  readonly hoursSinceLastEvent: number;
  readonly details: string;
}

export interface InactivityCheckResult {
  readonly findings: readonly InactivityFinding[];
  readonly considered: number;
}

export interface Scheduler {
  /**
   * Derive the schedule registry from registered agents. Re-runs
   * idempotently — folds the `AgentRegistered` stream + the runtime's
   * handlers-metadata for cron expressions.
   */
  syncRegistry(now: Date): SyncResult;

  /**
   * Single tick — for any schedule entry whose next-fire time is at-
   * or-before `now` AND has not already been fired for that exact
   * fire-time, emit a `ScheduledTrigger` event.
   *
   * Idempotency: the dedup key is `(agentUrn, triggerId, scheduledFor)`.
   * The function reads existing `ScheduledTrigger` events from the log
   * and skips fire-times already recorded.
   */
  tick(now: Date): TickResult;

  /**
   * Inactivity check — for each scheduled entry, compute the SLA
   * window (read from the persona spec § 6, fall back to
   * `cadenceHours * 1.5` from handlers-metadata) and emit a
   * `SubstrateAlert` (alertClass=inactivity) when no expected event
   * has landed inside the window.
   *
   * Idempotency: alert ids are stable per (agent, trigger) so re-
   * running before a new event lands does not duplicate the alert
   * (the registry is `latest-wins-per-key` on the alert).
   */
  inactivityCheck(now: Date): InactivityCheckResult;
}

export type { ParsedCron } from "./cron-parse";
export { LocalScheduler } from "./scheduler";
