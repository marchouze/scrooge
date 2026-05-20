// platform/recon/dispatch-sync-integrity.test.ts
//
// Tests for the dispatch-sync-integrity recon pipeline.
//
// The canonical seed test reconstructs the 2026-05-20
// WS-MARKET-RISK-PROCEDURES v1.0 incident and asserts the pipeline
// returns exactly one historic violation (Helena v1.0 closing delivered
// before Bea v1.0 closed delivered).
//
// Authority: D-DISPATCH-SYNC-PRIMITIVE.
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import { run, type DispatchSyncReconInput } from "./dispatch-sync-integrity";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BriefArgs {
  briefId: string;
  title: string;
  workstreamId?: string;
  runRoleClass?: "reviewer" | "decider" | "executor" | "observer";
  blocksOn?: { briefId: string; runRoleClass: "reviewer" | "decider" | "executor" | "observer" }[];
  asOf?: string;
}

function brief(args: BriefArgs) {
  return {
    as_of: args.asOf ?? "2026-05-20T00:00:00.000Z",
    payload: {
      briefId: args.briefId,
      issuedTo: { name: "Agent", position: "Position" },
      issuedBy: { name: "Scrooge", position: "Chief of Staff" },
      title: args.title,
      directiveDocumentHash: `blake3:${"0".repeat(64)}`,
      priority: "now" as const,
      expectedOutputs: [{ kind: "deliverable-document" as const, description: "x" }],
      ...(args.workstreamId ? { workstreamId: args.workstreamId } : {}),
      ...(args.runRoleClass ? { runRoleClass: args.runRoleClass } : {}),
      ...(args.blocksOn ? { blocksOn: args.blocksOn } : {}),
    },
  };
}

interface RunCompletedArgs {
  runId: string;
  briefId: string;
  outcome: "delivered" | "blocked" | "withdrawn";
  completedAt: string;
}

function completed(args: RunCompletedArgs) {
  return {
    as_of: args.completedAt,
    payload: {
      runId: args.runId,
      briefId: args.briefId,
      agent: { name: "Agent", position: "Position" },
      completedAt: args.completedAt,
      outcome: args.outcome,
      deliverableDocumentHashes: [],
      substrateGapsSurfaced: [],
      citations: ["D-DISPATCH-SYNC-PRIMITIVE"],
      followOnRoutes: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("recon:dispatch-sync-integrity", () => {
  it("passes on an empty event store", () => {
    const r = run({ briefIssuedEvents: [], runCompletedEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  // ----- Forward mode ------------------------------------------------------

  it("forward-mode: passes when decider closes after reviewer", () => {
    const input: DispatchSyncReconInput = {
      briefIssuedEvents: [
        brief({
          briefId: "brief:reviewer:1",
          title: "Independent validation",
          runRoleClass: "reviewer",
        }),
        brief({
          briefId: "brief:decider:1",
          title: "Approval",
          runRoleClass: "decider",
          blocksOn: [{ briefId: "brief:reviewer:1", runRoleClass: "reviewer" }],
        }),
      ],
      runCompletedEvents: [
        completed({
          runId: "run:reviewer:1",
          briefId: "brief:reviewer:1",
          outcome: "delivered",
          completedAt: "2026-05-20T10:00:00.000Z",
        }),
        completed({
          runId: "run:decider:1",
          briefId: "brief:decider:1",
          outcome: "delivered",
          completedAt: "2026-05-20T11:00:00.000Z",
        }),
      ],
    };
    const r = run(input);
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("forward-mode: fails when decider closes before reviewer", () => {
    const input: DispatchSyncReconInput = {
      briefIssuedEvents: [
        brief({
          briefId: "brief:reviewer:1",
          title: "Independent validation",
          runRoleClass: "reviewer",
        }),
        brief({
          briefId: "brief:decider:1",
          title: "Approval",
          runRoleClass: "decider",
          blocksOn: [{ briefId: "brief:reviewer:1", runRoleClass: "reviewer" }],
        }),
      ],
      runCompletedEvents: [
        completed({
          runId: "run:decider:1",
          briefId: "brief:decider:1",
          outcome: "delivered",
          completedAt: "2026-05-20T10:00:00.000Z",
        }),
        completed({
          runId: "run:reviewer:1",
          briefId: "brief:reviewer:1",
          outcome: "delivered",
          completedAt: "2026-05-20T11:00:00.000Z",
        }),
      ],
    };
    const r = run(input);
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.subject).toBe("agent-run:run:decider:1");
  });

  it("forward-mode: fails when reviewer closes blocked but decider closes delivered", () => {
    const input: DispatchSyncReconInput = {
      briefIssuedEvents: [
        brief({
          briefId: "brief:reviewer:1",
          title: "Independent validation",
          runRoleClass: "reviewer",
        }),
        brief({
          briefId: "brief:decider:1",
          title: "Approval",
          runRoleClass: "decider",
          blocksOn: [{ briefId: "brief:reviewer:1", runRoleClass: "reviewer" }],
        }),
      ],
      runCompletedEvents: [
        completed({
          runId: "run:reviewer:1",
          briefId: "brief:reviewer:1",
          outcome: "blocked",
          completedAt: "2026-05-20T10:00:00.000Z",
        }),
        completed({
          runId: "run:decider:1",
          briefId: "brief:decider:1",
          outcome: "delivered",
          completedAt: "2026-05-20T11:00:00.000Z",
        }),
      ],
    };
    const r = run(input);
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
  });

  // ----- Legacy mode -------------------------------------------------------

  it("legacy seed test: 2026-05-20 Helena v1.0 incident detected as exactly 1 violation", () => {
    // The v1.0 incident shape — Helena (decider) closed delivered BEFORE Bea
    // (reviewer) closed delivered, both bracketing WS-MARKET-RISK-PROCEDURES.
    // The v1.1 cycle the same day closed correctly — Bea then Helena.
    //
    // Source events (real eventIds, for traceability):
    //   - Helena v1.0 AgentRunCompleted: 196ea822-d220-48ac-825c-06ffacd2a9dd
    //   - Bea    v1.0 AgentRunCompleted: a9fedeba-4775-4744-ace5-3a6d5263a112
    //   - Helena v1.1 AgentRunCompleted: d9ff5f52-5f7c-4872-b29c-9ec44f45e05a
    //   - Bea    v1.1 AgentRunCompleted: 677bf600-e2b3-4f8a-aaec-167d9ff5bb26
    const input: DispatchSyncReconInput = {
      briefIssuedEvents: [
        brief({
          briefId: "brief:bea:ws-market-risk-procedures-v1-validation",
          title: "Independent validation of market-risk procedures v1.0",
          workstreamId: "WS-MARKET-RISK-PROCEDURES",
          asOf: "2026-05-20T08:00:00.000Z",
        }),
        brief({
          briefId: "brief:helena:ws-market-risk-procedures-v1-approval",
          title: "CRO approval of market-risk procedures v1.0",
          workstreamId: "WS-MARKET-RISK-PROCEDURES",
          asOf: "2026-05-20T08:00:00.000Z",
        }),
        // v1.1 cycle — same workstream, fresh briefs.
        brief({
          briefId: "brief:bea:ws-market-risk-procedures-v1.1-validation",
          title: "Independent validation of market-risk procedures v1.1",
          workstreamId: "WS-MARKET-RISK-PROCEDURES-V11",
          asOf: "2026-05-20T14:00:00.000Z",
        }),
        brief({
          briefId: "brief:helena:ws-market-risk-procedures-v1.1-approval",
          title: "CRO approval of market-risk procedures v1.1",
          workstreamId: "WS-MARKET-RISK-PROCEDURES-V11",
          asOf: "2026-05-20T14:00:00.000Z",
        }),
      ],
      runCompletedEvents: [
        // v1.0: Helena closes delivered FIRST (the bug).
        completed({
          runId: "run:helena:2026-05-20T10-15-00",
          briefId: "brief:helena:ws-market-risk-procedures-v1-approval",
          outcome: "delivered",
          completedAt: "2026-05-20T10:15:00.000Z",
        }),
        completed({
          runId: "run:bea:2026-05-20T10-30-00",
          briefId: "brief:bea:ws-market-risk-procedures-v1-validation",
          outcome: "delivered",
          completedAt: "2026-05-20T10:30:00.000Z",
        }),
        // v1.1: Bea closes delivered FIRST (correct).
        completed({
          runId: "run:bea:2026-05-20T15-00-00",
          briefId: "brief:bea:ws-market-risk-procedures-v1.1-validation",
          outcome: "delivered",
          completedAt: "2026-05-20T15:00:00.000Z",
        }),
        completed({
          runId: "run:helena:2026-05-20T15-15-00",
          briefId: "brief:helena:ws-market-risk-procedures-v1.1-approval",
          outcome: "delivered",
          completedAt: "2026-05-20T15:15:00.000Z",
        }),
      ],
    };

    const r = run(input);
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    const v = r.violations[0];
    expect(v).toBeDefined();
    expect(v?.subject).toBe("agent-run:run:helena:2026-05-20T10-15-00");
    expect(v?.severity).toBe("fail");
    expect(v?.message).toContain("WS-MARKET-RISK-PROCEDURES");
    expect(v?.message).toContain("brief:helena:ws-market-risk-procedures-v1-approval");
    expect(v?.message).toContain("brief:bea:ws-market-risk-procedures-v1-validation");
  });

  it("legacy mode: passes when reviewer closes before decider in same workstream", () => {
    const input: DispatchSyncReconInput = {
      briefIssuedEvents: [
        brief({
          briefId: "brief:reviewer:legacy:1",
          title: "Independent validation of v1",
          workstreamId: "WS-LEGACY",
        }),
        brief({
          briefId: "brief:decider:legacy:1",
          title: "CRO approval of v1",
          workstreamId: "WS-LEGACY",
        }),
      ],
      runCompletedEvents: [
        completed({
          runId: "run:reviewer:legacy:1",
          briefId: "brief:reviewer:legacy:1",
          outcome: "delivered",
          completedAt: "2026-05-20T10:00:00.000Z",
        }),
        completed({
          runId: "run:decider:legacy:1",
          briefId: "brief:decider:legacy:1",
          outcome: "delivered",
          completedAt: "2026-05-20T11:00:00.000Z",
        }),
      ],
    };
    const r = run(input);
    expect(r.ok).toBe(true);
  });

  it("legacy mode: workstreams without both reviewer + decider produce no violations", () => {
    const input: DispatchSyncReconInput = {
      briefIssuedEvents: [
        brief({
          briefId: "brief:solo:1",
          title: "Build something",
          workstreamId: "WS-SOLO",
        }),
      ],
      runCompletedEvents: [
        completed({
          runId: "run:solo:1",
          briefId: "brief:solo:1",
          outcome: "delivered",
          completedAt: "2026-05-20T10:00:00.000Z",
        }),
      ],
    };
    const r = run(input);
    expect(r.ok).toBe(true);
  });

  it("legacy mode: briefs without workstreamId are not auto-grouped", () => {
    const input: DispatchSyncReconInput = {
      briefIssuedEvents: [
        brief({
          briefId: "brief:reviewer:nows",
          title: "Independent validation",
        }),
        brief({
          briefId: "brief:decider:nows",
          title: "Approval",
        }),
      ],
      runCompletedEvents: [
        completed({
          runId: "run:decider:nows",
          briefId: "brief:decider:nows",
          outcome: "delivered",
          completedAt: "2026-05-20T10:00:00.000Z",
        }),
        completed({
          runId: "run:reviewer:nows",
          briefId: "brief:reviewer:nows",
          outcome: "delivered",
          completedAt: "2026-05-20T11:00:00.000Z",
        }),
      ],
    };
    const r = run(input);
    expect(r.ok).toBe(true);
  });
});
