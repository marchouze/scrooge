// platform/scheduler/types.ts
//
// Pure interface definitions for the scheduler component.
// Extracted from index.ts so that scheduler.ts can import from this
// leaf module rather than from the barrel (index.ts), breaking the
// circular dependency:
//   scheduler.ts → index.ts → scheduler.ts  (cycle 4, F-019 fix)
//
// All consumers should import interfaces from this file; index.ts re-exports
// them for back-compat with existing callers.
//
// Author: Atlas (Core banking platform architect, engineering)

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

/**
 * Discriminator for the kind of inactivity the recon caught. Vera's
 * Wave-4 #13 inactivity-SLA pipeline filters on this — `orphaned-run`
 * is operationally distinct from `stale-runs` (the former is a runner
 * that died mid-flow; the latter is a runner that hasn't fired at all
 * for a while).
 *
 *   - `no-runs`       — agent has never emitted a `SubstrateAgentRunStarted`.
 *   - `stale-runs`    — most recent paired close (`SubstrateAgentRunCompleted`
 *                       or `SubstrateAgentRunFailed`) is older than the SLA.
 *   - `orphaned-run`  — a `SubstrateAgentRunStarted` exists with no closing
 *                       event and `(now - startedAt) > SLA`.
 */
export type InactivityFindingClass = "no-runs" | "stale-runs" | "orphaned-run";

export interface InactivityFinding {
  readonly agentUrn: string;
  readonly triggerId: string;
  readonly alertId: string;
  readonly slaHours: number;
  /**
   * Hours since the last *closed* run (`SubstrateAgentRunCompleted` or
   * `…Failed`). For `findingClass: "no-runs"` this is `Number.POSITIVE_INFINITY`.
   * For `findingClass: "orphaned-run"` this is hours since the orphan
   * `…Started`.
   */
  readonly hoursSinceLastEvent: number;
  readonly details: string;
  /** What kind of inactivity was caught — see {@link InactivityFindingClass}. */
  readonly findingClass: InactivityFindingClass;
  /**
   * For `findingClass: "orphaned-run"`, the runId of the unclosed run.
   * Undefined for the other two classes.
   */
  readonly orphanedRunId?: string;
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
   * `SubstrateAlert` (alertClass=inactivity) when no expected
   * substrate run has closed inside the window.
   *
   * Recon input: pair-coupled `SubstrateAgentRunStarted` /
   * `SubstrateAgentRunCompleted` / `SubstrateAgentRunFailed` lifecycle
   * events (S8 spec §3.4). The fold isolates real run lifecycle from
   * substrate infrastructure noise — the previous heuristic ("any
   * event by agent") false-greened when the scheduler's own
   * `SubstrateAlert` or the bus's `BusDispatched` attributed to the
   * agent's URN.
   *
   * Three finding classes (see {@link InactivityFindingClass}):
   *   - `no-runs`       — never started.
   *   - `stale-runs`    — last close older than SLA.
   *   - `orphaned-run`  — started but unclosed within SLA.
   *
   * Idempotency: alert ids are stable per (agent, trigger, class)
   * so re-running before a closing event lands does not duplicate
   * the alert (the registry is `latest-wins-per-key` on the alert).
   */
  inactivityCheck(now: Date): InactivityCheckResult;
}
