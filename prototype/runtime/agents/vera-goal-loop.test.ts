// runtime/agents/vera-goal-loop.test.ts
//
// Unit tests for vera-goal-loop event-reactive helper functions.
//
// Tests cover:
//   openAuditFindingIds:
//   - Empty store → empty set
//   - AuditFinding with no closure → appears in open set
//   - AuditFinding then AuditFindingDisposed → removed from open set
//   - AuditFinding then AuditFindingAcknowledged → removed from open set
//   - Mixed open and closed findings
//
//   reconViolationsInLast4h:
//   - Empty store → false
//   - Recent ReconResult with violationsTotal > 0 → true
//   - Old ReconResult (> 4h) with violations → false
//   - Recent ReconResult with violationsTotal = 0 → false
//
//   staleBriefCountForAgents:
//   - Empty store → 0
//   - Brief addressed to Vera older than threshold → 1
//   - Brief completed (AgentRunCompleted) → 0 (closed)
//   - Brief to non-matching agent → 0
//   - Brief newer than threshold → 0
//   - Multiple briefs to governance group → correct count
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import {
  makeAgentBriefIssued,
  makeAgentRunCompleted,
} from "../../platform/event-store/event-types/agent";
import {
  makeAuditFinding,
  makeAuditFindingClosed,
} from "../../platform/event-store/event-types/audit";
import { EventStore } from "../../platform/event-store/store";
import type { Event } from "../../platform/event-store/types";
import {
  openAuditFindingIds,
  reconViolationsInLast4h,
  staleBriefCountForAgents,
} from "./vera-goal-loop";

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
const BASE_ENTITY = "LE-ZA-HOZ-BANK";

/** Append a minimal AuditFindingDisposed (not in registry → passthrough). */
function appendDisposed(store: EventStore, findingId: string): void {
  const e: Event = {
    event_id: newEventId(),
    type: "AuditFindingDisposed",
    as_of: nowIso(),
    entity: BASE_ENTITY,
    actor: BASE_ACTOR,
    citations: BASE_CITATIONS,
    payload: { findingId },
  };
  store.append(e);
}

/** Append a minimal AuditFindingAcknowledged (not in registry → passthrough). */
function appendAcknowledged(store: EventStore, findingId: string): void {
  const e: Event = {
    event_id: newEventId(),
    type: "AuditFindingAcknowledged",
    as_of: nowIso(),
    entity: BASE_ENTITY,
    actor: BASE_ACTOR,
    citations: BASE_CITATIONS,
    payload: { findingId },
  };
  store.append(e);
}

/** Minimal valid brief doc hash (for factory functions that require it). */
const BRIEF_DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";

// ---------------------------------------------------------------------------
// openAuditFindingIds
// ---------------------------------------------------------------------------

describe("openAuditFindingIds", () => {
  it("returns empty set when store is empty", () => {
    const store = makeStore();
    expect(openAuditFindingIds(store).size).toBe(0);
  });

  it("returns finding ID when AuditFinding has no closure", () => {
    const store = makeStore();
    store.append(
      makeAuditFinding({
        asOf: nowIso(),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-001",
          severity: "high",
          category: "code-quality",
          addressedTo: "agent:atlas",
          agentId: "atlas",
          raisedBy: "agent:vera",
          summary: "Test finding",
          citations: [],
        },
      }),
    );

    const open = openAuditFindingIds(store);
    expect(open.size).toBe(1);
    expect(open.has("F-001")).toBe(true);
  });

  it("removes finding when AuditFindingDisposed is present", () => {
    const store = makeStore();
    store.append(
      makeAuditFinding({
        asOf: hoursAgoIso(2),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-002",
          severity: "medium",
          category: "process",
          addressedTo: "agent:atlas",
          agentId: "atlas",
          raisedBy: "agent:vera",
          summary: "Test finding 002",
          citations: [],
        },
      }),
    );
    appendDisposed(store, "F-002");

    expect(openAuditFindingIds(store).size).toBe(0);
    expect(openAuditFindingIds(store).has("F-002")).toBe(false);
  });

  it("removes finding when AuditFindingAcknowledged is present", () => {
    const store = makeStore();
    store.append(
      makeAuditFinding({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-003",
          severity: "critical",
          category: "mandate",
          addressedTo: "agent:atlas",
          agentId: "atlas",
          raisedBy: "agent:vera",
          summary: "Test finding 003",
          citations: [],
        },
      }),
    );
    appendAcknowledged(store, "F-003");

    expect(openAuditFindingIds(store).size).toBe(0);
  });

  it("removes finding when canonical AuditFindingClosed is present", () => {
    const store = makeStore();
    store.append(
      makeAuditFinding({
        asOf: hoursAgoIso(2),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-004",
          severity: "high",
          category: "process",
          addressedTo: "agent:atlas",
          agentId: "atlas",
          raisedBy: "agent:vera",
          summary: "Test finding 004",
          citations: [],
        },
      }),
    );
    store.append(
      makeAuditFindingClosed({
        asOf: nowIso(),
        entity: BASE_ENTITY,
        actor: { type: "human", id: "marc@tgv.co.za" },
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-004",
          disposition: "resolved",
          verificationMethod: "recon-rerun",
          closedBy: "agent:vera",
          rationale: "Underlying cause fixed; source recon re-run shows 0 violations.",
          citations: [],
        },
      }),
    );

    expect(openAuditFindingIds(store).size).toBe(0);
    expect(openAuditFindingIds(store).has("F-004")).toBe(false);
  });

  it("keeps other open findings when only some are disposed", () => {
    const store = makeStore();
    store.append(
      makeAuditFinding({
        asOf: hoursAgoIso(3),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-010",
          severity: "high",
          category: "security",
          addressedTo: "agent:atlas",
          agentId: "atlas",
          raisedBy: "agent:vera",
          summary: "Finding 010 (to be disposed)",
          citations: [],
        },
      }),
    );
    store.append(
      makeAuditFinding({
        asOf: hoursAgoIso(2),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-011",
          severity: "medium",
          category: "output",
          addressedTo: "agent:atlas",
          agentId: "atlas",
          raisedBy: "agent:vera",
          summary: "Finding 011 (stays open)",
          citations: [],
        },
      }),
    );
    appendDisposed(store, "F-010");

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

  it("returns true for a recent ReconResult with violationsTotal > 0", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "ReconResult",
      as_of: hoursAgoIso(1),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { pipeline: "recon:test", violationsTotal: 3, ok: false },
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
      payload: { pipeline: "recon:test", violationsTotal: 5, ok: false },
    });
    expect(reconViolationsInLast4h(store)).toBe(false);
  });

  it("returns false for a recent ReconResult with violationsTotal = 0", () => {
    const store = makeStore();
    store.append({
      event_id: newEventId(),
      type: "ReconResult",
      as_of: nowIso(),
      entity: BASE_ENTITY,
      actor: BASE_ACTOR,
      citations: BASE_CITATIONS,
      payload: { pipeline: "recon:test", violationsTotal: 0, ok: true },
    });
    expect(reconViolationsInLast4h(store)).toBe(false);
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
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(50),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-vera-001",
          issuedTo: { name: "Vera", position: "internal-audit-engineer" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Audit finding review",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "Audit finding review" }],
        },
      }),
    );
    expect(staleBriefCountForAgents(["Vera"], 48 * 60 * 60 * 1000, store)).toBe(1);
  });

  it("does NOT count a brief where AgentRunCompleted references the briefId", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(50),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-vera-002",
          issuedTo: { name: "Vera", position: "internal-audit-engineer" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Completed brief",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "Completed brief" }],
        },
      }),
    );
    store.append(
      makeAgentRunCompleted({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-vera-002",
          agent: { name: "Vera", position: "internal-audit-engineer" },
          completedAt: hoursAgoIso(1),
          outcome: "delivered",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: [],
          citations: [],
          followOnRoutes: [],
        },
      }),
    );
    expect(staleBriefCountForAgents(["Vera"], 48 * 60 * 60 * 1000, store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-matching agent", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(50),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-atlas-003",
          issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Platform review",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "Platform review PR" }],
        },
      }),
    );
    expect(staleBriefCountForAgents(["Vera"], 48 * 60 * 60 * 1000, store)).toBe(0);
  });

  it("does NOT count a brief that is newer than the stale threshold", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-vera-004",
          issuedTo: { name: "Vera", position: "internal-audit-engineer" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Fresh brief",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "Fresh brief" }],
        },
      }),
    );
    expect(staleBriefCountForAgents(["Vera"], 48 * 60 * 60 * 1000, store)).toBe(0);
  });

  it("matches multiple agent names (governance group)", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(72),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-thandiwe-001",
          issuedTo: { name: "Thandiwe", position: "chief-audit-executive" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Audit committee brief",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "Audit committee brief" }],
        },
      }),
    );
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(60),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-helena-001",
          issuedTo: { name: "Helena", position: "chief-risk-officer" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "RAS review",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "RAS review" }],
        },
      }),
    );
    expect(
      staleBriefCountForAgents(
        ["Vera", "Thandiwe", "Owen", "Helena", "Rashida"],
        48 * 60 * 60 * 1000,
        store,
      ),
    ).toBe(2);
  });
});
