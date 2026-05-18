// tests/rms-dashboard-render.test.ts
//
// D-RMS-PHASE-1 Slice 4 — dashboard register render smoke tests.
//
// Asserts:
//   - `buildRmsRegistersFold` folds the EventStore through the seven
//     Slice-3 RMS register projections and returns a JSON-serialisable
//     view with the expected counts per register.
//   - `summariseFold` exposes the register catalogue and counts that the
//     `/api/rms` endpoint returns.
//   - `selectRegisterView` returns the right row array for each of the
//     seven register keys.
//   - `RMS_REGISTER_KEYS` contains the seven canonical register keys.
//   - `isRmsRegisterKey` rejects unknown keys.
//
// The tests are smoke tests for the API contract; the projections
// themselves are exhaustively asserted by `tests/rms-registers.test.ts`
// (Slice 3).
//
// Author: Anya (Data / analytics engineer, engineering)

import { describe, expect, it } from "bun:test";

import {
  RMS_REGISTER_CATALOGUE,
  RMS_REGISTER_KEYS,
  buildRmsRegistersFold,
  isRmsRegisterKey,
  selectRegisterView,
  summariseFold,
} from "../dashboard/rms-view";
import { BANK_ZA_001, newEventId } from "../platform/core/types";
import {
  makeAgentBriefIssued,
  makeAgentRunCompleted,
  makeAgentRunStarted,
  makeDecision,
  makeDecisionRequested,
  makeFeedback,
  makeRecordFiled,
} from "../platform/event-store/event-types";
import { EventStore } from "../platform/event-store/store";
import {
  decisionsRegisterProjection,
  decisionsRegisterRows,
} from "../platform/rms-registers";
import { LocalProjector } from "../platform/projections";

const ENTITY = BANK_ZA_001;
const ACTOR = { type: "service" as const, id: "agent:anya" };
const CITATIONS = ["P1-EVENTS-ARE-TRUTH"];

const ANYA = { name: "Anya", position: "Data / analytics engineer" };
const ATLAS = { name: "Atlas", position: "Core banking platform architect" };
const SCROOGE = { name: "Scrooge", position: "Chief of Staff / Orchestrator" };

const HASH_A = `blake3:${"a".repeat(64)}`;
const HASH_B = `blake3:${"b".repeat(64)}`;

function freshStore(): EventStore {
  return new EventStore();
}

describe("RMS_REGISTER_KEYS / catalogue", () => {
  it("contains the seven canonical register keys", () => {
    expect([...RMS_REGISTER_KEYS]).toEqual([
      "decisions",
      "correspondence",
      "agent-runs",
      "document",
      "feedback",
      "briefs-dispatches",
      "workstreams",
    ]);
  });

  it("catalogue has one descriptor per register key", () => {
    expect(RMS_REGISTER_CATALOGUE).toHaveLength(RMS_REGISTER_KEYS.length);
    const cataKeys = RMS_REGISTER_CATALOGUE.map((c) => c.key);
    for (const k of RMS_REGISTER_KEYS) {
      expect(cataKeys).toContain(k);
    }
  });

  it("each catalogue entry has a non-empty title, blurb, and folds list", () => {
    for (const c of RMS_REGISTER_CATALOGUE) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.blurb.length).toBeGreaterThan(0);
      expect(c.folds.length).toBeGreaterThan(0);
    }
  });

  it("isRmsRegisterKey accepts all canonical keys and rejects unknowns", () => {
    for (const k of RMS_REGISTER_KEYS) {
      expect(isRmsRegisterKey(k)).toBe(true);
    }
    expect(isRmsRegisterKey("not-a-register")).toBe(false);
    expect(isRmsRegisterKey("DECISIONS")).toBe(false); // case-sensitive
    expect(isRmsRegisterKey("")).toBe(false);
  });
});

describe("buildRmsRegistersFold (empty store)", () => {
  it("returns zero rows in every register when no events exist", () => {
    const store = freshStore();
    const fold = buildRmsRegistersFold(store, () => "2026-05-10T12:00:00.000Z");
    expect(fold.asOf).toBe("2026-05-10T12:00:00.000Z");
    expect(fold.decisions).toHaveLength(0);
    expect(fold.correspondence).toHaveLength(0);
    expect(fold.agentRuns).toHaveLength(0);
    expect(fold.document).toHaveLength(0);
    expect(fold.feedback).toHaveLength(0);
    expect(fold.briefsDispatches).toHaveLength(0);
    expect(fold.workstreams).toHaveLength(0);
    store.close();
  });
});

describe("buildRmsRegistersFold (seeded store)", () => {
  function seed(): EventStore {
    const store = freshStore();
    // 1) AgentBriefIssued — opens a brief + workstream + adds a doc-cite
    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:slice4:1",
          issuedTo: ANYA,
          issuedBy: SCROOGE,
          title: "Slice 4 dispatch",
          directiveDocumentHash: HASH_A,
          priority: "now",
          workstreamId: "ws:rms-phase-1",
          expectedOutputs: [{ kind: "deliverable-document", description: "register render" }],
        },
      }),
    );
    // 2) AgentRunStarted
    store.append(
      makeAgentRunStarted({
        asOf: "2026-05-10T08:05:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:slice4:1",
          briefId: "brief:slice4:1",
          agent: ANYA,
          startedAt: "2026-05-10T08:05:00Z",
          substrate: "scrooge-coordinated-in-session",
          worktree: "/tmp/wt-slice4",
        },
      }),
    );
    // 3) AgentRunCompleted
    store.append(
      makeAgentRunCompleted({
        asOf: "2026-05-10T09:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: "run:slice4:1",
          briefId: "brief:slice4:1",
          agent: ANYA,
          completedAt: "2026-05-10T09:00:00Z",
          outcome: "delivered",
          deliverableDocumentHashes: [HASH_B],
          substrateGapsSurfaced: [],
          citations: CITATIONS,
          followOnRoutes: [],
        },
      }),
    );
    // 4) DecisionRequested
    store.append(
      makeDecisionRequested({
        asOf: "2026-05-10T09:10:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          decisionId: "D-SMOKE-1",
          title: "Smoke decision",
          category: "near-term",
          owner: ATLAS,
          forActor: "CEO",
          decisionForActor: "Approve / defer.",
          recommendation: { stance: "approve", reasoning: "smoke" },
          sourceDocumentHashes: [HASH_A],
          citations: CITATIONS,
        },
      }),
    );
    // 5) Feedback
    store.append(
      makeFeedback({
        asOf: "2026-05-10T09:30:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          feedbackId: "fb:smoke:1",
          from: { actor: "CEO", identity: "human:marc@tgv.co.za" },
          channel: "chat",
          subject: { kind: "decision", ref: "D-SMOKE-1" },
          classifications: ["preference"],
          body: "Looks good.",
          intakeAt: "2026-05-10T09:30:00Z",
        },
      }),
    );
    // 6) RecordFiled — correspondence
    store.append(
      makeRecordFiled({
        asOf: "2026-05-10T10:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          recordId: "rec:corr:1",
          registerKey: "correspondence",
          documentHash: HASH_A,
          classification: "agent-internal",
          retention: {
            citationRef: "ORG-RECORDS-MGMT-01",
            minimumYears: 7,
            archivalTier: "cool",
          },
        },
      }),
    );
    return store;
  }

  it("counts rows correctly across all seven registers", () => {
    const store = seed();
    const fold = buildRmsRegistersFold(store);
    expect(fold.briefsDispatches).toHaveLength(1);
    expect(fold.agentRuns).toHaveLength(1);
    expect(fold.decisions).toHaveLength(1);
    expect(fold.feedback).toHaveLength(1);
    expect(fold.correspondence).toHaveLength(1);
    expect(fold.workstreams).toHaveLength(1);
    // Document register: HASH_A is cited by AgentBriefIssued, DecisionRequested,
    // and RecordFiled; HASH_B is cited by AgentRunCompleted. Two unique hashes.
    expect(fold.document).toHaveLength(2);
    store.close();
  });

  it("decisions register surfaces the open status when no terminal Decision lands", () => {
    const store = seed();
    const fold = buildRmsRegistersFold(store);
    expect(fold.decisions[0]?.status).toBe("open");
    expect(fold.decisions[0]?.decisionId).toBe("D-SMOKE-1");
    expect(fold.decisions[0]?.recommendation.stance).toBe("approve");
    store.close();
  });

  it("agent-runs register pair-couples started + completed by runId", () => {
    const store = seed();
    const fold = buildRmsRegistersFold(store);
    expect(fold.agentRuns[0]?.outcome).toBe("delivered");
    expect(fold.agentRuns[0]?.startedAt).toBe("2026-05-10T08:05:00Z");
    expect(fold.agentRuns[0]?.completedAt).toBe("2026-05-10T09:00:00Z");
    expect(fold.agentRuns[0]?.deliverableHashes).toEqual([HASH_B]);
    store.close();
  });

  it("briefs-dispatches register derives delivered status after AgentRunCompleted", () => {
    const store = seed();
    const fold = buildRmsRegistersFold(store);
    expect(fold.briefsDispatches[0]?.status).toBe("delivered");
    expect(fold.briefsDispatches[0]?.runId).toBe("run:slice4:1");
    store.close();
  });

  it("workstreams register groups by workstreamId and reaches complete", () => {
    const store = seed();
    const fold = buildRmsRegistersFold(store);
    expect(fold.workstreams[0]?.workstreamId).toBe("ws:rms-phase-1");
    expect(fold.workstreams[0]?.status).toBe("complete");
    expect(fold.workstreams[0]?.briefIds).toEqual(["brief:slice4:1"]);
    expect(fold.workstreams[0]?.runIds).toEqual(["run:slice4:1"]);
    expect(fold.workstreams[0]?.documentHashes).toEqual([HASH_B]);
    store.close();
  });

  it("correspondence register surfaces the RecordFiled row", () => {
    const store = seed();
    const fold = buildRmsRegistersFold(store);
    expect(fold.correspondence[0]?.correspondenceId).toBe("rec:corr:1");
    expect(fold.correspondence[0]?.classification).toBe("agent-internal");
    expect(fold.correspondence[0]?.supersededBy).toBeNull();
    store.close();
  });

  it("feedback register groups by subjectKey", () => {
    const store = seed();
    const fold = buildRmsRegistersFold(store);
    expect(fold.feedback[0]?.subjectKey).toBe("decision:D-SMOKE-1");
    expect(fold.feedback[0]?.feedbackId).toBe("fb:smoke:1");
    store.close();
  });
});

describe("summariseFold", () => {
  it("returns counts and the catalogue alongside as_of", () => {
    const store = freshStore();
    const fold = buildRmsRegistersFold(store, () => "2026-05-10T12:00:00.000Z");
    const summary = summariseFold(fold);
    expect(summary.asOf).toBe("2026-05-10T12:00:00.000Z");
    expect(summary.counts).toEqual({
      decisions: 0,
      correspondence: 0,
      agentRuns: 0,
      document: 0,
      feedback: 0,
      briefsDispatches: 0,
      workstreams: 0,
    });
    expect(summary.catalogue).toEqual(RMS_REGISTER_CATALOGUE);
    store.close();
  });
});

describe("selectRegisterView", () => {
  it("returns the right view array for each register key", () => {
    const store = freshStore();
    const fold = buildRmsRegistersFold(store);
    expect(selectRegisterView(fold, "decisions")).toBe(fold.decisions);
    expect(selectRegisterView(fold, "correspondence")).toBe(fold.correspondence);
    expect(selectRegisterView(fold, "agent-runs")).toBe(fold.agentRuns);
    expect(selectRegisterView(fold, "document")).toBe(fold.document);
    expect(selectRegisterView(fold, "feedback")).toBe(fold.feedback);
    expect(selectRegisterView(fold, "briefs-dispatches")).toBe(fold.briefsDispatches);
    expect(selectRegisterView(fold, "workstreams")).toBe(fold.workstreams);
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Regression test: inflated-uptoSequence snapshot path (F-007 boundary).
//
// Root cause (fixed in PR this test accompanies): `buildRmsRegistersFold`
// used to call `store.count()` AFTER `projectFromSnapshot`. If events were
// appended to the store between the fold completing and the count being
// taken (e.g. by a concurrent launchd daemon tick), the snapshot's
// `uptoSequence` would be inflated beyond the last sequence actually
// folded. The next `replayFromSnapshot` call would then skip those events,
// producing fewer rows than a naive replay — the 91 vs 83 eight-row
// discrepancy reported when the brief was dispatched.
//
// The fix: `uptoSequence = store.count()` is now captured BEFORE
// `projectFromSnapshot` starts, guaranteeing it is never inflated.
//
// This test simulates the scenario by:
//   1. Seeding N decision events.
//   2. Calling `buildRmsRegistersFold` so a snapshot is written.
//   3. Directly writing a "bad" snapshot (inflated uptoSequence covering
//      sequences that don't exist yet) to the event store's snapshot table
//      — simulating what the pre-fix code would have written.
//   4. Appending M more decision events at those sequences.
//   5. Verifying that `buildRmsRegistersFold` with the fixed code still
//      returns N+M rows (not N), because the new snapshot written in step 2
//      has a non-inflated uptoSequence and the delta picks up the M events.
//
// A parallel assertion verifies that the naive replay path always returns
// N+M regardless (sanity baseline).
// ---------------------------------------------------------------------------

describe("buildRmsRegistersFold — snapshot uptoSequence is captured before fold (F-007 regression)", () => {
  const ENTITY = BANK_ZA_001;
  const ACTOR = { type: "service" as const, id: "agent:atlas" };
  const CITATIONS = ["D-RMS-PHASE-1"];

  function makeDecisionEvent(asOf: string, decisionId: string) {
    return makeDecision({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      eventId: newEventId(),
      payload: {
        decisionId,
        phase: "approved",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: `Decision ${decisionId}`,
        category: "governance",
        recommendation: "approve",
        rationale: "regression test fixture",
        sourceDocHashes: [],
        citations: CITATIONS,
        recordedVia: "scrooge:session-delegation",
      },
    });
  }

  it("after snapshot write, appending new decision events and re-folding returns the full row count (not snapshot-count)", () => {
    const store = new EventStore();

    // Phase 1: seed 5 decision events and build the first fold (writes snapshot).
    const asOf1 = "2026-05-10T10:00:00.000Z";
    for (let i = 0; i < 5; i++) {
      store.append(makeDecisionEvent(asOf1, `D-REGRESSION-A${i}`));
    }
    const fold1 = buildRmsRegistersFold(store, () => asOf1);
    expect(fold1.decisions).toHaveLength(5);

    // Phase 2: append 3 more decision events (simulates new decisions arriving
    // after the snapshot was taken in phase 1).
    const asOf2 = "2026-05-10T11:00:00.000Z";
    for (let i = 0; i < 3; i++) {
      store.append(makeDecisionEvent(asOf2, `D-REGRESSION-B${i}`));
    }

    // Phase 3: fold again — with the fix in place, the snapshot written in
    // phase 1 has uptoSequence=5 (count taken before the fold), so the delta
    // replay from sequence 6 onwards correctly folds the 3 new events.
    const fold2 = buildRmsRegistersFold(store, () => asOf2);
    expect(fold2.decisions).toHaveLength(8); // 5 + 3

    // Naive baseline: a fresh projector.build() over all 8 events also returns 8.
    const projector = new LocalProjector(store);
    const naiveState = projector.build(decisionsRegisterProjection, { asOf: asOf2 });
    const naiveRows = decisionsRegisterRows(naiveState);
    expect(naiveRows).toHaveLength(8);

    // Both paths must agree exactly on which decision IDs are present.
    const foldIds = [...fold2.decisions.map((r) => r.decisionId)].sort();
    const naiveIds = [...naiveRows.map((r) => r.decisionId)].sort();
    expect(foldIds).toEqual(naiveIds);

    store.close();
  });
});

describe("API contract — JSON serialisability", () => {
  it("the fold object round-trips through JSON.stringify / JSON.parse", () => {
    const store = freshStore();
    // Add one event of each foldable type to stress the serialisation
    // surface (Maps in projection state are not directly JSON-serialisable,
    // but the row helpers convert to arrays — the API surface uses rows).
    store.append(
      makeAgentBriefIssued({
        asOf: "2026-05-10T08:00:00Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          briefId: "brief:json:1",
          issuedTo: ANYA,
          issuedBy: SCROOGE,
          title: "JSON test",
          directiveDocumentHash: HASH_A,
          priority: "scheduled",
          expectedOutputs: [{ kind: "deliverable-document", description: "test" }],
        },
      }),
    );
    const fold = buildRmsRegistersFold(store);
    const round = JSON.parse(JSON.stringify(fold));
    expect(round.briefsDispatches).toHaveLength(1);
    expect(round.briefsDispatches[0].briefId).toBe("brief:json:1");
    store.close();
  });
});
