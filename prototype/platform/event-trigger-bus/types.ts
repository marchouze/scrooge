// platform/event-trigger-bus/types.ts
//
// Pure interface definitions for the event-trigger bus component.
// Extracted from index.ts so that bus.ts and scheduled-trigger-consumer.ts
// can import from this leaf module rather than from the barrel (index.ts),
// breaking the circular dependency:
//   bus.ts → index.ts → bus.ts  (cycles 1 and 2, F-019 fix)
//
// All consumers should import interfaces from this file; index.ts re-exports
// them for back-compat with existing callers.
//
// Author: Atlas (Core banking platform architect, engineering)

/**
 * One row of the bus's subscription registry. Derived from the canonical
 * handler-metadata registry on `syncSubscriptions()`.
 */
export interface SubscriptionEntry {
  /** Composite handler key from `runtime/handlers-metadata.ts`. */
  readonly handlerKey: string;
  /** Persona name as it appears in /Team/<Name>.md. */
  readonly agent: string;
  /** Trigger id — second half of the handler key. */
  readonly triggerId: string;
  /** Event types this handler subscribes to. */
  readonly eventTypes: readonly string[];
}

export interface SubscriptionsResult {
  readonly entries: readonly SubscriptionEntry[];
  readonly count: number;
}

/**
 * One dispatch the bus performed on this tick. Mirrors the audit-trail
 * `BusDispatched` event so callers can observe activity without
 * re-reading the event store.
 */
export interface DispatchResult {
  readonly eventId: string;
  readonly eventType: string;
  readonly handlerKey: string;
  readonly outcome: "ok" | "failed";
  /** Failure reason when `outcome === "failed"`; undefined on success. */
  readonly failureReason?: string;
}

export interface TickResult {
  /** Dispatches performed in this tick (already-dispatched pairs are skipped silently). */
  readonly dispatches: readonly DispatchResult[];
  /** Number of source events the tick walked. */
  readonly considered: number;
  /**
   * The new cursor — pass back to the next `tick()` to continue. By
   * convention this is the highest sequence number processed plus one,
   * so re-passing it picks up only newly-appended events.
   */
  readonly nextCursor: number;
}

export interface EventTriggerBus {
  /**
   * Derive subscriptions from the canonical handler-metadata registry.
   * Idempotent — re-running with no metadata changes yields the same
   * registry.
   */
  syncSubscriptions(): SubscriptionsResult;

  /**
   * Single tick — for any event in the store with sequence ≥ `fromSequence`,
   * look up subscribers via the metadata registry and invoke them via
   * the runtime's `runAgent()`. Skips (eventId, handlerKey) pairs already
   * recorded as `BusDispatched`. Subscriber failures are isolated and
   * surfaced via `SubstrateAlert{alertClass: "integrity"}`.
   *
   * Returns a new cursor; pass to the next tick to process only new
   * events.
   */
  tick(fromSequence: number, now: Date): Promise<TickResult>;

  /**
   * List subscribers for a given event type. Pure — does not touch the
   * store.
   */
  subscribersOf(eventType: string): readonly SubscriptionEntry[];
}
