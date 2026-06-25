// platform/rms-registers/agent-memory.test.ts
//
// Tests for the federated agent-memory register projection: heads per memoryId,
// append-only supersedes (old retained, head moves), query by domain + agent.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 1.

import { describe, expect, it } from "bun:test";

import type { DocumentHash } from "../document-store/types";
import { makeAgentMemoryCommitted } from "../event-store/event-types";
import {
  agentMemoryRegisterInitial,
  agentMemoryRegisterProjection,
  headsByAgent,
  headsByDomain,
  liveHeads,
} from "./agent-memory";

function mem(opts: {
  memoryId: string;
  domains: string[];
  agentName?: string;
  agentId?: string;
  supersedes?: string;
  asOf?: string;
}) {
  return makeAgentMemoryCommitted({
    asOf: opts.asOf ?? "2026-06-25T00:00:00.000Z",
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: opts.agentId ?? "agent:atlas" },
    citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    payload: {
      memoryId: opts.memoryId,
      domains: opts.domains,
      producedByAgent: {
        name: opts.agentName ?? "Atlas",
        position: "Core banking platform architect",
        agentId: opts.agentId ?? "agent:atlas",
      },
      producedByRunId: "run:x",
      title: opts.memoryId,
      bodyDocumentHash: `blake3:${"0".repeat(64)}` as DocumentHash,
      citations: ["D-AGENT-MEMORY-PERSISTENCE"],
      ...(opts.supersedes ? { supersedes: opts.supersedes } : {}),
    },
  });
}

function fold(events: ReturnType<typeof mem>[]) {
  let state = agentMemoryRegisterInitial;
  for (const e of events) {
    if (agentMemoryRegisterProjection.accepts(e)) {
      state = agentMemoryRegisterProjection.reduce(state, e);
    }
  }
  return state;
}

describe("agentMemoryRegisterProjection", () => {
  it("opens a head per memoryId", () => {
    const state = fold([
      mem({ memoryId: "m1", domains: ["engineering"] }),
      mem({ memoryId: "m2", domains: ["risk"] }),
    ]);
    expect(
      liveHeads(state)
        .map((r) => r.memoryId)
        .sort(),
    ).toEqual(["m1", "m2"]);
  });

  it("supersedes moves the head — old row retained but not live", () => {
    const state = fold([
      mem({ memoryId: "m1", domains: ["engineering"], asOf: "2026-06-25T00:00:00.000Z" }),
      mem({
        memoryId: "m1-v2",
        domains: ["engineering"],
        supersedes: "m1",
        asOf: "2026-06-25T01:00:00.000Z",
      }),
    ]);
    const live = liveHeads(state).map((r) => r.memoryId);
    expect(live).toContain("m1-v2");
    expect(live).not.toContain("m1");
    // The superseded row is RETAINED (append-only) — it is still in the map.
    expect(state.rows.has("m1")).toBe(true);
    expect(state.rows.get("m1")?.supersededBy).toBe("m1-v2");
  });

  it("federation by domain — a cross-cutting fact tagged N domains surfaces under each", () => {
    const state = fold([mem({ memoryId: "x", domains: ["engineering", "risk", "compliance"] })]);
    expect(headsByDomain(state, "engineering").map((r) => r.memoryId)).toEqual(["x"]);
    expect(headsByDomain(state, "risk").map((r) => r.memoryId)).toEqual(["x"]);
    expect(headsByDomain(state, "compliance").map((r) => r.memoryId)).toEqual(["x"]);
    expect(headsByDomain(state, "markets").length).toBe(0);
  });

  it("query by producing agent — matches agentId OR name", () => {
    const state = fold([
      mem({ memoryId: "a", domains: ["risk"], agentName: "Helena", agentId: "agent:helena" }),
      mem({ memoryId: "b", domains: ["engineering"], agentName: "Atlas", agentId: "agent:atlas" }),
    ]);
    expect(headsByAgent(state, "agent:helena").map((r) => r.memoryId)).toEqual(["a"]);
    expect(headsByAgent(state, "Atlas").map((r) => r.memoryId)).toEqual(["b"]);
  });
});
