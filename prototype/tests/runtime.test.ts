// tests/runtime.test.ts
//
// Tests for the agent runtime. The MVP runtime executes one agent /
// trigger pair (Vera overnight-recon); these tests assert the handler
// completes against the live recon pipelines and writes the expected
// deliverable when not in dry-run mode.
//
// Author: Atlas

import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import atlasSubstrateState from "../runtime/agents/atlas-substrate-state";
import veraOvernightRecon from "../runtime/agents/vera-overnight-recon";
import type { AgentRunContext } from "../runtime/types";

function makeContext(overrides: Partial<AgentRunContext> = {}): AgentRunContext {
  const repoRoot = join(import.meta.dir, "..", "..");
  const ownerInboxDir = mkdtempSync(join(tmpdir(), "agent-run-"));
  return {
    agent: "Vera",
    trigger: { kind: "scheduled", id: "overnight-recon" },
    asOf: "2026-05-07T02:00:00.000Z",
    repoRoot,
    ownerInboxDir,
    dryRun: true,
    ...overrides,
  };
}

describe("runtime — Vera overnight-recon handler", () => {
  it("runs all pipelines and reports ok against the live repo", async () => {
    const ctx = makeContext({ dryRun: true });
    const result = await veraOvernightRecon(ctx);
    expect(result.ok).toBe(true);
    // Dry-run emits no events and writes no file.
    expect(result.eventsEmitted).toBe(0);
    expect(result.deliverable).toBeUndefined();
    // Summary should reference the pipelines.
    expect(result.summary).toMatch(/pipelines pass/);
  });

  it("writes a deliverable when not in dry-run mode", async () => {
    const ctx = makeContext({ dryRun: false });
    try {
      const result = await veraOvernightRecon(ctx);
      expect(result.ok).toBe(true);
      expect(result.deliverable).toMatch(/^Owner Inbox\/2026-05-07_vera_overnight-recon\.md$/);
      expect(existsSync(join(ctx.ownerInboxDir, "2026-05-07_vera_overnight-recon.md"))).toBe(true);
      // 4 ReconResult events + 0 AuditFinding events expected on a clean repo.
      expect(result.eventsEmitted).toBeGreaterThanOrEqual(4);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});

describe("runtime — Atlas substrate-state handler", () => {
  it("snapshots event store + persona coverage in dry-run", async () => {
    const ctx = makeContext({ dryRun: true });
    const result = await atlasSubstrateState(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.deliverable).toBeUndefined();
    // Summary should reference event count and persona coverage.
    expect(result.summary).toMatch(/events.*personas.*spec-ready/);
  });

  it("writes a deliverable + emits a SubstrateStateSnapshot event when not in dry-run", async () => {
    const ctx = makeContext({ dryRun: false });
    try {
      const result = await atlasSubstrateState(ctx);
      expect(result.ok).toBe(true);
      expect(result.deliverable).toMatch(/^Owner Inbox\/2026-05-07_atlas_substrate-state\.md$/);
      expect(existsSync(join(ctx.ownerInboxDir, "2026-05-07_atlas_substrate-state.md"))).toBe(true);
      expect(result.eventsEmitted).toBe(1);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});
