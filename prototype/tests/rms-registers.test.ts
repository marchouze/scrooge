// tests/rms-registers.test.ts
//
// D-RMS-PHASE-1 Slice 3 — projection-runtime tests for the seven RMS
// register projections.
//
// Asserts:
//   - Each projection round-trips a fixture event stream into the expected
//     register rows (happy-path).
//   - Pair-coupled projections handle out-of-order replay (Completed before
//     Started; CeoDecision before DecisionRequested).
//   - Supersession resolves cleanly (BriefSuperseded; RecordFiled supersedes).
//   - Snapshot codec is round-trip stable (`decodeSnapshot(encodeSnapshot(s))`
//     equals s, and folding forward from a snapshot equals folding from
//     scratch — the EvSS Slice-3 equivalence guarantee).
//   - Provenance filter skips events tagged with non-matching kinds /
//     scenarios.
//   - Replay is deterministic — folding the same events twice yields equal
//     state.
//
// Author: Anya (Data / analytics engineer, engineering)

import { describe, expect, it } from "bun:test";

import { BANK_ZA_001, newEventId } from "../platform/core/types";
import {
  makeAgentBriefIssued,
  makeAgentRunCompleted,
  makeAgentRunStarted,
  makeBriefSuperseded,
  makeDecisionRequested,
  makeFeedback,
  makeRecordFiled,
} from "../platform/event-store/event-types";
import { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";
import { LocalProjector } from "../platform/projections";
import {
  agentRunsRegisterProjection,
  agentRunsRegisterRows,
  briefsRegisterProjection,
  briefsRegisterRows,
  correspondenceRegisterProjection,
  correspondenceRegisterRows,
  decisionsRegisterProjection,
  decisionsRegisterRows,
  documentRegisterProjection,
  documentRegisterRows,
  feedbackRegisterBySubject,
  feedbackRegisterProjection,
  feedbackRegisterRows,
  filterEventsByProvenance,
  workstreamsRegisterProjection,
  workstreamsRegisterRows,
} from "../platform/rms-registers";

const ENTITY = BANK_ZA_001;
const ACTOR = { type: "service" as const, id: "agent:atlas" };
const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"];

const SCROOGE = { name: "Scrooge", position: "Chief of Staff / Orchestrator" };
const ATLAS = { name: "Atlas", position: "Core banking platform architect" };
const ANYA = { name: "Anya", position: "Data / analytics engineer" };
const OWEN = { name: "Owen", position: "Company Secretary, governance" };

// 64-hex BLAKE3-shape placeholders (the projections do not validate; the
// emitter constructors do, and we use real makeXxx() helpers below).
const HASH_A = `blake3:${"a".repeat(64)}`;
const HASH_B = `blake3:${"b".repeat(64)}`;
const HASH_C = `blake3:${"c".repeat(64)}`;
const HASH_D = `blake3:${"d".repeat(64)}`;

function newStore(): EventStore {
  return new EventStore();
}

function appendCeoDecision(
  store: EventStore,
  args: {
    decisionId: string;
    action: "approve" | "defer" | "modify" | "request-revision";
    title: string;
    outcome: string;
    asOf: string;
    requestEventId?: string;
  },
): Event {
  const event: Event = {
    event_id: newEventId(),
    type: "CeoDecision",
    as_of: args.asOf,
    entity: ENTITY,
    actor: { type: "human", id: "marc@tgv.co.za" },
    citations: CITATIONS,
    payload: {
      decisionId: args.decisionId,
      title: args.title,
      action: args.action,
      outcome: args.outcome,
      recordedVia: "test",
      ...(args.requestEventId ? { requestEventId: args.requestEventId } : {}),
    },
  };
  store.append(event);
  return event;
}

// ---------------------------------------------------------------------------
// Decisions register
// ---------------------------------------------------------------------------

describe("decisionsRegisterProjection", () => {
  it("opens a row on DecisionRequested and resolves on matching CeoDecision", () => {
    const store = newStore();
    const requestEv = makeDecisionRequested({
      asOf: "2026-05-10T08:00:00Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        decisionId: "D-TEST-1",
        title: "Test decision",
        category: "near-term",
        owner: ATLAS,
        forActor: "CEO",
        decisionForActor: "Approve / defer / modify.",
        recommendation: { stance: "approve", reasoning: "Tested." },
        sourceDocumentHashes: [HASH_A],
        citations: ["P1-EVENTS-ARE-TRUTH"],
      },
    });
    store.append(requestEv);

    const projector = new LocalProjector(store);
    let state = projector.build(decisionsRegisterProjection);
    let rows = decisionsRegisterRows(state);
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe("open");
    expect(rows[0]?.title).toBe("Test decision");
    expect(rows[0]?.sourceDocumentHashes).toEqual([HASH_A]);

    appendCeoDecision(store, {
      decisionId: "D-TEST-1",
      action: "approve",
      title: "Test decision",
      outcome: "Approved.",
      asOf: "2026-05-10T09:00:00Z",
      requestEventId: requestEv.event_id,
    });

    state = projector.build(decisionsRegisterProjection);
    rows = decisionsRegisterRows(state);
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe("resolved");
    expect(rows[0]?.resolvedAt).toBe("2026-05-10T09:00:00Z");
    expect(rows[0]?.resolution?.action).toBe("approve");
    store.close();
  });

  it("flips to revision-requested when CEO actions request-revision", () => {
    const store = newStore();
    store.append(
      makeDecisionRequested({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          decisionId: "D-REV-1",
          title: "Revision test",
          category: "pacing",
          owner: ATLAS,
          forActor: "CEO",
          decisionForActor: "Approve / revise.",
          recommendation: { stance: "approve", reasoning: "x" },
          sourceDocumentHashes: [],
          citations: ["P1-EVENTS-ARE-TRUTH"],
        },
      }),
    );
    appendCeoDecision(store, {
      decisionId: "D-REV-1",
      action: "request-revision",
      title: "Revision test",
      outcome: "Please revise.",
      asOf: "2026-05-10T09:00:00Z",
    });

    const projector = new LocalProjector(store);
    const rows = decisionsRegisterRows(projector.build(decisionsRegisterProjection));
    expect(rows[0]?.status).toBe("revision-requested");
    expect(rows[0]?.resolution?.action).toBe("request-revision");
    store.close();
  });

  it("handles CeoDecision arriving before DecisionRequested (out-of-order)", () => {
    const store = newStore();
    appendCeoDecision(store, {
      decisionId: "D-OUT-1",
      action: "approve",
      title: "Out-of-order",
      outcome: "Approved.",
      asOf: "2026-05-10T10:00:00Z",
    });
    // Stub row materialised — request-side fields blank but resolution set.
    const projector = new LocalProjector(store);
    let rows = decisionsRegisterRows(projector.build(decisionsRegisterProjection));
    expect(rows[0]?.status).toBe("resolved");
    expect(rows[0]?.requestEventId).toBe("");

    // DecisionRequested arrives later; existing resolution is preserved.
    store.append(
      makeDecisionRequested({
        asOf: "2026-05-10T11:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          decisionId: "D-OUT-1",
          title: "Out-of-order",
          category: "near-term",
          owner: ATLAS,
          forActor: "CEO",
          decisionForActor: "Q",
          recommendation: { stance: "approve", reasoning: "x" },
          sourceDocumentHashes: [],
          citations: ["P1-EVENTS-ARE-TRUTH"],
        },
      }),
    );
    rows = decisionsRegisterRows(projector.build(decisionsRegisterProjection));
    expect(rows[0]?.status).toBe("resolved");
    expect(rows[0]?.requestEventId).not.toBe("");
    store.close();
  });

  it("snapshot codec round-trips state", () => {
    const store = newStore();
    store.append(
      makeDecisionRequested({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          decisionId: "D-SNAP-1",
          title: "Snap",
          category: "near-term",
          owner: ATLAS,
          forActor: "CEO",
          decisionForActor: "Q",
          recommendation: { stance: "approve", reasoning: "x" },
          sourceDocumentHashes: [HASH_A, HASH_B],
          citations: ["P1-EVENTS-ARE-TRUTH"],
        },
      }),
    );
    const projector = new LocalProjector(store);
    const state = projector.build(decisionsRegisterProjection);
    const encoded = decisionsRegisterProjection.encodeSnapshot?.(state) ?? "";
    const decoded = decisionsRegisterProjection.decodeSnapshot?.(encoded);
    expect(decoded).toEqual(state);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Correspondence register
// ---------------------------------------------------------------------------

describe("correspondenceRegisterProjection", () => {
  it("rolls RecordFiled with registerKey=correspondence into rows", () => {
    const store = newStore();
    store.append(
      makeRecordFiled({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          recordId: "record:correspondence:sarb-letter-1",
          registerKey: "correspondence",
          documentHash: HASH_A,
          classification: "governance-seat",
          retention: {
            citationRef: "BANKS-ACT-94-1990",
            minimumYears: 5,
            archivalTier: "hot",
          },
        },
      }),
    );
    // A non-correspondence RecordFiled must be ignored.
    store.append(
      makeRecordFiled({
        asOf: "2026-05-10T08:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          recordId: "record:decisions:foo",
          registerKey: "decisions",
          documentHash: HASH_B,
          classification: "ceo-only",
          retention: {
            citationRef: "COMPANIES-ACT-71-2008",
            minimumYears: 7,
            archivalTier: "hot",
          },
        },
      }),
    );

    const projector = new LocalProjector(store);
    const rows = correspondenceRegisterRows(projector.build(correspondenceRegisterProjection));
    expect(rows.length).toBe(1);
    expect(rows[0]?.correspondenceId).toBe("record:correspondence:sarb-letter-1");
    expect(rows[0]?.documentHash).toBe(HASH_A);
    store.close();
  });

  it("supersession marks predecessor and links the new row", () => {
    const store = newStore();
    store.append(
      makeRecordFiled({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          recordId: "record:correspondence:v1",
          registerKey: "correspondence",
          documentHash: HASH_A,
          classification: "governance-seat",
          retention: {
            citationRef: "BANKS-ACT-94-1990",
            minimumYears: 5,
            archivalTier: "hot",
          },
        },
      }),
    );
    store.append(
      makeRecordFiled({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          recordId: "record:correspondence:v2",
          registerKey: "correspondence",
          documentHash: HASH_B,
          classification: "governance-seat",
          retention: {
            citationRef: "BANKS-ACT-94-1990",
            minimumYears: 5,
            archivalTier: "hot",
          },
          supersedes: "record:correspondence:v1",
          correctsOriginalErrors: true,
        },
      }),
    );

    const projector = new LocalProjector(store);
    const rows = correspondenceRegisterRows(projector.build(correspondenceRegisterProjection));
    const v1 = rows.find((r) => r.correspondenceId === "record:correspondence:v1");
    const v2 = rows.find((r) => r.correspondenceId === "record:correspondence:v2");
    expect(v1?.supersededBy).toBe("record:correspondence:v2");
    expect(v2?.supersedes).toBe("record:correspondence:v1");
    expect(v2?.correctsOriginalErrors).toBe(true);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Records-of-agent-runs register
// ---------------------------------------------------------------------------

describe("agentRunsRegisterProjection", () => {
  it("pairs Started + Completed by runId", () => {
    const store = newStore();
    store.append(
      makeAgentRunStarted({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:atlas:1",
          briefId: "brief:atlas:1",
          agent: ATLAS,
          startedAt: "2026-05-10T08:00:00Z",
          substrate: "scrooge-coordinated-in-session",
          worktree: "/tmp/wt",
        },
      }),
    );

    const projector = new LocalProjector(store);
    let rows = agentRunsRegisterRows(projector.build(agentRunsRegisterProjection));
    expect(rows[0]?.outcome).toBe("in-flight");
    expect(rows[0]?.worktree).toBe("/tmp/wt");

    store.append(
      makeAgentRunCompleted({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:atlas:1",
          briefId: "brief:atlas:1",
          agent: ATLAS,
          completedAt: "2026-05-10T09:00:00Z",
          outcome: "delivered",
          deliverableDocumentHashes: [HASH_A, HASH_B],
          substrateGapsSurfaced: ["S8 not yet built"],
          citations: ["P1-EVENTS-ARE-TRUTH"],
          followOnRoutes: [],
        },
      }),
    );
    rows = agentRunsRegisterRows(projector.build(agentRunsRegisterProjection));
    expect(rows[0]?.outcome).toBe("delivered");
    expect(rows[0]?.deliverableHashes).toEqual([HASH_A, HASH_B]);
    expect(rows[0]?.substrateGapsSurfaced).toEqual(["S8 not yet built"]);
    expect(rows[0]?.startedAt).toBe("2026-05-10T08:00:00Z");
    expect(rows[0]?.completedAt).toBe("2026-05-10T09:00:00Z");
    store.close();
  });

  it("BriefSuperseded flags in-flight runs on the same briefId", () => {
    const store = newStore();
    store.append(
      makeAgentRunStarted({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:flagged",
          briefId: "brief:original",
          agent: ATLAS,
          startedAt: "2026-05-10T08:00:00Z",
          substrate: "scrooge-coordinated-in-session",
        },
      }),
    );
    store.append(
      makeBriefSuperseded({
        asOf: "2026-05-10T08:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          originalBriefId: "brief:original",
          supersededBy: "brief:replacement",
          reason: "scope-changed",
          authorisedBy: SCROOGE,
        },
      }),
    );
    const projector = new LocalProjector(store);
    const rows = agentRunsRegisterRows(projector.build(agentRunsRegisterProjection));
    expect(rows[0]?.briefSuperseded).toBe(true);
    store.close();
  });

  it("handles Completed before Started (out-of-order replay)", () => {
    const store = newStore();
    store.append(
      makeAgentRunCompleted({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:ooo",
          briefId: "brief:ooo",
          agent: ANYA,
          completedAt: "2026-05-10T09:00:00Z",
          outcome: "delivered",
          deliverableDocumentHashes: [HASH_A],
          substrateGapsSurfaced: [],
          citations: ["P1-EVENTS-ARE-TRUTH"],
          followOnRoutes: [],
        },
      }),
    );
    store.append(
      makeAgentRunStarted({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:ooo",
          briefId: "brief:ooo",
          agent: ANYA,
          startedAt: "2026-05-10T08:00:00Z",
          substrate: "agent-runtime",
        },
      }),
    );
    const projector = new LocalProjector(store);
    const rows = agentRunsRegisterRows(projector.build(agentRunsRegisterProjection));
    expect(rows[0]?.startedAt).toBe("2026-05-10T08:00:00Z");
    expect(rows[0]?.completedAt).toBe("2026-05-10T09:00:00Z");
    expect(rows[0]?.outcome).toBe("delivered");
    expect(rows[0]?.deliverableHashes).toEqual([HASH_A]);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Document register
// ---------------------------------------------------------------------------

describe("documentRegisterProjection", () => {
  it("collects every cited hash and tracks first-seen + reverse-lookup", () => {
    const store = newStore();
    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:doc-test",
          issuedTo: ATLAS,
          issuedBy: SCROOGE,
          title: "Doc-test",
          directiveDocumentHash: HASH_A,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        },
      }),
    );
    store.append(
      makeAgentRunCompleted({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:doc-test",
          briefId: "brief:doc-test",
          agent: ATLAS,
          completedAt: "2026-05-10T09:00:00Z",
          outcome: "delivered",
          deliverableDocumentHashes: [HASH_B, HASH_C],
          substrateGapsSurfaced: [],
          citations: ["P1-EVENTS-ARE-TRUTH"],
          followOnRoutes: [],
        },
      }),
    );
    store.append(
      makeRecordFiled({
        asOf: "2026-05-10T10:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          recordId: "record:documents:b",
          registerKey: "documents",
          documentHash: HASH_B,
          classification: "governance-seat",
          retention: {
            citationRef: "BANKS-ACT-94-1990",
            minimumYears: 5,
            archivalTier: "hot",
          },
        },
      }),
    );
    const projector = new LocalProjector(store);
    const rows = documentRegisterRows(projector.build(documentRegisterProjection));
    expect(rows.length).toBe(3);
    const a = rows.find((r) => r.documentHash === HASH_A);
    const b = rows.find((r) => r.documentHash === HASH_B);
    const c = rows.find((r) => r.documentHash === HASH_C);
    expect(a?.firstReferencedByEventType).toBe("AgentBriefIssued");
    expect(a?.registered).toBe(false);
    expect(a?.classification).toBe("agent-internal");
    expect(b?.registered).toBe(true);
    expect(b?.recordId).toBe("record:documents:b");
    expect(b?.classification).toBe("governance-seat");
    // HASH_B was cited twice (run + record-filed) — both event ids on the row.
    expect(b?.referencedByEventIds.length).toBe(2);
    expect(c?.registered).toBe(false);
    store.close();
  });

  it("supersession chain on RecordFiled marks the predecessor", () => {
    const store = newStore();
    store.append(
      makeRecordFiled({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          recordId: "record:documents:v1",
          registerKey: "documents",
          documentHash: HASH_A,
          classification: "agent-internal",
          retention: {
            citationRef: "BANKS-ACT-94-1990",
            minimumYears: 5,
            archivalTier: "hot",
          },
        },
      }),
    );
    store.append(
      makeRecordFiled({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          recordId: "record:documents:v2",
          registerKey: "documents",
          documentHash: HASH_B,
          classification: "agent-internal",
          retention: {
            citationRef: "BANKS-ACT-94-1990",
            minimumYears: 5,
            archivalTier: "hot",
          },
          supersedes: "record:documents:v1",
        },
      }),
    );
    const projector = new LocalProjector(store);
    const rows = documentRegisterRows(projector.build(documentRegisterProjection));
    const a = rows.find((r) => r.documentHash === HASH_A);
    const b = rows.find((r) => r.documentHash === HASH_B);
    expect(a?.supersededBy).toBe("record:documents:v2");
    expect(b?.supersedes).toBe("record:documents:v1");
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Feedback register
// ---------------------------------------------------------------------------

describe("feedbackRegisterProjection", () => {
  it("emits one row per feedback event and groups by subject", () => {
    const store = newStore();
    store.append(
      makeFeedback({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          feedbackId: "feedback:1",
          from: { actor: "CEO", identity: "human:marc@tgv.co.za" },
          channel: "chat",
          intakeAt: "2026-05-10T08:00:00Z",
          subject: { kind: "brief", ref: "brief:atlas:1" },
          body: "Ship it.",
          classifications: ["directive"],
        },
      }),
    );
    store.append(
      makeFeedback({
        asOf: "2026-05-10T08:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          feedbackId: "feedback:2",
          from: { actor: "CEO", identity: "human:marc@tgv.co.za" },
          channel: "chat",
          intakeAt: "2026-05-10T08:30:00Z",
          subject: { kind: "brief", ref: "brief:atlas:1" },
          body: "And again.",
          classifications: ["preference"],
        },
      }),
    );
    const projector = new LocalProjector(store);
    const state = projector.build(feedbackRegisterProjection);
    const rows = feedbackRegisterRows(state);
    expect(rows.length).toBe(2);
    const grouped = feedbackRegisterBySubject(state);
    expect(grouped.size).toBe(1);
    expect(grouped.get("brief:brief:atlas:1")?.length).toBe(2);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Briefs / Dispatches register
// ---------------------------------------------------------------------------

describe("briefsRegisterProjection", () => {
  it("derives status from downstream lifecycle events", () => {
    const store = newStore();
    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:lifecycle",
          issuedTo: ANYA,
          issuedBy: SCROOGE,
          title: "Lifecycle",
          directiveDocumentHash: HASH_A,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        },
      }),
    );
    const projector = new LocalProjector(store);
    let rows = briefsRegisterRows(projector.build(briefsRegisterProjection));
    expect(rows[0]?.status).toBe("issued");

    store.append(
      makeAgentRunStarted({
        asOf: "2026-05-10T08:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:lifecycle",
          briefId: "brief:lifecycle",
          agent: ANYA,
          startedAt: "2026-05-10T08:30:00Z",
          substrate: "scrooge-coordinated-in-session",
        },
      }),
    );
    rows = briefsRegisterRows(projector.build(briefsRegisterProjection));
    expect(rows[0]?.status).toBe("in-flight");
    expect(rows[0]?.runId).toBe("run:lifecycle");

    store.append(
      makeAgentRunCompleted({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:lifecycle",
          briefId: "brief:lifecycle",
          agent: ANYA,
          completedAt: "2026-05-10T09:00:00Z",
          outcome: "delivered",
          deliverableDocumentHashes: [HASH_B],
          substrateGapsSurfaced: [],
          citations: ["P1-EVENTS-ARE-TRUTH"],
          followOnRoutes: [],
        },
      }),
    );
    rows = briefsRegisterRows(projector.build(briefsRegisterProjection));
    expect(rows[0]?.status).toBe("delivered");
    store.close();
  });

  it("supersession overrides any other status (terminal)", () => {
    const store = newStore();
    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:to-supersede",
          issuedTo: ATLAS,
          issuedBy: SCROOGE,
          title: "Original",
          directiveDocumentHash: HASH_A,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        },
      }),
    );
    store.append(
      makeBriefSuperseded({
        asOf: "2026-05-10T08:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          originalBriefId: "brief:to-supersede",
          supersededBy: "brief:replacement",
          reason: "withdrawn",
          authorisedBy: SCROOGE,
        },
      }),
    );
    const projector = new LocalProjector(store);
    const rows = briefsRegisterRows(projector.build(briefsRegisterProjection));
    expect(rows[0]?.status).toBe("superseded");
    expect(rows[0]?.supersedingBriefId).toBe("brief:replacement");
    expect(rows[0]?.supersessionReason).toBe("withdrawn");
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Workstreams register
// ---------------------------------------------------------------------------

describe("workstreamsRegisterProjection", () => {
  it("groups briefs + runs + decisions + documents by workstreamId", () => {
    const store = newStore();
    const wsId = "ws:rms-phase-1-slice-3";

    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:slice-3a",
          issuedTo: ANYA,
          issuedBy: SCROOGE,
          title: "Slice 3 — registers",
          directiveDocumentHash: HASH_A,
          priority: "now",
          workstreamId: wsId,
          expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        },
      }),
    );
    store.append(
      makeAgentRunStarted({
        asOf: "2026-05-10T08:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:slice-3a",
          briefId: "brief:slice-3a",
          agent: ANYA,
          startedAt: "2026-05-10T08:30:00Z",
          substrate: "scrooge-coordinated-in-session",
        },
      }),
    );
    store.append(
      makeAgentRunCompleted({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:slice-3a",
          briefId: "brief:slice-3a",
          agent: ANYA,
          completedAt: "2026-05-10T09:00:00Z",
          outcome: "delivered",
          deliverableDocumentHashes: [HASH_B, HASH_C],
          substrateGapsSurfaced: [],
          citations: ["P1-EVENTS-ARE-TRUTH"],
          followOnRoutes: [
            { kind: "decision", target: "D-SLICE-4", directive: "Approve dashboard render" },
          ],
        },
      }),
    );

    const projector = new LocalProjector(store);
    const rows = workstreamsRegisterRows(projector.build(workstreamsRegisterProjection));
    expect(rows.length).toBe(1);
    expect(rows[0]?.workstreamId).toBe(wsId);
    expect(rows[0]?.title).toBe("Slice 3 — registers");
    expect(rows[0]?.briefIds).toEqual(["brief:slice-3a"]);
    expect(rows[0]?.runIds).toEqual(["run:slice-3a"]);
    expect(rows[0]?.documentHashes).toEqual([HASH_B, HASH_C]);
    expect(rows[0]?.decisionIds).toEqual(["D-SLICE-4"]);
    expect(rows[0]?.status).toBe("complete");
    store.close();
  });

  it("status is 'active' while any brief in the workstream is open", () => {
    const store = newStore();
    const wsId = "ws:multi";
    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:a",
          issuedTo: ANYA,
          issuedBy: SCROOGE,
          title: "A",
          directiveDocumentHash: HASH_A,
          priority: "now",
          workstreamId: wsId,
          expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        },
      }),
    );
    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:10:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:b",
          issuedTo: OWEN,
          issuedBy: SCROOGE,
          title: "B",
          directiveDocumentHash: HASH_B,
          priority: "now",
          workstreamId: wsId,
          expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        },
      }),
    );
    // Close A only.
    store.append(
      makeAgentRunCompleted({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:a",
          briefId: "brief:a",
          agent: ANYA,
          completedAt: "2026-05-10T09:00:00Z",
          outcome: "delivered",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: [],
          citations: ["P1-EVENTS-ARE-TRUTH"],
          followOnRoutes: [],
        },
      }),
    );
    const projector = new LocalProjector(store);
    const rows = workstreamsRegisterRows(projector.build(workstreamsRegisterProjection));
    expect(rows[0]?.status).toBe("active");
    expect([...(rows[0]?.briefIds ?? [])].sort()).toEqual(["brief:a", "brief:b"]);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Snapshot integration
// ---------------------------------------------------------------------------

describe("snapshot codec equivalence", () => {
  it("decodeSnapshot(encodeSnapshot(state)) equals state for every register", () => {
    const store = newStore();
    // Mixed event stream that hits all seven projections.
    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:mixed",
          issuedTo: ANYA,
          issuedBy: SCROOGE,
          title: "Mixed",
          directiveDocumentHash: HASH_A,
          priority: "now",
          workstreamId: "ws:mixed",
          expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        },
      }),
    );
    store.append(
      makeAgentRunStarted({
        asOf: "2026-05-10T08:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:mixed",
          briefId: "brief:mixed",
          agent: ANYA,
          startedAt: "2026-05-10T08:30:00Z",
          substrate: "scrooge-coordinated-in-session",
        },
      }),
    );
    store.append(
      makeAgentRunCompleted({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:mixed",
          briefId: "brief:mixed",
          agent: ANYA,
          completedAt: "2026-05-10T09:00:00Z",
          outcome: "delivered",
          deliverableDocumentHashes: [HASH_B],
          substrateGapsSurfaced: [],
          citations: ["P1-EVENTS-ARE-TRUTH"],
          followOnRoutes: [],
        },
      }),
    );
    store.append(
      makeFeedback({
        asOf: "2026-05-10T09:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          feedbackId: "feedback:mixed",
          from: { actor: "CEO", identity: "human:marc@tgv.co.za" },
          channel: "chat",
          intakeAt: "2026-05-10T09:30:00Z",
          subject: { kind: "brief", ref: "brief:mixed" },
          body: "Good.",
          classifications: ["praise"],
        },
      }),
    );
    store.append(
      makeRecordFiled({
        asOf: "2026-05-10T10:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          recordId: "record:correspondence:mixed",
          registerKey: "correspondence",
          documentHash: HASH_C,
          classification: "governance-seat",
          retention: {
            citationRef: "BANKS-ACT-94-1990",
            minimumYears: 5,
            archivalTier: "hot",
          },
        },
      }),
    );
    store.append(
      makeDecisionRequested({
        asOf: "2026-05-10T10:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          decisionId: "D-MIXED",
          title: "Mixed",
          category: "near-term",
          owner: ATLAS,
          forActor: "CEO",
          decisionForActor: "Approve.",
          recommendation: { stance: "approve", reasoning: "x" },
          sourceDocumentHashes: [HASH_D],
          citations: ["P1-EVENTS-ARE-TRUTH"],
        },
      }),
    );

    const projector = new LocalProjector(store);
    function roundTrip<S>(p: import("../platform/projections").Projection<S, Event>): void {
      const state = projector.build(p);
      const encoded = p.encodeSnapshot?.(state) ?? "";
      const decoded = p.decodeSnapshot?.(encoded);
      expect(decoded).toEqual(state);
    }
    roundTrip(decisionsRegisterProjection);
    roundTrip(correspondenceRegisterProjection);
    roundTrip(agentRunsRegisterProjection);
    roundTrip(documentRegisterProjection);
    roundTrip(feedbackRegisterProjection);
    roundTrip(briefsRegisterProjection);
    roundTrip(workstreamsRegisterProjection);

    store.close();
  });

  it("snapshot path equals naive build for the briefs register (EvSS Slice-3 invariant)", () => {
    const store = newStore();
    for (let i = 0; i < 5; i++) {
      store.append(
        makeAgentBriefIssued({
          asOf: `2026-05-10T0${i}:00:00.000Z`,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            briefId: `brief:snap-${i}`,
            issuedTo: ATLAS,
            issuedBy: SCROOGE,
            title: `Snap ${i}`,
            directiveDocumentHash: HASH_A,
            priority: "now",
            expectedOutputs: [{ kind: "code-pr", description: "PR" }],
          },
        }),
      );
    }
    const projector = new LocalProjector(store);
    const naive = projector.build(briefsRegisterProjection);
    const { state: fromSnap } = projector.projectFromSnapshot(briefsRegisterProjection, {
      streamKey: "LE-BANK-SA|projection/rms-briefs",
      asOf: "2026-05-10T05:00:00.000Z",
    });
    expect(fromSnap).toEqual(naive);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Provenance filter
// ---------------------------------------------------------------------------

describe("filterEventsByProvenance", () => {
  it("drops untagged events when kinds is set without includeUntagged", () => {
    const e1 = makeFeedback({
      asOf: "2026-05-10T08:00:00Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        feedbackId: "f:1",
        from: { actor: "CEO", identity: "human:marc@tgv.co.za" },
        channel: "chat",
        intakeAt: "2026-05-10T08:00:00Z",
        subject: { kind: "brief", ref: "x" },
        body: "x",
        classifications: ["directive"],
      },
    });
    const e2: Event = {
      ...e1,
      event_id: newEventId(),
      provenance: {
        kind: "production",
        sourceLineage: "ceo-decision-record",
      } as Event["provenance"],
    };
    const filtered = [...filterEventsByProvenance([e1, e2], { kinds: ["production"] })];
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.event_id).toBe(e2.event_id);
  });

  it("admits untagged events when includeUntagged is true", () => {
    const e1 = makeFeedback({
      asOf: "2026-05-10T08:00:00Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        feedbackId: "f:1",
        from: { actor: "CEO", identity: "human:marc@tgv.co.za" },
        channel: "chat",
        intakeAt: "2026-05-10T08:00:00Z",
        subject: { kind: "brief", ref: "x" },
        body: "x",
        classifications: ["directive"],
      },
    });
    const filtered = [
      ...filterEventsByProvenance([e1], {
        kinds: ["production"],
        includeUntagged: true,
      }),
    ];
    expect(filtered.length).toBe(1);
  });

  it("scenario filter narrows on provenance.scenario", () => {
    const base = makeFeedback({
      asOf: "2026-05-10T08:00:00Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        feedbackId: "f:1",
        from: { actor: "CEO", identity: "human:marc@tgv.co.za" },
        channel: "chat",
        intakeAt: "2026-05-10T08:00:00Z",
        subject: { kind: "brief", ref: "x" },
        body: "x",
        classifications: ["directive"],
      },
    });
    const e1: Event = {
      ...base,
      event_id: newEventId(),
      provenance: {
        kind: "simulated",
        scenario: "rehearsal-2026-Q1",
        sourceLineage: "scenario-runner:rehearsal-2026-Q1",
      } as Event["provenance"],
    };
    const e2: Event = {
      ...base,
      event_id: newEventId(),
      provenance: {
        kind: "simulated",
        scenario: "stress-adverse",
        sourceLineage: "scenario-runner:stress-adverse",
      } as Event["provenance"],
    };
    const filtered = [...filterEventsByProvenance([e1, e2], { scenario: "rehearsal-2026-Q1" })];
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.event_id).toBe(e1.event_id);
  });
});

// ---------------------------------------------------------------------------
// Determinism — replay invariance
// ---------------------------------------------------------------------------

describe("determinism — same events, same state", () => {
  it("folding the briefs register twice yields equal state", () => {
    const store = newStore();
    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:det",
          issuedTo: ATLAS,
          issuedBy: SCROOGE,
          title: "Det",
          directiveDocumentHash: HASH_A,
          priority: "now",
          expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        },
      }),
    );
    const projector = new LocalProjector(store);
    const a = projector.build(briefsRegisterProjection);
    const b = projector.build(briefsRegisterProjection);
    expect(a).toEqual(b);
    store.close();
  });
});
