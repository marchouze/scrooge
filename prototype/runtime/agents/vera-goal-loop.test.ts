// runtime/agents/vera-goal-loop.test.ts
//
// Unit tests for vera-goal-loop event-reactive helper functions.
//
// Tests cover:
//   openAuditFindingIds:
//   - Empty store → empty set
//   - AuditFinding with no closure → appears in open set
//   - AuditFinding disposed → removed from open set
//   - AuditFinding acknowledged → removed from open set
//
//   reconViolationsInLast4h:
//   - Empty store → false
//   - Recent ReconResult with violations > 0 → true
//   - Old ReconResult (> 4h) with violations → false
//   - Recent ReconResult with violations = 0 → false
//
//   staleBriefCountForAgents:
//   - Empty store → 0
//   - Brief addressed to Vera older than threshold → 1
//   - Brief completed (AgentRunCompleted) → 0 (closed)
//   - Brief to non-matching agent → 0
//   - Brief newer than threshold → 0
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import { EventStore } from "../../platform/event-store/store";
import { openAuditFindingIds, reconViolationsInLast4h, staleBriefCountForAgents } from "./vera-goal-loop";

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

const BASE_ACTOR = { type: "service" as const, id: "test:vera-goal-loop-test" };
const BASE_CITATIONS = ["test-citation"];
const BASE_ENTITY = "BANK-ZA-001";

// ---------------------------------------------------------------------------
// openAuditFindingIds
// ---------------------------------------------------------------------------

describe("openAuditFindingIds", () => {
  it("returns empty set when store is empty", () => {
    const store = makeStore();
    expect(openAuditFindingIds(store).size).toBe(0);
  });

  it("returns finding ID when AuditFinding is present without closure", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: nowIso(),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-001", severity: "fail", description: "test finding" },
    });

    const open = openAuditFindingIds(store);
    expect(open.size).toBe(1);
    expect(open.has("F-001")).toBe(true);
  });

  it("removes finding when AuditFindingDisposed is present", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: hoursAgoIso(2),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-002", severity: "warn" },
    });
    store.append({
      event_id: newEventId(),
      type: "AuditFindingDisposed",
      as_of: nowIso(),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-002" },
    });

    const open = openAuditFindingIds(store);
    expect(open.size).toBe(0);
    expect(open.has("F-002")).toBe(false);
  });

  it("removes finding when AuditFindingAcknowledged is present", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-003", severity: "fail" },
    });
    store.append({
      event_id: newEventId(),
      type: "AuditFindingAcknowledged",
      as_of: nowIso(),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-003" },
    });

    const open = openAuditFindingIds(store);
    expect(open.size).toBe(0);
  });

  it("keeps other open findings when only some are disposed", () => {
    const store = makeStore();
    // Two findings; one disposed, one still open.
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: hoursAgoIso(3),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-010", severity: "fail" },
    });
    store.append({
      event_id: newEventId(),
      type: "AuditFinding",
      as_of: hoursAgoIso(2),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-011", severity: "warn" },
    });
    store.append({
      event_id: newEventId(),
      type: "AuditFindingDisposed",
      as_of: nowIso(),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { findingId: "F-010" },
    });

    const open = openAuditFindingIds(store);
    expect(open.size).toBe(1);
    expect(open.has("F-011")).toBe(true);
    expect(open.has("F-010")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reconViolationsInLast4h
// ---------------------------------------------------------------------------

describe("reconViolationsInLast4h", () => {
  it("returns false when store is empty", () => {
    const store = makeStore();
    expect(reconViolationsInLast4h(store)).toBe(false);
  });

  it("returns true for a recent ReconResult with violations > 0", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "ReconResult",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { pipeline: "recon:test", violations: 3, status: "fail" },
    });
    expect(reconViolationsInLast4h(store)).toBe(true);
  });

  it("returns false for an old ReconResult (> 4h) with violations", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "ReconResult",
      as_of: hoursAgoIso(5),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { pipeline: "recon:test", violations: 5, status: "fail" },
    });
    expect(reconViolationsInLast4h(store)).toBe(false);
  });

  it("returns false for a recent ReconResult with violations = 0", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "ReconResult",
      as_of: nowIso(),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { pipeline: "recon:test", violations: 0, status: "ok" },
    });
    expect(reconViolationsInLast4h(store)).toBe(false);
  });

  it("returns true when using `fails` payload key instead of `violations`", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "ReconResult",
      as_of: hoursAgoIso(2),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { pipeline: "recon:alt", fails: 1, status: "fail" },
    });
    expect(reconViolationsInLast4h(store)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// staleBriefCountForAgents
// ---------------------------------------------------------------------------

describe("staleBriefCountForAgents", () => {
  it("returns 0 when store is empty", () => {
    const store = makeStore();
    expect(staleBriefCountForAgents(["Vera"], 48 * 60 * 60 * 1000, store)).toBe(0);
  });

  it("counts a brief addressed to Vera older than the threshold", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(50), // older than 48h threshold
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-vera-001",
        issuedTo: { name: "Vera", position: "internal-audit-engineer" },
        title: "Audit finding review",
      },
    });
    expect(staleBriefCountForAgents(["Vera"], 48 * 60 * 60 * 1000, store)).toBe(1);
  });

  it("does NOT count a brief where AgentRunCompleted references the briefId", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(50),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-vera-002",
        issuedTo: { name: "Vera", position: "internal-audit-engineer" },
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
      payload: { briefId: "brief-vera-002", outcome: "delivered" },
    });
    expect(staleBriefCountForAgents(["Vera"], 48 * 60 * 60 * 1000, store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-matching agent", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(50),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-atlas-003",
        issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
        title: "Platform review",
      },
    });
    expect(staleBriefCountForAgents(["Vera"], 48 * 60 * 60 * 1000, store)).toBe(0);
  });

  it("does NOT count a brief that is newer than the stale threshold", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(1), // only 1h old, threshold is 48h
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-vera-004",
        issuedTo: { name: "Vera", position: "internal-audit-engineer" },
        title: "Fresh brief",
      },
    });
    expect(staleBriefCountForAgents(["Vera"], 48 * 60 * 60 * 1000, store)).toBe(0);
  });

  it("matches multiple agent names (governance group)", () => {
    const store = makeStore();
    // Brief for Thandiwe
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(72),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-thandiwe-001",
        issuedTo: { name: "Thandiwe", position: "chief-audit-executive" },
        title: "Audit committee brief",
      },
    });
    // Brief for Helena
    store.append({
      event_id: newEventId(),
      type: "AgentBriefIssued",
      as_of: hoursAgoIso(60),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: {
        briefId: "brief-helena-001",
        issuedTo: { name: "Helena", position: "chief-risk-officer" },
        title: "RAS review",
      },
    });
    expect(
      staleBriefCountForAgents(
        ["Vera", "Thandiwe", "Owen", "Helena", "Rashida"],
        48 * 60 * 60 * 1000,
        store,
      ),
    ).toBe(2);
  });
});
