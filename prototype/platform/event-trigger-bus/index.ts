// platform/event-trigger-bus/index.ts
//
// A2.2 — Event-trigger bus component interface.
//
// Generalises the in-process fan-out that today lives at
// `prototype/runtime/run.ts` lines 132–199: when a parent run appends
// events whose types are subscribed to by event-driven handlers, those
// handlers are invoked. A2.1's scheduler emits `ScheduledTrigger`; the
// other event-driven handlers (Anya `projection-refresh`, Scrooge
// `follow-on-router`) subscribe to domain events. The bus generalises
// both surfaces so the dispatch loop is a substrate component, not a
// best-effort tail at the end of every parent run.
//
// What this slice does:
//   - Reads subscriptions from the canonical handler-metadata registry
//     (`runtime/handlers-metadata.ts`). Every entry with
//     `kind: "event-driven"` and a `subscribesTo: [...]` set defines a
//     subscription.
//   - On `tick(fromSequence, now)`, walks events appended at or after
//     `fromSequence`, looks up subscribers, and dispatches via the
//     runtime's `runAgent()`. Returns a new cursor.
//   - Idempotency: a `BusDispatched{eventId, handlerKey, dispatchedAt}`
//     event is appended for every (event, handler) invocation. Before
//     invoking, the bus consults that stream and skips already-recorded
//     pairs. A second tick on the same cursor is a no-op.
//   - Subscriber failures isolate: a handler that throws emits a
//     `SubstrateAlert{alertClass: "integrity"}` and the tick continues
//     to the next subscriber. The parent's audit trail is unaffected.
//
// What this slice does NOT do (deferred):
//   - Replace the in-process fan-out in `runtime/run.ts`. The two
//     surfaces run side-by-side until A2.2 is proven; the legacy fan-out
//     stays untouched per Atlas spec philosophy of substrate-replacement
//     without loss.
//   - Cross-process delivery semantics. Local bus is single-process. The
//     cloud-substrate (Event Hubs + Service Bus) lift lands at M8.
//   - Backpressure / per-agent in-flight cap. Spec §3.3 mentions it but
//     A2.2 is dispatch-only; capacity guard lands when the bus has
//     observed real handler throughput in the build phase.
//   - Filter expressions on subscriptions. The spec carries `filterExpression?`
//     for future use; today the metadata only declares event types.
//
// Substrate seams (Atlas runtime spec §5):
//   - Local: in-process bus over the SQLite event-store change stream
//     (this file's `LocalEventTriggerBus`).
//   - Cloud (M8): Azure Event Hubs (high-volume) + Service Bus
//     (per-agent topics). Same `EventTriggerBus` interface; swap the
//     implementation in composition.ts.
//
// Author: Atlas (A2.2)
//
// Interface definitions live in ./types.ts (extracted to break the
// barrel → implementation → barrel cycle; F-019 fix). Re-exported here
// for back-compat with existing callers.

export type {
  DispatchResult,
  EventTriggerBus,
  SubscriptionEntry,
  SubscriptionsResult,
  TickResult,
} from "./types";

export { LocalEventTriggerBus, defaultBusSource, inMemoryBusSource } from "./bus";
export type { BusRunner, BusRunnerResult, BusSource, LocalEventTriggerBusConfig } from "./bus";
export { ScheduledTriggerConsumer } from "./scheduled-trigger-consumer";
export type {
  ScheduledConsumeResult,
  ScheduledDispatchResult,
  ScheduledTriggerConsumerConfig,
} from "./scheduled-trigger-consumer";
