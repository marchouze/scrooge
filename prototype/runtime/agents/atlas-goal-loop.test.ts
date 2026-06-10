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
//   - Brief for Atlas but newer than 30 min (default minAgeMs) → 0
//   - Brief for non-Atlas agent → 0
//   - Priority: event-reactive count > 0 signals trigger should fire before cadence
//
//   openFindingsOwnedByAtlas:
//   - Empty store → 0
//   - AuditFinding owned by Atlas → 1
//   - AuditFinding owned by Atlas then AuditFindingDisposed → 0
//   - AuditFinding owned by Atlas then AuditFindingAcknowledged → 0
//   - AuditFinding owned by someone else → 0
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import type { AgentBriefIssuedPayload } from "../../platform/event-store/event-types/agent";
import {
  makeAgentBriefIssued,
  makeAgentRunCompleted,
  makeAgentRunStarted,
} from "../../platform/event-store/event-types/agent";
import { makeAuditFinding } from "../../platform/event-store/event-types/audit";
import { EventStore } from "../../platform/event-store/store";
import type { Event } from "../../platform/event-store/types";
import {
  isSelfExecutableByAtlas,
  openBriefsAddressedToAtlas,
  openBriefsListForAtlas,
  openFindingsOwnedByAtlas,
} from "./atlas-goal-loop";

const ATLAS_REF = { name: "Atlas", position: "Core banking platform architect" } as const;
const SCROOGE_REF = { name: "Scrooge", position: "Chief of Staff / Orchestrator" } as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(): EventStore {
  return new EventStore(":memory:");
}

function hoursAgoIso(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

const BASE_ACTOR = { type: "service" as const, id: "test:atlas-goal-loop-test" };
const BASE_CITATIONS = ["test-citation"];
const BASE_ENTITY = "LE-ZA-HOZ-BANK";

const BRIEF_DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";

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
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(3),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-atlas-001",
          issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Platform design review",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "Platform design review PR" }],
        },
      }),
    );
    expect(openBriefsAddressedToAtlas(store)).toBe(1);
  });

  it("does NOT count a brief where AgentRunCompleted references the briefId", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(4),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-atlas-002",
          issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Already done",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "Already done PR" }],
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
          briefId: "brief-atlas-002",
          agent: { name: "Atlas", position: "core-banking-platform-architect" },
          completedAt: hoursAgoIso(1),
          outcome: "delivered",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: [],
          citations: [],
          followOnRoutes: [],
        },
      }),
    );
    expect(openBriefsAddressedToAtlas(store)).toBe(0);
  });

  it("does NOT count a brief where AgentRunStarted references the briefId", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(5),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-atlas-003",
          issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "In progress",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "In progress PR" }],
        },
      }),
    );
    store.append(
      makeAgentRunStarted({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief-atlas-003",
          agent: { name: "Atlas", position: "core-banking-platform-architect" },
          startedAt: hoursAgoIso(1),
          substrate: "scrooge-coordinated-in-session",
        },
      }),
    );
    expect(openBriefsAddressedToAtlas(store)).toBe(0);
  });

  it("does NOT count a brief that is newer than 30 minutes (default minAgeMs)", () => {
    const store = makeStore();
    const FIFTEEN_MIN_AGO = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    store.append(
      makeAgentBriefIssued({
        asOf: FIFTEEN_MIN_AGO,
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-atlas-004",
          issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Fresh brief",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "Fresh brief PR" }],
        },
      }),
    );
    expect(openBriefsAddressedToAtlas(store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-Atlas agent", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(4),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-vera-010",
          issuedTo: { name: "Vera", position: "internal-audit-engineer" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Vera brief",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "Vera deliverable" }],
        },
      }),
    );
    expect(openBriefsAddressedToAtlas(store)).toBe(0);
  });

  it("event-reactive fires before cadence: brief count > 0 signals trigger", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(6),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-atlas-priority",
          issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Priority brief",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "Priority PR" }],
        },
      }),
    );
    // Count > 0 → event-reactive candidate 0a fires before cadence candidate 2.
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

  it("counts an open AuditFinding with owner field containing 'atlas'", () => {
    const store = makeStore();
    store.append(
      makeAuditFinding({
        asOf: hoursAgoIso(2),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-ATLAS-001",
          severity: "high",
          category: "code-quality",
          addressedTo: "agent:atlas",
          agentId: "atlas",
          raisedBy: "agent:vera",
          summary: "Missing schema citation",
          owner: "atlas",
          citations: [],
        },
      }),
    );
    expect(openFindingsOwnedByAtlas(store)).toBe(1);
  });

  it("returns 0 after AuditFindingDisposed", () => {
    const store = makeStore();
    store.append(
      makeAuditFinding({
        asOf: hoursAgoIso(3),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-ATLAS-003",
          severity: "high",
          category: "process",
          addressedTo: "agent:atlas",
          agentId: "atlas",
          raisedBy: "agent:vera",
          summary: "Disposed finding",
          owner: "atlas",
          citations: [],
        },
      }),
    );
    appendDisposed(store, "F-ATLAS-003");
    expect(openFindingsOwnedByAtlas(store)).toBe(0);
  });

  it("returns 0 after AuditFindingAcknowledged", () => {
    const store = makeStore();
    store.append(
      makeAuditFinding({
        asOf: hoursAgoIso(3),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-ATLAS-004",
          severity: "medium",
          category: "output",
          addressedTo: "agent:atlas",
          agentId: "atlas",
          raisedBy: "agent:vera",
          summary: "Acknowledged finding",
          owner: "Atlas",
          citations: [],
        },
      }),
    );
    appendAcknowledged(store, "F-ATLAS-004");
    expect(openFindingsOwnedByAtlas(store)).toBe(0);
  });

  it("does NOT count findings owned by another agent", () => {
    const store = makeStore();
    store.append(
      makeAuditFinding({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          findingId: "F-VERA-001",
          severity: "high",
          category: "mandate",
          addressedTo: "agent:vera",
          agentId: "vera",
          raisedBy: "agent:vera",
          summary: "Vera finding",
          owner: "Vera",
          citations: [],
        },
      }),
    );
    expect(openFindingsOwnedByAtlas(store)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// openBriefsListForAtlas — oldest-first list + duplicate-envelope collapse.
//
// The phantom-open-brief case: 44 RMS-Phase-2 test envelopes all share the
// briefId `brief:atlas:rms-slice-2-second-event`. The list must collapse them
// to ONE open entry so a single run-lifecycle pair against that briefId clears
// the whole batch (not 44 separate runs).
// ---------------------------------------------------------------------------

describe("openBriefsListForAtlas", () => {
  function appendBrief(store: EventStore, briefId: string, hoursAgo: number, title = "T"): void {
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(hoursAgo),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId,
          issuedTo: ATLAS_REF,
          issuedBy: SCROOGE_REF,
          title,
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "d" }],
        },
      }),
    );
  }

  it("returns empty for an empty store", () => {
    expect(openBriefsListForAtlas(makeStore())).toEqual([]);
  });

  it("collapses 44 envelopes sharing one briefId to a single open entry", () => {
    const store = makeStore();
    for (let i = 0; i < 44; i++) {
      appendBrief(
        store,
        "brief:atlas:rms-slice-2-second-event",
        3,
        "Same body, different envelope",
      );
    }
    const open = openBriefsListForAtlas(store);
    expect(open).toHaveLength(1);
    expect(open[0]?.briefId).toBe("brief:atlas:rms-slice-2-second-event");
    // The count helper agrees.
    expect(openBriefsAddressedToAtlas(store)).toBe(1);
  });

  it("a single AgentRunStarted on the shared briefId clears the whole batch", () => {
    const store = makeStore();
    for (let i = 0; i < 44; i++) {
      appendBrief(store, "brief:atlas:rms-slice-2-second-event", 3);
    }
    store.append(
      makeAgentRunStarted({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          runId: newEventId(),
          briefId: "brief:atlas:rms-slice-2-second-event",
          agent: ATLAS_REF,
          startedAt: hoursAgoIso(1),
          substrate: "agent-runtime",
        },
      }),
    );
    expect(openBriefsListForAtlas(store)).toHaveLength(0);
  });

  it("orders distinct open briefs oldest-first (FIFO drain)", () => {
    const store = makeStore();
    appendBrief(store, "brief:atlas:newer", 2, "newer");
    appendBrief(store, "brief:atlas:older", 6, "older");
    const open = openBriefsListForAtlas(store);
    expect(open.map((b) => b.briefId)).toEqual(["brief:atlas:older", "brief:atlas:newer"]);
  });
});

// ---------------------------------------------------------------------------
// isSelfExecutableByAtlas — triage classifier.
//
// Atlas's rule engine owns exactly one deterministic deliverable: the
// SubstrateStateSnapshot. Code-PR / schema / design work is judgement work and
// must classify as NOT self-executable so the dispatcher emits
// AgentRunCompleted{outcome:"blocked"} (selected-but-blocked-on-LLM) rather than
// a fabricated delivery.
// ---------------------------------------------------------------------------

describe("isSelfExecutableByAtlas", () => {
  const brief = (
    title: string,
    kind: "code-pr" | "deliverable-document" | "register-row" | "decision-card",
  ): AgentBriefIssuedPayload => ({
    briefId: "b",
    issuedTo: ATLAS_REF,
    issuedBy: SCROOGE_REF,
    title,
    directiveDocumentHash: BRIEF_DOC_HASH,
    priority: "next-tick",
    expectedOutputs: [{ kind, description: "d" }],
  });

  it("is NOT self-executable when the brief requires a code-pr output", () => {
    expect(isSelfExecutableByAtlas(brief("Refresh the substrate-state snapshot", "code-pr"))).toBe(
      false,
    );
  });

  it("is self-executable for a substrate-state attestation with no code output", () => {
    expect(
      isSelfExecutableByAtlas(
        brief("Substrate-state readiness attestation", "deliverable-document"),
      ),
    ).toBe(true);
  });

  it("is NOT self-executable for a platform-design code-PR brief", () => {
    expect(
      isSelfExecutableByAtlas(
        brief("Route explicit-provenance emitters through the category policy", "code-pr"),
      ),
    ).toBe(false);
  });

  it("is NOT self-executable for a non-substrate-state brief with no code output", () => {
    expect(isSelfExecutableByAtlas(brief("Approve a new event schema", "register-row"))).toBe(
      false,
    );
  });
});
