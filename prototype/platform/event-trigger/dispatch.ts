// platform/event-trigger/dispatch.ts
//
// Factory + emit functions for agent-trigger typed events.
//
// Covers:
//   - dispatchEscalation   — emit an AgentEscalation event via the
//                            EscalationChannel substrate (A3.1).
//   - dispatchDecisionRequest — emit an AgentDecisionRequired event
//                            directly to the EventStore.
//
// Both functions return the emitted event_id so callers can correlate
// follow-on events (e.g. Scrooge's follow-on-router subscribes to
// AgentDecisionRequired via the bus and surfaces it to the CEO).
//
// Authority: Principle 6 — autonomous by default; humans oversee the
// residual. Every decision an agent cannot make on its own is a formal
// typed channel, never a side-channel.
//
// See also:
//   - platform/escalation/channel.ts — full lifecycle management for
//     AgentEscalation (acknowledge / decide / delegate / overdue).
//   - platform/event-trigger/subscribe.ts — subscription helpers.
//
// Author: Atlas (Core banking platform architect, engineering)

import { type AgentEscalationPayload, makeAgentDecisionRequired } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { newEventId } from "../core/types";
import { LocalEscalationChannel } from "../escalation/channel";

// ---------------------------------------------------------------------------
// Default infrastructure constants
// ---------------------------------------------------------------------------

const DEFAULT_ENTITY = "BANK-ZA-001";

const DEFAULT_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:event-trigger",
};

const DEFAULT_CITATIONS: readonly string[] = [
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-2-2024",
];

// ---------------------------------------------------------------------------
// dispatchEscalation
// ---------------------------------------------------------------------------

export interface DispatchEscalationParams {
  /**
   * The event store into which the AgentEscalation is appended.
   * If omitted, the caller must supply `channel`.
   */
  readonly eventStore?: EventStore;

  /**
   * Pre-constructed escalation channel. Either `eventStore` or
   * `channel` is required; `channel` takes precedence if both are
   * supplied.
   */
  readonly channel?: LocalEscalationChannel;

  /** ISO 8601 business time for the event. */
  readonly asOf: string;

  /** Legal-entity identifier (defaults to BANK-ZA-001). */
  readonly entity?: string;

  /** Actor emitting the escalation. */
  readonly actor?: Actor;

  /** Obligation-register citations (P2). */
  readonly citations?: string[];

  /** AgentEscalation payload (see platform/event-store/event-types/agent.ts). */
  readonly payload: AgentEscalationPayload;

  /** Optional deterministic event_id (useful for idempotent re-runs). */
  readonly eventId?: string;
}

export interface DispatchEscalationResult {
  readonly eventId: string;
  readonly escalationId: string;
  /** Resolved routing — may differ from payload.routedTo for sealed escalations. */
  readonly routedTo: string;
}

/**
 * Emit an AgentEscalation event.
 *
 * Uses the `LocalEscalationChannel` so sealed-routing overrides and
 * all channel invariants are enforced. Either pass a pre-built
 * `channel` or an `eventStore` from which a channel is constructed.
 *
 * @throws if neither `channel` nor `eventStore` is supplied.
 */
export function dispatchEscalation(params: DispatchEscalationParams): DispatchEscalationResult {
  const channel =
    params.channel ??
    (params.eventStore
      ? new LocalEscalationChannel(params.eventStore)
      : (() => {
          throw new Error("dispatchEscalation: supply either `channel` or `eventStore`");
        })());

  const result = channel.open({
    asOf: params.asOf,
    entity: params.entity ?? DEFAULT_ENTITY,
    actor: params.actor ?? DEFAULT_ACTOR,
    citations: params.citations ?? [...DEFAULT_CITATIONS],
    payload: params.payload,
    ...(params.eventId !== undefined ? { eventId: params.eventId } : {}),
  });

  return {
    eventId: result.eventId,
    escalationId: result.escalationId,
    routedTo: result.routedTo,
  };
}

// ---------------------------------------------------------------------------
// dispatchDecisionRequest
// ---------------------------------------------------------------------------

export interface DispatchDecisionRequestParams {
  /** The event store into which the AgentDecisionRequired event is appended. */
  readonly eventStore: EventStore;

  /** ISO 8601 business time for the event. */
  readonly asOf: string;

  /** Legal-entity identifier (defaults to BANK-ZA-001). */
  readonly entity?: string;

  /** Actor emitting the request. */
  readonly actor?: Actor;

  /** Obligation-register citations (P2). */
  readonly citations?: string[];

  /**
   * Agent name or URN emitting the request (e.g. "atlas" or
   * "agent:atlas"). Becomes payload.fromAgent.
   */
  readonly fromAgent: string;

  /**
   * Agents or authority level that must respond — agent names or
   * the literal "CEO". At least one required.
   */
  readonly requestedOf: readonly string[];

  /** The question the agent cannot answer within its own mandate. */
  readonly question: string;

  /**
   * Supporting context so the respondent can answer without reading
   * the agent's internal state.
   */
  readonly context: string;

  /**
   * Enumerated options for the respondent. Empty array = free-form
   * answer accepted.
   */
  readonly options?: readonly string[];

  /**
   * ISO 8601 deadline for the decision. Omit when no hard deadline
   * applies.
   */
  readonly deadline?: string;

  /** Optional deterministic event_id for idempotent re-runs. */
  readonly eventId?: string;
}

export interface DispatchDecisionRequestResult {
  readonly eventId: string;
  readonly requestId: string;
}

/**
 * Emit an AgentDecisionRequired event to the event store.
 *
 * The emitted event is a first-class typed artefact (Principle 1).
 * Scrooge's `follow-on-router` handler (event-driven, subscribes to
 * AgentDecisionRequired via the bus) surfaces open requests to the CEO.
 */
export function dispatchDecisionRequest(
  params: DispatchDecisionRequestParams,
): DispatchDecisionRequestResult {
  const requestId = `DR-${params.fromAgent.toUpperCase().replace(/[^A-Z0-9]/g, "-")}-${params.asOf.replace(/[^0-9T]/g, "").slice(0, 15)}`;

  const event = makeAgentDecisionRequired({
    asOf: params.asOf,
    entity: params.entity ?? DEFAULT_ENTITY,
    actor: params.actor ?? { ...DEFAULT_ACTOR, id: `agent:${params.fromAgent.toLowerCase().replace(/[^a-z0-9-]/g, "-")}:event-trigger` },
    citations: params.citations ?? [...DEFAULT_CITATIONS],
    payload: {
      requestId: params.eventId ? `${requestId}-${params.eventId.slice(0, 8)}` : requestId,
      fromAgent: params.fromAgent,
      requestedOf: [...params.requestedOf],
      question: params.question,
      context: params.context,
      options: [...(params.options ?? [])],
      ...(params.deadline !== undefined ? { deadline: params.deadline } : {}),
      raisedAt: params.asOf,
    },
    ...(params.eventId !== undefined ? { eventId: params.eventId } : {}),
  });

  params.eventStore.append(event);

  const payload = event.payload as { requestId: string };
  return {
    eventId: event.event_id,
    requestId: payload.requestId,
  };
}
