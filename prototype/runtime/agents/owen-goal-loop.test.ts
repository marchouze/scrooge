// runtime/agents/owen-goal-loop.test.ts
//
// Unit tests for owen-goal-loop event-reactive helper functions.
//
// Tests cover:
//   approvedDecisionsSinceLastGovPrep:
//   - Empty store → 0
//   - Approved Decision event, no GovernanceCyclePrep → 1
//   - Approved Decision before GovernanceCyclePrep → 0 (already processed)
//   - Approved Decision after GovernanceCyclePrep → 1
//   - Non-approved Decision (pending) → 0
//
//   openBriefsAddressedToOwen:
//   - Empty store → 0
//   - Brief for Owen older than 4h → 1
//   - Brief for Owen completed → 0
//   - Brief for Owen started → 0
//   - Brief for Owen but newer than 4h → 0
//   - Brief for non-Owen agent → 0
//
//   newWorkstreamsSinceLastGovPrep:
//   - Empty store → 0
//   - WorkstreamRegistered, no GovernanceCyclePrep → 1
//   - WorkstreamRegistered before GovernanceCyclePrep → 0
//   - WorkstreamRegistered after GovernanceCyclePrep → 1
//   - Priority: event-reactive fires before cadence (count > 0 → non-zero)
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import { EventStore } from "../../platform/event-store/store";
import {
  approvedDecisionsSinceLastGovPrep,
  newWorkstreamsSinceLastGovPrep,
  openBriefsAddressedToOwen,
} from "./owen-goal-loop";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function hoursAgoIso(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

const BASE_ACTOR = { type: "service" as const, id: "test:owen-goal-loop-test" };
const BASE_CITATIONS = ["test-citation"];
const BASE_ENTITY = "BANK-ZA-001";

// ---------------------------------------------------------------------------
// approvedDecisionsSinceLastGovPrep
// ---------------------------------------------------------------------------

describe("approvedDecisionsSinceLastGovPrep", () => {
  it("returns 0 when store is empty", () => {
    const store = makeStore();
    expect(approvedDecisionsSinceLastGovPrep(store)).toBe(0);
  });

  it("counts an approved Decision when no GovernanceCyclePrep exists", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "Decision",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        decisionId: "D-TEST-001",
        phase: "approved",
        title: "Test decision",
        authority: "CEO",
      },
    });
    expect(approvedDecisionsSinceLastGovPrep(store)).toBe(1);
  });

  it("does NOT count an approved Decision that predates the GovernanceCyclePrep", () => {
    const store = makeStore();
    // Decision emitted 5h ago; GovernanceCyclePrep emitted 3h ago → already processed.
    store.append({
      event_id: newEventId(),
      type: "Decision",
      as_of: hoursAgoIso(5),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        decisionId: "D-TEST-002",
        phase: "approved",
        title: "Older decision",
        authority: "CEO",
      },
    });
    store.append({
      event_id: newEventId(),
      type: "GovernanceCyclePrep",
      as_of: hoursAgoIso(3),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { cycleId: "GCP-001" },
    });
    expect(approvedDecisionsSinceLastGovPrep(store)).toBe(0);
  });

  it("counts an approved Decision emitted after the GovernanceCyclePrep", () => {
    const store = makeStore();
    // GovernanceCyclePrep 4h ago; Decision 1h ago → new since last prep.
    store.append({
      event_id: newEventId(),
      type: "GovernanceCyclePrep",
      as_of: hoursAgoIso(4),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { cycleId: "GCP-002" },
    });
    store.append({
      event_id: newEventId(),
      type: "Decision",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        decisionId: "D-TEST-003",
        phase: "approved",
        title: "New decision",
        authority: "CEO",
      },
    });
    expect(approvedDecisionsSinceLastGovPrep(store)).toBe(1);
  });

  it("does NOT count a Decision with phase = pending", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "Decision",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        decisionId: "D-TEST-004",
        phase: "pending",
        title: "Pending decision",
        authority: "CEO",
      },
    });
    expect(approvedDecisionsSinceLastGovPrep(store)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// openBriefsAddressedToOwen
// ---------------------------------------------------------------------------

describe("openBriefsAddressedToOwen", () => {
  it("returns 0 when store is empty", () => {
    const store = makeStore();
    expect(openBriefsAddressedToOwen(store)).toBe(0);
  });

  it("counts a brief addressed to Owen older than 4 hours", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(6),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-owen-001",
        issuedTo: { name: "Owen", position: "company-secretary" },
        title: "Governance cycle prep",
      },
    });
    expect(openBriefsAddressedToOwen(store)).toBe(1);
  });

  it("does NOT count a brief with AgentRunCompleted closure", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(6),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-owen-002",
        issuedTo: { name: "Owen", position: "company-secretary" },
        title: "Completed brief",
      },
    });
    store.append({
      event_id: newEventId(),
      type: "AgentRunCompleted",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { briefId: "brief-owen-002", outcome: "delivered" },
    });
    expect(openBriefsAddressedToOwen(store)).toBe(0);
  });

  it("does NOT count a brief with AgentRunStarted (already in progress)", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(6),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-owen-003",
        issuedTo: { name: "Owen", position: "company-secretary" },
        title: "In-progress brief",
      },
    });
    store.append({
      event_id: newEventId(),
      type: "AgentRunStarted",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { briefId: "brief-owen-003" },
    });
    expect(openBriefsAddressedToOwen(store)).toBe(0);
  });

  it("does NOT count a brief newer than 4 hours", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(2), // only 2h old, threshold is 4h
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-owen-004",
        issuedTo: { name: "Owen", position: "company-secretary" },
        title: "Fresh brief",
      },
    });
    expect(openBriefsAddressedToOwen(store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-Owen agent", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(6),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-atlas-010",
        issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
        title: "Atlas brief",
      },
    });
    expect(openBriefsAddressedToOwen(store)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// newWorkstreamsSinceLastGovPrep
// ---------------------------------------------------------------------------

describe("newWorkstreamsSinceLastGovPrep", () => {
  it("returns 0 when store is empty", () => {
    const store = makeStore();
    expect(newWorkstreamsSinceLastGovPrep(store)).toBe(0);
  });

  it("counts a WorkstreamRegistered event when no GovernanceCyclePrep exists", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "WorkstreamRegistered",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { workstreamId: "WS-TEST-001", title: "New workstream" },
    });
    expect(newWorkstreamsSinceLastGovPrep(store)).toBe(1);
  });

  it("does NOT count a WorkstreamRegistered that predates the GovernanceCyclePrep", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "WorkstreamRegistered",
      as_of: hoursAgoIso(6),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { workstreamId: "WS-TEST-002", title: "Old workstream" },
    });
    store.append({
      event_id: newEventId(),
      type: "GovernanceCyclePrep",
      as_of: hoursAgoIso(3),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { cycleId: "GCP-003" },
    });
    expect(newWorkstreamsSinceLastGovPrep(store)).toBe(0);
  });

  it("counts a WorkstreamRegistered event emitted after the GovernanceCyclePrep", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "GovernanceCyclePrep",
      as_of: hoursAgoIso(4),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { cycleId: "GCP-004" },
    });
    store.append({
      event_id: newEventId(),
      type: "WorkstreamRegistered",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { workstreamId: "WS-TEST-003", title: "Post-prep workstream" },
    });
    expect(newWorkstreamsSinceLastGovPrep(store)).toBe(1);
  });

  it("event-reactive fires before cadence: count > 0 indicates trigger should fire", () => {
    const store = makeStore();
    // Add two workstreams after the last prep.
    store.append({
      event_id: newEventId(),
      type: "GovernanceCyclePrep",
      as_of: hoursAgoIso(5),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { cycleId: "GCP-005" },
    });
    store.append({
      event_id: newEventId(),
      type: "WorkstreamRegistered",
      as_of: hoursAgoIso(2),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { workstreamId: "WS-TEST-004", title: "WS 1" },
    });
    store.append({
      event_id: newEventId(),
      type: "WorkstreamRegistered",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { workstreamId: "WS-TEST-005", title: "WS 2" },
    });
    // Both workstreams are newer than the last GovernanceCyclePrep → count is 2.
    expect(newWorkstreamsSinceLastGovPrep(store)).toBe(2);
  });
});
