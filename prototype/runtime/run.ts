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
//   - Principle 7 (autonomous by default — bus runs unattended)
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

import { eventStore } from "../platform/composition";
import { makeLegacyFanoutShadowed, makeSubstrateAlert } from "../platform/event-store/event-types";
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

const DEFAULT_ENTITY = "BANK-ZA-001";

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
  const ctx: AgentRunContext = {
    agent: opts.agent,
    trigger: { kind: entry.metadata.kind, id: opts.trigger },
    asOf: new Date().toISOString(),
    repoRoot,
    ownerInboxDir: resolve(repoRoot, "Owner Inbox"),
    dryRun: opts.dryRun,
  };

  logger.info(
    { agent: ctx.agent, trigger: ctx.trigger.id, asOf: ctx.asOf, dryRun: ctx.dryRun },
    "agent run started",
  );
  const t0 = Date.now();
  // Capture the event-store sequence pointer before the run so we can
  // observe what new event types this run appended (for event-driven
  // fan-out below).
  const seqBefore = eventStore.count();
  const result = await entry.handler(ctx);
  const ms = Date.now() - t0;
  logger.info(
    {
      agent: ctx.agent,
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
          if (matchedTypes.length > 0) {
            try {
              eventStore.append(
                makeLegacyFanoutShadowed({
                  asOf: new Date().toISOString(),
                  entity: DEFAULT_ENTITY,
                  actor: SHADOW_ACTOR,
                  citations: [...PHASE_1_CITATIONS],
                  payload: {
                    parentAgent: ctx.agent.toLowerCase(),
                    parentTrigger: ctx.trigger.id,
                    triggeredHandlerKey: tk,
                    triggeringEventTypes: matchedTypes,
                    suppressedAtSequence: seqBefore,
                  },
                }),
              );
            } catch (err) {
              // Shadow-event append failed — most likely a permission-
              // gate denial or schema regression. The shadow event is
              // Phase-1 evidence, not a runtime gate, so we log and
              // continue. The bus path is unaffected.
              logger.error(
                { triggered: tk, err: (err as Error).message },
                "legacy-fanout-shadow — append LegacyFanoutShadowed failed (non-fatal)",
              );
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
          asOf: new Date().toISOString(),
          repoRoot,
          ownerInboxDir: resolve(repoRoot, "Owner Inbox"),
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
            asOf: new Date().toISOString(),
            entity: DEFAULT_ENTITY,
            actor: BUS_TICK_ACTOR,
            citations: [...PHASE_1_CITATIONS],
            payload: {
              alertId: `alert:integrity:bus-tick-${Date.now()}`,
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
