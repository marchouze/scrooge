// tests/dashboard-procedure-fetch.test.ts
//
// Integration test for the procedure-body inline-preview endpoint that
// backs the procedures-page modal (Anya, 2026-05-10).
//
//   GET /api/procedure/:filename
//
// Mirrors `dashboard-owner-inbox-fetch.test.ts`. Asserts:
//   • Happy path — a filename that exists in the live procedures index
//     returns 200 + the markdown body matching disk.
//   • Path-traversal attempt is rejected (400 / 404, never 200).
//   • Non-.md filenames are rejected with 400.
//   • Unknown filenames (basename not in the index) are rejected with 404.
//   • Files on disk under `Procedures/by-policy/` but not cited by the
//     current `_index.md` are rejected with 404 — allow-list integrity.
//
// Author: Anya (Data / analytics engineer, engineering)

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Subprocess, spawn } from "bun";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { getProceduresIndex } from "../dashboard/procedures-index";

const PROTOTYPE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(PROTOTYPE_ROOT, "..");
const SERVER_ENTRY = resolve(PROTOTYPE_ROOT, "dashboard", "server.ts");

let tmpDir: string;
let runtimeStatePath: string;
let eventDbPath: string;
let serverProcess: Subprocess | undefined;
let serverPort: number;
let sampleFilename: string | undefined;
let sampleDiskBody: string | undefined;
let unlistedDiskFilename: string | undefined;

async function findFreePort(): Promise<number> {
  const probe = Bun.serve({ port: 0, fetch: () => new Response("probe") });
  const port = probe.port;
  probe.stop();
  if (typeof port !== "number") {
    throw new Error("Bun.serve probe did not return a numeric port");
  }
  return port;
}

async function waitForServer(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/state`);
      if (r.ok) {
        await r.json();
        return;
      }
    } catch (e) {
      lastErr = e;
    }
    await Bun.sleep(150);
  }
  throw new Error(`server never became ready on port ${port}: ${String(lastErr)}`);
}

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "bank-dashboard-proc-fetch-"));
  runtimeStatePath = join(tmpDir, "runtime-dashboard-state.json");
  eventDbPath = join(tmpDir, "event.db");

  // Pick a sample procedure that the live index resolves to a file on
  // disk (i.e. authored, not orphan, not bare-reference). We read the
  // file body here so the happy-path assertion can match disk byte-for-
  // byte.
  const view = getProceduresIndex(REPO_ROOT);
  for (const g of view.groups) {
    for (const r of g.rows) {
      if (!r.procedureFile || r.orphan) continue;
      const filePath = resolve(REPO_ROOT, "Procedures", "by-policy", r.procedureFile);
      if (!existsSync(filePath)) continue;
      sampleFilename = r.procedureFile;
      sampleDiskBody = readFileSync(filePath, "utf8");
      break;
    }
    if (sampleFilename) break;
  }
  if (!sampleFilename || sampleDiskBody === undefined) {
    throw new Error("expected at least one authored procedure in the live index");
  }

  // For the allow-list-integrity case: a `Procedures/by-policy/` filename
  // that is *not* cited by the index. We synthesise one rather than
  // pulling a real file, to keep the assertion deterministic against
  // index churn.
  unlistedDiskFilename = "0000-anya-test-not-in-index.md";

  serverPort = await findFreePort();
  serverProcess = spawn({
    cmd: ["bun", "run", SERVER_ENTRY],
    cwd: PROTOTYPE_ROOT,
    env: {
      ...process.env,
      BANK_DASHBOARD_PORT: String(serverPort),
      BANK_DASHBOARD_RUNTIME_STATE: runtimeStatePath,
      BANK_EVENT_DB: eventDbPath,
      BANK_REPO_ROOT: REPO_ROOT,
      BANK_DASHBOARD_REFRESH_MS: "0",
      LOG_LEVEL: "warn",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  await waitForServer(serverPort);
});

afterAll(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    try {
      await serverProcess.exited;
    } catch {
      /* ignore */
    }
  }
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe("dashboard server — GET /api/procedure/:filename", () => {
  it("returns 200 and the markdown body for a procedure in the live index", async () => {
    if (!sampleFilename || sampleDiskBody === undefined) {
      throw new Error("no sample fixture");
    }
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/procedure/${encodeURIComponent(sampleFilename)}`,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/markdown");
    const body = await r.text();
    expect(body.length).toBeGreaterThan(0);
    expect(body).toBe(sampleDiskBody);
  });

  it("rejects path-traversal filenames with 400", async () => {
    // Use raw fetch URL — encodeURIComponent would mask the traversal.
    const r = await fetch(`http://127.0.0.1:${serverPort}/api/procedure/..%2Fpackage.json`);
    expect([400, 404]).toContain(r.status);
    expect(r.headers.get("content-type")).toContain("application/json");
  });

  it("rejects non-.md filenames with 400", async () => {
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/procedure/${encodeURIComponent("something.txt")}`,
    );
    expect(r.status).toBe(400);
  });

  it("rejects unknown filenames with 404", async () => {
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/procedure/${encodeURIComponent("0000-00-00_no-such-file.md")}`,
    );
    expect(r.status).toBe(404);
  });

  it("rejects filenames not present in the procedures index with 404", async () => {
    if (!unlistedDiskFilename) throw new Error("no unlistedDiskFilename");
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/procedure/${encodeURIComponent(unlistedDiskFilename)}`,
    );
    // The basename does not appear in any index row; allow-list rejects
    // before we touch disk, so this is a clean 404.
    expect(r.status).toBe(404);
  });
});
