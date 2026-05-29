// platform/event-trigger-bus/scheduled-trigger-consumer.ts
//
// S8 §3.3 — bus consumer for `ScheduledTrigger` events.
//
// The scheduler (`prototype/scripts/scheduler-tick.ts` + `LocalScheduler.tick()`)
// emits `ScheduledTrigger` events for any registered cron entry whose due-time
// has elapsed. Until this consumer landed, those events were an audit-trail
// record only — nothing read them and dispatched the named agent's handler.
// `prototype/scripts/scheduler-tick.ts`'s header comment documented the gap:
// "A2.2's bus reads ScheduledTrigger and dispatches".
//
// Why a separate consumer (vs the existing `LocalEventTriggerBus`):
//   - The existing bus dispatches handlers whose metadata declares
//     `kind === "event-driven"` and lists the event type in `subscribesTo`.
//     Scheduled handlers do not declare a `subscribesTo` set — they fire on
//     cadence, not on event-class subscription. Forcing every scheduled
//     handler to opt-in to a `ScheduledTrigger` subscription would require
//     27 metadata edits and obscures the fact that the *scheduler* (not the
//     handler author) is the consumer of the trigger.
//   - The dispatch loop is identical in shape: walk events past a cursor,
//     dedupe per (eventId, handlerKey) via `BusDispatched`, invoke a
//     `BusRunner`, emit a `BusDispatched` audit row + `SubstrateAlert` on
//     failure. We re-use those primitives by parameterising over
//     "match a subscriber for this event" — the only thing that differs
//     between the two paths is the subscriber-resolution rule.
//
// Resolution rule for ScheduledTrigger:
//   - Read `agentUrn` (e.g. `agent:vera`) and `triggerId` (e.g. `overnight-recon`)
//     from the payload.
//   - Look up the handler key `<lowercased-agent>:<triggerId>` in the
//     canonical handler-metadata registry.
//   - Require `metadata.kind === "scheduled"`. A ScheduledTrigger that
//     names an event-driven or on-request handler is a substrate-state
//     bug; we emit a `SubstrateAlert{alertClass: integrity}` and skip
//     the dispatch (the existing LocalEventTriggerBus would refuse to
//     pick it up, so silence would be a black hole).
//
// What this consumer does NOT do:
//   - Spawn out-of-process workers — that's M8.
//   - Concurrency control / per-agent in-flight cap — substrate gap shared
//     with the event-driven bus (spec §3.3 third bullet).
//   - Cross-process cursor durability — runs single-shot from scheduler-tick
//     today (the scheduler-tick CLI invokes the consumer once per tick).
//     The cursor is the highest-sequence ScheduledTrigger event already
//     dispatched (read from the BusDispatched stream); restarts replay
//     idempotently.
//
// Author: Atlas (Core banking platform architect, engineering)

import { HANDLERS_METADATA_BY_KEY } from "../../runtime/handlers-metadata";
import { makeBusDispatched, makeSubstrateAlert } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";
import { logger } from "../observability/logger";

import type { BusRunner, BusRunnerResult } from "./bus";

const DEFAULT_ENTITY = "LE-ZA-HOZ-BANK";
const DEFAULT_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:scheduled-trigger-consumer",
};

const DEFAULT_CITATIONS: readonly string[] = [
  "D-AGENT-RUNTIME-AUTHORIZE",
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-2-2024",
  "ORG-CY-09",
];

export interface ScheduledTriggerConsumerConfig {
  readonly eventStore: EventStore;
  /**
   * Runner to use for dispatching scheduled handlers.
   *
   * Must be provided explicitly. Use `createInProcessBusRunner` from `bus.ts`
   * for in-process dispatch (default for most callers and all tests), or
   * `createBunWorkerBusRunner` from `../agent-runtime/bun-worker-bus-runner`
   * for isolated Bun Worker thread dispatch (explicit opt-in only).
   *
   * `BunWorkerBusRunner` is available infrastructure but is NOT the default —
   * it must be opted into explicitly so existing callers and the runtime test
   * suite are not affected by worker-isolation behaviour.
   */
  readonly runner: BusRunner;
  readonly entity?: string;
  readonly actor?: Actor;
  readonly citations?: readonly string[];
}

export interface ScheduledDispatchResult {
  readonly eventId: string;
  readonly agentUrn: string;
  readonly triggerId: string;
  readonly handlerKey: string;
  readonly outcome: "ok" | "failed" | "unmatched";
  readonly failureReason?: string;
}

export interface ScheduledConsumeResult {
  /** Dispatches performed in this run (already-dispatched are skipped silently). */
  readonly dispatches: readonly ScheduledDispatchResult[];
  /** Number of `ScheduledTrigger` events the consumer walked. */
  readonly considered: number;
}

/**
 * Consume any `ScheduledTrigger` events that have not yet been dispatched
 * (no `BusDispatched{eventId, handlerKey}` audit row) and invoke the
 * matching scheduled handler via the injected `runner`. Idempotent —
 * second invocation with no new triggers is a no-op.
 *
 * Failure isolation: a runner that throws emits `BusDispatched{outcome:
 * "failed"}` + `SubstrateAlert{alertClass: integrity, severity: high}`
 * and the consumer continues to the next trigger. The parent caller's
 * caller (the scheduler-tick CLI) decides exit-code semantics.
 */
export class ScheduledTriggerConsumer {
  private readonly eventStore: EventStore;
  private readonly runner: BusRunner;
  private readonly entity: string;
  private readonly actor: Actor;
  private readonly citations: readonly string[];

  constructor(config: ScheduledTriggerConsumerConfig) {
    this.eventStore = config.eventStore;
    this.runner = config.runner;
    this.entity = config.entity ?? DEFAULT_ENTITY;
    this.actor = config.actor ?? DEFAULT_ACTOR;
    this.citations = config.citations ?? DEFAULT_CITATIONS;
  }

  async consume(now: Date): Promise<ScheduledConsumeResult> {
    // Pre-fold the BusDispatched stream into a Set keyed `<eventId>|<handlerKey>`
    // for an O(1) in-process fast-path. Mirrors the LocalEventTriggerBus pattern.
    // As in the bus, this in-memory set is ONLY a within-run optimisation — the
    // authoritative cross-process dedup is `eventStore.claimDispatch` below.
    // Applying the same claim primitive here means the scheduled path cannot
    // race the event-driven path (or a concurrent scheduled run) on the same
    // (eventId, handlerKey) pair. F2 close (F-ATLAS-20260529-BUSDEDUP).
    const dispatched = new Set<string>();
    for (const e of this.eventStore.replay({ type: "BusDispatched" })) {
      const p = e.payload as Record<string, unknown>;
      const k = `${String(p.eventId ?? "")}|${String(p.handlerKey ?? "")}`;
      dispatched.add(k);
    }

    const triggers: Event[] = [];
    for (const e of this.eventStore.replay({ type: "ScheduledTrigger" })) {
      triggers.push(e);
    }

    const dispatches: ScheduledDispatchResult[] = [];
    for (const event of triggers) {
      const p = event.payload as Record<string, unknown>;
      const agentUrn = String(p.agentUrn ?? "");
      const triggerId = String(p.triggerId ?? "");
      if (!agentUrn || !triggerId) {
        logger.warn(
          { eventId: event.event_id, agentUrn, triggerId },
          "scheduled-trigger-consumer — malformed payload; skipping",
        );
        continue;
      }
      const lowerAgent = agentUrn.replace(/^agent:/, "");
      const handlerKey = `${lowerAgent}:${triggerId}`;
      const metadata = HANDLERS_METADATA_BY_KEY.get(handlerKey);

      if (!metadata) {
        // No registered handler. Surface as an integrity alert so Vera's
        // recon catches the registry/scheduler drift, then move on.
        const alertId = this.alertIdFor(event.event_id, handlerKey, "unregistered");
        try {
          this.eventStore.append(
            makeSubstrateAlert({
              asOf: now.toISOString(),
              entity: this.entity,
              actor: this.actor,
              citations: [...this.citations],
              payload: {
                alertId,
                alertClass: "integrity",
                agentUrn,
                details: `scheduled-trigger-consumer: no registered handler for ${handlerKey} (eventId=${event.event_id})`,
                severity: "medium",
              },
            }),
          );
        } catch (err) {
          logger.error(
            { eventId: event.event_id, handlerKey, err: (err as Error).message },
            "scheduled-trigger-consumer — SubstrateAlert(unregistered) append failed",
          );
        }
        dispatches.push({
          eventId: event.event_id,
          agentUrn,
          triggerId,
          handlerKey,
          outcome: "unmatched",
          failureReason: "no registered handler",
        });
        continue;
      }

      if (metadata.kind !== "scheduled") {
        // The metadata exists but the handler is not scheduled. Surface as
        // integrity alert; do not dispatch (the LocalEventTriggerBus
        // handles event-driven; on-request handlers fire only via
        // explicit caller).
        const alertId = this.alertIdFor(event.event_id, handlerKey, "wrong-kind");
        try {
          this.eventStore.append(
            makeSubstrateAlert({
              asOf: now.toISOString(),
              entity: this.entity,
              actor: this.actor,
              citations: [...this.citations],
              payload: {
                alertId,
                alertClass: "integrity",
                agentUrn,
                details: `scheduled-trigger-consumer: handler ${handlerKey} is kind="${metadata.kind}", not "scheduled" — ScheduledTrigger silently dropped`,
                severity: "high",
              },
            }),
          );
        } catch (err) {
          logger.error(
            { eventId: event.event_id, handlerKey, err: (err as Error).message },
            "scheduled-trigger-consumer — SubstrateAlert(wrong-kind) append failed",
          );
        }
        dispatches.push({
          eventId: event.event_id,
          agentUrn,
          triggerId,
          handlerKey,
          outcome: "unmatched",
          failureReason: `handler kind is "${metadata.kind}", not "scheduled"`,
        });
        continue;
      }

      const dedupKey = `${event.event_id}|${handlerKey}`;
      // Fast-path: skip if already dispatched in this run (not authoritative).
      if (dispatched.has(dedupKey)) continue;

      // Authoritative cross-process claim. Claim-FIRST: take the atomic
      // UNIQUE-constrained claim BEFORE invoking the handler. A lost claim
      // means another process/path (the event-driven bus or a concurrent
      // scheduled run) owns this pair — skip invocation. F2 close.
      const won = this.eventStore.claimDispatch(event.event_id, handlerKey);
      if (!won) {
        dispatched.add(dedupKey);
        continue;
      }
      dispatched.add(dedupKey);

      const dispatchedAt = now.toISOString();
      let outcome: "ok" | "failed" = "ok";
      let failureReason: string | undefined;
      let runnerResult: BusRunnerResult | undefined;
      try {
        runnerResult = await this.runner({
          agent: metadata.agent,
          trigger: triggerId,
          triggeringEvents: [event],
        });
        if (!runnerResult.ok) {
          outcome = "failed";
          failureReason = "runner returned ok=false";
        }
      } catch (err) {
        outcome = "failed";
        failureReason = (err as Error).message;
        logger.error(
          { eventId: event.event_id, handlerKey, err: failureReason },
          "scheduled-trigger-consumer — runner threw (isolated)",
        );
      }

      // Always emit the audit row.
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
              handlerKey,
              dispatchedAt,
              outcome,
            },
          }),
        );
      } catch (err) {
        logger.error(
          { eventId: event.event_id, handlerKey, err: (err as Error).message },
          "scheduled-trigger-consumer — BusDispatched append failed",
        );
      }

      if (outcome === "failed") {
        try {
          this.eventStore.append(
            makeSubstrateAlert({
              asOf: dispatchedAt,
              entity: this.entity,
              actor: this.actor,
              citations: [...this.citations],
              payload: {
                alertId: this.alertIdFor(event.event_id, handlerKey, "dispatch"),
                alertClass: "integrity",
                agentUrn,
                details: `scheduled-trigger dispatch failed: handler=${handlerKey} eventId=${event.event_id} reason=${failureReason ?? "unknown"}`,
                severity: "high",
              },
            }),
          );
        } catch (err) {
          logger.error(
            { eventId: event.event_id, handlerKey, err: (err as Error).message },
            "scheduled-trigger-consumer — SubstrateAlert(dispatch) append failed",
          );
        }
      }

      dispatches.push({
        eventId: event.event_id,
        agentUrn,
        triggerId,
        handlerKey,
        outcome,
        ...(failureReason ? { failureReason } : {}),
      });
    }

    return { dispatches, considered: triggers.length };
  }

  /** Stable alert id keyed off a short event-id slug. */
  private alertIdFor(eventId: string, handlerKey: string, kind: string): string {
    const short = eventId
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase()
      .slice(0, 8);
    const handlerSlug = handlerKey.replace(/:/g, "-");
    return `alert:integrity:scheduled-${kind}-${handlerSlug}-${short}`;
  }
}
