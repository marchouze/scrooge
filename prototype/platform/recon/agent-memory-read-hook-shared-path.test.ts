// platform/recon/agent-memory-read-hook-shared-path.test.ts
//
// Sabotage-proof tests for recon:agent-memory-read-hook-shared-path. The real
// probe passes (run() — the autonomous runtime read-hook and the direct
// readMyMemory call agree, and both consumers import the canonical symbol). The
// pure assertion core FAILS on:
//   - a runtime slice that diverges from the direct read (a forked read-hook),
//   - an empty runtime slice while the direct read is non-empty (a stubbed hook),
//   - a consumer that does not import readMyMemory from the canonical module.
// The structural import-matcher is unit-tested on positive + negative source.
//
// Authority: D-SCROOGE-RECALL-BEFORE-DISPATCH (under D-AGENT-MEMORY-PERSISTENCE);
//   WS-AGENT-MEMORY read-hook.

import { describe, expect, it } from "bun:test";

import type { AgentMemoryRow } from "../agent-runtime/read-my-memory";
import {
  assertSharedPath,
  importsCanonicalReadMyMemory,
  run,
} from "./agent-memory-read-hook-shared-path";

function row(memoryId: string): AgentMemoryRow {
  return {
    memoryId,
    title: memoryId,
    domains: ["platform"],
    citations: ["D-SCROOGE-RECALL-BEFORE-DISPATCH"],
    producedByAgent: {
      name: "Atlas",
      position: "Core banking platform architect",
      agentId: "agent:atlas",
    },
    producedByRunId: "run:x",
    bodyDocumentHash: `blake3:${"1".repeat(64)}`,
    committedAt: "2026-06-27T00:00:01.000Z",
    body: "b",
    bodyResolved: true,
  };
}

const BOTH_IMPORT_CANONICAL = [
  { label: "runtime", imports: true },
  { label: "recall-cli", imports: true },
];

describe("assertSharedPath", () => {
  it("runtime == direct, both consumers import canonical → zero fails", () => {
    const slice = [row("memory:a")];
    const r = assertSharedPath(slice, slice, BOTH_IMPORT_CANONICAL, "fail");
    expect(r.violations.filter((v) => v.severity === "fail").length).toBe(0);
    // 1 equivalence + 1 liveness + 2 consumers.
    expect(r.asserted).toBe(4);
  });

  it("NEGATIVE — runtime slice diverges from the direct read FAILS (fork)", () => {
    const runtime = [row("memory:a")];
    const direct = [row("memory:b")]; // different rows → drift
    const r = assertSharedPath(runtime, direct, BOTH_IMPORT_CANONICAL, "fail");
    expect(
      r.violations.some(
        (v) => v.subject === "read-hook:runtime-vs-direct" && v.severity === "fail",
      ),
    ).toBe(true);
  });

  it("NEGATIVE — empty runtime slice while direct is non-empty FAILS (stubbed hook)", () => {
    const runtime: AgentMemoryRow[] = [];
    const direct = [row("memory:a")];
    const r = assertSharedPath(runtime, direct, BOTH_IMPORT_CANONICAL, "fail");
    // both the equivalence AND the liveness assertion trip; assert the liveness one.
    expect(
      r.violations.some((v) => v.subject === "read-hook:runtime-liveness" && v.severity === "fail"),
    ).toBe(true);
  });

  it("NEGATIVE — a consumer missing the canonical import FAILS", () => {
    const slice = [row("memory:a")];
    const r = assertSharedPath(
      slice,
      slice,
      [
        { label: "runtime", imports: true },
        { label: "recall-cli", imports: false },
      ],
      "fail",
    );
    expect(
      r.violations.some(
        (v) => v.subject === "read-hook:canonical-import:recall-cli" && v.severity === "fail",
      ),
    ).toBe(true);
  });
});

describe("importsCanonicalReadMyMemory", () => {
  it("matches a value import of readMyMemory from the canonical module", () => {
    const src = `import { readMyMemory } from "../agent-runtime/read-my-memory";`;
    expect(importsCanonicalReadMyMemory(src)).toBe(true);
  });

  it("matches a mixed type+value import across the named list", () => {
    const src = `import { type AgentMemoryRow, readMyMemory } from "../agent-runtime/read-my-memory";`;
    expect(importsCanonicalReadMyMemory(src)).toBe(true);
  });

  it("matches a multi-line import block", () => {
    const src = `import {\n  type AgentMemoryRow,\n  readMyMemory,\n} from "./read-my-memory";`;
    expect(importsCanonicalReadMyMemory(src)).toBe(true);
  });

  it("does NOT match a readMyMemory imported from a DIFFERENT module (a fork)", () => {
    const src = `import { readMyMemory } from "./my-forked-memory-reader";`;
    expect(importsCanonicalReadMyMemory(src)).toBe(false);
  });

  it("does NOT match the canonical module when readMyMemory is absent", () => {
    const src = `import { type AgentMemoryRow } from "../agent-runtime/read-my-memory";`;
    expect(importsCanonicalReadMyMemory(src)).toBe(false);
  });

  it("does NOT false-match a substring symbol like notReadMyMemoryX", () => {
    const src = `import { notReadMyMemoryX } from "./read-my-memory";`;
    expect(importsCanonicalReadMyMemory(src)).toBe(false);
  });
});

describe("run() — the real behavioural + structural probe", () => {
  it("passes: runtime read-hook == direct readMyMemory; both consumers canonical", () => {
    const result = run();
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === "fail").length).toBe(0);
    expect(result.asserted).toBe(4);
  });
});
