// tests/scrooge-owner-inbox-archiver.test.ts
//
// D-OWNER-INBOX-AUTO-ARCHIVE — round-trip tests for the event-driven
// auto-archiver handler.
//
// Phase 4 update: Owner Inbox has been moved to archive/owner-inbox/ per
// D-RMS-PHASE-4. Tests now use archive paths.
//
// Asserts that the handler:
//   1. Moves a `decision-required: true` source card from `archive/owner-inbox/`
//      to `archive/owner-inbox/actioned/` on a CeoDecision event with sourceDoc.
//   2. Emits a typed `RecordFiled` event with the correct shape
//      (registerKey: "decisions", classification: "ceo-only", BLAKE3 hash).
//   3. Idempotent: a second invocation against the same CeoDecision event
//      (file already in `actioned/`) is a no-op + no event.
//   4. Skips `decision-required: false` source files (no move, no event).
//   5. Skips `sourceDoc` not-found cases without failing the handler
//      (logs warn, returns ok: true).
//   6. Skips events without `sourceDoc` (no-op).
//   7. Skips `sourceDoc` paths outside `archive/owner-inbox/` (no-op).
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09); slice authorisation
// under the no-pause rule.
//
// Author: Atlas (Core banking platform architect, engineering) +
//         Owen (Company Secretary, governance)

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeDecision } from "../platform/event-store/event-types/decision";
import type { Event } from "../platform/event-store/types";
import scroogeOwnerInboxArchiver from "../runtime/agents/scrooge-owner-inbox-archiver";
import type { AgentRunContext } from "../runtime/types";

const ENTITY = "BANK-ZA-001";

let repoRoot: string;
let ownerInboxDir: string;
let actionedDir: string;

beforeEach(() => {
  // Fresh per-test repo root with the archive/owner-inbox/actioned/ structure
  // the Phase 4 handler expects. Legacy "Owner Inbox/" has been archived.
  repoRoot = mkdtempSync(join(tmpdir(), "owner-inbox-archiver-"));
  ownerInboxDir = resolve(repoRoot, "archive", "owner-inbox");
  actionedDir = resolve(ownerInboxDir, "actioned");
  mkdirSync(actionedDir, { recursive: true });
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

function decisionRequiredCard(filename: string, decisionId: string): string {
  const path = resolve(ownerInboxDir, filename);
  const body = [
    "---",
    `title: Test card ${decisionId}`,
    "author: Atlas",
    "date: 2026-05-10",
    `summary: Fixture for ${decisionId} auto-archival round-trip.`,
    "decision-required: true",
    `decision-id: ${decisionId}`,
    "decision-category: near-term",
    "decision-for-ceo: Approve the test fixture.",
    "decision-recommendation: Approve as drafted.",
    "---",
    "",
    `# Test card ${decisionId}`,
    "",
    "Body content for the auto-archive round-trip test.",
    "",
  ].join("\n");
  writeFileSync(path, body, "utf8");
  return path;
}

function informationalCard(filename: string): string {
  const path = resolve(ownerInboxDir, filename);
  const body = [
    "---",
    "title: Informational",
    "author: Scrooge",
    "date: 2026-05-10",
    "summary: Not a decision card.",
    "decision-required: false",
    "---",
    "",
    "# Informational",
    "",
    "Not for archival.",
    "",
  ].join("\n");
  writeFileSync(path, body, "utf8");
  return path;
}

// D-DECISIONS-FRAMEWORK-REDESIGN Slice C: migrated from raw CeoDecision
// construction to makeDecision with the unified Decision payload.
function ceoDecisionEvent(opts: { decisionId: string; sourceDoc?: string }): Event {
  return makeDecision({
    asOf: "2026-05-10T12:00:00.000Z",
    entity: ENTITY,
    actor: { type: "human", id: "marc@tgv.co.za" },
    citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
    eventId: newEventId(),
    payload: {
      decisionId: opts.decisionId,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: `Test ${opts.decisionId}`,
      category: "governance",
      recommendation: "Approved.",
      rationale: "Approved.",
      sourceDocHashes: [],
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      recordedVia: "authoring-ui",
    },
  });
}

function makeContext(
  overrides: Partial<AgentRunContext> & { triggeringEvents: readonly Event[] },
): AgentRunContext {
  return {
    agent: "Scrooge",
    trigger: {
      kind: "event-driven",
      id: "owner-inbox-archiver",
      triggeringEvents: overrides.triggeringEvents,
    },
    asOf: "2026-05-10T12:05:00.000Z",
    repoRoot,
    ownerInboxDir,
    dryRun: false,
    ...overrides,
  };
}

describe("scrooge:owner-inbox-archiver", () => {
  it("moves a decision-required source card and emits RecordFiled", async () => {
    const filename = "2026-05-10_atlas_test-archive-move.md";
    const sourcePath = decisionRequiredCard(filename, "D-TEST-ARCHIVE-MOVE");
    const event = ceoDecisionEvent({
      decisionId: "D-TEST-ARCHIVE-MOVE",
      sourceDoc: `archive/owner-inbox/${filename}`,
    });

    const recordedBefore = countRecordFiled();

    const ctx = makeContext({ triggeringEvents: [event] });
    const result = await scroogeOwnerInboxArchiver(ctx);

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(1);
    expect(result.summary).toMatch(/1 archived/);

    // File moved.
    expect(existsSync(sourcePath)).toBe(false);
    expect(existsSync(resolve(actionedDir, filename))).toBe(true);

    // RecordFiled event has the right shape.
    const recordedAfter = countRecordFiled();
    expect(recordedAfter).toBe(recordedBefore + 1);

    const filed = lastRecordFiled();
    expect(filed.type).toBe("RecordFiled");
    const payload = filed.payload as Record<string, unknown>;
    expect(payload.recordId).toBe("record:decisions:2026-05-10_atlas_test-archive-move:actioned");
    expect(payload.registerKey).toBe("decisions");
    expect(payload.classification).toBe("ceo-only");
    expect(typeof payload.documentHash).toBe("string");
    expect(payload.documentHash as string).toMatch(/^blake3:[0-9a-f]{64}$/);
    expect(filed.actor).toEqual({ type: "service", id: "agent:scrooge:owner-inbox-archiver" });
  });

  it("is idempotent: re-firing on an already-archived source is a no-op", async () => {
    const filename = "2026-05-10_atlas_test-archive-idempotent.md";
    decisionRequiredCard(filename, "D-TEST-ARCHIVE-IDEMPOTENT");
    const event = ceoDecisionEvent({
      decisionId: "D-TEST-ARCHIVE-IDEMPOTENT",
      sourceDoc: `archive/owner-inbox/${filename}`,
    });

    // First invocation moves + emits.
    const ctx1 = makeContext({ triggeringEvents: [event] });
    const r1 = await scroogeOwnerInboxArchiver(ctx1);
    expect(r1.eventsEmitted).toBe(1);
    expect(existsSync(resolve(actionedDir, filename))).toBe(true);

    const recordedAfterFirst = countRecordFiled();

    // Second invocation on the same event — file is already in actioned/.
    const ctx2 = makeContext({ triggeringEvents: [event] });
    const r2 = await scroogeOwnerInboxArchiver(ctx2);
    expect(r2.ok).toBe(true);
    expect(r2.eventsEmitted).toBe(0);
    expect(r2.summary).toMatch(/0 archived/);

    // No additional RecordFiled emitted.
    expect(countRecordFiled()).toBe(recordedAfterFirst);
  });

  it("does NOT move decision-required: false files", async () => {
    const filename = "2026-05-10_scrooge_informational.md";
    const sourcePath = informationalCard(filename);
    const event = ceoDecisionEvent({
      decisionId: "D-TEST-NOT-A-DECISION",
      sourceDoc: `archive/owner-inbox/${filename}`,
    });

    const recordedBefore = countRecordFiled();

    const ctx = makeContext({ triggeringEvents: [event] });
    const result = await scroogeOwnerInboxArchiver(ctx);

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    // File still in archive/owner-inbox/, not in actioned/.
    expect(existsSync(sourcePath)).toBe(true);
    expect(existsSync(resolve(actionedDir, filename))).toBe(false);
    // No RecordFiled emitted.
    expect(countRecordFiled()).toBe(recordedBefore);
  });

  it("logs warn and returns ok when sourceDoc does not resolve", async () => {
    const event = ceoDecisionEvent({
      decisionId: "D-TEST-MISSING-SOURCE",
      sourceDoc: "archive/owner-inbox/2026-05-10_does-not-exist.md",
    });

    const recordedBefore = countRecordFiled();

    const ctx = makeContext({ triggeringEvents: [event] });
    const result = await scroogeOwnerInboxArchiver(ctx);

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(countRecordFiled()).toBe(recordedBefore);
  });

  it("skips events without sourceDoc", async () => {
    const event = ceoDecisionEvent({ decisionId: "D-TEST-NO-SOURCE-DOC" });

    const recordedBefore = countRecordFiled();
    const ctx = makeContext({ triggeringEvents: [event] });
    const result = await scroogeOwnerInboxArchiver(ctx);

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(countRecordFiled()).toBe(recordedBefore);
  });

  it("skips sourceDoc paths outside archive/owner-inbox/", async () => {
    // A Team Inbox source — out of scope; the handler must not touch it.
    const teamInboxDir = resolve(repoRoot, "archive", "team-inbox");
    mkdirSync(teamInboxDir, { recursive: true });
    const teamPath = resolve(teamInboxDir, "2026-05-10_test-team-inbox.md");
    writeFileSync(teamPath, "---\ndecision-required: true\n---\n# x\n", "utf8");

    const event = ceoDecisionEvent({
      decisionId: "D-TEST-OUT-OF-SCOPE",
      sourceDoc: "archive/team-inbox/2026-05-10_test-team-inbox.md",
    });

    const recordedBefore = countRecordFiled();

    const ctx = makeContext({ triggeringEvents: [event] });
    const result = await scroogeOwnerInboxArchiver(ctx);

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    // Team Inbox file untouched.
    expect(existsSync(teamPath)).toBe(true);
    expect(countRecordFiled()).toBe(recordedBefore);
  });

  it("skips sourceDoc paths already in archive/owner-inbox/actioned/", async () => {
    // File already in actioned/ — second-line idempotency layer.
    const filename = "2026-05-10_atlas_test-already-actioned.md";
    const actionedPath = resolve(actionedDir, filename);
    writeFileSync(actionedPath, "---\ndecision-required: true\n---\n# x\n", "utf8");

    const event = ceoDecisionEvent({
      decisionId: "D-TEST-ALREADY-ACTIONED",
      sourceDoc: `archive/owner-inbox/actioned/${filename}`,
    });

    const recordedBefore = countRecordFiled();

    const ctx = makeContext({ triggeringEvents: [event] });
    const result = await scroogeOwnerInboxArchiver(ctx);

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(existsSync(actionedPath)).toBe(true);
    expect(countRecordFiled()).toBe(recordedBefore);
  });

  it("returns ok with summary when no CeoDecision events in the triggering set", async () => {
    const ctx = makeContext({ triggeringEvents: [] });
    const result = await scroogeOwnerInboxArchiver(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toMatch(/no CeoDecision/);
  });

  it("dry-run does not move or emit", async () => {
    const filename = "2026-05-10_atlas_test-archive-dryrun.md";
    const sourcePath = decisionRequiredCard(filename, "D-TEST-ARCHIVE-DRYRUN");
    const event = ceoDecisionEvent({
      decisionId: "D-TEST-ARCHIVE-DRYRUN",
      sourceDoc: `archive/owner-inbox/${filename}`,
    });

    const recordedBefore = countRecordFiled();

    const ctx = makeContext({ triggeringEvents: [event], dryRun: true });
    const result = await scroogeOwnerInboxArchiver(ctx);

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    // File NOT moved in dry-run.
    expect(existsSync(sourcePath)).toBe(true);
    expect(existsSync(resolve(actionedDir, filename))).toBe(false);
    expect(countRecordFiled()).toBe(recordedBefore);
  });
});

// ---------------------------------------------------------------------------
// Helpers — read RecordFiled events from the test event store.
// ---------------------------------------------------------------------------

function countRecordFiled(): number {
  let n = 0;
  for (const _ of eventStore.replay({ type: "RecordFiled" })) n++;
  return n;
}

function lastRecordFiled(): Event {
  let last: Event | undefined;
  for (const e of eventStore.replay({ type: "RecordFiled" })) last = e;
  if (!last) throw new Error("no RecordFiled event in store");
  return last;
}
