// tests/runtime.test.ts
//
// Tests for the agent runtime. The MVP runtime executes one agent /
// trigger pair (Vera overnight-recon); these tests assert the handler
// completes against the live recon pipelines and writes the expected
// deliverable when not in dry-run mode.
//
// Author: Atlas

import { beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeDecision } from "../platform/event-store/event-types/decision";
import anyaProjectionDrift from "../runtime/agents/anya-projection-drift";
import atlasSubstrateState from "../runtime/agents/atlas-substrate-state";
import miraObligationsSnapshot from "../runtime/agents/mira-obligations-snapshot";
import owenGovernanceCyclePrep from "../runtime/agents/owen-governance-cycle-prep";
import scroogeInboxHygiene from "../runtime/agents/scrooge-inbox-hygiene";
import sennaSecuritySubstrateState from "../runtime/agents/senna-security-substrate-state";
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
  beforeAll(() => {
    // The test event store (temp DB from _setup.ts) starts empty. If other
    // test files running in parallel write CeoDecision events (e.g. Mira's
    // M1 handler tests), isStoreEmpty() returns false and the
    // decision-required-event-pairing recon runs its full check — but the
    // temp store won't have the real actioned files' decision IDs, so the
    // check fails. Pre-seed the temp store with terminal CeoDecision events
    // for every actioned file that has decision-required: true + decision-id.
    const repoRoot = join(import.meta.dir, "..", "..");
    const actionedDir = resolve(repoRoot, "Owner Inbox", "actioned");
    try {
      for (const name of readdirSync(actionedDir)) {
        if (!name.endsWith(".md")) continue;
        const path = resolve(actionedDir, name);
        try {
          if (!statSync(path).isFile()) continue;
        } catch {
          continue;
        }
        const content = readFileSync(path, "utf8");
        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!fmMatch?.[1]) continue;
        const fm = fmMatch[1];
        const drMatch = fm.match(/^decision-required:\s*(.+?)\s*$/im);
        if (drMatch?.[1]?.trim().toLowerCase() !== "true") continue;
        const diMatch = fm.match(/^decision-id:\s*(.+?)\s*$/im);
        const decisionId = diMatch?.[1]?.trim();
        if (!decisionId) continue;
        eventStore.append(
          makeDecision({
            asOf: "2026-05-01T00:00:00.000Z",
            entity: "BANK-ZA-001",
            actor: { type: "human", id: "marc@tgv.co.za" },
            citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
            eventId: newEventId(),
            payload: {
              decisionId,
              phase: "approved",
              authority: "CEO",
              authorityRef: "marc@tgv.co.za",
              title: `Seed approval for ${decisionId}`,
              category: "governance",
              recommendation: "Approved.",
              rationale: "Approved (runtime test seed).",
              sourceDocHashes: [],
              citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
              recordedVia: "backfill:owner-inbox-records",
            },
          }),
        );
      }
    } catch {
      // If actioned/ doesn't exist or can't be read, skip seeding.
    }
  });

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
      // 1 SubstrateStateSnapshot + 2 events per substrate gap (RiskRaised
      // + WorkstreamRegistered). Gap inventory evolves; assert the shape
      // (≥ 1 baseline + even gap-pair count) rather than a fixed number.
      expect(result.eventsEmitted).toBeGreaterThanOrEqual(1);
      expect((result.eventsEmitted - 1) % 2).toBe(0);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});

describe("runtime — Anya projection-drift handler", () => {
  it("snapshots canonical-source counts in dry-run", async () => {
    const ctx = makeContext({ dryRun: true });
    const result = await anyaProjectionDrift(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.deliverable).toBeUndefined();
  });

  it("writes a deliverable + emits a DataProjectionSnapshot event when live", async () => {
    const ctx = makeContext({ dryRun: false });
    try {
      const result = await anyaProjectionDrift(ctx);
      expect(result.ok).toBe(true);
      expect(result.deliverable).toMatch(/^Owner Inbox\/2026-05-07_anya_projection-drift\.md$/);
      expect(existsSync(join(ctx.ownerInboxDir, "2026-05-07_anya_projection-drift.md"))).toBe(true);
      expect(result.eventsEmitted).toBe(1);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});

describe("runtime — Scrooge inbox-hygiene handler", () => {
  it("reports inbox state without moving anything in dry-run", async () => {
    const ctx = makeContext({ dryRun: true });
    const result = await scroogeInboxHygiene(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.deliverable).toBeUndefined();
    expect(result.summary).toMatch(/Team Inbox open/);
  });

  it("writes a deliverable + emits an InboxHygieneSweep event when live", async () => {
    const ctx = makeContext({ dryRun: false });
    try {
      const result = await scroogeInboxHygiene(ctx);
      expect(result.ok).toBe(true);
      expect(result.deliverable).toMatch(/^Owner Inbox\/2026-05-07_scrooge_inbox-hygiene\.md$/);
      expect(result.eventsEmitted).toBe(1);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});

describe("runtime — Owen governance-cycle-prep handler", () => {
  it("digests open decisions + open seats + recent CEO actions in dry-run", async () => {
    const ctx = makeContext({ dryRun: true });
    const result = await owenGovernanceCyclePrep(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.deliverable).toBeUndefined();
    expect(result.summary).toMatch(/decisions/);
  });

  it("writes a deliverable + emits a GovernanceCyclePrep event when live", async () => {
    const ctx = makeContext({ dryRun: false });
    try {
      const result = await owenGovernanceCyclePrep(ctx);
      expect(result.ok).toBe(true);
      expect(result.deliverable).toMatch(
        /^Owner Inbox\/2026-05-07_owen_governance-cycle-prep\.md$/,
      );
      expect(result.eventsEmitted).toBe(1);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});

describe("runtime — Mira obligations-snapshot handler", () => {
  it("counts obligations + regulator instruments in dry-run", async () => {
    const ctx = makeContext({ dryRun: true });
    const result = await miraObligationsSnapshot(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toMatch(/obligations.*regulator instruments/);
  });

  it("writes a deliverable + emits an ObligationsRegisterSnapshot event when live", async () => {
    const ctx = makeContext({ dryRun: false });
    try {
      const result = await miraObligationsSnapshot(ctx);
      expect(result.ok).toBe(true);
      expect(result.deliverable).toMatch(/^Owner Inbox\/2026-05-07_mira_obligations-snapshot\.md$/);
      expect(result.eventsEmitted).toBe(1);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});

describe("runtime — Senna security-substrate-state handler", () => {
  it("inventories CI gates + recon pipelines + security artefacts in dry-run", async () => {
    const ctx = makeContext({ dryRun: true });
    const result = await sennaSecuritySubstrateState(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toMatch(/CI gates.*recon pipelines/);
  });

  it("writes a deliverable + emits a SecuritySubstrateSnapshot event when live", async () => {
    const ctx = makeContext({ dryRun: false });
    try {
      const result = await sennaSecuritySubstrateState(ctx);
      expect(result.ok).toBe(true);
      expect(result.deliverable).toMatch(
        /^Owner Inbox\/2026-05-07_senna_security-substrate-state\.md$/,
      );
      expect(result.eventsEmitted).toBe(1);
    } finally {
      rmSync(ctx.ownerInboxDir, { recursive: true, force: true });
    }
  });
});
