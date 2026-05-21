// tests/rms-record-helpers.test.ts
//
// D-RMS-PHASE-1 Slice 2 — round-trip tests for the record-helpers.
//
// Asserts that each helper:
//   1. Puts the relevant body into the document store and gets a hash back.
//   2. Appends a typed event referencing that hash.
//   3. Round-trips: the event is in the store, the document is in the doc
//      store at the cited hash, and re-running the helper with the same
//      bytes returns the same hash with `isNewDocument: false`.
//
// Authority: D-RMS-PHASE-1 (CEO approved 2026-05-09); slice authorisation
//            D-RMS-PHASE-1-SLICE-2.
// Source spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md §3
//
// Author: Owen (Company Secretary, governance) +
//         Atlas (Core banking platform architect, engineering)

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { LocalFsDocumentStore } from "../platform/document-store";
import {
  recordAgentRun,
  recordAgentRunCompleted,
  recordAgentRunStarted,
  recordBriefIssued,
  recordDecisionRequested,
  recordFeedback,
  recordFiled,
  supersedeBrief,
} from "../platform/records";

const SCROOGE_REF = {
  name: "Scrooge",
  position: "Chief of Staff / Orchestrator",
};
const ATLAS_REF = {
  name: "Atlas",
  position: "Core banking platform architect, engineering",
};
const OWEN_REF = { name: "Owen", position: "Company Secretary, governance" };

const ACTOR = { type: "service" as const, id: "agent:atlas" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED"] as const;
const AS_OF = "2026-05-10T12:00:00Z";

let store: LocalFsDocumentStore;

beforeEach(() => {
  // Fresh document-store root per test — keeps `isNewDocument` semantics
  // crisp and prevents cross-test bleed.
  const root = mkdtempSync(join(tmpdir(), "rms-helpers-"));
  store = new LocalFsDocumentStore({ root });
});

describe("recordBriefIssued", () => {
  it("puts the directive body into the store and emits AgentBriefIssued", () => {
    const result = recordBriefIssued(
      {
        briefId: "brief:atlas:rms-slice-2",
        issuedTo: ATLAS_REF,
        issuedBy: SCROOGE_REF,
        title: "Build RMS Slice 2",
        directiveBody: "## Brief\n\nBuild it.",
        priority: "now",
        expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
      { documentStore: store },
    );

    expect(result.event.type).toBe("AgentBriefIssued");
    expect(result.documentHash.startsWith("blake3:")).toBe(true);
    expect(result.isNewDocument).toBe(true);
    expect(store.exists(result.documentHash)).toBe(true);

    // Round-trip: the event is in the event store with the same hash.
    const ev = [...eventStore.replay({ type: "AgentBriefIssued" })].find(
      (e) => e.event_id === result.eventId,
    );
    expect(ev).toBeDefined();
    expect((ev?.payload as { directiveDocumentHash: string }).directiveDocumentHash).toBe(
      result.documentHash,
    );

    // Idempotent on re-put: same bytes → same hash, isNewDocument=false.
    const second = recordBriefIssued(
      {
        briefId: "brief:atlas:rms-slice-2-second-event",
        issuedTo: ATLAS_REF,
        issuedBy: SCROOGE_REF,
        title: "Same body, different brief envelope",
        directiveBody: "## Brief\n\nBuild it.",
        priority: "now",
        expectedOutputs: [{ kind: "code-pr", description: "PR" }],
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
      { documentStore: store },
    );
    expect(second.documentHash).toBe(result.documentHash);
    expect(second.isNewDocument).toBe(false);
  });
});

describe("recordAgentRunStarted + recordAgentRunCompleted (paired)", () => {
  it("emits both lifecycle events and stores deliverables by hash", () => {
    const started = recordAgentRunStarted(
      {
        runId: "run:atlas:slice2",
        briefId: "brief:atlas:rms-slice-2",
        agent: ATLAS_REF,
        startedAt: AS_OF,
        substrate: "scrooge-coordinated-in-session",
        worktree: "/tmp/wt",
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
    );
    expect(started.event.type).toBe("AgentRunStarted");

    const completed = recordAgentRunCompleted(
      {
        runId: "run:atlas:slice2",
        briefId: "brief:atlas:rms-slice-2",
        agent: ATLAS_REF,
        completedAt: AS_OF,
        outcome: "delivered",
        deliverableBodies: ["# decision record\n\nbody-A", "# pr description\n\nbody-B"],
        substrateGapsSurfaced: ["Slice 3 not yet built"],
        deliverableCitations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        followOnRoutes: [],
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
      { documentStore: store },
    );

    expect(completed.event.type).toBe("AgentRunCompleted");
    expect(completed.deliverableDocumentHashes.length).toBe(2);
    expect(completed.newDeliverableCount).toBe(2);
    for (const h of completed.deliverableDocumentHashes) {
      expect(store.exists(h)).toBe(true);
    }
  });
});

describe("recordAgentRun (one-shot helper)", () => {
  it("emits start + completion in one call", () => {
    const result = recordAgentRun(
      {
        runId: "run:atlas:oneshot",
        briefId: "brief:atlas:oneshot",
        agent: ATLAS_REF,
        startedAt: AS_OF,
        substrate: "scrooge-coordinated-in-session",
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      {
        completedAt: AS_OF,
        outcome: "delivered",
        deliverableBodies: ["doc"],
        substrateGapsSurfaced: [],
        deliverableCitations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        followOnRoutes: [],
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
      { documentStore: store },
    );

    expect(result.started.event.type).toBe("AgentRunStarted");
    expect(result.completed.event.type).toBe("AgentRunCompleted");
    expect(result.completed.deliverableDocumentHashes.length).toBe(1);
  });
});

describe("recordDecisionRequested", () => {
  it("puts source-document bodies into the store and emits DecisionRequested", () => {
    const result = recordDecisionRequested(
      {
        decisionId: "D-EXAMPLE",
        title: "Should we ship?",
        category: "near-term",
        owner: ATLAS_REF,
        forActor: "CEO",
        decisionForActor: "Approve / defer / modify.",
        recommendation: { stance: "approve", reasoning: "Tested" },
        sourceDocumentBodies: ["analysis-A", "analysis-B"],
        decisionCitations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
      { documentStore: store },
    );

    expect(result.event.type).toBe("DecisionRequested");
    expect(result.sourceDocumentHashes.length).toBe(2);
    expect(result.newDocumentCount).toBe(2);
    for (const h of result.sourceDocumentHashes) expect(store.exists(h)).toBe(true);
  });

  it("works without source documents", () => {
    const result = recordDecisionRequested(
      {
        decisionId: "D-EMPTY",
        title: "Empty",
        category: "pacing",
        owner: ATLAS_REF,
        forActor: "CEO",
        decisionForActor: "Q?",
        recommendation: { stance: "defer", reasoning: "Wait" },
        decisionCitations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
      { documentStore: store },
    );

    expect(result.sourceDocumentHashes).toEqual([]);
    expect(result.event.type).toBe("DecisionRequested");
  });
});

describe("recordFeedback", () => {
  it("emits Feedback without long-form body", () => {
    const result = recordFeedback(
      {
        feedbackId: "feedback:short",
        from: { actor: "CEO", identity: "human:marc@tgv.co.za" },
        channel: "chat",
        intakeAt: AS_OF,
        subject: { kind: "brief", ref: "brief:atlas:rms-slice-2" },
        body: "Ship it.",
        classifications: ["directive"],
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
      { documentStore: store },
    );

    expect(result.event.type).toBe("Feedback");
    expect(result.bodyDocumentHash).toBeUndefined();
    expect(result.isNewBodyDocument).toBe(false);
  });

  it("puts long-form body into the store when provided", () => {
    const longBody = "x".repeat(4096);
    const result = recordFeedback(
      {
        feedbackId: "feedback:long",
        from: { actor: "CEO", identity: "human:marc@tgv.co.za" },
        channel: "chat",
        intakeAt: AS_OF,
        subject: { kind: "policy", ref: "policy:foo:v1" },
        body: "(long-form below)",
        bodyLongForm: longBody,
        classifications: ["preference"],
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
      { documentStore: store },
    );

    expect(result.bodyDocumentHash).toBeDefined();
    expect(result.isNewBodyDocument).toBe(true);
    if (result.bodyDocumentHash) {
      expect(store.exists(result.bodyDocumentHash)).toBe(true);
    }
  });
});

describe("supersedeBrief", () => {
  it("emits BriefSuperseded with no document-store interaction", () => {
    const result = supersedeBrief(
      {
        originalBriefId: "brief:old",
        supersededBy: "brief:new",
        reason: "merged",
        authorisedBy: SCROOGE_REF,
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
    );
    expect(result.event.type).toBe("BriefSuperseded");
  });
});

describe("recordFiled", () => {
  it("puts the artefact into the store and emits RecordFiled", () => {
    const result = recordFiled(
      {
        recordId: "record:decisions:D-RMS-PHASE-1-SLICE-2",
        registerKey: "decisions",
        body: "## CEO decision record\n\n...",
        classification: "ceo-only",
        retention: {
          citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
          minimumYears: 7,
          archivalTier: "archive",
        },
        citations: [...CITATIONS],
        actor: ACTOR,
        entity: ENTITY,
      },
      AS_OF,
      { documentStore: store },
    );

    expect(result.event.type).toBe("RecordFiled");
    expect(result.documentHash.startsWith("blake3:")).toBe(true);
    expect(result.isNewDocument).toBe(true);
    expect(store.exists(result.documentHash)).toBe(true);

    // The event payload references the same hash.
    expect((result.event.payload as { documentHash: string }).documentHash).toBe(
      result.documentHash,
    );
  });

  it("rejects an empty retention.citationRef", () => {
    expect(() =>
      recordFiled(
        {
          recordId: "record:decisions:bad",
          registerKey: "decisions",
          body: "x",
          classification: "ceo-only",
          retention: { citationRef: "", minimumYears: 7, archivalTier: "archive" },
          citations: [...CITATIONS],
          actor: ACTOR,
          entity: ENTITY,
        },
        AS_OF,
        { documentStore: store },
      ),
    ).toThrow();
  });

  it("rejects empty citations envelope (Principle 2)", () => {
    expect(() =>
      recordFiled(
        {
          recordId: "record:decisions:bad",
          registerKey: "decisions",
          body: "x",
          classification: "ceo-only",
          retention: {
            citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
            minimumYears: 7,
            archivalTier: "archive",
          },
          citations: [],
          actor: ACTOR,
          entity: ENTITY,
        },
        AS_OF,
        { documentStore: store },
      ),
    ).toThrow();
  });
});

describe("Identity-discipline (sanity)", () => {
  it("OWEN_REF + ATLAS_REF + SCROOGE_REF all carry name + position", () => {
    for (const ref of [OWEN_REF, ATLAS_REF, SCROOGE_REF]) {
      expect(ref.name.length).toBeGreaterThan(0);
      expect(ref.position.length).toBeGreaterThan(0);
    }
  });
});
