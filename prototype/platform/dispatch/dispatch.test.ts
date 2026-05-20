// platform/dispatch/dispatch.test.ts
//
// Unit tests for the dispatch sync primitive.
// Authority: D-DISPATCH-SYNC-PRIMITIVE.
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import type {
  AgentBriefIssuedPayload,
  AgentRunCompletedPayload,
} from "../event-store/event-types/agent";
import type { Event } from "../event-store/types";
import { assertBlockingRunsClosed } from "./index";

function mkBrief(
  args: Partial<AgentBriefIssuedPayload> & { briefId: string },
): AgentBriefIssuedPayload {
  const defaults: AgentBriefIssuedPayload = {
    briefId: args.briefId,
    issuedTo: { name: "Agent", position: "Position" },
    issuedBy: { name: "Scrooge", position: "Chief of Staff" },
    title: args.title ?? "Title",
    directiveDocumentHash: `blake3:${"0".repeat(64)}`,
    priority: "now",
    expectedOutputs: [{ kind: "deliverable-document", description: "x" }],
  };
  return { ...defaults, ...args };
}

function mkCompletion(args: {
  runId: string;
  briefId: string;
  outcome: AgentRunCompletedPayload["outcome"];
  completedAt: string;
}): Event {
  return {
    event_id: `e-${args.runId}`,
    type: "AgentRunCompleted",
    as_of: args.completedAt,
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "test" },
    citations: ["D-DISPATCH-SYNC-PRIMITIVE"],
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

describe("assertBlockingRunsClosed", () => {
  it("returns ok=true with empty blocksOn", () => {
    const brief = mkBrief({ briefId: "b:1" });
    const r = assertBlockingRunsClosed({
      brief,
      events: [],
      asOf: "2026-05-20T12:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    expect(r.blocksOn).toHaveLength(0);
  });

  it("returns ok=false when blocking reviewer has no completion event", () => {
    const brief = mkBrief({
      briefId: "b:decider",
      runRoleClass: "decider",
      blocksOn: [{ briefId: "b:reviewer", runRoleClass: "reviewer" }],
    });
    const r = assertBlockingRunsClosed({
      brief,
      events: [],
      asOf: "2026-05-20T12:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.blockedBy?.briefId).toBe("b:reviewer");
    expect(r.blockedBy?.reason).toMatch(/no AgentRunCompleted/);
  });

  it("returns ok=true when blocking reviewer closed delivered at or before asOf", () => {
    const brief = mkBrief({
      briefId: "b:decider",
      runRoleClass: "decider",
      blocksOn: [{ briefId: "b:reviewer", runRoleClass: "reviewer" }],
    });
    const r = assertBlockingRunsClosed({
      brief,
      events: [
        mkCompletion({
          runId: "r:reviewer",
          briefId: "b:reviewer",
          outcome: "delivered",
          completedAt: "2026-05-20T10:00:00.000Z",
        }),
      ],
      asOf: "2026-05-20T11:00:00.000Z",
    });
    expect(r.ok).toBe(true);
  });

  it("returns ok=false when blocking reviewer closed blocked", () => {
    const brief = mkBrief({
      briefId: "b:decider",
      runRoleClass: "decider",
      blocksOn: [{ briefId: "b:reviewer", runRoleClass: "reviewer" }],
    });
    const r = assertBlockingRunsClosed({
      brief,
      events: [
        mkCompletion({
          runId: "r:reviewer",
          briefId: "b:reviewer",
          outcome: "blocked",
          completedAt: "2026-05-20T10:00:00.000Z",
        }),
      ],
      asOf: "2026-05-20T11:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.blockedBy?.outcome).toBe("blocked");
    expect(r.blockedBy?.reason).toMatch(/outcome=blocked/);
  });

  it("returns ok=false when blocking reviewer closed AFTER asOf", () => {
    const brief = mkBrief({
      briefId: "b:decider",
      runRoleClass: "decider",
      blocksOn: [{ briefId: "b:reviewer", runRoleClass: "reviewer" }],
    });
    const r = assertBlockingRunsClosed({
      brief,
      events: [
        mkCompletion({
          runId: "r:reviewer",
          briefId: "b:reviewer",
          outcome: "delivered",
          completedAt: "2026-05-20T12:00:00.000Z",
        }),
      ],
      asOf: "2026-05-20T11:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.blockedBy?.reason).toMatch(/after assert asOf/);
  });

  it("returns ok=false if any of multiple reviewers is unsatisfied", () => {
    const brief = mkBrief({
      briefId: "b:decider",
      runRoleClass: "decider",
      blocksOn: [
        { briefId: "b:r1", runRoleClass: "reviewer" },
        { briefId: "b:r2", runRoleClass: "reviewer" },
      ],
    });
    const r = assertBlockingRunsClosed({
      brief,
      events: [
        mkCompletion({
          runId: "r:r1",
          briefId: "b:r1",
          outcome: "delivered",
          completedAt: "2026-05-20T10:00:00.000Z",
        }),
      ],
      asOf: "2026-05-20T11:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    expect(r.blockedBy?.briefId).toBe("b:r2");
    expect(r.blocksOn[0]?.satisfied).toBe(true);
    expect(r.blocksOn[1]?.satisfied).toBe(false);
  });
});
