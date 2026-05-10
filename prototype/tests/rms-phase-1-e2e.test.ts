// tests/rms-phase-1-e2e.test.ts
//
// D-RMS-PHASE-1 Slice 5 — end-to-end round-trip test.
//
// Spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
//   §13 Slice 5; acceptance criterion §7.1 #6.
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09); slice
// authorisation D-RMS-PHASE-1-SLICE-5 under the no-pause rule.
//
// Asserts the full RMS chain runs end-to-end through the typed event
// substrate + content-addressed document store + seven register
// projections + auto-archive handler — with NO new markdown files
// authored in `Owner Inbox/` or `Team Inbox/` during the run window
// (the source-card pre-write that exercises the archiver is fixture
// scaffolding, not authored output; the assertion is that the substrate
// itself adds zero new files).
//
// Six steps:
//   1. AgentBriefIssued    — Scrooge dispatches a brief to Mira
//   2. AgentRunStarted     — Mira picks up the brief
//   3. AgentRunCompleted   — Mira finishes; deliverable in document store
//   4. DecisionRequested   — Mira requests CEO sign-off
//   5. CeoDecision         — CEO approves
//   6. RecordFiled (auto)  — auto-archive handler moves source card +
//                            emits typed RecordFiled
//
// Author: Anya (Data / analytics engineer, engineering — projection-runtime
//          + dashboard derivation curator)
//          · Owen (Company Secretary, governance — records-lifecycle
//          semantics consult)

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { LocalFsDocumentStore } from "../platform/document-store";
import {
  recordAgentRunCompleted,
  recordAgentRunStarted,
  recordBriefIssued,
  recordDecisionRequested,
} from "../platform/records";
import { LocalProjector } from "../platform/projections";
import {
  agentRunsRegisterProjection,
  agentRunsRegisterRows,
  briefsRegisterProjection,
  briefsRegisterRows,
  decisionsRegisterProjection,
  decisionsRegisterRows,
  documentRegisterProjection,
  documentRegisterRows,
} from "../platform/rms-registers";
import scroogeOwnerInboxArchiver from "../runtime/agents/scrooge-owner-inbox-archiver";
import { recordCeoDecision } from "../runtime/decisions/record";
import type { AgentRunContext } from "../runtime/types";

// ---------------------------------------------------------------------------
// Identity discipline (Principle 7) — name + position pairs.
// ---------------------------------------------------------------------------

const SCROOGE_REF = {
  name: "Scrooge",
  position: "Chief of Staff / Orchestrator",
};
const MIRA_REF = {
  name: "Mira",
  position: "Compliance / RegTech engineer",
};
const ATLAS_REF = {
  name: "Atlas",
  position: "Core banking platform architect",
};

const ENTITY = "BANK-ZA-001";
const SCROOGE_ACTOR = { type: "service" as const, id: "agent:scrooge" };
const MIRA_ACTOR = { type: "service" as const, id: "agent:mira" };

// Shared citations used across the chain.
const ENVELOPE_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "D-RMS-PHASE-1"];
const BRIEF_CITATIONS = ["FIC-S42", "MIRA-OBLIGATIONS-REGISTER-V1"];

// Stable identifiers — referenced across steps and assertions.
const BRIEF_ID = "brief:mira:obligations-refresh-2026-05-10-slice-5";
const RUN_ID = "run:mira:obligations-refresh-2026-05-10-slice-5";
const DECISION_ID = "D-RMS-SLICE-5-OBLIGATION-CADENCE";
const SOURCE_CARD_FILENAME = "2026-05-10_mira_slice-5-obligation-cadence.md";

// ---------------------------------------------------------------------------
// Fixture bodies — every body is content-addressed in the doc store.
// ---------------------------------------------------------------------------

const BRIEF_BODY = [
  "# Brief — refresh FIC obligations cadence",
  "",
  "**To:** Mira (Compliance / RegTech engineer)",
  "**From:** Scrooge (Chief of Staff / Orchestrator)",
  "",
  "Refresh the FIC obligations register entry for s.42 reporting cadence; the FIC has",
  "issued GN7 update raising cadence from quarterly to monthly. Surface the change as",
  "a CEO-decision card per the standing obligations-register-update workflow.",
  "",
  "Citations: FIC-S42, MIRA-OBLIGATIONS-REGISTER-V1.",
  "",
].join("\n");

const DELIVERABLE_BODY = [
  "# Mira — obligations register refresh: FIC s.42 cadence",
  "",
  "Per FIC GN7 update, refresh the cadence cell on the FIC s.42 obligation row from",
  "`quarterly` to `monthly`. The change has knock-on effects on Owen's cycle calendar",
  "and Eitan's reporting roster. Recommend CEO sign-off before the cadence flip lands",
  "in the obligations register.",
  "",
  "## Substrate gaps surfaced",
  "",
  "- Auto-router for AgentRunCompleted.followOnRoutes → DecisionRequested not yet built",
  "  (lives in S8 / Phase 2 of RMS).",
  "",
].join("\n");

const RECOMMENDATION_BODY = [
  "# Decision recommendation — D-RMS-SLICE-5-OBLIGATION-CADENCE",
  "",
  "**Stance:** Approve cadence shift to monthly per FIC GN7 update.",
  "",
  "**Reasoning:** The FIC has lifted the cadence floor; defaulting to monthly is the",
  "least-effort compliant posture. The downstream effect on Owen's cycle and Eitan's",
  "reporting roster is small (one row each).",
  "",
].join("\n");

// The source-decision-card written into the fixture owner-inbox so the
// auto-archive handler has something to move (Step 6). Written by the
// fixture itself — the test asserts that the SUBSTRATE writes zero new
// markdown, the fixture pre-write is scaffolding for the archiver bridge.
function decisionCardBody(): string {
  return [
    "---",
    "title: D-RMS-SLICE-5-OBLIGATION-CADENCE — refresh FIC s.42 cadence",
    "author: Mira (Compliance / RegTech engineer)",
    "date: 2026-05-10",
    "summary: Slice-5 fixture decision card.",
    "decision-required: true",
    `decision-id: ${DECISION_ID}`,
    "decision-category: near-term",
    "decision-for-ceo: Approve cadence shift to monthly per FIC GN7 update.",
    "decision-recommendation: Approve as drafted.",
    "decision-owner: Mira (Compliance / RegTech engineer)",
    "---",
    "",
    "# Decision card — D-RMS-SLICE-5-OBLIGATION-CADENCE",
    "",
    "Slice-5 fixture body — the substrate proper does not author this card",
    "in steady state; it exists only to exercise the auto-archive handler.",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Per-test isolation: fresh repo root + document store root.
//
// The event store is the per-process tmp DB seeded by `tests/_setup.ts`
// (BANK_EVENT_DB env var). Per-test we just track event counts and read
// new events delta-style, since the singleton is shared across describe
// blocks in this file.
// ---------------------------------------------------------------------------

let repoRoot: string;
let ownerInboxDir: string;
let actionedDir: string;
let teamInboxDir: string;
let docStoreRoot: string;
let documentStore: LocalFsDocumentStore;
let asOf: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "rms-phase-1-e2e-"));
  ownerInboxDir = resolve(repoRoot, "Owner Inbox");
  actionedDir = resolve(ownerInboxDir, "actioned");
  teamInboxDir = resolve(repoRoot, "Team Inbox");
  mkdirSync(actionedDir, { recursive: true });
  mkdirSync(teamInboxDir, { recursive: true });

  docStoreRoot = mkdtempSync(join(tmpdir(), "rms-phase-1-e2e-docs-"));
  documentStore = new LocalFsDocumentStore({ root: docStoreRoot });

  // Single asOf for the whole chain — keeps the events ordered + readable.
  asOf = "2026-05-10T15:00:00.000Z";
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
  rmSync(docStoreRoot, { recursive: true, force: true });
});

// Snapshot the singleton event store's count so we can read the delta
// emitted *during the run window*. The setup-preload temp DB is shared
// across tests, so cross-test leakage of event types like `RecordFiled`
// (from earlier tests) would otherwise pollute the assertions.
function snapshotEventCounts(): {
  agentBriefIssued: number;
  agentRunStarted: number;
  agentRunCompleted: number;
  decisionRequested: number;
  ceoDecision: number;
  recordFiled: number;
} {
  let agentBriefIssued = 0;
  let agentRunStarted = 0;
  let agentRunCompleted = 0;
  let decisionRequested = 0;
  let ceoDecision = 0;
  let recordFiled = 0;
  for (const e of eventStore.replay()) {
    switch (e.type) {
      case "AgentBriefIssued":
        agentBriefIssued++;
        break;
      case "AgentRunStarted":
        agentRunStarted++;
        break;
      case "AgentRunCompleted":
        agentRunCompleted++;
        break;
      case "DecisionRequested":
        decisionRequested++;
        break;
      case "CeoDecision":
        ceoDecision++;
        break;
      case "RecordFiled":
        recordFiled++;
        break;
    }
  }
  return {
    agentBriefIssued,
    agentRunStarted,
    agentRunCompleted,
    decisionRequested,
    ceoDecision,
    recordFiled,
  };
}

function listInboxRoot(dir: string): string[] {
  // Files at the directory's top level only (excluding sub-directories
  // like `actioned/`).
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();
}

// ---------------------------------------------------------------------------
// The chain
// ---------------------------------------------------------------------------

describe("RMS Phase 1 — end-to-end round-trip (Slice 5)", () => {
  it("exercises the six-step chain: brief → run → decision → CEO → auto-archive", async () => {
    const before = snapshotEventCounts();

    // Pre-flight: the fixture owner-inbox is empty (modulo the actioned/
    // sub-directory). The substrate must not add files at the top level.
    expect(listInboxRoot(ownerInboxDir)).toEqual([]);
    expect(listInboxRoot(teamInboxDir)).toEqual([]);

    // -----------------------------------------------------------------------
    // Step 1 — AgentBriefIssued
    // -----------------------------------------------------------------------
    const briefRes = recordBriefIssued(
      {
        briefId: BRIEF_ID,
        issuedTo: MIRA_REF,
        issuedBy: SCROOGE_REF,
        title: "Refresh FIC obligations cadence (s.42 → monthly)",
        directiveBody: BRIEF_BODY,
        priority: "now",
        expectedOutputs: [
          {
            kind: "decision-card",
            description:
              "DecisionRequested for the cadence shift; CEO sign-off via Decisions Desk",
          },
        ],
        citations: [...ENVELOPE_CITATIONS, ...BRIEF_CITATIONS],
        actor: SCROOGE_ACTOR,
        entity: ENTITY,
      },
      asOf,
      { documentStore },
    );

    expect(briefRes.event.type).toBe("AgentBriefIssued");
    expect(briefRes.documentHash.startsWith("blake3:")).toBe(true);
    expect(documentStore.exists(briefRes.documentHash)).toBe(true);
    // Body resolves to the cited bytes.
    expect(new TextDecoder().decode(documentStore.get(briefRes.documentHash))).toBe(BRIEF_BODY);

    // -----------------------------------------------------------------------
    // Step 2 — AgentRunStarted
    // -----------------------------------------------------------------------
    const startRes = recordAgentRunStarted(
      {
        runId: RUN_ID,
        briefId: BRIEF_ID,
        agent: MIRA_REF,
        startedAt: asOf,
        substrate: "scrooge-coordinated-in-session",
        worktree: repoRoot,
        citations: [...ENVELOPE_CITATIONS],
        actor: MIRA_ACTOR,
        entity: ENTITY,
      },
      asOf,
    );
    expect(startRes.event.type).toBe("AgentRunStarted");

    // -----------------------------------------------------------------------
    // Step 3 — AgentRunCompleted
    // -----------------------------------------------------------------------
    const completeRes = recordAgentRunCompleted(
      {
        runId: RUN_ID,
        briefId: BRIEF_ID,
        agent: MIRA_REF,
        completedAt: asOf,
        outcome: "delivered",
        deliverableBodies: [DELIVERABLE_BODY],
        substrateGapsSurfaced: [
          "Auto-router for followOnRoutes → DecisionRequested not yet built (Phase 2 / S8).",
        ],
        deliverableCitations: [...BRIEF_CITATIONS],
        followOnRoutes: [
          {
            kind: "decision",
            target: DECISION_ID,
            directive: "refresh requires CEO sign-off on cadence change",
          },
        ],
        citations: [...ENVELOPE_CITATIONS],
        actor: MIRA_ACTOR,
        entity: ENTITY,
      },
      asOf,
      { documentStore },
    );
    expect(completeRes.event.type).toBe("AgentRunCompleted");
    expect(completeRes.deliverableDocumentHashes.length).toBe(1);
    const deliverableHash = completeRes.deliverableDocumentHashes[0];
    expect(deliverableHash).toBeDefined();
    if (deliverableHash) {
      expect(documentStore.exists(deliverableHash)).toBe(true);
      expect(new TextDecoder().decode(documentStore.get(deliverableHash))).toBe(DELIVERABLE_BODY);
    }

    // -----------------------------------------------------------------------
    // Step 4 — DecisionRequested
    // -----------------------------------------------------------------------
    const decisionReqRes = recordDecisionRequested(
      {
        decisionId: DECISION_ID,
        title: "Refresh FIC s.42 cadence to monthly",
        category: "near-term",
        owner: MIRA_REF,
        forActor: "CEO",
        decisionForActor: "Approve cadence shift to monthly per FIC GN7.",
        recommendation: {
          stance: "approve",
          reasoning: "FIC GN7 update lifts the cadence floor; monthly is least-effort compliant.",
        },
        sourceDocumentBodies: [RECOMMENDATION_BODY],
        decisionCitations: [...BRIEF_CITATIONS],
        citations: [...ENVELOPE_CITATIONS, ...BRIEF_CITATIONS],
        actor: MIRA_ACTOR,
        entity: ENTITY,
      },
      asOf,
      { documentStore },
    );
    expect(decisionReqRes.event.type).toBe("DecisionRequested");
    expect(decisionReqRes.sourceDocumentHashes.length).toBe(1);
    const recHash = decisionReqRes.sourceDocumentHashes[0];
    if (recHash) {
      expect(documentStore.exists(recHash)).toBe(true);
    }

    // -----------------------------------------------------------------------
    // Pre-step-5 fixture: write the source-decision-card into the
    // fixture owner-inbox so the auto-archive handler has something to
    // move. This is scaffolding (the substrate itself does not author
    // this in steady state); the round-trip-acceptance assertion below
    // accounts for this fixture pre-write.
    // -----------------------------------------------------------------------
    const sourceCardPath = resolve(ownerInboxDir, SOURCE_CARD_FILENAME);
    writeFileSync(sourceCardPath, decisionCardBody(), "utf8");
    // Snapshot just-after-fixture-pre-write so the substrate-only delta
    // can be observed (substrate must add zero further files).
    const inboxAfterFixture = listInboxRoot(ownerInboxDir);
    expect(inboxAfterFixture).toEqual([SOURCE_CARD_FILENAME]);

    // -----------------------------------------------------------------------
    // Step 5 — CeoDecision
    // -----------------------------------------------------------------------
    const ceoRes = recordCeoDecision(
      {
        decisionId: DECISION_ID,
        action: "approve",
        title: "Refresh FIC s.42 cadence to monthly",
        outcome: "Approved per Mira's recommendation; cadence shift lands at next FIC reporting tick.",
        actor: "marc@tgv.co.za",
        comment: "downstream dispatch from D-RMS-PHASE-1; cadence change low-risk",
        sourceDoc: `Owner Inbox/${SOURCE_CARD_FILENAME}`,
        recordedVia: "test:rms-phase-1-e2e",
      },
      asOf,
    );
    expect(ceoRes.event.type).toBe("CeoDecision");

    // -----------------------------------------------------------------------
    // Step 6 — Auto-archive (RecordFiled)
    // -----------------------------------------------------------------------
    // In production, the event-trigger bus dispatches the archiver
    // handler with the CeoDecision event. Here we call the handler
    // directly — same code path, isolated repo root.
    const ctx: AgentRunContext = {
      agent: "Scrooge",
      trigger: {
        kind: "event-driven",
        id: "owner-inbox-archiver",
        triggeringEvents: [ceoRes.event],
      },
      asOf,
      repoRoot,
      ownerInboxDir,
      dryRun: false,
    };
    const archiverResult = await scroogeOwnerInboxArchiver(ctx);
    expect(archiverResult.ok).toBe(true);
    expect(archiverResult.eventsEmitted).toBe(1);
    expect(archiverResult.summary).toMatch(/1 archived/);

    // The file moved.
    expect(existsSync(sourceCardPath)).toBe(false);
    expect(existsSync(resolve(actionedDir, SOURCE_CARD_FILENAME))).toBe(true);

    // -----------------------------------------------------------------------
    // Event delta — exactly the six expected events landed.
    // -----------------------------------------------------------------------
    const after = snapshotEventCounts();
    expect(after.agentBriefIssued - before.agentBriefIssued).toBe(1);
    expect(after.agentRunStarted - before.agentRunStarted).toBe(1);
    expect(after.agentRunCompleted - before.agentRunCompleted).toBe(1);
    expect(after.decisionRequested - before.decisionRequested).toBe(1);
    expect(after.ceoDecision - before.ceoDecision).toBe(1);
    expect(after.recordFiled - before.recordFiled).toBe(1);

    // -----------------------------------------------------------------------
    // Acceptance criterion (spec §7.1 #6): no NEW markdown authored in
    // the inbox roots during the run window — beyond the fixture
    // source-card pre-write, which has been moved to actioned/.
    //
    // The substrate's contribution to the top-level inbox is ZERO files.
    // -----------------------------------------------------------------------
    expect(listInboxRoot(ownerInboxDir)).toEqual([]); // fixture card moved
    expect(listInboxRoot(teamInboxDir)).toEqual([]); // never touched
    // The fixture card sits in actioned/, not at the inbox root.
    expect(readdirSync(actionedDir).sort()).toEqual([SOURCE_CARD_FILENAME]);

    // -----------------------------------------------------------------------
    // Register projections — replaying from zero recovers the chain.
    // -----------------------------------------------------------------------
    const projector = new LocalProjector(eventStore);

    // Decisions register: row is open after Step 4, resolved after Step 5.
    const decisionsRows = decisionsRegisterRows(projector.build(decisionsRegisterProjection));
    const ourDecision = decisionsRows.find((r) => r.decisionId === DECISION_ID);
    expect(ourDecision).toBeDefined();
    expect(ourDecision?.status).toBe("resolved");
    expect(ourDecision?.resolution?.action).toBe("approve");
    expect(ourDecision?.title).toBe("Refresh FIC s.42 cadence to monthly");

    // Briefs register: row exists, status is `delivered`.
    const briefsRows = briefsRegisterRows(projector.build(briefsRegisterProjection));
    const ourBrief = briefsRows.find((r) => r.briefId === BRIEF_ID);
    expect(ourBrief).toBeDefined();
    expect(ourBrief?.status).toBe("delivered");
    expect(ourBrief?.issuedTo.name).toBe("Mira");
    expect(ourBrief?.runId).toBe(RUN_ID);

    // Records-of-agent-runs register: row exists, outcome is `delivered`.
    const runsRows = agentRunsRegisterRows(projector.build(agentRunsRegisterProjection));
    const ourRun = runsRows.find((r) => r.runId === RUN_ID);
    expect(ourRun).toBeDefined();
    expect(ourRun?.outcome).toBe("delivered");
    expect(ourRun?.briefId).toBe(BRIEF_ID);
    expect(ourRun?.deliverableHashes.length).toBe(1);

    // Document register: at least three new hashes (brief + deliverable +
    // recommendation source). The auto-archiver also files the source-
    // card body via recordFiled, so a fourth hash also lands.
    const docRows = documentRegisterRows(projector.build(documentRegisterProjection));
    const docHashes = new Set(docRows.map((r) => r.documentHash));
    if (deliverableHash) expect(docHashes.has(deliverableHash)).toBe(true);
    if (recHash) expect(docHashes.has(recHash)).toBe(true);
    // The brief body is referenced by AgentBriefIssued; the document
    // register projects it on first reference.
    expect(docHashes.has(briefRes.documentHash)).toBe(true);
  });

  it("auto-archive emits RecordFiled with registerKey=decisions and ceo-only classification", async () => {
    // Smaller targeted assertion on the Step-6 RecordFiled shape — the
    // big test above covers the chain; this asserts the RecordFiled
    // payload shape contracts the Document Register depends on.
    const sourceCardPath = resolve(ownerInboxDir, SOURCE_CARD_FILENAME);
    writeFileSync(sourceCardPath, decisionCardBody(), "utf8");

    const ceoRes = recordCeoDecision(
      {
        decisionId: `${DECISION_ID}-SHAPE`,
        action: "approve",
        title: "Shape test",
        outcome: "Approved.",
        actor: "marc@tgv.co.za",
        sourceDoc: `Owner Inbox/${SOURCE_CARD_FILENAME}`,
        recordedVia: "test:rms-phase-1-e2e:shape",
      },
      asOf,
    );

    const before = snapshotEventCounts();
    const ctx: AgentRunContext = {
      agent: "Scrooge",
      trigger: {
        kind: "event-driven",
        id: "owner-inbox-archiver",
        triggeringEvents: [ceoRes.event],
      },
      asOf,
      repoRoot,
      ownerInboxDir,
      dryRun: false,
    };
    const result = await scroogeOwnerInboxArchiver(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);

    // Find the new RecordFiled event.
    const after = snapshotEventCounts();
    expect(after.recordFiled - before.recordFiled).toBe(1);
    let last: { type: string; payload: Record<string, unknown> } | undefined;
    for (const e of eventStore.replay({ type: "RecordFiled" })) last = e;
    expect(last).toBeDefined();
    if (!last) throw new Error("no RecordFiled");
    expect(last.payload.registerKey).toBe("decisions");
    expect(last.payload.classification).toBe("ceo-only");
    expect(typeof last.payload.documentHash).toBe("string");
    expect(last.payload.documentHash as string).toMatch(/^blake3:[0-9a-f]{64}$/);
  });

  it("identity discipline (P7) — every emitted event in the chain pairs name + position on agent refs", () => {
    // Deliberately a separate test so the chain can be re-asserted at the
    // event-payload level without re-walking projections.
    const briefRes = recordBriefIssued(
      {
        briefId: `${BRIEF_ID}-id`,
        issuedTo: MIRA_REF,
        issuedBy: SCROOGE_REF,
        title: "Identity-pairing test",
        directiveBody: BRIEF_BODY,
        priority: "now",
        expectedOutputs: [{ kind: "decision-card", description: "x" }],
        citations: [...ENVELOPE_CITATIONS],
        actor: SCROOGE_ACTOR,
        entity: ENTITY,
      },
      asOf,
      { documentStore },
    );
    const startRes = recordAgentRunStarted(
      {
        runId: `${RUN_ID}-id`,
        briefId: `${BRIEF_ID}-id`,
        agent: MIRA_REF,
        startedAt: asOf,
        substrate: "scrooge-coordinated-in-session",
        citations: [...ENVELOPE_CITATIONS],
        actor: MIRA_ACTOR,
        entity: ENTITY,
      },
      asOf,
    );
    const completeRes = recordAgentRunCompleted(
      {
        runId: `${RUN_ID}-id`,
        briefId: `${BRIEF_ID}-id`,
        agent: MIRA_REF,
        completedAt: asOf,
        outcome: "delivered",
        deliverableBodies: [DELIVERABLE_BODY],
        substrateGapsSurfaced: [],
        deliverableCitations: [...BRIEF_CITATIONS],
        followOnRoutes: [],
        citations: [...ENVELOPE_CITATIONS],
        actor: MIRA_ACTOR,
        entity: ENTITY,
      },
      asOf,
      { documentStore },
    );

    const briefPayload = briefRes.event.payload as {
      issuedTo: { name: string; position: string };
      issuedBy: { name: string; position: string };
    };
    expect(briefPayload.issuedTo.name).toBe("Mira");
    expect(briefPayload.issuedTo.position).toBe("Compliance / RegTech engineer");
    expect(briefPayload.issuedBy.name).toBe("Scrooge");
    expect(briefPayload.issuedBy.position).toBe("Chief of Staff / Orchestrator");

    const startPayload = startRes.event.payload as { agent: { name: string; position: string } };
    expect(startPayload.agent.name).toBe("Mira");
    expect(startPayload.agent.position).toBe("Compliance / RegTech engineer");

    const completePayload = completeRes.event.payload as {
      agent: { name: string; position: string };
    };
    expect(completePayload.agent.name).toBe("Mira");
    expect(completePayload.agent.position).toBe("Compliance / RegTech engineer");

    // Sanity: the citations envelope carries the standing decision.
    expect(briefRes.event.citations).toContain("D-RMS-PHASE-1");
    // Untouched name reference for ATLAS_REF — keep the constant referenced
    // (avoids unused-binding lint flag) and prove the test imports the
    // identity-pairing convention end-to-end.
    expect(ATLAS_REF.position).toBe("Core banking platform architect");
  });
});
