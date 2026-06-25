// platform/recon/agent-memory-recall-determinism.test.ts
//
// Sabotage-proof tests for recon:agent-memory-recall-determinism. The real probe
// passes (run()); the pure assertion core FAILS on a leak (unrelated memory
// returned), a dropped in-mandate memory, a dropped shared memory, and a
// non-deterministic order.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 2.

import { describe, expect, it } from "bun:test";

import type { AgentMemoryRow } from "../agent-runtime/read-my-memory";
import { assertRecallDeterminism, run } from "./agent-memory-recall-determinism";

const IDS = {
  inMandate: "memory:in-mandate",
  sharedOnly: "memory:shared-only",
  unrelated: "memory:unrelated",
};

function row(memoryId: string, domains: string[]): AgentMemoryRow {
  return {
    memoryId,
    title: memoryId,
    domains,
    citations: ["D-AGENT-MEMORY-PERSISTENCE"],
    producedByAgent: { name: "Atlas", position: "Core banking platform architect", agentId: "agent:atlas" },
    producedByRunId: "run:x",
    bodyDocumentHash: `blake3:${"0".repeat(64)}`,
    committedAt: "2026-06-25T00:00:00.000Z",
    body: "b",
    bodyResolved: true,
  };
}

describe("assertRecallDeterminism", () => {
  it("correct slice (in-mandate + shared, no unrelated), deterministic → zero fails", () => {
    const slice = [row(IDS.inMandate, ["platform"]), row(IDS.sharedOnly, ["shared"])];
    const r = assertRecallDeterminism(slice, slice, IDS, "fail");
    expect(r.violations.filter((v) => v.severity === "fail").length).toBe(0);
    expect(r.asserted).toBe(4);
  });

  it("NEGATIVE — leaking the unrelated memory FAILS (no-leak)", () => {
    const slice = [
      row(IDS.inMandate, ["platform"]),
      row(IDS.sharedOnly, ["shared"]),
      row(IDS.unrelated, ["credit-risk"]),
    ];
    const r = assertRecallDeterminism(slice, slice, IDS, "fail");
    expect(r.violations.some((v) => v.subject === "readMyMemory:no-leak" && v.severity === "fail")).toBe(true);
  });

  it("NEGATIVE — dropping the in-mandate memory FAILS", () => {
    const slice = [row(IDS.sharedOnly, ["shared"])];
    const r = assertRecallDeterminism(slice, slice, IDS, "fail");
    expect(r.violations.some((v) => v.subject === "readMyMemory:mandate-filter")).toBe(true);
  });

  it("NEGATIVE — dropping the shared memory FAILS", () => {
    const slice = [row(IDS.inMandate, ["platform"])];
    const r = assertRecallDeterminism(slice, slice, IDS, "fail");
    expect(r.violations.some((v) => v.subject === "readMyMemory:shared-tier")).toBe(true);
  });

  it("NEGATIVE — non-deterministic results across calls FAIL", () => {
    const first = [row(IDS.inMandate, ["platform"]), row(IDS.sharedOnly, ["shared"])];
    const second = [row(IDS.sharedOnly, ["shared"]), row(IDS.inMandate, ["platform"])]; // reordered
    const r = assertRecallDeterminism(first, second, IDS, "fail");
    expect(r.violations.some((v) => v.subject === "readMyMemory:determinism")).toBe(true);
  });
});

describe("run() — the real behavioural probe", () => {
  it("passes: readMyMemory is deterministic + mandate∪shared-correct on the seeded store", () => {
    const result = run();
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail").length).toBe(0);
    expect(result.asserted).toBe(4);
  });
});
