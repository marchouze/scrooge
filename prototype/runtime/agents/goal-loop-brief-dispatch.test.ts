// runtime/agents/goal-loop-brief-dispatch.test.ts
//
// Tests for the shared brief-bound run-lifecycle dispatch helper that
// instruments every goal-loop's iterations into the autonomy run-feed
// (which reads only AgentRunStarted{substrate:"agent-runtime"}).
//
// Store isolation: BANK_EVENT_DB is set to a tmp file BEFORE importing the
// composition-backed module (mirrors atlas-goal-loop-dispatch.integration.test.ts).
//
// Authority: D-AUTONOMY-RUN-LIFECYCLE-INSTRUMENTATION (PR #1182);
// D-QUEUE-CLOSEOUT-2026-06-10.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "goal-loop-dispatch-"));
process.env.BANK_EVENT_DB = join(tmpDir, "event.db");

const { eventStore } = await import("../../platform/composition");
const { makeAgentBriefIssued } = await import("../../platform/event-store/event-types/agent");
const { dispatchBriefBoundRun, isSelfExecutableBrief, openBriefsListForAgent } = await import(
  "./goal-loop-brief-dispatch"
);

import type { AgentBriefIssuedPayload } from "../../platform/event-store/event-types/agent";
import type { AgentRunContext, AgentRunOutput } from "../types";

const ANYA_REF = { name: "Anya", position: "Data / analytics engineer" } as const;
const SCROOGE_REF = { name: "Scrooge", position: "Chief of Staff / Orchestrator" } as const;
const DOC_HASH = "blake3:0000000000000000000000000000000000000000000000000000000000000001";

function makeCtx(asOf: string): AgentRunContext {
  return {
    agent: "anya",
    runId: `run:anya:test:${asOf}`,
    trigger: { kind: "scheduled", id: "goal-loop" },
    asOf,
    repoRoot: tmpDir,
    ownerInboxDir: tmpDir,
    dryRun: false,
  };
}

function makeBriefPayload(
  briefId: string,
  title: string,
  kind: "code-pr" | "deliverable-document",
  issuedTo: { name: string; position: string } = ANYA_REF,
): AgentBriefIssuedPayload {
  return {
    briefId,
    issuedTo,
    issuedBy: SCROOGE_REF,
    title,
    directiveDocumentHash: DOC_HASH,
    priority: "now",
    expectedOutputs: [{ kind, description: "d" }],
  };
}

function appendBrief(payload: AgentBriefIssuedPayload, asOf: string): void {
  eventStore.append(
    makeAgentBriefIssued({
      asOf,
      entity: "LE-BANK-SA",
      actor: { type: "service", id: "agent:scrooge" },
      citations: ["D-QUEUE-CLOSEOUT-2026-06-10"],
      payload,
    }),
  );
}

function makeStubHandler(): {
  handler: (c: AgentRunContext) => Promise<AgentRunOutput>;
  callCount: () => number;
} {
  let calls = 0;
  return {
    handler: async (_c: AgentRunContext): Promise<AgentRunOutput> => {
      calls++;
      return { eventsEmitted: 1, ok: true, summary: "stub attestation run" };
    },
    callCount: () => calls,
  };
}

function runLifecycleForBrief(briefId: string): {
  started: Array<{ substrate?: string; runId?: string; actorId?: string }>;
  completed: Array<{ outcome?: string; gaps: string[]; routes: unknown[] }>;
} {
  const started: Array<{ substrate?: string; runId?: string; actorId?: string }> = [];
  const completed: Array<{ outcome?: string; gaps: string[]; routes: unknown[] }> = [];
  for (const e of eventStore.replay({ type: "AgentRunStarted" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.briefId ?? "") !== briefId) continue;
    started.push({
      substrate: p.substrate as string,
      runId: p.runId as string,
      actorId: (e.actor as { id?: string } | undefined)?.id,
    });
  }
  for (const e of eventStore.replay({ type: "AgentRunCompleted" })) {
    const p = e.payload as Record<string, unknown>;
    if (String(p.briefId ?? "") !== briefId) continue;
    completed.push({
      outcome: p.outcome as string,
      gaps: (p.substrateGapsSurfaced as string[]) ?? [],
      routes: (p.followOnRoutes as unknown[]) ?? [],
    });
  }
  return { started, completed };
}

describe("isSelfExecutableBrief", () => {
  test("no pattern → never self-executable (shadow-mode posture)", () => {
    const brief = makeBriefPayload("brief:anya:x", "Projection drift sweep", "deliverable-document");
    expect(isSelfExecutableBrief(brief, undefined)).toBe(false);
  });

  test("pattern match + no code-PR output → self-executable", () => {
    const brief = makeBriefPayload(
      "brief:anya:y",
      "Projection-drift attestation",
      "deliverable-document",
    );
    expect(isSelfExecutableBrief(brief, /projection[\s-]?drift/i)).toBe(true);
  });

  test("code-PR output forces blocked even when the title matches", () => {
    const brief = makeBriefPayload("brief:anya:z", "Projection drift refactor", "code-pr");
    expect(isSelfExecutableBrief(brief, /projection[\s-]?drift/i)).toBe(false);
  });
});

describe("openBriefsListForAgent", () => {
  test("collapses duplicate envelopes, drops handled briefs, sorts oldest-first, respects min-age", async () => {
    // Three envelopes share one briefId (phantom-duplicate class from #1182).
    const dupId = "brief:anya:dup:open-list";
    appendBrief(
      makeBriefPayload(dupId, "Dup A", "deliverable-document"),
      "2026-06-01T08:00:00.000Z",
    );
    appendBrief(
      makeBriefPayload(dupId, "Dup A", "deliverable-document"),
      "2026-06-01T09:00:00.000Z",
    );
    appendBrief(
      makeBriefPayload(dupId, "Dup A", "deliverable-document"),
      "2026-06-01T10:00:00.000Z",
    );
    // An older distinct brief — must sort first.
    const oldId = "brief:anya:old:open-list";
    appendBrief(
      makeBriefPayload(oldId, "Old brief", "deliverable-document"),
      "2026-05-30T08:00:00.000Z",
    );
    // A too-recent brief (now) — excluded by min-age.
    appendBrief(
      makeBriefPayload("brief:anya:fresh:open-list", "Fresh brief", "deliverable-document"),
      new Date(Date.now() - 60_000).toISOString(), // wall-clock: relative-age fixture for the min-age filter
    );
    // A brief addressed to someone else — excluded.
    appendBrief(
      makeBriefPayload("brief:vera:other:open-list", "Vera brief", "deliverable-document", {
        name: "Vera",
        position: "Internal audit engineer",
      }),
      "2026-05-30T09:00:00.000Z",
    );

    const open = openBriefsListForAgent("anya");
    const ids = open.map((b) => b.briefId);
    expect(ids).toEqual([oldId, dupId]);

    // Handling the dup brief (one run-lifecycle pair) clears the whole batch.
    const stub = makeStubHandler();
    await dispatchBriefBoundRun(
      makeCtx("2026-06-10T10:00:00.000Z"),
      open[1] as AgentBriefIssuedPayload,
      "iter:dedup",
      0,
      { agentSlug: "anya" },
    );
    expect(stub.callCount()).toBe(0);
    const after = openBriefsListForAgent("anya").map((b) => b.briefId);
    expect(after).toEqual([oldId]);
  });
});

describe("dispatchBriefBoundRun — run-feed instrumentation", () => {
  test("self-executable attestation brief → live handler + AgentRunStarted{agent-runtime} → delivered", async () => {
    const briefId = "brief:anya:attestation:dispatch";
    const brief = makeBriefPayload(briefId, "Projection-drift attestation", "deliverable-document");
    const stub = makeStubHandler();

    const result = await dispatchBriefBoundRun(
      makeCtx("2026-06-10T11:00:00.000Z"),
      brief,
      "iter:delivered",
      0,
      {
        agentSlug: "anya",
        selfExecutablePattern: /projection[\s-]?drift/i,
        deliveredClassLabel: "projection-drift attestation",
        runHandler: stub.handler,
      },
    );

    expect(stub.callCount()).toBe(1);
    expect(result.eventsEmitted).toBeGreaterThanOrEqual(3); // started + handler(1) + completed

    const lc = runLifecycleForBrief(briefId);
    expect(lc.started).toHaveLength(1);
    expect(lc.started[0]?.substrate).toBe("agent-runtime"); // visible in /api/autonomy
    expect(lc.started[0]?.runId).toBe("run:anya:goal-loop:iter:delivered");
    expect(lc.started[0]?.actorId).toBe("agent:anya");
    expect(lc.completed).toHaveLength(1);
    expect(lc.completed[0]?.outcome).toBe("delivered");
    expect(lc.completed[0]?.gaps).toHaveLength(0);
  });

  test("non-executable brief → blocked with surfaced gap, handler NOT invoked, NOT auto-routed", async () => {
    const briefId = "brief:anya:code-pr:dispatch";
    const brief = makeBriefPayload(briefId, "Implement the projection migration", "code-pr");
    const stub = makeStubHandler();

    const result = await dispatchBriefBoundRun(
      makeCtx("2026-06-10T12:00:00.000Z"),
      brief,
      "iter:blocked",
      1,
      {
        agentSlug: "anya",
        selfExecutablePattern: /projection[\s-]?drift/i,
        deliveredClassLabel: "projection-drift attestation",
        runHandler: stub.handler,
      },
    );

    expect(stub.callCount()).toBe(0);
    expect(result.eventsEmitted).toBe(2); // started + completed only

    const lc = runLifecycleForBrief(briefId);
    expect(lc.started).toHaveLength(1);
    expect(lc.started[0]?.substrate).toBe("agent-runtime");
    expect(lc.completed).toHaveLength(1);
    expect(lc.completed[0]?.outcome).toBe("blocked");
    expect(lc.completed[0]?.gaps.length).toBeGreaterThan(0);
    expect(lc.completed[0]?.gaps[0]).toContain("cannot execute it autonomously");
    // No auto-routing — the #1182 phantom-backlog failure mode.
    expect(lc.completed[0]?.routes).toHaveLength(0);
  });

  test("shadow-mode config (no runHandler) → blocked even for an attestation-titled brief", async () => {
    const briefId = "brief:owen:shadow:dispatch";
    const brief = makeBriefPayload(briefId, "Governance-cycle readiness attestation", "deliverable-document", {
      name: "Owen",
      position: "Company Secretary",
    });

    await dispatchBriefBoundRun(makeCtx("2026-06-10T13:00:00.000Z"), brief, "iter:shadow", 0, {
      agentSlug: "owen",
    });

    const lc = runLifecycleForBrief(briefId);
    expect(lc.started).toHaveLength(1);
    expect(lc.started[0]?.substrate).toBe("agent-runtime");
    expect(lc.started[0]?.actorId).toBe("agent:owen");
    expect(lc.completed[0]?.outcome).toBe("blocked");
  });

  test("no new AgentBriefIssued envelopes are emitted by any dispatch path", () => {
    let routeBriefs = 0;
    for (const e of eventStore.replay({ type: "AgentBriefIssued" })) {
      const p = e.payload as Record<string, unknown>;
      const id = String(p.briefId ?? "");
      if (id.includes(":route-")) routeBriefs++;
    }
    expect(routeBriefs).toBe(0);
  });
});
