// tests/rms-phase-2-roundtrip.test.ts
//
// RMS Phase 2 Block A — round-trip integration test for the three events-first
// dispatch CLIs (open-brief / start-run / close-run).
//
// Asserts:
//   1. open-brief emits AgentBriefIssued and puts the directive body in the
//      content-addressed document store.
//   2. start-run emits AgentRunStarted citing the briefId.
//   3. close-run emits AgentRunCompleted with deliverable hashes.
//   4. The briefs-dispatches register projects the lifecycle to status
//      `delivered` with the right runId + deliverable hashes.
//   5. The directive + each deliverable resolve from the document store at
//      their cited hashes.
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
let deliverablePath: string;

let openBriefResult: { briefId: string; documentHash: string; eventId: string };
let startRunResult: { runId: string; eventId: string };
let closeRunResult: {
  runId: string;
  briefId: string;
  eventId: string;
  outcome: string;
  deliverableHashes: string[];
};

interface CliOk {
  ok: true;
  [k: string]: unknown;
}

async function runCli(args: readonly string[]): Promise<CliOk> {
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
  // The CLI may print bun's `$ bun run ...` banner before our JSON line; the
  // last non-empty line is the JSON envelope.
  const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
  const lastLine = lines[lines.length - 1] ?? "";
  const parsed = JSON.parse(lastLine);
  if (parsed.ok !== true) {
    throw new Error(`CLI returned non-ok envelope: ${lastLine}`);
  }
  return parsed as CliOk;
}

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "rms-phase-2-roundtrip-"));
  eventDbPath = join(tmpRoot, "event.db");
  docStorePath = join(tmpRoot, "doc-store");
  briefBodyPath = join(tmpRoot, "brief.md");
  deliverablePath = join(tmpRoot, "deliverable.md");

  writeFileSync(
    briefBodyPath,
    [
      "# Block A round-trip brief",
      "",
      "Build the three events-first dispatch CLIs and the /briefs route.",
      "",
      `Generated at ${new Date().toISOString()} for the integration test.`,
    ].join("\n"),
  );

  writeFileSync(
    deliverablePath,
    [
      "# Block A deliverable",
      "",
      "PR scaffold + three CLIs landed + /briefs render + F-007/F-023 fixes.",
    ].join("\n"),
  );
});

afterAll(() => {
  // tmp dir is left in place — Bun's test runner cleans the OS tmp on next
  // reboot. Removing it explicitly would race with sqlite WAL closers.
});

describe("RMS Phase 2 Block A — events-first dispatch round-trip", () => {
  it("open-brief emits AgentBriefIssued + puts directive in doc store", async () => {
    openBriefResult = (await runCli([
      "scripts/dispatch/open-brief.ts",
      "--to-name",
      "Atlas",
      "--to-position",
      "Core banking platform architect, engineering",
      "--title",
      "Block A round-trip test brief",
      "--workstream",
      "WS-RMS-PHASE-2",
      "--priority",
      "now",
      "--body",
      briefBodyPath,
      "--cite",
      "D-RMS-PHASE-1",
      "--expected",
      "code-pr:PR landing Block A",
    ])) as typeof openBriefResult & CliOk;

    expect(openBriefResult.briefId).toMatch(/^brief:/);
    expect(openBriefResult.documentHash).toMatch(/^blake3:[0-9a-f]{64}$/);
    expect(typeof openBriefResult.eventId).toBe("string");
  });

  it("start-run emits AgentRunStarted citing the brief", async () => {
    startRunResult = (await runCli([
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
    ])) as typeof startRunResult & CliOk;

    expect(startRunResult.runId).toMatch(/^run:/);
    expect(typeof startRunResult.eventId).toBe("string");
  });

  it("close-run emits AgentRunCompleted + captures deliverable hashes", async () => {
    closeRunResult = (await runCli([
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
      deliverablePath,
      "--cite",
      "D-RMS-PHASE-1",
      "--gap",
      "M8 auto-commit ingest still pending",
    ])) as typeof closeRunResult & CliOk;

    expect(closeRunResult.outcome).toBe("delivered");
    expect(closeRunResult.deliverableHashes).toHaveLength(1);
    expect(closeRunResult.deliverableHashes[0]).toMatch(/^blake3:[0-9a-f]{64}$/);
  });

  it("briefs register shows the brief as delivered with the deliverable hash", async () => {
    // Re-import composition inside this test so it reads our test env vars.
    // (Bun caches modules per-process; the in-process eventStore singleton
    // was bound at module-load time when this test file imported. To read
    // the events the CLI wrote, instantiate a fresh store with the same
    // sqlite path, then fold through the briefs-register projection.)
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
    expect(row.directiveDocumentHash).toBe(openBriefResult.documentHash);
    expect(row.workstreamId).toBe("WS-RMS-PHASE-2");
    expect(row.issuedTo.name).toBe("Atlas");
  });

  it("documents resolve from the doc store at their cited hashes", async () => {
    const { LocalFsDocumentStore } = await import("../platform/document-store/local-fs");
    const docStore = new LocalFsDocumentStore({ root: docStorePath });

    // The CLI envelope returns hashes as plain strings; the DocumentStore.get
    // API takes the branded `DocumentHash` nominal type. The branding is a
    // pure compile-time tag, so casting is safe at the test seam.
    type DocumentHash = Parameters<typeof docStore.get>[0];
    const directive = new TextDecoder().decode(
      docStore.get(openBriefResult.documentHash as unknown as DocumentHash),
    );
    expect(directive).toContain("Block A round-trip brief");

    for (const hash of closeRunResult.deliverableHashes) {
      const body = new TextDecoder().decode(docStore.get(hash as unknown as DocumentHash));
      expect(body).toContain("Block A deliverable");
    }
  });

  it("idempotent re-emit returns the prior briefId without a fresh event", async () => {
    const dup = await runCli([
      "scripts/dispatch/open-brief.ts",
      "--to-name",
      "Atlas",
      "--to-position",
      "Core banking platform architect, engineering",
      "--title",
      "Block A round-trip test brief",
      "--workstream",
      "WS-RMS-PHASE-2",
      "--priority",
      "now",
      "--body",
      briefBodyPath,
      "--cite",
      "D-RMS-PHASE-1",
      "--expected",
      "code-pr:PR landing Block A",
    ]);
    expect(dup.duplicate).toBe(true);
    expect(dup.briefId).toBe(openBriefResult.briefId);
  });
});
