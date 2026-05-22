// platform/event-trigger-bus/bus.ts
//
// A2.2 — Local-first event-trigger bus implementation.
//
// Reads subscriptions from `runtime/handlers-metadata.ts`, walks events
// appended at or after the cursor, and dispatches subscribers via an
// injected `runAgent` callable. Idempotency keyed on
// `(eventId, handlerKey)` via a `BusDispatched` audit-event.
//
// The runner is injected (rather than imported from `runtime/run.ts`)
// for two reasons:
//   1. Tests can pass in a synthetic runner without booting the
//      runtime's full callable map.
//   2. The bus module can sit in the substrate layer
//      (`platform/event-trigger-bus/`) without importing from `runtime/`,
//      keeping the seam clean for the M8 cloud lift where the runner
//      is invoked over a network-typed boundary.
//
// Author: Atlas (A2.2)

import { HANDLERS_METADATA } from "../../runtime/handlers-metadata";
import { makeBusDispatched, makeSubstrateAlert } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import { logger } from "../observability/logger";

import type {
  DispatchResult,
  EventTriggerBus,
  SubscriptionEntry,
  SubscriptionsResult,
  TickResult,
} from "./types";

const DEFAULT_ENTITY = "LE-ZA-HOZ-BANK";
const DEFAULT_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:event-trigger-bus",
};

const DEFAULT_CITATIONS: readonly string[] = [
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-2-2024",
  "ORG-CY-01",
];

/**
 * Outcome of an injected runner invocation. The bus only cares whether
 * the handler completed without throwing; the agent's deliverable +
 * events are recorded by the runtime, not by the bus.
 */
export interface BusRunnerResult {
  readonly ok: boolean;
}

/**
 * The runner the bus calls to invoke a handler. Default impl wraps
 * `runtime/run.ts`'s `runAgent({ agent, trigger, dryRun: false })`;
 * tests inject a synthetic.
 */
export type BusRunner = (args: {
  agent: string;
  trigger: string;
  triggeringEvents: readonly Event[];
}) => Promise<BusRunnerResult>;

/**
 * Named factory that wraps any `BusRunner`-shaped function into a `BusRunner`.
 * Symmetric counterpart to `createBunWorkerBusRunner` — use this in tests to
 * opt into the in-process path explicitly without spawning workers.
 *
 * The inline lambdas in `ScheduledTriggerConsumer` and `LocalEventTriggerBus`
 * continue to work unchanged; this factory exists purely so test suites can
 * name their runner choice at construction time.
 */
export function createInProcessBusRunner(
  innerRunner: (args: {
    agent: string;
    trigger: string;
    triggeringEvents: readonly Event[];
  }) => Promise<BusRunnerResult>,
): BusRunner {
  return (args) => innerRunner(args);
}

/**
 * Provider for the subscription registry. Pulled out as a seam so tests
 * can inject a synthetic source.
 */
export interface BusSource {
  /**
   * Returns metadata rows for *event-driven* handlers (kind === "event-driven").
   * Default impl reads from `runtime/handlers-metadata.ts`; tests inject
   * a stub.
   */
  readonly eventDrivenHandlers: () => ReadonlyArray<{
    readonly agent: string;
    readonly trigger: string;
    readonly key: string;
    readonly subscribesTo: readonly string[];
  }>;
}

export function defaultBusSource(): BusSource {
  return {
    eventDrivenHandlers: () =>
      HANDLERS_METADATA.filter((h) => h.kind === "event-driven").map((h) => ({
        agent: h.agent,
        trigger: h.trigger,
        key: h.key,
        subscribesTo: h.subscribesTo ?? [],
      })),
  };
}

/** In-memory source for tests. */
export function inMemoryBusSource(args: {
  handlers: ReadonlyArray<{
    agent: string;
    trigger: string;
    subscribesTo: readonly string[];
  }>;
}): BusSource {
  return {
    eventDrivenHandlers: () =>
      args.handlers.map((h) => ({
        agent: h.agent,
        trigger: h.trigger,
        key: `${h.agent.toLowerCase()}:${h.trigger}`,
        subscribesTo: h.subscribesTo,
      })),
  };
}

export interface LocalEventTriggerBusConfig {
  readonly eventStore: EventStore;
  readonly runner: BusRunner;
  readonly source?: BusSource;
  readonly entity?: string;
  readonly actor?: Actor;
  readonly citations?: readonly string[];
}

/**
 * Local-first event-trigger bus. Authoritative state is the event store
 * (P1); the in-memory subscription registry is a cache reproducible
 * from `runtime/handlers-metadata.ts` at any moment.
 */
export class LocalEventTriggerBus implements EventTriggerBus {
  private readonly eventStore: EventStore;
  private readonly runner: BusRunner;
  private readonly source: BusSource;
  private readonly entity: string;
  private readonly actor: Actor;
  private readonly citations: readonly string[];
  private cachedSubscriptions: readonly SubscriptionEntry[] | undefined;

  constructor(config: LocalEventTriggerBusConfig) {
    this.eventStore = config.eventStore;
    this.runner = config.runner;
    this.source = config.source ?? defaultBusSource();
    this.entity = config.entity ?? DEFAULT_ENTITY;
    this.actor = config.actor ?? DEFAULT_ACTOR;
    this.citations = config.citations ?? DEFAULT_CITATIONS;
  }

  syncSubscriptions(): SubscriptionsResult {
    const handlers = this.source.eventDrivenHandlers();
    const entries: SubscriptionEntry[] = handlers
      // Drop event-driven handlers that declare no subscription set —
      // they cannot be dispatched by the bus and would clutter the
      // registry. The runtime-handler-sync recon still catches the
      // case where metadata declares `event-driven` without a
      // `subscribesTo`; this is fail-quiet here, fail-loud there.
      .filter((h) => h.subscribesTo.length > 0)
      .map((h) => ({
        handlerKey: h.key,
        agent: h.agent,
        triggerId: h.trigger,
        eventTypes: h.subscribesTo,
      }));
    this.cachedSubscriptions = entries;
    return { entries, count: entries.length };
  }

  /** Internal — derive entries lazily from `syncSubscriptions` if not cached. */
  private subscriptions(): readonly SubscriptionEntry[] {
    if (!this.cachedSubscriptions) this.syncSubscriptions();
    return this.cachedSubscriptions ?? [];
  }

  subscribersOf(eventType: string): readonly SubscriptionEntry[] {
    return this.subscriptions().filter((s) => s.eventTypes.includes(eventType));
  }

  async tick(fromSequence: number, now: Date): Promise<TickResult> {
    const subs = this.subscriptions();
    // Pre-fold the BusDispatched stream into a Set keyed
    // `<eventId>|<handlerKey>` for O(1) idempotency lookup.
    const dispatched = new Set<string>();
    for (const e of this.eventStore.replay({ type: "BusDispatched" })) {
      const p = e.payload as Record<string, unknown>;
      const k = `${String(p.eventId ?? "")}|${String(p.handlerKey ?? "")}`;
      dispatched.add(k);
    }

    // Snapshot the high-water sequence before we walk so the new cursor
    // is stable even if a dispatched handler appends additional events.
    // Source events for *this* tick are bounded to [fromSequence, snapshot].
    // New events emitted by handlers we invoke land in the next tick.
    //
    // MUST be `highWatermark()` (max sequence), not `count()`: when the
    // store has any sequence gap (rolled-back append, replaced event),
    // count() undercounts by the gap size and the walk-budget below
    // truncates before reaching the just-appended event — silently
    // dropping the dispatch.
    const snapshot = this.eventStore.highWatermark();

    // Walk source events. The store's replay yields in sequence order,
    // and we only care about events in [fromSequence, snapshot]; we
    // bound below by sequence-fence using `fromSequence` and above by
    // tracking how many we've yielded (the high-water snapshot bounds
    // the dense-sequence range; with gaps we may break a few iterations
    // early, which is harmless — those positions held no event).
    const sourceEvents: Event[] = [];
    let walked = 0;
    for (const e of this.eventStore.replay({ fromSequence })) {
      walked += 1;
      if (walked > snapshot - fromSequence + 1) break;
      // Skip BusDispatched events — they're the bus's own audit trail,
      // never a trigger. Skipping here also prevents a feedback loop
      // were a handler ever to subscribe to BusDispatched (the sub-
      // scription registry would have to declare it; we still belt-
      // and-brace defensively).
      if (e.type === "BusDispatched") continue;
      sourceEvents.push(e);
    }

    const dispatches: DispatchResult[] = [];
    for (const event of sourceEvents) {
      const subscribers = subs.filter((s) => s.eventTypes.includes(event.type));
      if (subscribers.length === 0) continue;
      for (const sub of subscribers) {
        const dedupKey = `${event.event_id}|${sub.handlerKey}`;
        if (dispatched.has(dedupKey)) continue;
        dispatched.add(dedupKey);

        const dispatchedAt = now.toISOString();
        let outcome: "ok" | "failed" = "ok";
        let failureReason: string | undefined;
        try {
          const result = await this.runner({
            agent: sub.agent,
            trigger: sub.triggerId,
            triggeringEvents: [event],
          });
          if (!result.ok) {
            outcome = "failed";
            failureReason = "runner returned ok=false";
          }
        } catch (err) {
          outcome = "failed";
          failureReason = (err as Error).message;
          logger.error(
            {
              eventId: event.event_id,
              eventType: event.type,
              handlerKey: sub.handlerKey,
              err: failureReason,
            },
            "event-trigger-bus — subscriber failed (isolated)",
          );
        }

        // Always emit the BusDispatched audit event — even on failure.
        // The dispatch happened; the outcome is recorded so audit can
        // count attempts vs failures.
        try {
          this.eventStore.append(
            makeBusDispatched({
              asOf: dispatchedAt,
              entity: this.entity,
              actor: this.actor,
              citations: [...this.citations],
              payload: {
                eventId: event.event_id,
                eventType: event.type,
                handlerKey: sub.handlerKey,
                dispatchedAt,
                outcome,
              },
            }),
          );
        } catch (err) {
          // BusDispatched append failed — most likely a permission-gate
          // denial. Log + continue; the next tick will retry the
          // dispatch (the dedup key is recorded in-memory above so we
          // don't double-invoke the handler within this tick, but it
          // won't survive process restart without the audit row).
          logger.error(
            {
              eventId: event.event_id,
              handlerKey: sub.handlerKey,
              err: (err as Error).message,
            },
            "event-trigger-bus — BusDispatched append failed",
          );
        }

        // On failure, emit a SubstrateAlert so Devon / Vera see it.
        if (outcome === "failed") {
          try {
            this.eventStore.append(
              makeSubstrateAlert({
                asOf: dispatchedAt,
                entity: this.entity,
                actor: this.actor,
                citations: [...this.citations],
                payload: {
                  // alertId convention: alert:integrity:<short-slug>.
                  // Per-attempt id keeps the alert distinct from
                  // prior attempts on the same (event, handler) pair.
                  alertId: this.alertIdFor(event.event_id, sub.handlerKey),
                  alertClass: "integrity",
                  agentUrn: `agent:${sub.agent.toLowerCase()}`,
                  details: `bus dispatch failed: handler=${sub.handlerKey} eventId=${event.event_id} reason=${failureReason ?? "unknown"}`,
                  severity: "high",
                },
              }),
            );
          } catch (err) {
            logger.error(
              { err: (err as Error).message },
              "event-trigger-bus — SubstrateAlert append failed",
            );
          }
        }

        dispatches.push({
          eventId: event.event_id,
          eventType: event.type,
          handlerKey: sub.handlerKey,
          outcome,
          ...(failureReason ? { failureReason } : {}),
        });
      }
    }

    return {
      dispatches,
      considered: sourceEvents.length,
      // Cursor advances to one past the snapshot — the next tick picks
      // up only events appended after this tick started (including the
      // BusDispatched / SubstrateAlert events we just emitted, which
      // are filtered out of dispatch above).
      nextCursor: snapshot + 1,
    };
  }

  /**
   * Alert id for a failed dispatch. Stable per (eventId, handlerKey)
   * pair — hashing the long event_id keeps the alertId within the
   * `alert:<class>:<short-slug>` regex (kebab; alphanumerics only).
   */
  private alertIdFor(eventId: string, handlerKey: string): string {
    // event_id is a uuid; take the first 8 hex chars for brevity. The
    // handlerKey already matches a-z/0-9/-:.
    const short = eventId
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase()
      .slice(0, 8);
    const handlerSlug = handlerKey.replace(/:/g, "-");
    return `alert:integrity:bus-${handlerSlug}-${short}`;
  }
}
