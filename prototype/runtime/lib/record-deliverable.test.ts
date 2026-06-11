// runtime/lib/record-deliverable.test.ts
//
// Unit tests for the central scheduler-deliverable RecordFiled emission.
// Focused on the idempotency / skip-decision branches, which are pure and
// do not append to the event store. The actual emit path is validated
// end-to-end by the live backfill + `recon:rms-documents-parity` going green
// (D-SCHEDULER-RECORDFILED-EMISSION remediation).
//
// Authority: D-SCHEDULER-RECORDFILED-EMISSION; D-RMS-PHASE-3.
// Author: Atlas (Core banking platform architect, engineering)

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import type { Event } from "../../platform/event-store/types";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { recordDeliverableFiled } from "./record-deliverable";

function makeCtx(overrides: Partial<AgentRunContext> = {}): AgentRunContext {
  return {
    agent: "Eitan",
    runId: "run:eitan:test",
    trigger: { kind: "scheduled", id: "liquidity-snapshot" },
    asOf: "2026-06-11T12:00:00.000Z",
    repoRoot: "/tmp/repo",
    ownerInboxDir: "/tmp/repo/archive/owner-inbox",
    dryRun: false,
    ...overrides,
  } as AgentRunContext;
}

function makeOutput(deliverable: string | undefined): AgentRunOutput {
  return { eventsEmitted: 0, ok: true, summary: "test", ...(deliverable ? { deliverable } : {}) };
}

const emptyPriorPaths = () => new Set<string>();

describe("recordDeliverableFiled — skip branches", () => {
  it("skips dry-run", () => {
    const r = recordDeliverableFiled(
      makeCtx({ dryRun: true }),
      makeOutput("Owner Inbox/2026-06-11_eitan_liquidity-snapshot.md"),
      [],
      emptyPriorPaths,
    );
    expect(r).toBeNull();
  });

  it("skips when no deliverable", () => {
    expect(
      recordDeliverableFiled(makeCtx(), makeOutput(undefined), [], emptyPriorPaths),
    ).toBeNull();
  });

  it("skips non-Owner-Inbox deliverables", () => {
    expect(
      recordDeliverableFiled(makeCtx(), makeOutput("prototype/foo.ts"), [], emptyPriorPaths),
    ).toBeNull();
  });

  it("skips non-markdown Owner Inbox deliverables", () => {
    expect(
      recordDeliverableFiled(makeCtx(), makeOutput("Owner Inbox/foo.json"), [], emptyPriorPaths),
    ).toBeNull();
  });

  it("skips when the handler self-filed the same path", () => {
    const deliverable = "Owner Inbox/2026-06-11_eitan_liquidity-snapshot.md";
    const selfFiled = {
      type: "RecordFiled",
      payload: { registerKey: "agent-runs", metadata: { path: deliverable } },
    } as unknown as Event;
    expect(
      recordDeliverableFiled(makeCtx(), makeOutput(deliverable), [selfFiled], emptyPriorPaths),
    ).toBeNull();
  });

  it("skips when the handler self-filed any documents record this run", () => {
    const docFiled = {
      type: "RecordFiled",
      payload: { registerKey: "documents", metadata: { path: "Owner Inbox/other.md" } },
    } as unknown as Event;
    expect(
      recordDeliverableFiled(
        makeCtx(),
        makeOutput("Owner Inbox/2026-06-11_eitan_liquidity-snapshot.md"),
        [docFiled],
        emptyPriorPaths,
      ),
    ).toBeNull();
  });

  it("skips when a prior run already filed the path", () => {
    const deliverable = "Owner Inbox/2026-06-11_eitan_liquidity-snapshot.md";
    expect(
      recordDeliverableFiled(makeCtx(), makeOutput(deliverable), [], () => new Set([deliverable])),
    ).toBeNull();
  });
});

describe("recordDeliverableFiled — missing-on-disk", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "record-deliverable-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("skips (returns null) when the deliverable file does not exist on disk", () => {
    const r = recordDeliverableFiled(
      makeCtx({ ownerInboxDir: dir }),
      makeOutput("Owner Inbox/2026-06-11_eitan_does-not-exist.md"),
      [],
      emptyPriorPaths,
    );
    expect(r).toBeNull();
  });

  it("skips (returns null) when the deliverable file is empty", () => {
    writeFileSync(resolve(dir, "2026-06-11_eitan_empty.md"), "   \n", "utf8");
    const r = recordDeliverableFiled(
      makeCtx({ ownerInboxDir: dir }),
      makeOutput("Owner Inbox/2026-06-11_eitan_empty.md"),
      [],
      emptyPriorPaths,
    );
    expect(r).toBeNull();
  });
});
