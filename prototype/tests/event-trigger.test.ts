// tests/event-trigger.test.ts
//
// Unit tests for platform/event-trigger/ — dispatch/subscribe library.
//
// Asserts round-trip dispatch → event store → subscribe for:
//   1. AgentEscalation via dispatchEscalation + subscribeEscalations
//   2. AgentDecisionRequired via dispatchDecisionRequest + subscribeDecisionRequests
//
// Also asserts:
//   - dispatchEscalation propagates sealed-routing overrides from
//     LocalEscalationChannel (A3.1).
//   - listOpenDecisionRequests returns all requests when no AgentDecision
//     has been emitted.
//   - findDecisionRequest / findEscalation return undefined for unknown ids.
//   - Multiple dispatches produce multiple events in sequence order.
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  dispatchDecisionRequest,
  dispatchEscalation,
  findDecisionRequest,
  findEscalation,
  listDecisionRequests,
  listEscalations,
  listOpenDecisionRequests,
  subscribeDecisionRequests,
  subscribeEscalations,
} from "../platform/event-trigger";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR: Actor = { type: "service", id: "agent:atlas:test" };
const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];
const T0 = "2026-05-15T08:00:00.000Z";
const T1 = "2026-05-15T10:00:00.000Z";

function newStore(): EventStore {
  return new EventStore();
}

// ---------------------------------------------------------------------------
// AgentEscalation — dispatch + subscribe round-trip
// ---------------------------------------------------------------------------

describe("dispatchEscalation — round-trip", () => {
  it("emits an AgentEscalation event and subscribeEscalations yields it", () => {
    const store = newStore();

    const result = dispatchEscalation({
      eventStore: store,
      asOf: T0,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        escalationId: "ESC-ATLAS-0001",
        raisedBy: "atlas",
        question: "Does this trade breach the RAS concentration limit?",
        options: ["Approve", "Reject", "Escalate to Helena"],
        blockedBy: "Exceeds agent:atlas mandate — requires Helena (CRO) sign-off.",
        severity: "high",
        routedTo: "human:marc@tgv.co.za",
      },
    });

    expect(result.escalationId).toBe("ESC-ATLAS-0001");
    expect(result.eventId).toBeTruthy();
    expect(result.routedTo).toBe("human:marc@tgv.co.za");

    // subscribeEscalations should yield the event
    const views = listEscalations(store);
    expect(views).toHaveLength(1);
    expect(views[0]?.payload.escalationId).toBe("ESC-ATLAS-0001");
    expect(views[0]?.payload.severity).toBe("high");
    expect(views[0]?.eventId).toBe(result.eventId);
  });

  it("sealed escalation routing is overridden by the channel", () => {
    const store = newStore();

    const result = dispatchEscalation({
      eventStore: store,
      asOf: T0,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        escalationId: "ESC-FRAUD-0001",
        raisedBy: "vera",
        question: "Suspected fraud pattern detected — sealed escalation.",
        options: ["Investigate", "Freeze account"],
        blockedBy: "Fraud escalation requires CAE + CEO + CoSec.",
        severity: "blocking",
        routedTo: "human:vera", // will be overridden by sealed routing
        sealed: { reason: "fraud" },
      },
    });

    // Sealed-routing override: fraud → human:cae+human:ceo+human:cosec
    expect(result.routedTo).toBe("human:cae+human:ceo+human:cosec");
    expect(result.escalationId).toBe("ESC-FRAUD-0001");
  });

  it("findEscalation returns undefined for unknown escalationId", () => {
    const store = newStore();
    expect(findEscalation(store, "ESC-UNKNOWN")).toBeUndefined();
  });

  it("multiple dispatches produce multiple events in sequence order", () => {
    const store = newStore();

    dispatchEscalation({
      eventStore: store,
      asOf: T0,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        escalationId: "ESC-A",
        raisedBy: "helena",
        question: "Q1",
        options: [],
        blockedBy: "Mandate exceeded.",
        severity: "medium",
        routedTo: "human:marc@tgv.co.za",
      },
    });

    dispatchEscalation({
      eventStore: store,
      asOf: T1,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        escalationId: "ESC-B",
        raisedBy: "mira",
        question: "Q2",
        options: ["Yes", "No"],
        blockedBy: "Policy gate requires CEO.",
        severity: "low",
        routedTo: "human:marc@tgv.co.za",
      },
    });

    const views = listEscalations(store);
    expect(views).toHaveLength(2);
    // Sequence order: ESC-A before ESC-B
    expect(views[0]?.payload.escalationId).toBe("ESC-A");
    expect(views[1]?.payload.escalationId).toBe("ESC-B");
  });

  it("subscribeEscalations is a generator that yields one-by-one", () => {
    const store = newStore();
    dispatchEscalation({
      eventStore: store,
      asOf: T0,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        escalationId: "ESC-GEN",
        raisedBy: "atlas",
        question: "Generator test",
        options: [],
        blockedBy: "Mandate exceeded.",
        severity: "low",
        routedTo: "human:marc@tgv.co.za",
      },
    });

    const gen = subscribeEscalations(store);
    const first = gen.next();
    expect(first.done).toBe(false);
    expect(first.value?.payload.escalationId).toBe("ESC-GEN");
    const second = gen.next();
    expect(second.done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AgentDecisionRequired — dispatch + subscribe round-trip
// ---------------------------------------------------------------------------

describe("dispatchDecisionRequest — round-trip", () => {
  it("emits an AgentDecisionRequired event and subscribeDecisionRequests yields it", () => {
    const store = newStore();

    const result = dispatchDecisionRequest({
      eventStore: store,
      asOf: T0,
      actor: ACTOR,
      citations: CITATIONS,
      fromAgent: "atlas",
      requestedOf: ["CEO"],
      question: "Should we proceed with the hedge under current market conditions?",
      context: "BRL/ZAR position is at 80% of RAS limit; market volatility elevated.",
      options: ["Proceed", "Defer", "Reduce position first"],
    });

    expect(result.eventId).toBeTruthy();
    expect(result.requestId).toBeTruthy();

    const views = listDecisionRequests(store);
    expect(views).toHaveLength(1);
    expect(views[0]?.payload.fromAgent).toBe("atlas");
    expect(views[0]?.payload.requestedOf).toEqual(["CEO"]);
    expect(views[0]?.payload.options).toEqual(["Proceed", "Defer", "Reduce position first"]);
    expect(views[0]?.payload.raisedAt).toBe(T0);
  });

  it("findDecisionRequest returns undefined for unknown requestId", () => {
    const store = newStore();
    expect(findDecisionRequest(store, "DR-UNKNOWN")).toBeUndefined();
  });

  it("listOpenDecisionRequests returns all requests when no AgentDecision landed", () => {
    const store = newStore();

    dispatchDecisionRequest({
      eventStore: store,
      asOf: T0,
      actor: ACTOR,
      citations: CITATIONS,
      fromAgent: "mira",
      requestedOf: ["Helena", "CEO"],
      question: "Is the regulatory mapping complete for FAIS s.13?",
      context: "Three obligations remain unlinked; Helena (CRO) may waive if pre-licence.",
      options: ["Approve waiver", "Require full mapping"],
    });

    const open = listOpenDecisionRequests(store);
    expect(open).toHaveLength(1);
    expect(open[0]?.payload.fromAgent).toBe("mira");
  });

  it("multiple requests produce multiple events in sequence order", () => {
    const store = newStore();

    const r1 = dispatchDecisionRequest({
      eventStore: store,
      asOf: T0,
      actor: ACTOR,
      citations: CITATIONS,
      fromAgent: "kai",
      requestedOf: ["CEO"],
      question: "Approve order above RAS threshold?",
      context: "Order size exceeds pre-approved limit.",
      options: ["Approve", "Reject"],
    });

    const r2 = dispatchDecisionRequest({
      eventStore: store,
      asOf: T1,
      actor: ACTOR,
      citations: CITATIONS,
      fromAgent: "bea",
      requestedOf: ["Camille"],
      question: "Apply hedge-accounting designation?",
      context: "IAS 39 effectiveness test passed; CFO sign-off required.",
      options: ["Designate", "Decline"],
      deadline: "2026-05-16T17:00:00.000Z",
    });

    const views = listDecisionRequests(store);
    expect(views).toHaveLength(2);
    // Sequence order: r1 before r2
    expect(views[0]?.eventId).toBe(r1.eventId);
    expect(views[1]?.eventId).toBe(r2.eventId);
    // Deadline is persisted
    expect(views[1]?.payload.deadline).toBe("2026-05-16T17:00:00.000Z");
  });

  it("subscribeDecisionRequests is a generator", () => {
    const store = newStore();

    dispatchDecisionRequest({
      eventStore: store,
      asOf: T0,
      actor: ACTOR,
      citations: CITATIONS,
      fromAgent: "rohan",
      requestedOf: ["CEO"],
      question: "Approve model change?",
      context: "FRTB IMA recalibration pending board sign-off.",
      options: [],
    });

    const gen = subscribeDecisionRequests(store);
    const first = gen.next();
    expect(first.done).toBe(false);
    expect(first.value?.payload.fromAgent).toBe("rohan");
    expect(gen.next().done).toBe(true);
  });

  it("dispatchDecisionRequest with deterministic eventId is idempotent if event_id is unique", () => {
    const store = newStore();
    const fixedId = "00000000-0000-0000-0000-000000000001";

    dispatchDecisionRequest({
      eventStore: store,
      asOf: T0,
      actor: ACTOR,
      citations: CITATIONS,
      fromAgent: "atlas",
      requestedOf: ["CEO"],
      question: "Fixed-id test",
      context: "Testing deterministic eventId.",
      options: [],
      eventId: fixedId,
    });

    const views = listDecisionRequests(store);
    expect(views[0]?.eventId).toBe(fixedId);
  });
});
