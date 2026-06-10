// runtime/agents/atlas-goal-loop-dispatch.integration.test.ts
//
// Integration test for Atlas's brief-bound run-lifecycle dispatch.
//
// Proves the autonomy run-feed instrumentation end-to-end:
//   - A selected + executed deterministic iteration (substrate-state
//     attestation brief, no code-PR) emits AgentRunStarted{agent-runtime}
//     → AgentRunCompleted{outcome:"delivered"}.
//   - A selected-but-blocked iteration (code-PR brief the rule engine cannot
//     execute autonomously) emits AgentRunStarted{agent-runtime} →
//     AgentRunCompleted{outcome:"blocked"} with a surfaced substrate gap — a
//     typed deferred/blocked marker, NOT a phantom delivered run and NOT an
//     empty feed.
//
// The substrate (agent-runtime) classification is what makes the iteration
// visible in /api/autonomy (dashboard/server.ts filters
// substrate === "agent-runtime"). Before this instrumentation, Atlas's hourly
// select emitted AgentGoalSelected with NO run-lifecycle event, leaving the
// run-feed frozen at the last rohan run.
//
// Store isolation: BANK_EVENT_DB is set to a tmp file BEFORE importing the
// composition-backed module, so the lazy singleton event store + record helpers
// write to the isolated DB. Mirrors
// platform/regulatory/graph/obligation-equivalence-fold.integration.test.ts.
//
// Authority: D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (CEO-approved 2026-06-10).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "atlas-dispatch-"));
process.env.BANK_EVENT_DB = join(tmpDir, "event.db");

const { eventStore } = await import("../../platform/composition");
const { dispatchBriefBoundRun } = await import("./atlas-goal-loop");
const composition = await import("../../platform/composition");

import type { AgentBriefIssuedPayload } from "../../platform/event-store/event-types/agent";
import type { AgentRunContext, AgentRunOutput } from "../types";

const ATLAS_REF = { name: "Atlas", position: "Core banking platform architect" } as const;
const SCROOGE_REF = { name: "Scrooge", position: "Chief of Staff / Orchestrator" } as const;
const BRIEF_DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";

function makeCtx(asOf: string): AgentRunContext {
  return {
    agent: "atlas",
    runId: `run:atlas:test:${asOf}`,
    trigger: { kind: "scheduled", id: "goal-loop" },
    asOf,
    repoRoot: tmpDir,
    ownerInboxDir: tmpDir,
    dryRun: false,
  };
}

function makeBrief(
  briefId: string,
  title: string,
  kind: "code-pr" | "deliverable-document",
): AgentBriefIssuedPayload {
  return {
    briefId,
    issuedTo: ATLAS_REF,
    issuedBy: SCROOGE_REF,
    title,
    directiveDocumentHash: BRIEF_DOC_HASH,
    priority: "now",
    expectedOutputs: [{ kind, description: "d" }],
  };
}

/** Stub substrate-state handler — emits nothing, just confirms it is invoked. */
function makeStubHandler(): {
  handler: (c: AgentRunContext) => Promise<AgentRunOutput>;
  callCount: () => number;
} {
  let calls = 0;
  return {
    handler: async (_c: AgentRunContext): Promise<AgentRunOutput> => {
      calls++;
      return { eventsEmitted: 1, ok: true, summary: "stub substrate-state run" };
    },
    callCount: () => calls,
  };
}

function runLifecycleForBrief(briefId: string): {
  started: Array<{ substrate?: string; runId?: string }>;
  completed: Array<{ outcome?: string; gaps: string[] }>;
} {
  const started: Array<{ substrate?: string; runId?: string }> = [];
  const completed: Array<{ outcome?: string; gaps: string[] }> = [];
  for (const e of eventStore.replay({ type: "AgentRunStarted" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.briefId ?? "") !== briefId) continue;
    started.push({ substrate: p.substrate as string, runId: p.runId as string });
  }
  for (const e of eventStore.replay({ type: "AgentRunCompleted" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.briefId ?? "") !== briefId) continue;
    completed.push({
      outcome: p.outcome as string,
      gaps: (p.substrateGapsSurfaced as string[]) ?? [],
    });
  }
  return { started, completed };
}

describe("atlas dispatchBriefBoundRun — run-feed instrumentation", () => {
  test("selected + executed (substrate-state attestation) emits AgentRunStarted{agent-runtime} → delivered", async () => {
    const briefId = "brief:atlas:substrate-state-attestation:test";
    const brief = makeBrief(
      briefId,
      "Substrate-state readiness attestation",
      "deliverable-document",
    );
    const stub = makeStubHandler();

    const result = await dispatchBriefBoundRun(
      makeCtx("2026-06-10T10:00:00.000Z"),
      brief,
      "iter:aaa",
      0,
      stub.handler,
    );

    // The live handler ran (delivered path) and emitted Started + Completed.
    expect(stub.callCount()).toBe(1);
    expect(result.eventsEmitted).toBeGreaterThanOrEqual(3); // started + handler(1) + completed

    const lc = runLifecycleForBrief(briefId);
    expect(lc.started).toHaveLength(1);
    expect(lc.started[0]?.substrate).toBe("agent-runtime"); // visible in /api/autonomy
    expect(lc.completed).toHaveLength(1);
    expect(lc.completed[0]?.outcome).toBe("delivered");
    expect(lc.completed[0]?.gaps).toHaveLength(0);
  });

  test("selected-but-blocked (code-PR brief) emits AgentRunStarted{agent-runtime} → blocked with surfaced gap, no phantom delivery", async () => {
    const briefId = "brief:atlas:route-code-pr:test";
    const brief = makeBrief(briefId, "Implement the provenanceForEmit migration", "code-pr");
    const stub = makeStubHandler();

    const result = await dispatchBriefBoundRun(
      makeCtx("2026-06-10T11:00:00.000Z"),
      brief,
      "iter:bbb",
      2,
      stub.handler,
    );

    // The live handler is NOT invoked on the blocked path (no fabricated work).
    expect(stub.callCount()).toBe(0);
    expect(result.eventsEmitted).toBe(2); // started + completed only

    const lc = runLifecycleForBrief(briefId);
    expect(lc.started).toHaveLength(1);
    expect(lc.started[0]?.substrate).toBe("agent-runtime");
    expect(lc.completed).toHaveLength(1);
    expect(lc.completed[0]?.outcome).toBe("blocked");
    // Typed deferred/blocked marker carries the substrate gap, not a delivery.
    expect(lc.completed[0]?.gaps.length).toBeGreaterThan(0);
    expect(lc.completed[0]?.gaps[0]).toContain("cannot execute it autonomously");
  });

  test("blocked code-PR brief is NOT auto-routed (no new brief:atlas:route-* envelope)", () => {
    // Self-loop guard: Atlas must not issue a follow-on brief for a blocked
    // code-PR brief (the code-pr→Atlas brief-router would re-target Atlas).
    let routeBriefsIssued = 0;
    for (const e of eventStore.replay({ type: "AgentBriefIssued" })) {
      const p = e.payload as Record<string, unknown>;
      const id = String(p.briefId ?? "");
      if (id.startsWith("brief:atlas:route-")) routeBriefsIssued++;
    }
    expect(routeBriefsIssued).toBe(0);
    // Keep composition reference live (lint: no-unused).
    expect(typeof composition.eventStore.replay).toBe("function");
  });
});
