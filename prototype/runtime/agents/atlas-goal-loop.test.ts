// runtime/agents/atlas-goal-loop.test.ts
//
// Unit tests for atlas-goal-loop event-reactive helper functions.
//
// Tests cover:
//   openBriefsAddressedToAtlas:
//   - Empty store → 0
//   - Old brief for Atlas (> 2h) → 1
//   - Brief for Atlas but AgentRunCompleted → 0 (closed)
//   - Brief for Atlas but AgentRunStarted → 0 (started)
//   - Brief for Atlas but newer than 2h → 0
//   - Brief for non-Atlas agent → 0
//
//   openFindingsOwnedByAtlas:
//   - Empty store → 0
//   - AuditFinding owned by Atlas → 1
//   - AuditFinding owned by Atlas then disposed → 0
//   - AuditFinding owned by Atlas then acknowledged → 0
//   - AuditFinding owned by someone else → 0
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import { EventStore } from "../../platform/event-store/store";
import { openBriefsAddressedToAtlas, openFindingsOwnedByAtlas } from "./atlas-goal-loop";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function nowIso(): string {
  return new Date().toISOString();
}

function hoursAgoIso(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

const BASE_ACTOR = { type: "service" as const, id: "test:atlas-goal-loop-test" };
const BASE_CITATIONS = ["test-citation"];
const BASE_ENTITY = "BANK-ZA-001";

// ---------------------------------------------------------------------------
// openBriefsAddressedToAtlas
// ---------------------------------------------------------------------------

describe("openBriefsAddressedToAtlas", () => {
  it("returns 0 when store is empty", () => {
    const store = makeStore();
    expect(openBriefsAddressedToAtlas(store)).toBe(0);
  });

  it("counts a brief addressed to Atlas older than 2 hours", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(3),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-atlas-001",
        issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
        title: "Platform design review",
      },
    });
    expect(openBriefsAddressedToAtlas(store)).toBe(1);
  });

  it("does NOT count a brief where AgentRunCompleted references the briefId", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(4),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-atlas-002",
        issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
        title: "Already done",
      },
    });
    store.append({
      event_id: newEventId(),
      type: "AgentRunCompleted",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { briefId: "brief-atlas-002", outcome: "delivered" },
    });
    expect(openBriefsAddressedToAtlas(store)).toBe(0);
  });

  it("does NOT count a brief where AgentRunStarted references the briefId", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(5),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-atlas-003",
        issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
        title: "In progress",
      },
    });
    store.append({
      event_id: newEventId(),
      type: "AgentRunStarted",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { briefId: "brief-atlas-003" },
    });
    expect(openBriefsAddressedToAtlas(store)).toBe(0);
  });

  it("does NOT count a brief that is newer than 2 hours", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(1), // only 1h old — under the 2h threshold
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-atlas-004",
        issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
        title: "Fresh brief",
      },
    });
    expect(openBriefsAddressedToAtlas(store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-Atlas agent", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(4),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-vera-010",
        issuedTo: { name: "Vera", position: "internal-audit-engineer" },
        title: "Vera brief",
      },
    });
    expect(openBriefsAddressedToAtlas(store)).toBe(0);
  });

  it("event-reactive fires before cadence: brief count > 0 takes priority", () => {
    const store = makeStore();
    // This test validates that given a brief > 2h old, count is non-zero.
    // The goal deriver will check this before checking the cadence candidate.
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(6),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-atlas-priority",
        issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
        title: "Priority brief",
      },
    });
    expect(openBriefsAddressedToAtlas(store)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// openFindingsOwnedByAtlas
// ---------------------------------------------------------------------------

describe("openFindingsOwnedByAtlas", () => {
  it("returns 0 when store is empty", () => {
    const store = makeStore();
    expect(openFindingsOwnedByAtlas(store)).toBe(0);
  });

  it("counts an open AuditFinding with owner = atlas", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: hoursAgoIso(2),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        findingId: "F-ATLAS-001",
        severity: "fail",
        owner: "atlas",
        description: "Missing schema citation",
      },
    });
    expect(openFindingsOwnedByAtlas(store)).toBe(1);
  });

  it("counts a finding with recommendedOwner = Atlas (case-insensitive)", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        findingId: "F-ATLAS-002",
        severity: "warn",
        recommendedOwner: "Atlas",
        description: "Orphan event type",
      },
    });
    expect(openFindingsOwnedByAtlas(store)).toBe(1);
  });

  it("returns 0 after AuditFindingDisposed", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: hoursAgoIso(3),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-ATLAS-003", severity: "fail", owner: "atlas" },
    });
    store.append({
      event_id: newEventId(),
      type: "AuditFindingDisposed",
      as_of: nowIso(),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-ATLAS-003" },
    });
    expect(openFindingsOwnedByAtlas(store)).toBe(0);
  });

  it("returns 0 after AuditFindingAcknowledged", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: hoursAgoIso(3),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-ATLAS-004", severity: "warn", owner: "Atlas" },
    });
    store.append({
      event_id: newEventId(),
      type: "AuditFindingAcknowledged",
      as_of: nowIso(),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-ATLAS-004" },
    });
    expect(openFindingsOwnedByAtlas(store)).toBe(0);
  });

  it("does NOT count findings owned by another agent", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-VERA-001", severity: "fail", owner: "Vera" },
    });
    expect(openFindingsOwnedByAtlas(store)).toBe(0);
  });
});
