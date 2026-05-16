// tests/rms-phase-2-block-b-roundtrip.test.ts
//
// RMS Phase 2 Block B — round-trip integration test for the
// RecordFiled-extended dispatch:close-run CLI + the Document register
// projection. Two deliverables of different classifications round-trip
// through open-brief → start-run → close-run; assertions confirm:
//
//   1. AgentBriefIssued + AgentRunStarted + AgentRunCompleted +
//      two RecordFiled events all in the store.
//   2. Both deliverable bodies resolve from the document store at
//      their cited hashes.
//   3. Document register surfaces both rows with the correct
//      classifications and retention citations.
//   4. Briefs register status = `delivered`.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09);
//            D-RMS-PHASE-2-4-AUTHORSHIP (Owen + Atlas, 2026-05-16).
//
// Author: Atlas (Core banking platform architect, engineering)

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

const PROTOTYPE_ROOT = new URL("..", import.meta.url).pathname;

let tmpRoot: string;
let eventDbPath: string;
let docStorePath: string;
let briefBodyPath: string;
let deliverableInternalPath: string;
let deliverableGovernancePath: string;

interface OpenBriefOk {
  ok: true;
  briefId: string;
  documentHash: string;
  eventId: string;
}
interface StartRunOk {
  ok: true;
  runId: string;
  eventId: string;
}
interface CloseRunOk {
  ok: true;
  runId: string;
  briefId: string;
  eventId: string;
  outcome: string;
  deliverableHashes: string[];
  recordEvents: Array<{
    recordId: string;
    documentHash: string;
    classification: string;
    registerKey: string;
    eventId: string;
  }>;
}

let openBriefResult: OpenBriefOk;
let startRunResult: StartRunOk;
let closeRunResult: CloseRunOk;

async function runCli<T>(args: readonly string[]): Promise<T> {
  const child = spawn({
    cmd: ["bun", "run", ...args],
    cwd: PROTOTYPE_ROOT,
    env: {
      ...process.env,
      BANK_EVENT_DB: eventDbPath,
      BANK_DOCUMENT_STORE_PATH: docStorePath,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await child.exited;
  const stdout = await new Response(child.stdout).text();
  const stderr = await new Response(child.stderr).text();
  if (exitCode !== 0) {
    throw new Error(`CLI exited ${exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`);
  }
  const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
  const lastLine = lines[lines.length - 1] ?? "";
  const parsed = JSON.parse(lastLine);
  if (parsed.ok !== true) {
    throw new Error(`CLI returned non-ok envelope: ${lastLine}`);
  }
  return parsed as T;
}

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "rms-phase-2-block-b-"));
  eventDbPath = join(tmpRoot, "event.db");
  docStorePath = join(tmpRoot, "doc-store");
  briefBodyPath = join(tmpRoot, "brief.md");
  deliverableInternalPath = join(tmpRoot, "deliverable-internal.md");
  deliverableGovernancePath = join(tmpRoot, "deliverable-governance.md");

  writeFileSync(
    briefBodyPath,
    [
      "# Block B round-trip brief",
      "",
      "Wire RecordFiled into close-run; two deliverables, two classifications.",
    ].join("\n"),
  );
  writeFileSync(
    deliverableInternalPath,
    [
      "# Block B agent-internal deliverable",
      "",
      "This deliverable falls under the agent-internal default classification.",
    ].join("\n"),
  );
  writeFileSync(
    deliverableGovernancePath,
    [
      "# Block B governance-seat deliverable",
      "",
      "This deliverable is classified governance-seat and registered in the `decisions` register.",
    ].join("\n"),
  );
});

afterAll(() => {
  // tmp dir left for sqlite WAL hygiene; OS cleans /tmp on reboot.
});

describe("RMS Phase 2 Block B — RecordFiled wiring round-trip", () => {
  it("open-brief emits AgentBriefIssued + puts directive in doc store", async () => {
    openBriefResult = await runCli<OpenBriefOk>([
      "scripts/dispatch/open-brief.ts",
      "--to-name",
      "Atlas",
      "--to-position",
      "Core banking platform architect, engineering",
      "--title",
      "Block B round-trip test brief",
      "--workstream",
      "WS-RMS-PHASE-2",
      "--priority",
      "now",
      "--body",
      briefBodyPath,
      "--cite",
      "D-RMS-PHASE-1",
      "--expected",
      "code-pr:PR landing Block B",
    ]);
    expect(openBriefResult.briefId).toMatch(/^brief:/);
    expect(openBriefResult.documentHash).toMatch(/^blake3:[0-9a-f]{64}$/);
  });

  it("start-run emits AgentRunStarted", async () => {
    startRunResult = await runCli<StartRunOk>([
      "scripts/dispatch/start-run.ts",
      "--brief",
      openBriefResult.briefId,
      "--agent-name",
      "Atlas",
      "--agent-position",
      "Core banking platform architect, engineering",
      "--substrate",
      "scrooge-coordinated-in-session",
      "--worktree",
      "/test/worktree",
      "--cite",
      "D-RMS-PHASE-1",
    ]);
    expect(startRunResult.runId).toMatch(/^run:/);
  });

  it("close-run emits AgentRunCompleted + one RecordFiled per deliverable", async () => {
    closeRunResult = await runCli<CloseRunOk>([
      "scripts/dispatch/close-run.ts",
      "--run",
      startRunResult.runId,
      "--brief",
      openBriefResult.briefId,
      "--agent-name",
      "Atlas",
      "--agent-position",
      "Core banking platform architect, engineering",
      "--outcome",
      "delivered",
      "--deliverable",
      deliverableInternalPath,
      "--deliverable",
      deliverableGovernancePath,
      "--classification",
      "agent-internal",
      "--classification",
      "governance-seat",
      "--register-key",
      "documents",
      "--register-key",
      "decisions",
      "--cite",
      "D-RMS-PHASE-1",
    ]);

    expect(closeRunResult.outcome).toBe("delivered");
    expect(closeRunResult.deliverableHashes).toHaveLength(2);
    expect(closeRunResult.recordEvents).toHaveLength(2);

    const [r0, r1] = closeRunResult.recordEvents;
    if (!r0 || !r1) throw new Error("expected two recordEvents");
    expect(r0.classification).toBe("agent-internal");
    expect(r0.registerKey).toBe("documents");
    expect(r1.classification).toBe("governance-seat");
    expect(r1.registerKey).toBe("decisions");
    expect(r0.documentHash).toMatch(/^blake3:[0-9a-f]{64}$/);
    expect(r1.documentHash).toMatch(/^blake3:[0-9a-f]{64}$/);
  });

  it("Document register surfaces both deliverables with correct retention citations", async () => {
    process.env.BANK_EVENT_DB = eventDbPath;
    process.env.BANK_DOCUMENT_STORE_PATH = docStorePath;
    const { EventStore } = await import("../platform/event-store/store");
    const { documentRegisterProjection, documentRegisterRows } = await import(
      "../platform/rms-registers/document"
    );
    const { LocalProjector } = await import("../platform/projections");

    const store = new EventStore(eventDbPath);
    const projector = new LocalProjector(store);
    const state = projector.build(documentRegisterProjection);
    const rows = documentRegisterRows(state);

    const r0Hash = closeRunResult.recordEvents[0]?.documentHash;
    const r1Hash = closeRunResult.recordEvents[1]?.documentHash;
    const internal = rows.find((r) => r.documentHash === r0Hash);
    const governance = rows.find((r) => r.documentHash === r1Hash);
    expect(internal).toBeDefined();
    expect(governance).toBeDefined();
    if (!internal || !governance) return;

    expect(internal.registered).toBe(true);
    expect(internal.classification).toBe("agent-internal");
    expect(internal.registerKey).toBe("documents");
    expect(internal.retention?.citationRef).toBe("BANKS-ACT-94-1990");
    expect(internal.retention?.minimumYears).toBe(5);

    expect(governance.registered).toBe(true);
    expect(governance.classification).toBe("governance-seat");
    expect(governance.registerKey).toBe("decisions");
    expect(governance.retention?.citationRef).toBe("COMPANIES-ACT-71-2008-S24");
    expect(governance.retention?.minimumYears).toBe(7);
  });

  it("Briefs register status is `delivered`", async () => {
    process.env.BANK_EVENT_DB = eventDbPath;
    process.env.BANK_DOCUMENT_STORE_PATH = docStorePath;
    const { EventStore } = await import("../platform/event-store/store");
    const { briefsRegisterProjection, briefsRegisterRows } = await import(
      "../platform/rms-registers/briefs-dispatches"
    );
    const { LocalProjector } = await import("../platform/projections");

    const store = new EventStore(eventDbPath);
    const projector = new LocalProjector(store);
    const state = projector.build(briefsRegisterProjection);
    const rows = briefsRegisterRows(state);

    const row = rows.find((r) => r.briefId === openBriefResult.briefId);
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.status).toBe("delivered");
    expect(row.runId).toBe(startRunResult.runId);
  });

  it("RecordFiled bodies resolve from the doc store", async () => {
    const { LocalFsDocumentStore } = await import("../platform/document-store/local-fs");
    const docStore = new LocalFsDocumentStore({ root: docStorePath });
    type DocumentHash = Parameters<typeof docStore.get>[0];
    for (const r of closeRunResult.recordEvents) {
      const body = new TextDecoder().decode(
        docStore.get(r.documentHash as unknown as DocumentHash),
      );
      expect(body).toContain("Block B");
    }
  });
});
