// platform/event-trigger/
//
// Event-trigger dispatch and subscribe library.
//
// Provides factory + emit functions for the two primary agent-to-agent
// and agent-to-human typed event channels:
//
//   1. AgentEscalation — emitted when an agent escalates a decision
//      beyond its authority. Full lifecycle (acknowledge / decide /
//      delegate / overdue) managed by platform/escalation/channel.ts.
//      `dispatchEscalation()` here is a convenience wrapper that routes
//      through the LocalEscalationChannel so sealed-routing overrides
//      and integrity guards are always enforced.
//
//   2. AgentDecisionRequired — emitted when an agent needs a human or
//      higher-authority agent to make a decision before it can proceed.
//      Lighter-weight than an escalation: no acknowledge/delegate
//      lifecycle; the agent simply blocks until a decision lands.
//      Scrooge's `follow-on-router` subscribes to this event type via
//      the bus and surfaces open requests to the CEO.
//
// Subscription helpers in subscribe.ts fold the EventStore replay
// stream into typed views. For bus-driven dispatch (handler registered
// in HANDLERS_METADATA and fired by LocalEventTriggerBus), the bus
// machinery in platform/event-trigger-bus/ handles fan-out.
//
// Authority: Principle 6 — autonomous by default; humans oversee the
// residual. Principle 1 — events are the only source of truth.
//
// Author: Atlas (Core banking platform architect, engineering)

// Dispatch
export type {
  DispatchDecisionRequestParams,
  DispatchDecisionRequestResult,
  DispatchEscalationParams,
  DispatchEscalationResult,
} from "./dispatch";
export { dispatchDecisionRequest, dispatchEscalation } from "./dispatch";

// Subscribe
export type {
  DecisionRequestView,
  EscalationEventView,
} from "./subscribe";
export {
  findDecisionRequest,
  findEscalation,
  listDecisionRequests,
  listEscalations,
  listOpenDecisionRequests,
  subscribeDecisionRequests,
  subscribeEscalations,
} from "./subscribe";
