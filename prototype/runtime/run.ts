// runtime/run.ts
//
// Agent-runtime entry point. Invoked by:
//   - bun run agent:vera-overnight     (npm script in package.json)
//   - GitHub Actions scheduled workflow (.github/workflows/agent-runtime-*.yml)
//
// Resolves the handler for `<agent>:<trigger>`, builds an AgentRunContext,
// invokes the handler, logs the result. Idempotency, citation discipline,
// and event emission are the handler's responsibility — the runtime only
// builds the context and reports the outcome.
//
// MVP scope: handler resolution by static import map. V1 broadens to a
// handler registry that scans /runtime/agents/.
//
// D-A22-RETIRE-LEGACY Phase 1 — bus-canonical, legacy-shadow
// ----------------------------------------------------------
// Authority:
//   - D-A22-RETIRE-LEGACY Phase 1 (CeoDecision, 2026-05-08, dashboard /api/decide)
//   - D-AGENT-RUNTIME-AUTHORIZE (resolved 2026-05-07; A0–A3 substrate)
//   - Principle 1 (events as truth — BusDispatched is the canonical
//     dispatch record; LegacyFanoutShadowed is Phase-1 evidence)
//   - Principle 6 (autonomous by default — bus runs unattended)
// Source-of-truth spec:
//   Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md
//
// Topology under Phase 1:
//   - The LocalEventTriggerBus is the canonical event-driven dispatcher.
//     `runAgent` ticks the bus at the end of every run, so every
//     event-driven handler is invoked exactly once, by the bus.
//   - The legacy in-process fan-out below (lines following) is preserved
//     in code but runs in shadow mode: it walks the new-events set and
//     emits a typed `LegacyFanoutShadowed` event per (parent run,
//     triggered handler key) row, but does NOT invoke the handler.
//     Vera's Wave-4 #13b parallel-dispatch-divergence pipeline reads
//     the shadow events and reconciles them against `BusDispatched`.
//   - Single-commit rollback: setting `LEGACY_FANOUT_MODE` back to
//     `"active"` and removing the bus-tick hook restores prior behaviour
//     (the bus continues to run via manual `bun run bus:tick`). This is
//     the gating criterion called out in the spec §5.1.
//
// Phase 2 (separate decision; not implemented here) deletes the legacy
// fan-out, this mode constant, and the LegacyFanoutShadowed event type.
//
// Author: Atlas

import { resolve } from "node:path";

import { randomBytes } from "node:crypto";

import { WorktreeBoundaryError, createRunnerWorker } from "../platform/agent-runtime/runner-worker";
import { clock, eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import {
  makeLegacyFanoutShadowed,
  makeSubstrateAgentRunCompleted,
  makeSubstrateAgentRunFailed,
  makeSubstrateAgentRunStarted,
  makeSubstrateAlert,
} from "../platform/event-store/event-types";
import type { Actor } from "../platform/event-store/types";
import { LocalEventTriggerBus, defaultBusSource } from "../platform/event-trigger-bus";
import { logger } from "../platform/observability/logger";
import { HANDLER_CALLABLES } from "./handler-callables";
import { HANDLERS_METADATA, type HandlerMetadata } from "./handlers-metadata";
import type { AgentRunContext, AgentRunHandler, AgentRunOutput } from "./types";

interface HandlerEntry {
  readonly metadata: HandlerMetadata;
  readonly handler: AgentRunHandler;
}

// ---------------------------------------------------------------------------
// D-A22-RETIRE-LEGACY Phase 1 wiring
// ---------------------------------------------------------------------------

/**
 * Legacy fan-out mode flag.
 *
 *   - `"shadow"` (Phase 1 default): the legacy fan-out walks events,
 *     computes the set of triggered handler keys exactly as it did before,
 *     and emits a typed `LegacyFanoutShadowed` event per row — but does
 *     NOT invoke the handler. Handlers fire only via the bus.
 *   - `"active"` (rollback / pre-Phase-1): the legacy fan-out invokes
 *     handlers in-process, exactly as it did before the cutover. Used
 *     for single-commit rollback (spec §5.1) — flip this constant back
 *     to `"active"` and remove the bus-tick hook below to restore
 *     pre-cutover behaviour.
 *
 * Phase 2 deletes both this flag and the legacy block entirely.
 */
const LEGACY_FANOUT_MODE: "active" | "shadow" = "shadow";

/**
 * Whether the bus is the canonical dispatcher (i.e. `runAgent` ticks the
 * bus before returning). Default on; the env var
 * `BANK_BUS_CANONICAL=false` opt-out exists only as a runtime escape
 * hatch for emergencies — Phase 1 entry presumes this is on. When off,
 * `LEGACY_FANOUT_MODE` should be flipped to `"active"` in the same
 * change so handlers continue to be dispatched.
 */
const BUS_CANONICAL: boolean = process.env.BANK_BUS_CANONICAL !== "false";

const SHADOW_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:legacy-fanout-shadow",
};

const BUS_TICK_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:event-trigger-bus",
};

const PHASE_1_CITATIONS: readonly string[] = [
  "D-A22-RETIRE-LEGACY",
  "D-AGENT-RUNTIME-AUTHORIZE",
  "GOV-FRAMEWORK-CEO-RESERVED",
  "ORG-CY-01",
];

const DEFAULT_ENTITY = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// Substrate-runner lifecycle (S8 / D-AGENT-RUNTIME-AUTHORIZE; spec §3.4)
//
// Every `runAgent` invocation is wrapped in `SubstrateAgentRunStarted` →
// (`SubstrateAgentRunCompleted` | `SubstrateAgentRunFailed`). The pair-coupling
// key is the `runId` minted at run start. Vera Wave-4 #13 (inactivity-SLA)
// will fold these streams to detect runs that opened but never closed.
//
// Authority: S8 / D-AGENT-RUNTIME-AUTHORIZE (CEO-approved 2026-05-08).
// Assessment: Owner Inbox/2026-05-10_atlas_s8-substrate-state-and-next-slice.md.
// ---------------------------------------------------------------------------

const SUBSTRATE_RUNNER_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:substrate-runner",
};

const SUBSTRATE_LIFECYCLE_CITATIONS: readonly string[] = [
  "D-AGENT-RUNTIME-AUTHORIZE",
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-2-2024",
  "ORG-CY-09",
];

/** Cap for SubstrateAgentRunFailed.errorMessage. Schema enforces 1024; we trim defensively. */
const ERROR_MESSAGE_MAX_LEN = 1024;

// ---------------------------------------------------------------------------
// Worker isolation hook (S8 §3.4 — runner-worker primitive, PR #185).
//
// Every top-level `runAgent` invocation installs a `RunnerWorker` bound to
// the worktree root. The primitive (a) chdirs into the worktree root,
// (b) wraps `process.chdir` to throw `WorktreeBoundaryError` on any escape
// to a path outside the root, and (c) shims `node:fs` *Sync helpers (CJS
// view) for the same boundary check. This is the substrate fix for the
// 2026-05-09 lost-work incidents (PR #74 / #76 / #77) where Scrooge-
// dispatched agents `cd`'d to /Users/marc/code/Bank and committed
// scaffold-files onto the wrong branch.
//
// Re-entrancy:
//   - The bus-tick at the bottom of `runAgent` re-enters `runAgent` for
//     event-driven dispatches; the scheduled-trigger consumer also routes
//     through `runAgent`. Both nested calls expect the same worktree
//     root the outer call is already bound to — the parent process is
//     a single agent process today (the runner-worker primitive is the
//     local-first stand-in for the M8 per-agent Container App Job).
//   - We avoid stacking wrappers by tracking an in-process install
//     counter: only the top-level `runAgent` installs, and only it
//     disposes. Inner calls observe the counter > 0 and skip both.
//   - On boundary escape we emit a typed `SubstrateAlert{alertClass:
//     integrity, severity: high}` so Vera's recon catches accidental
//     escapes even when the handler swallows the thrown error.
// ---------------------------------------------------------------------------

/**
 * Process-scoped install depth. Top-level `runAgent` installs at depth 1;
 * nested re-entries (bus-tick, scheduled-trigger consumer) observe depth > 0
 * and skip install/dispose — they inherit the outer worker's binding.
 */
let runnerWorkerDepth = 0;

const RUNNER_WORKER_ALERT_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:runner-worker",
};

function emitWorktreeBoundaryAlert(args: {
  agent: string;
  runId: string;
  err: WorktreeBoundaryError;
}): void {
  try {
    eventStore.append(
      makeSubstrateAlert({
        asOf: new Date().toISOString(), // wall-clock: boundary-escape alert fired outside the composition clock scope
        entity: DEFAULT_ENTITY,
        actor: RUNNER_WORKER_ALERT_ACTOR,
        citations: [...SUBSTRATE_LIFECYCLE_CITATIONS],
        payload: {
          alertId: `alert:integrity:worktree-boundary-${args.runId
            .replace(/[^a-z0-9]/gi, "")
            .slice(0, 16)
            .toLowerCase()}`,
          alertClass: "integrity",
          agentUrn: `agent:${args.agent.toLowerCase()}`,
          details: `RunnerWorker boundary escape: agent="${args.agent}" runId="${args.runId}" attemptedPath="${args.err.attemptedPath}" worktreeRoot="${args.err.worktreeRoot}"`,
          severity: "high",
        },
      }),
    );
  } catch (alertErr) {
    logger.error(
      { runId: args.runId, agent: args.agent, err: (alertErr as Error).message },
      "runner-worker — SubstrateAlert(boundary) append failed",
    );
  }
}

/**
 * Mint a stable run id for the substrate-runner lifecycle. Format:
 * `run:<lowercased-agent>:<iso-utc-no-punct>:<short-rand>`. The
 * substrateRunIdSchema in event-types.ts validates the same regex; keep
 * the two in sync.
 */
function mintRunId(agent: string, startedAt: string): string {
  const slug = agent.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  // ISO-8601 with `:` and `.` stripped — keeps the regex-friendly char set.
  // Example "2026-05-10T13:55:01.234Z" → "2026-05-10T135501234Z".
  const tsCompact = startedAt.replace(/[:.]/g, "");
  const rand = randomBytes(4).toString("hex");
  return `run:${slug}:${tsCompact}:${rand}`;
}

function truncateErrMsg(msg: string): string {
  if (msg.length <= ERROR_MESSAGE_MAX_LEN) return msg;
  return `${msg.slice(0, ERROR_MESSAGE_MAX_LEN - 1)}…`;
}

function emitSubstrateRunStarted(payload: {
  runId: string;
  agent: string;
  trigger: { kind: "scheduled" | "event-driven" | "on-request"; id: string };
  startedAt: string;
  dryRun: boolean;
  sequenceAtStart: number;
}): void {
  try {
    eventStore.append(
      makeSubstrateAgentRunStarted({
        asOf: payload.startedAt,
        entity: DEFAULT_ENTITY,
        actor: SUBSTRATE_RUNNER_ACTOR,
        citations: [...SUBSTRATE_LIFECYCLE_CITATIONS],
        payload: {
          runId: payload.runId,
          agent: payload.agent,
          trigger: payload.trigger,
          startedAt: payload.startedAt,
          dryRun: payload.dryRun,
          // Today every `runAgent` invocation is the autonomous substrate
          // path. Scrooge-coordinated in-session runs do not call into
          // `runAgent` — they run handler logic directly. The flag exists
          // so future substrate-vs-Scrooge distinguishing remains explicit.
          substrate: "agent-runtime",
          sequenceAtStart: payload.sequenceAtStart,
        },
      }),
    );
  } catch (telemetryErr) {
    try {
      eventStore.append(
        makeSubstrateAlert({
          asOf: new Date().toISOString(), // wall-clock: error-fallback SubstrateAlert; clock unavailable in catch scope
          entity: DEFAULT_ENTITY,
          actor: SUBSTRATE_RUNNER_ACTOR,
          citations: [...SUBSTRATE_LIFECYCLE_CITATIONS],
          payload: {
            alertId: `alert:integrity:lifecycle-telemetry-${newEventId()}`,
            alertClass: "integrity",
            agentUrn: `agent:${payload.agent.toLowerCase()}`,
            details: `lifecycle telemetry append failed (SubstrateAgentRunStarted): ${(telemetryErr as Error).message}`,
            severity: "high",
          },
        }),
      );
    } catch {
      // last resort: log only — cannot emit to broken store
      logger.error(
        { runId: payload.runId, agent: payload.agent, err: (telemetryErr as Error).message },
        "lifecycle telemetry append failed and SubstrateAlert also failed",
      );
    }
  }
}

function emitSubstrateRunCompleted(payload: {
  runId: string;
  agent: string;
  completedAt: string;
  durationMs: number;
  ok: boolean;
  eventsEmitted: number;
  decisionsEmitted: number;
  escalationsEmitted: number;
  sequenceAtCompletion: number;
  deliverable?: string;
  summary: string;
}): void {
  try {
    eventStore.append(
      makeSubstrateAgentRunCompleted({
        asOf: payload.completedAt,
        entity: DEFAULT_ENTITY,
        actor: SUBSTRATE_RUNNER_ACTOR,
        citations: [...SUBSTRATE_LIFECYCLE_CITATIONS],
        payload: {
          runId: payload.runId,
          agent: payload.agent,
          completedAt: payload.completedAt,
          durationMs: payload.durationMs,
          ok: payload.ok,
          eventsEmitted: payload.eventsEmitted,
          decisionsEmitted: payload.decisionsEmitted,
          escalationsEmitted: payload.escalationsEmitted,
          sequenceAtCompletion: payload.sequenceAtCompletion,
          ...(payload.deliverable ? { deliverable: payload.deliverable } : {}),
          summary: payload.summary,
        },
      }),
    );
  } catch (telemetryErr) {
    try {
      eventStore.append(
        makeSubstrateAlert({
          asOf: new Date().toISOString(), // wall-clock: error-fallback SubstrateAlert; clock unavailable in catch scope
          entity: DEFAULT_ENTITY,
          actor: SUBSTRATE_RUNNER_ACTOR,
          citations: [...SUBSTRATE_LIFECYCLE_CITATIONS],
          payload: {
            alertId: `alert:integrity:lifecycle-telemetry-${newEventId()}`,
            alertClass: "integrity",
            agentUrn: `agent:${payload.agent.toLowerCase()}`,
            details: `lifecycle telemetry append failed (SubstrateAgentRunCompleted): ${(telemetryErr as Error).message}`,
            severity: "high",
          },
        }),
      );
    } catch {
      // last resort: log only — cannot emit to broken store
      logger.error(
        { runId: payload.runId, agent: payload.agent, err: (telemetryErr as Error).message },
        "lifecycle telemetry append failed and SubstrateAlert also failed",
      );
    }
  }
}

function emitSubstrateRunFailed(payload: {
  runId: string;
  agent: string;
  failedAt: string;
  durationMs: number;
  errorClass: "exception" | "structured" | "timeout" | "unknown";
  errorMessage: string;
  sequenceAtFailure: number;
}): void {
  try {
    eventStore.append(
      makeSubstrateAgentRunFailed({
        asOf: payload.failedAt,
        entity: DEFAULT_ENTITY,
        actor: SUBSTRATE_RUNNER_ACTOR,
        citations: [...SUBSTRATE_LIFECYCLE_CITATIONS],
        payload: {
          runId: payload.runId,
          agent: payload.agent,
          failedAt: payload.failedAt,
          durationMs: payload.durationMs,
          errorClass: payload.errorClass,
          errorMessage: payload.errorMessage,
          sequenceAtFailure: payload.sequenceAtFailure,
        },
      }),
    );
  } catch (telemetryErr) {
    try {
      eventStore.append(
        makeSubstrateAlert({
          asOf: new Date().toISOString(), // wall-clock: error-fallback SubstrateAlert; clock unavailable in catch scope
          entity: DEFAULT_ENTITY,
          actor: SUBSTRATE_RUNNER_ACTOR,
          citations: [...SUBSTRATE_LIFECYCLE_CITATIONS],
          payload: {
            alertId: `alert:integrity:lifecycle-telemetry-${newEventId()}`,
            alertClass: "integrity",
            agentUrn: `agent:${payload.agent.toLowerCase()}`,
            details: `lifecycle telemetry append failed (SubstrateAgentRunFailed): ${(telemetryErr as Error).message}`,
            severity: "high",
          },
        }),
      );
    } catch {
      // last resort: log only — cannot emit to broken store
      logger.error(
        { runId: payload.runId, agent: payload.agent, err: (telemetryErr as Error).message },
        "lifecycle telemetry append failed and SubstrateAlert also failed",
      );
    }
  }
}

/**
 * Lazily-built bus singleton. Constructed on first use rather than at
 * module load so tests / scripts that import from `runtime/run.ts`
 * without triggering `runAgent` (and therefore without the
 * `defaultBusSource()` registry-walk side-effects) stay cheap.
 */
let busSingleton: LocalEventTriggerBus | undefined;

function getBus(): LocalEventTriggerBus {
  if (!busSingleton) {
    busSingleton = new LocalEventTriggerBus({
      eventStore,
      source: defaultBusSource(),
      runner: async ({ agent, trigger }) => {
        const out = await runAgent({ agent, trigger, dryRun: false });
        return { ok: out.ok };
      },
    });
  }
  return busSingleton;
}

/**
 * Compose metadata + callables on module load. Throws if either side
 * has a key the other lacks — fail-loud is correct here; the build
 * shouldn't ship with a half-registered handler.
 */
function buildHandlerMap(): Readonly<Record<string, HandlerEntry>> {
  const out: Record<string, HandlerEntry> = {};
  const metadataKeys = new Set<string>();
  for (const m of HANDLERS_METADATA) {
    metadataKeys.add(m.key);
    const handler = HANDLER_CALLABLES[m.key];
    if (!handler) {
      throw new Error(
        `runtime/handlers-metadata.ts declares ${m.key} but runtime/run.ts has no callable. Add it to HANDLER_CALLABLES.`,
      );
    }
    out[m.key] = { metadata: m, handler };
  }
  for (const k of Object.keys(HANDLER_CALLABLES)) {
    if (!metadataKeys.has(k)) {
      throw new Error(
        `runtime/run.ts has callable for ${k} but runtime/handlers-metadata.ts has no metadata. Add a row to HANDLERS_METADATA.`,
      );
    }
  }
  return out;
}

const HANDLERS: Readonly<Record<string, HandlerEntry>> = buildHandlerMap();

/**
 * Test seam (S8 §3.4 worker-isolation integration tests) — temporarily
 * substitute the handler callable for a registered key. Returns a
 * disposer that restores the original.
 *
 * Used only by `tests/scheduler-driven-run.test.ts` to plant a stub
 * handler that exercises the runner-worker boundary check (e.g. a
 * handler that attempts `process.chdir("..")`). Production code paths
 * never call this. The metadata key MUST already exist in
 * `HANDLERS_METADATA`; the seam refuses to register new (agent, trigger)
 * pairs because that would bypass the handlers-metadata canonicality
 * recon (Wave-4 #11).
 */
export function __testOverrideHandler(
  key: string,
  handler: AgentRunHandler,
): { dispose: () => void } {
  const handlersMutable = HANDLERS as Record<string, HandlerEntry>;
  const existing = handlersMutable[key];
  if (!existing) {
    throw new Error(
      `__testOverrideHandler: no registered handler for ${key}. Test seam refuses to add new keys; add a metadata row to handlers-metadata.ts first.`,
    );
  }
  handlersMutable[key] = { metadata: existing.metadata, handler };
  return {
    dispose: () => {
      handlersMutable[key] = existing;
    },
  };
}

interface CliArgs {
  agent: string;
  trigger: string;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args = argv.slice(2);
  let agent = "";
  let trigger = "";
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--agent") {
      agent = args[++i] ?? "";
    } else if (a === "--trigger") {
      trigger = args[++i] ?? "";
    } else if (a === "--dry-run") {
      dryRun = true;
    }
  }
  if (!agent || !trigger) {
    throw new Error(
      // biome-ignore lint/style/useTemplate: minimal-touch — Atlas owns this file in A2.2 cutover (claude/cool-rhodes-9b2c4e); a template-literal collapse would clobber his single-commit-revert path. Re-fix in his next pass.
      "Usage: bun runtime/run.ts --agent <Name> --trigger <id> [--dry-run]\n" +
        `Available: ${Object.keys(HANDLERS).join(", ")}`,
    );
  }
  return { agent, trigger, dryRun };
}

export async function runAgent(opts: CliArgs): Promise<AgentRunOutput> {
  const key = `${opts.agent.toLowerCase()}:${opts.trigger}`;
  const entry = HANDLERS[key];
  if (!entry) {
    throw new Error(
      `No handler registered for ${key}. Available: ${Object.keys(HANDLERS).join(", ")}`,
    );
  }

  const repoRoot = process.env.BANK_REPO_ROOT ?? resolve(import.meta.dir, "..", "..");
  const startedAt = clock.now();
  const runId = mintRunId(opts.agent, startedAt);
  const ctx: AgentRunContext = {
    agent: opts.agent,
    runId,
    trigger: { kind: entry.metadata.kind, id: opts.trigger },
    asOf: startedAt,
    repoRoot,
    ownerInboxDir: resolve(repoRoot, "archive", "owner-inbox"),
    dryRun: opts.dryRun,
  };

  logger.info(
    {
      agent: ctx.agent,
      runId,
      trigger: ctx.trigger.id,
      asOf: ctx.asOf,
      dryRun: ctx.dryRun,
    },
    "agent run started",
  );
  const t0 = Date.now(); // wall-clock: elapsed-time measurement for run duration
  // Capture the event-store sequence pointer before the run so we can
  // observe what new event types this run appended (for event-driven
  // fan-out below). MUST be `highWatermark()` — `count()` is a row count
  // and undercounts whenever the store has a sequence gap, causing the
  // bus tick at the end of this run to walk over stale events instead
  // of the run's own emissions.
  const seqBefore = eventStore.highWatermark();

  // Emit the substrate-runner lifecycle Started event (S8 §3.4).
  // Best-effort — a permission-gate denial here would leave the run
  // running without lifecycle pairing, which is a finding for Vera but
  // not a runtime fail. We log + continue.
  emitSubstrateRunStarted({
    runId,
    agent: ctx.agent,
    trigger: ctx.trigger,
    startedAt,
    dryRun: ctx.dryRun,
    sequenceAtStart: seqBefore,
  });

  // Install the worker-isolation primitive (S8 §3.4) for the duration
  // of the handler call. Top-level only — nested re-entries (bus-tick,
  // scheduled-trigger consumer) inherit the outer install. The dispose
  // handle is honoured even on handler-thrown error so the host process
  // is never left with a stale wrapper. Boundary escapes route to a
  // typed SubstrateAlert sink before re-throw.
  const isOuter = runnerWorkerDepth === 0;
  let workerDispose: (() => void) | undefined;
  // Capture the host process's pre-install cwd so we can restore it on
  // dispose. The worker primitive itself does not restore cwd (the
  // production model is one worker per process / one Container App Job
  // per agent run, where the post-run cwd is irrelevant). For the
  // local-first single-process model the host's cwd matters: leaving
  // cwd at repoRoot after dispose breaks any downstream caller that
  // resolves paths relative to the original cwd — including Bun's test
  // runner with `bunfig.toml`'s `[test].preload` path.
  let cwdBeforeInstall: string | undefined;
  if (isOuter) {
    try {
      cwdBeforeInstall = process.cwd();
    } catch {
      // process.cwd() can throw on a deleted directory; let it.
      cwdBeforeInstall = undefined;
    }
    const worker = createRunnerWorker({
      worktreeRoot: repoRoot,
      onBoundaryEscape: (err) => emitWorktreeBoundaryAlert({ agent: ctx.agent, runId, err }),
    });
    try {
      const handle = worker.install();
      workerDispose = handle.dispose;
    } catch (err) {
      // install() itself failed — most often because repoRoot is not an
      // absolute path or doesn't exist. Log + continue: the worker is a
      // defence-in-depth primitive, not a runtime gate. The handler will
      // run without the boundary check, and Vera's substrate-state recon
      // will surface the missing wrapping.
      logger.error(
        { runId, agent: ctx.agent, repoRoot, err: (err as Error).message },
        "runner-worker — install() failed (handler will run unwrapped)",
      );
    }
  }
  if (isOuter) runnerWorkerDepth = 1;
  else runnerWorkerDepth += 1;

  // Internal helper — paired with the install above. Invoked from both
  // the success path and the catch unwind to restore host state.
  const restoreWorker = (): void => {
    runnerWorkerDepth = Math.max(0, runnerWorkerDepth - 1);
    if (!isOuter) return;
    if (workerDispose) {
      try {
        workerDispose();
      } catch (disposeErr) {
        logger.error(
          { runId, agent: ctx.agent, err: (disposeErr as Error).message },
          "runner-worker — dispose() failed",
        );
      }
    }
    if (cwdBeforeInstall !== undefined) {
      try {
        process.chdir(cwdBeforeInstall);
      } catch (cwdErr) {
        logger.error(
          { runId, agent: ctx.agent, cwdBeforeInstall, err: (cwdErr as Error).message },
          "runner-worker — restore cwd failed (host left at worktree root)",
        );
      }
    }
  };

  // Invoke the handler. Wrap in try/catch so a thrown error still emits
  // the closing `…Failed` lifecycle event before propagating.
  let result: AgentRunOutput;
  try {
    result = await entry.handler(ctx);
  } catch (err) {
    const ms = Date.now() - t0; // wall-clock: elapsed-time for run duration
    const seqAtFailure = eventStore.highWatermark();
    emitSubstrateRunFailed({
      runId,
      agent: ctx.agent,
      failedAt: new Date().toISOString(), // wall-clock: real failure timestamp for run lifecycle
      durationMs: ms,
      errorClass: err instanceof WorktreeBoundaryError ? "structured" : "exception",
      errorMessage: truncateErrMsg((err as Error).message ?? "unknown"),
      sequenceAtFailure: seqAtFailure,
    });
    // Restore worker + cwd before re-throwing so the host process is
    // never left with a stale chdir override or worktree-rooted cwd.
    restoreWorker();
    throw err;
  }
  const ms = Date.now() - t0; // wall-clock: elapsed-time for run duration
  const seqAtCompletion = eventStore.highWatermark();
  // Count the run's own emissions of decision / escalation events so the
  // closing payload carries the per-run tallies (Atlas spec §3.4 — "count
  // of decisions emitted, count of escalations emitted").
  const newEventsThisRun = [...eventStore.replay({ fromSequence: seqBefore + 1 })];
  const decisionsEmitted = newEventsThisRun.filter((e) => e.type === "AgentDecision").length;
  const escalationsEmitted = newEventsThisRun.filter((e) => e.type === "AgentEscalation").length;
  emitSubstrateRunCompleted({
    runId,
    agent: ctx.agent,
    completedAt: new Date().toISOString(), // wall-clock: real completion timestamp for run lifecycle
    durationMs: ms,
    ok: result.ok,
    eventsEmitted: Math.max(0, seqAtCompletion - seqBefore),
    decisionsEmitted,
    escalationsEmitted,
    sequenceAtCompletion: seqAtCompletion,
    ...(result.deliverable !== undefined ? { deliverable: result.deliverable } : {}),
    summary: result.summary,
  });
  logger.info(
    {
      agent: ctx.agent,
      runId,
      trigger: ctx.trigger.id,
      ok: result.ok,
      eventsEmitted: result.eventsEmitted,
      deliverable: result.deliverable,
      ms,
    },
    `agent run finished: ${result.summary}`,
  );

  // Event-driven fan-out: if this parent run was scheduled or on-request,
  // dispatch (or, in Phase 1 shadow mode, *record* what would have been
  // dispatched of) any event-driven handlers whose `subscribesTo`
  // intersects the set of event types appended during this run. We do
  // NOT recurse into event-driven handlers themselves — that would risk
  // loops in active mode (the bus's idempotency catches it in shadow
  // mode either way).
  if (entry.metadata.kind !== "event-driven" && !ctx.dryRun) {
    // Collect new events with full payloads (not just types) so we can
    // pass triggeringEvents to each event-driven handler / record them
    // on the LegacyFanoutShadowed payload.
    const newEvents = [...eventStore.replay({ fromSequence: seqBefore + 1 })];
    const newEventTypes = new Set<string>(newEvents.map((e) => e.type));
    if (newEventTypes.size > 0) {
      const triggered: string[] = [];
      for (const [k, e] of Object.entries(HANDLERS)) {
        if (e.metadata.kind !== "event-driven") continue;
        const subs = e.metadata.subscribesTo ?? [];
        if (subs.some((t) => newEventTypes.has(t))) triggered.push(k);
      }
      for (const tk of triggered) {
        const tEntry = HANDLERS[tk];
        if (!tEntry) continue;
        const [tAgent, tTrigger] = tk.split(":");
        if (!tAgent || !tTrigger) continue;
        const subscribed = new Set(tEntry.metadata.subscribesTo ?? []);
        const matchedEvents = newEvents.filter((e) => subscribed.has(e.type));
        const matchedTypes = [...new Set(matchedEvents.map((e) => e.type))];

        if (LEGACY_FANOUT_MODE === "shadow") {
          // Phase 1 — shadow mode. Record what we *would* have dispatched
          // and continue. The bus (ticked below at the end of runAgent)
          // is the canonical dispatcher; the handler runs there.
          // Vera's Wave-4 #13b parallel-dispatch-divergence pipeline
          // reconciles these LegacyFanoutShadowed events against
          // BusDispatched and asserts the two sets agree.
          logger.info(
            {
              parent: `${ctx.agent}:${ctx.trigger.id}`,
              triggered: tk,
              triggerEventTypes: matchedTypes,
              mode: "shadow",
            },
            "event-driven dispatch (shadowed — bus is canonical)",
          );
          if (matchedEvents.length > 0) {
            // Real-identity protocol (A22 Phase-1 evidence completion,
            // 2026-05-29): emit ONE `LegacyFanoutShadowed` per matched
            // triggering event, carrying that event's real `event_id`.
            // The bus dispatches per `(triggering event_id, handlerKey)`
            // (`platform/event-trigger-bus/bus.ts`), so the shadow stream
            // must record the same granularity for the recon's G1
            // `(eventId, handlerKey)` symmetric-coverage comparison to be
            // evaluable. The earlier protocol emitted a single shadow event
            // per (parent-run, handler) carrying only `suppressedAtSequence`
            // — no triggering-event identity — which pinned the recon to
            // warn (event-level comparison inconclusive). See spec §3.1.
            for (const me of matchedEvents) {
              try {
                eventStore.append(
                  makeLegacyFanoutShadowed({
                    asOf: clock.now(),
                    entity: DEFAULT_ENTITY,
                    actor: SHADOW_ACTOR,
                    citations: [...PHASE_1_CITATIONS],
                    payload: {
                      parentAgent: ctx.agent.toLowerCase(),
                      parentTrigger: ctx.trigger.id,
                      triggeredHandlerKey: tk,
                      triggeringEventTypes: [me.type],
                      suppressedAtSequence: seqBefore,
                      eventId: me.event_id,
                    },
                  }),
                );
              } catch (err) {
                // Shadow-event append failed — most likely a permission-
                // gate denial or schema regression. The shadow event is
                // Phase-1 evidence, not a runtime gate, so we log and
                // continue. The bus path is unaffected.
                logger.error(
                  { triggered: tk, eventId: me.event_id, err: (err as Error).message },
                  "legacy-fanout-shadow — append LegacyFanoutShadowed failed (non-fatal)",
                );
              }
            }
          }
          continue;
        }

        // Active mode — pre-Phase-1 / rollback behaviour. The legacy
        // fan-out invokes the handler in-process. Kept verbatim so a
        // single-commit revert of the cutover restores prior behaviour
        // (spec §5.1).
        const tCtx: AgentRunContext = {
          agent: capitalise(tAgent),
          trigger: {
            kind: "event-driven",
            id: tTrigger,
            triggeringEvents: matchedEvents,
          },
          asOf: clock.now(),
          repoRoot,
          ownerInboxDir: resolve(repoRoot, "archive", "owner-inbox"),
          dryRun: ctx.dryRun,
        };
        logger.info(
          {
            parent: `${ctx.agent}:${ctx.trigger.id}`,
            triggered: tk,
            triggerEventTypes: [...newEventTypes].filter((t) =>
              (tEntry.metadata.subscribesTo ?? []).includes(t),
            ),
            mode: "active",
          },
          "event-driven dispatch",
        );
        try {
          const tResult = await tEntry.handler(tCtx);
          logger.info(
            {
              triggered: tk,
              ok: tResult.ok,
              eventsEmitted: tResult.eventsEmitted,
              deliverable: tResult.deliverable,
            },
            `event-driven handler finished: ${tResult.summary}`,
          );
        } catch (e) {
          // Event-driven failures are non-fatal to the parent run — the
          // parent's deliverable + events are already valuable. Log and
          // continue; surface as a substrate-gap if it recurs.
          logger.error(
            { triggered: tk, err: (e as Error).message },
            "event-driven handler failed (non-fatal to parent)",
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // Bus-tick hook (D-A22-RETIRE-LEGACY Phase 1, spec §3.1 build step #2).
  //
  // The LocalEventTriggerBus is the canonical dispatcher under Phase 1.
  // Hook it into the scheduler tick by ticking after every agent run —
  // the bus picks up any subscribed events appended during this run and
  // dispatches the corresponding event-driven handlers. Idempotency is
  // the bus's responsibility (it folds BusDispatched on every tick), so
  // this hook is safe to invoke unconditionally.
  //
  // We tick from `seqBefore` so the bus only walks events emitted by
  // this parent run — not the entire store history. The cursor in
  // `.local/bus-cursor.json` (used by the standalone `bus:tick` script)
  // is intentionally NOT updated here: this hook is a per-run dispatch,
  // not a global cursor advance. Events emitted outside `runAgent`
  // (e.g. by the dashboard, by hand-edits, by future event ingestors)
  // are still picked up by `bus:tick`.
  //
  // Excluded conditions:
  //   - `dryRun`: never side-effect in dry-run.
  //   - `BUS_CANONICAL=false`: emergency escape hatch. When off, the
  //     legacy fan-out mode should be flipped to "active" in the same
  //     change so handlers continue to fire somewhere.
  //   - Parent kind === "event-driven": event-driven handlers are
  //     themselves invoked by the bus. Re-ticking inside an event-driven
  //     run is safe (idempotent on (eventId, handlerKey)), but skipping
  //     keeps log volume bounded and the call-graph easier to follow.
  //     Future event-driven-to-event-driven chains (substrate gap New-1
  //     in the spec §7) are unblocked by the standalone `bus:tick`
  //     script + a free-standing scheduler-driven tick when that lands.
  // ---------------------------------------------------------------------
  if (BUS_CANONICAL && !ctx.dryRun && entry.metadata.kind !== "event-driven") {
    try {
      const bus = getBus();
      // syncSubscriptions is idempotent — re-running with no metadata
      // changes yields the same registry. We sync per-run to pick up
      // hot-reloaded metadata in dev, at near-zero cost in prod.
      bus.syncSubscriptions();
      const tickResult = await bus.tick(seqBefore + 1, new Date());
      if (tickResult.dispatches.length > 0) {
        logger.info(
          {
            parent: `${ctx.agent}:${ctx.trigger.id}`,
            considered: tickResult.considered,
            dispatches: tickResult.dispatches.length,
            ok: tickResult.dispatches.filter((d) => d.outcome === "ok").length,
            failed: tickResult.dispatches.filter((d) => d.outcome === "failed").length,
          },
          "bus-tick (run-coupled) — canonical dispatch complete",
        );
      }
    } catch (err) {
      // Bus tick itself threw. The bus's internal failure path already
      // emits BusDispatched / SubstrateAlert per-handler-failure; this
      // catch is for failures of `tick()` itself (e.g. registry
      // unreadable, store transient). Per spec §4.3 (failure mode F3),
      // emit a typed SubstrateAlert so Devon / Vera see it. Do NOT
      // re-throw — the parent run's deliverable is already valuable,
      // and the inactivity-SLA pipeline will catch missed dispatches
      // independently.
      const errMsg = (err as Error).message;
      logger.error(
        { parent: `${ctx.agent}:${ctx.trigger.id}`, err: errMsg },
        "bus-tick (run-coupled) — tick threw (non-fatal to parent)",
      );
      try {
        eventStore.append(
          makeSubstrateAlert({
            asOf: new Date().toISOString(), // wall-clock: bus-tick error SubstrateAlert; clock unavailable in catch scope
            entity: DEFAULT_ENTITY,
            actor: BUS_TICK_ACTOR,
            citations: [...PHASE_1_CITATIONS],
            payload: {
              alertId: `alert:integrity:bus-tick-${newEventId()}`,
              alertClass: "integrity",
              agentUrn: BUS_TICK_ACTOR.id,
              details: `bus tick failed inside runAgent: parent=${ctx.agent}:${ctx.trigger.id} reason=${errMsg}`,
              severity: "high",
            },
          }),
        );
      } catch (alertErr) {
        logger.error(
          { err: (alertErr as Error).message },
          "bus-tick (run-coupled) — SubstrateAlert append failed",
        );
      }
    }
  }

  // Dispose the worker AFTER the bus-tick — the tick may re-enter
  // runAgent for event-driven handlers, and those nested calls expect
  // to inherit the parent's worktree binding. Only the top-level call
  // disposes (inner re-entries see runnerWorkerDepth > 0).
  restoreWorker();

  return result;
}

function capitalise(s: string): string {
  return s.length === 0 ? s : (s[0]?.toUpperCase() ?? "") + s.slice(1);
}

// CLI entry — only when invoked directly.
//
// Exit-code semantics (deliberate):
//   0 — agent run completed. Findings, if any, live in the deliverable +
//       events; they are NOT a workflow failure. An autonomous agent
//       observing and reporting is doing its job.
//   1 — runtime / substrate failure. The agent could not run to completion
//       (handler threw, capability resolution failed, etc.). This is a
//       genuine workflow failure that requires substrate attention.
//
// Caller workflows that want to react to findings (post a comment, raise
// an issue, escalate) should parse the deliverable / event stream — not
// the exit code.
if (import.meta.main) {
  const opts = parseArgs(process.argv);
  runAgent(opts)
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error({ err: (e as Error).message }, "agent run failed");
      process.exit(1);
    });
}
