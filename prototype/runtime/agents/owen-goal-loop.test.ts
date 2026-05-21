// runtime/agents/owen-goal-loop.test.ts
//
// Unit tests for owen-goal-loop event-reactive helper functions.
//
// Tests cover:
//   approvedDecisionsSinceLastGovPrep:
//   - Empty store → 0
//   - Approved Decision, no GovernanceCyclePrep → 1
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
//   - Priority: two workstreams post-prep → count is 2
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (CEO-approved 2026-05-11) Slice 3.
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { newEventId } from "../../platform/core/types";
import {
  makeAgentBriefIssued,
  makeAgentRunCompleted,
  makeAgentRunStarted,
} from "../../platform/event-store/event-types/agent";
import { makeDecision } from "../../platform/event-store/event-types/decision";
import { makeWorkstreamRegistered } from "../../platform/event-store/event-types/platform";
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
const BASE_ENTITY = "LE-ZA-HOZ-BANK";

const BRIEF_DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";

/** Append a minimal GovernanceCyclePrep (passthrough schema, all optional). */
function appendGovPrep(store: EventStore, asOf: string): void {
  store.append({
    event_id: newEventId(),
    type: "GovernanceCyclePrep",
    as_of: asOf,
    entity: BASE_ENTITY,
    actor: BASE_ACTOR,
    citations: BASE_CITATIONS,
    payload: { runTrigger: "test" },
  });
}

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
    store.append(
      makeDecision({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          decisionId: "D-TEST-001",
          phase: "approved",
          title: "Test decision",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          category: "governance",
          recommendation: "Approve",
          rationale: "Test",
          sourceDocHashes: [],
          citations: [],
          recordedVia: "scrooge:session-delegation",
        },
      }),
    );
    expect(approvedDecisionsSinceLastGovPrep(store)).toBe(1);
  });

  it("does NOT count an approved Decision that predates the GovernanceCyclePrep", () => {
    const store = makeStore();
    // Decision emitted 5h ago; GovernanceCyclePrep emitted 3h ago → already processed.
    store.append(
      makeDecision({
        asOf: hoursAgoIso(5),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          decisionId: "D-TEST-002",
          phase: "approved",
          title: "Older decision",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          category: "governance",
          recommendation: "Approve",
          rationale: "Test",
          sourceDocHashes: [],
          citations: [],
          recordedVia: "scrooge:session-delegation",
        },
      }),
    );
    appendGovPrep(store, hoursAgoIso(3));
    expect(approvedDecisionsSinceLastGovPrep(store)).toBe(0);
  });

  it("counts an approved Decision emitted after the GovernanceCyclePrep", () => {
    const store = makeStore();
    appendGovPrep(store, hoursAgoIso(4));
    store.append(
      makeDecision({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          decisionId: "D-TEST-003",
          phase: "approved",
          title: "New decision",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          category: "engineering",
          recommendation: "Approve",
          rationale: "New substrate needed",
          sourceDocHashes: [],
          citations: [],
          recordedVia: "scrooge:session-delegation",
        },
      }),
    );
    expect(approvedDecisionsSinceLastGovPrep(store)).toBe(1);
  });

  it("does NOT count a Decision with phase = requested (pending)", () => {
    const store = makeStore();
    store.append(
      makeDecision({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          decisionId: "D-TEST-004",
          phase: "requested",
          title: "Pending decision",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          category: "governance",
          recommendation: "Approve",
          rationale: "Pending",
          sourceDocHashes: [],
          citations: [],
          recordedVia: "scrooge:session-delegation",
        },
      }),
    );
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
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(6),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-owen-001",
          issuedTo: { name: "Owen", position: "company-secretary" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Governance cycle prep",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "Gov cycle deliverable" }],
        },
      }),
    );
    expect(openBriefsAddressedToOwen(store)).toBe(1);
  });

  it("does NOT count a brief with AgentRunCompleted closure", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(6),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-owen-002",
          issuedTo: { name: "Owen", position: "company-secretary" },
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
          briefId: "brief-owen-002",
          agent: { name: "Owen", position: "company-secretary" },
          completedAt: hoursAgoIso(1),
          outcome: "delivered",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: [],
          citations: [],
          followOnRoutes: [],
        },
      }),
    );
    expect(openBriefsAddressedToOwen(store)).toBe(0);
  });

  it("does NOT count a brief with AgentRunStarted (already in progress)", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(6),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-owen-003",
          issuedTo: { name: "Owen", position: "company-secretary" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "In-progress brief",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "In-progress brief" }],
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
          briefId: "brief-owen-003",
          agent: { name: "Owen", position: "company-secretary" },
          startedAt: hoursAgoIso(1),
          substrate: "scrooge-coordinated-in-session",
        },
      }),
    );
    expect(openBriefsAddressedToOwen(store)).toBe(0);
  });

  it("does NOT count a brief newer than 4 hours", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(2),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-owen-004",
          issuedTo: { name: "Owen", position: "company-secretary" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Fresh brief",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "deliverable-document", description: "Fresh brief" }],
        },
      }),
    );
    expect(openBriefsAddressedToOwen(store)).toBe(0);
  });

  it("does NOT count a brief addressed to a non-Owen agent", () => {
    const store = makeStore();
    store.append(
      makeAgentBriefIssued({
        asOf: hoursAgoIso(6),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          briefId: "brief-atlas-010",
          issuedTo: { name: "Atlas", position: "core-banking-platform-architect" },
          issuedBy: { name: "Scrooge", position: "chief-of-staff" },
          title: "Atlas brief",
          directiveDocumentHash: BRIEF_DOC_HASH,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "Atlas PR" }],
        },
      }),
    );
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
    store.append(
      makeWorkstreamRegistered({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          workstreamId: "WS-TEST-001",
          title: "New workstream",
          owner: "atlas",
          status: "in-flight",
          summary: "Test workstream",
        },
      }),
    );
    expect(newWorkstreamsSinceLastGovPrep(store)).toBe(1);
  });

  it("does NOT count a WorkstreamRegistered that predates the GovernanceCyclePrep", () => {
    const store = makeStore();
    store.append(
      makeWorkstreamRegistered({
        asOf: hoursAgoIso(6),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          workstreamId: "WS-TEST-002",
          title: "Old workstream",
          owner: "atlas",
          status: "in-flight",
          summary: "Old WS",
        },
      }),
    );
    appendGovPrep(store, hoursAgoIso(3));
    expect(newWorkstreamsSinceLastGovPrep(store)).toBe(0);
  });

  it("counts a WorkstreamRegistered event emitted after the GovernanceCyclePrep", () => {
    const store = makeStore();
    appendGovPrep(store, hoursAgoIso(4));
    store.append(
      makeWorkstreamRegistered({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          workstreamId: "WS-TEST-003",
          title: "Post-prep workstream",
          owner: "atlas",
          status: "in-flight",
          summary: "Post-prep WS",
        },
      }),
    );
    expect(newWorkstreamsSinceLastGovPrep(store)).toBe(1);
  });

  it("event-reactive fires before cadence: two workstreams post-prep → count 2", () => {
    const store = makeStore();
    appendGovPrep(store, hoursAgoIso(5));
    store.append(
      makeWorkstreamRegistered({
        asOf: hoursAgoIso(2),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          workstreamId: "WS-TEST-004",
          title: "WS 1",
          owner: "atlas",
          status: "in-flight",
          summary: "WS 1 summary",
        },
      }),
    );
    store.append(
      makeWorkstreamRegistered({
        asOf: hoursAgoIso(1),
        entity: BASE_ENTITY,
        actor: BASE_ACTOR,
        citations: BASE_CITATIONS,
        payload: {
          workstreamId: "WS-TEST-005",
          title: "WS 2",
          owner: "atlas",
          status: "planned",
          summary: "WS 2 summary",
        },
      }),
    );
    expect(newWorkstreamsSinceLastGovPrep(store)).toBe(2);
  });
});
