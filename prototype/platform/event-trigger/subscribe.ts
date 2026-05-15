// platform/event-trigger/subscribe.ts
//
// Typed subscription helpers for AgentEscalation and AgentDecisionRequired
// event types.
//
// These helpers fold the EventStore's replay stream into typed views so
// downstream consumers don't need to cast raw payloads. The helpers are
// pure (no side effects) and return synchronous iterators — they do not
// require the full event-trigger-bus machinery for simple queries.
//
// For bus-driven dispatch (handler subscribes via HANDLERS_METADATA and
// fires on each new event), use the LocalEventTriggerBus in
// platform/event-trigger-bus/.
//
// Authority: Principle 1 — events are the only source of truth. Status
// views are derived, never stored.
//
// Author: Atlas (Core banking platform architect, engineering)

import type {
  AgentDecisionRequiredPayload,
  AgentEscalationPayload,
} from "../event-store/event-types";
import type { EventStore } from "../event-store/store";

// ---------------------------------------------------------------------------
// AgentEscalation subscription helpers
// ---------------------------------------------------------------------------

export interface EscalationEventView {
  readonly eventId: string;
  readonly asOf: string;
  readonly entity: string;
  readonly payload: AgentEscalationPayload;
}

/**
 * Replay all `AgentEscalation` events from the store in sequence order.
 *
 * Returns a typed iterator; each element is an `EscalationEventView`.
 * Callers that need full lifecycle (acknowledge / decide / delegate)
 * should use `LocalEscalationChannel` from `platform/escalation/`.
 */
export function* subscribeEscalations(
  eventStore: EventStore,
): Generator<EscalationEventView> {
  for (const event of eventStore.replay({ type: "AgentEscalation" })) {
    yield {
      eventId: event.event_id,
      asOf: event.as_of,
      entity: event.entity,
      payload: event.payload as unknown as AgentEscalationPayload,
    };
  }
}

/**
 * Collect all `AgentEscalation` events into an array.
 * Convenience wrapper around `subscribeEscalations`.
 */
export function listEscalations(eventStore: EventStore): readonly EscalationEventView[] {
  return [...subscribeEscalations(eventStore)];
}

/**
 * Find the most recent `AgentEscalation` for a given escalationId.
 * Returns `undefined` if none found.
 */
export function findEscalation(
  eventStore: EventStore,
  escalationId: string,
): EscalationEventView | undefined {
  let found: EscalationEventView | undefined;
  for (const view of subscribeEscalations(eventStore)) {
    if (view.payload.escalationId === escalationId) {
      // Keep last (latest sequence wins on duplicates).
      found = view;
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// AgentDecisionRequired subscription helpers
// ---------------------------------------------------------------------------

export interface DecisionRequestView {
  readonly eventId: string;
  readonly asOf: string;
  readonly entity: string;
  readonly payload: AgentDecisionRequiredPayload;
}

/**
 * Replay all `AgentDecisionRequired` events from the store in sequence order.
 *
 * Returns a typed iterator. Each element is a `DecisionRequestView`.
 */
export function* subscribeDecisionRequests(
  eventStore: EventStore,
): Generator<DecisionRequestView> {
  for (const event of eventStore.replay({ type: "AgentDecisionRequired" })) {
    yield {
      eventId: event.event_id,
      asOf: event.as_of,
      entity: event.entity,
      payload: event.payload as unknown as AgentDecisionRequiredPayload,
    };
  }
}

/**
 * Collect all `AgentDecisionRequired` events into an array.
 */
export function listDecisionRequests(eventStore: EventStore): readonly DecisionRequestView[] {
  return [...subscribeDecisionRequests(eventStore)];
}

/**
 * Find a decision request by its `requestId`.
 * Returns the first match (requestIds are expected to be unique per the
 * dispatch contract; duplicates indicate an integrity issue).
 */
export function findDecisionRequest(
  eventStore: EventStore,
  requestId: string,
): DecisionRequestView | undefined {
  for (const view of subscribeDecisionRequests(eventStore)) {
    if (view.payload.requestId === requestId) return view;
  }
  return undefined;
}

/**
 * List open decision requests — those without a corresponding
 * `AgentDecisionRequired` resolution event.
 *
 * "Open" is defined as: an `AgentDecisionRequired` event exists, and no
 * `AgentDecision` event with the same `requestId` in its payload has
 * been appended. This is a lightweight fold — for production volume
 * consider a projection (Anya's projection-refresh substrate).
 *
 * NOTE: this fold relies on `AgentDecision.payload.decisionId` matching
 * the `requestId`. In the current schema, `AgentDecision` uses
 * `decisionId` for CEO-level decisions; the agent-triggered path is
 * distinct. Until a formal resolution event type is defined, this
 * helper returns ALL decision requests (treats every request as open).
 * Callers that need cross-linking with CEO decisions should fold
 * `CeoDecision` events directly.
 */
export function listOpenDecisionRequests(
  eventStore: EventStore,
): readonly DecisionRequestView[] {
  // Collect requestIds that have been resolved via AgentDecision.
  const resolvedIds = new Set<string>();
  for (const event of eventStore.replay({ type: "AgentDecision" })) {
    const p = event.payload as Record<string, unknown>;
    if (typeof p.decisionId === "string") resolvedIds.add(p.decisionId);
  }

  return listDecisionRequests(eventStore).filter(
    (v) => !resolvedIds.has(v.payload.requestId),
  );
}
