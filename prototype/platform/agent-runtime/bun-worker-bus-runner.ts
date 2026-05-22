// platform/agent-runtime/bun-worker-bus-runner.ts
//
// S8 §3.4 A4 — BunWorkerBusRunner: implements BusRunner using Bun Worker threads.
//
// Each agent invocation spawns a fresh Bun Worker for crash isolation and
// memory separation. The worker runs `worker-entry.ts`, which calls
// `runAgent` from `runtime/run.ts` inside the worker's own module graph.
//
// Concurrency contract:
//   - `maxConcurrentPerAgent` (default 1): the number of simultaneous
//     in-flight workers for the same agent URN (keyed on the first two
//     segments of the handlerKey, e.g. `agent:vera`).
//   - If the agent is already at cap, a `SubstrateAlert{integrity,medium}`
//     is emitted and `{ ok: false, eventsEmitted: 0 }` is returned without
//     spawning a worker.
//   - `timeoutMs` (default 60_000): the worker is terminated if it has not
//     responded within this window; a `SubstrateAlert{latency,high}` is
//     emitted.
//
// Seam for M8: the `workerEntryPath` config lets tests inject a noop worker
// path; production uses the `worker-entry.ts` URL resolved at import time.
//
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";

import { makeSubstrateAlert } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { logger } from "../observability/logger";
import type { BusRunner, BusRunnerResult } from "../event-trigger-bus/bus";
import type { WorkerInMessage, WorkerOutMessage } from "./worker-entry";
import { newEventId } from "../core/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface BunWorkerBusRunnerConfig {
  readonly eventStore: EventStore;
  /** Absolute path to the SQLite event database. Passed into the worker
   *  so it can override BANK_EVENT_DB before loading composition. */
  readonly eventDbPath: string;
  /** Absolute path to the worktree root. Passed to the worker so it can
   *  set BANK_REPO_ROOT and install the RunnerWorker boundary shim. */
  readonly worktreeRoot: string;
  /** Maximum simultaneous in-flight workers per agent URN. Default: 1. */
  readonly maxConcurrentPerAgent?: number;
  /** Worker response timeout in milliseconds. Default: 60_000. */
  readonly timeoutMs?: number;
  /** Actor for SubstrateAlert events emitted by this runner. */
  readonly actor?: Actor;
  /** Legal entity for SubstrateAlert events. */
  readonly entity?: string;
  /**
   * Override the worker entry-point URL. In production this defaults to
   * `./worker-entry.ts` (resolved relative to this file). Tests inject a
   * noop worker path via this option to avoid spinning up a full runtime.
   */
  readonly workerEntryPath?: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_ENTITY = "LE-ZA-HOZ-BANK";
const DEFAULT_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:bun-worker-bus-runner",
};
const CITATIONS: readonly string[] = [
  "D-AGENT-RUNTIME-AUTHORIZE",
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-2-2024",
  "ORG-CY-09",
];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a `BusRunner` that dispatches each agent run in a fresh Bun Worker
 * thread, providing crash isolation and memory separation.
 */
export function createBunWorkerBusRunner(config: BunWorkerBusRunnerConfig): BusRunner {
  const maxConcurrent = config.maxConcurrentPerAgent ?? DEFAULT_MAX_CONCURRENT;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const entity = config.entity ?? DEFAULT_ENTITY;
  const actor = config.actor ?? DEFAULT_ACTOR;

  // Per-agent in-flight counter. Key: agent URN (e.g. `agent:vera`).
  const inFlight = new Map<string, number>();

  // Resolve the worker entry-point URL once at factory creation time.
  // Tests override this via `config.workerEntryPath`.
  const workerUrl = config.workerEntryPath
    ? new URL(`file://${resolve(config.workerEntryPath)}`)
    : new URL("./worker-entry.ts", import.meta.url);

  // Helper — emit a SubstrateAlert to the eventStore. Best-effort: logs on
  // append failure but does not re-throw so the caller always gets a clean
  // BusRunnerResult.
  function emitAlert(alertId: string, alertClass: "integrity" | "latency" | "capacity" | "inactivity", severity: "low" | "medium" | "high", message: string, agentUrn?: string): void {
    try {
      config.eventStore.append(
        makeSubstrateAlert({
          asOf: new Date().toISOString(),
          entity,
          actor,
          citations: [...CITATIONS],
          payload: {
            alertId,
            alertClass,
            severity,
            details: message,
            ...(agentUrn !== undefined ? { agentUrn } : {}),
          },
        }),
      );
    } catch (err) {
      logger.error(
        { alertId, err: (err as Error).message },
        "bun-worker-bus-runner — SubstrateAlert append failed",
      );
    }
  }

  // The BusRunner function.
  return async function bunWorkerBusRunner(args: {
    agent: string;
    trigger: string;
    triggeringEvents: readonly import("../event-store/types").Event[];
  }): Promise<BusRunnerResult> {
    // Derive the agent URN for in-flight tracking.
    const agentUrn = `agent:${args.agent.toLowerCase()}`;

    // Concurrency gate.
    const current = inFlight.get(agentUrn) ?? 0;
    if (current >= maxConcurrent) {
      const alertId = `alert:integrity:worker-cap-${agentUrn.replace(/[^a-z0-9]/g, "-")}-${newEventId().slice(0, 8)}`;
      logger.warn(
        { agentUrn, inFlight: current, maxConcurrent },
        "bun-worker-bus-runner — agent at in-flight cap; dispatch skipped",
      );
      emitAlert(
        alertId,
        "integrity",
        "medium",
        `bun-worker-bus-runner: agent ${agentUrn} is at in-flight cap (${current}/${maxConcurrent}); dispatch skipped`,
        agentUrn,
      );
      return { ok: false, eventsEmitted: 0 };
    }

    // Increment the in-flight counter.
    inFlight.set(agentUrn, current + 1);

    let worker: Worker | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    try {
      worker = new Worker(workerUrl, { type: "module" });

      // Race worker response against timeout.
      const result = await new Promise<WorkerOutMessage>((resolve, reject) => {
        // Timeout path.
        timeoutHandle = setTimeout(() => {
          reject(new Error(`bun-worker-bus-runner: worker timeout after ${timeoutMs}ms (agent=${agentUrn} trigger=${args.trigger})`));
        }, timeoutMs);

        // Worker success/failure.
        worker!.onmessage = (ev: MessageEvent<WorkerOutMessage>) => {
          clearTimeout(timeoutHandle);
          resolve(ev.data);
        };

        worker!.onerror = (err: ErrorEvent) => {
          clearTimeout(timeoutHandle);
          reject(new Error(err.message ?? "worker error"));
        };

        // Send the run message.
        const msg: WorkerInMessage = {
          agent: args.agent,
          trigger: args.trigger,
          eventDbPath: config.eventDbPath,
          worktreeRoot: config.worktreeRoot,
          dryRun: false,
        };
        worker!.postMessage(msg);
      });

      if (!result.ok) {
        const alertId = `alert:integrity:worker-run-failed-${agentUrn.replace(/[^a-z0-9]/g, "-")}-${newEventId().slice(0, 8)}`;
        emitAlert(
          alertId,
          "integrity",
          "high",
          `bun-worker-bus-runner: worker returned ok=false for agent=${agentUrn} trigger=${args.trigger}${result.error ? `: ${result.error}` : ""}`,
          agentUrn,
        );
      }

      return { ok: result.ok, eventsEmitted: result.eventsEmitted };
    } catch (err) {
      const errMsg = (err as Error).message ?? String(err);
      const isTimeout = errMsg.includes("worker timeout");

      if (isTimeout) {
        // Terminate the timed-out worker.
        worker?.terminate();
        const alertId = `alert:latency:worker-timeout-${agentUrn.replace(/[^a-z0-9]/g, "-")}-${newEventId().slice(0, 8)}`;
        logger.error(
          { agentUrn, trigger: args.trigger, timeoutMs },
          "bun-worker-bus-runner — worker timed out",
        );
        emitAlert(
          alertId,
          "latency",
          "high",
          `bun-worker-bus-runner: worker timeout after ${timeoutMs}ms (agent=${agentUrn} trigger=${args.trigger})`,
          agentUrn,
        );
      } else {
        // Worker crash / onerror path.
        const alertId = `alert:integrity:worker-crash-${agentUrn.replace(/[^a-z0-9]/g, "-")}-${newEventId().slice(0, 8)}`;
        logger.error(
          { agentUrn, trigger: args.trigger, err: errMsg },
          "bun-worker-bus-runner — worker error",
        );
        emitAlert(
          alertId,
          "integrity",
          "high",
          `bun-worker-bus-runner: worker error for agent=${agentUrn} trigger=${args.trigger}: ${errMsg}`,
          agentUrn,
        );
      }

      return { ok: false, eventsEmitted: 0 };
    } finally {
      clearTimeout(timeoutHandle);
      worker?.terminate();
      // Decrement the in-flight counter.
      const after = (inFlight.get(agentUrn) ?? 1) - 1;
      if (after <= 0) {
        inFlight.delete(agentUrn);
      } else {
        inFlight.set(agentUrn, after);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Re-export WorkerInMessage / WorkerOutMessage for callers
// ---------------------------------------------------------------------------
export type { WorkerInMessage, WorkerOutMessage } from "./worker-entry";
