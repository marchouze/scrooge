/// <reference lib="WebWorker" />
// platform/agent-runtime/worker-entry.ts
//
// S8 §3.4 A4 — Bun Worker entry-point for out-of-process agent isolation.
//
// This file is loaded by `new Worker(...)` in `bun-worker-bus-runner.ts`.
// Each agent run gets its own Worker thread — crash isolation, memory
// separation, and a clean seam for the M8 Container Apps Jobs lift.
//
// Protocol (Web Worker API):
//   - Host → Worker: `WorkerInMessage` via `worker.postMessage()`
//   - Worker → Host: `WorkerOutMessage` via `self.postMessage()`
//
// Design note — event-store path:
//   Handlers import `eventStore` from `platform/composition`, which reads
//   `BANK_EVENT_DB` at module initialisation. Because Bun Workers are
//   separate thread contexts with their own module graphs, the composition
//   module is initialised fresh inside the worker. The worker inherits
//   `BANK_EVENT_DB` (and all other env vars) from the host process, so the
//   worker's composition root points at the same database automatically.
//   The `eventDbPath` in the message is an override: if the caller needs
//   the worker to target a *different* database (e.g. in tests), it sets
//   `process.env.BANK_EVENT_DB` here before triggering the dynamic import
//   of `runAgent`.
//
// Author: Atlas (Core banking platform architect, engineering)

// ---------------------------------------------------------------------------
// Message types (re-exported so bun-worker-bus-runner.ts can import them)
// ---------------------------------------------------------------------------

export interface WorkerInMessage {
  readonly agent: string;
  readonly trigger: string;
  /** Absolute path to the event store SQLite file.
   *  If provided, overrides BANK_EVENT_DB for this worker's composition root.
   *  The module-init trick only works because Bun Worker module graphs are
   *  freshly initialised per-worker; the env mutation happens before the
   *  first import that reads it. */
  readonly eventDbPath: string;
  readonly worktreeRoot: string;
  readonly dryRun?: boolean;
}

export interface WorkerOutMessage {
  readonly ok: boolean;
  readonly eventsEmitted: number;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Worker boot
// ---------------------------------------------------------------------------

self.onmessage = async (ev: MessageEvent<WorkerInMessage>) => {
  const msg = ev.data;

  // Override the event-db path before any module that reads BANK_EVENT_DB
  // has been imported. Static imports in this file (above) do not touch
  // composition; the `runAgent` import below is the first composition
  // consumer. Setting BANK_EVENT_DB here ensures the worker's composition
  // root points at the right database.
  if (msg.eventDbPath) {
    process.env.BANK_EVENT_DB = msg.eventDbPath;
  }
  if (msg.worktreeRoot) {
    process.env.BANK_REPO_ROOT = msg.worktreeRoot;
  }

  // Dynamic import defers composition-root init until after the env override.
  // This is intentional: do not convert to a static import.
  const { runAgent } = await import("../../runtime/run");

  let ok = false;
  let eventsEmitted = 0;
  let error: string | undefined;

  try {
    const output = await runAgent({
      agent: msg.agent,
      trigger: msg.trigger,
      dryRun: msg.dryRun ?? false,
    });
    ok = output.ok;
    eventsEmitted = output.eventsEmitted;
    if (!output.ok) {
      error = output.summary;
    }
  } catch (err) {
    ok = false;
    error = (err as Error).message ?? String(err);
  }

  self.postMessage({
    ok,
    eventsEmitted,
    ...(error !== undefined ? { error } : {}),
  } satisfies WorkerOutMessage);
};
