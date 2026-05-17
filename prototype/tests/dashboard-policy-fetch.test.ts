// tests/dashboard-policy-fetch.test.ts
//
// Integration test for the policy-source inline-preview endpoint that
// backs the policies-page modal (Anya, 2026-05-10).
//
//   GET /api/policy/:filename
//
// Mirrors `dashboard-owner-inbox-fetch.test.ts` and
// `dashboard-procedure-fetch.test.ts`. Asserts:
//   • Happy path — a filename in the live policy register's per-policy
//     `sourceFiles[]` union returns 200 + the markdown body matching disk.
//   • Path-traversal attempt is rejected (400 / 404, never 200).
//   • Non-.md filenames are rejected with 400.
//   • Unknown filenames (basename not cited by any policy) are rejected
//     with 404.
//   • Files on disk under `Owner Inbox/` but not cited by the policy
//     register are rejected with 404 — allow-list integrity.
//
// Author: Anya (Data / analytics engineer, engineering)

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Subprocess, spawn } from "bun";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import type { DashboardState, Policy } from "../dashboard/types";

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
  tmpDir = mkdtempSync(join(tmpdir(), "bank-dashboard-pol-fetch-"));
  runtimeStatePath = join(tmpDir, "runtime-dashboard-state.json");
  eventDbPath = join(tmpDir, "event.db");

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

  // Pull the live policy register's per-policy `sourceFiles[]` union and
  // pick the first basename that exists on disk under `Owner Inbox/`.
  const stateRes = await fetch(`http://127.0.0.1:${serverPort}/api/state`);
  const state = (await stateRes.json()) as DashboardState;
  const policies = (state.policies ?? []) as readonly Policy[];
  const allowlist = new Set<string>();
  for (const p of policies) {
    for (const f of p.sourceFiles ?? []) allowlist.add(f);
  }
  for (const f of allowlist) {
    const filePath = resolve(REPO_ROOT, "archive", "owner-inbox", f);
    if (existsSync(filePath)) {
      sampleFilename = f;
      sampleDiskBody = readFileSync(filePath, "utf8");
      break;
    }
  }
  if (!sampleFilename || sampleDiskBody === undefined) {
    throw new Error("expected at least one policy sourceFile to exist on disk");
  }

  // For the allow-list-integrity case: an `Owner Inbox/*.md` filename
  // that exists on disk but is *not* cited by any policy in the
  // register. We pick a real Owner-Inbox file the policy register does
  // not name, falling back to a synthesised basename if none qualifies
  // (extremely unlikely given the inbox size).
  const ownerInboxDir = resolve(REPO_ROOT, "archive", "owner-inbox");
  if (existsSync(ownerInboxDir)) {
    const entries = readdirSync(ownerInboxDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
      .map((e) => e.name);
    unlistedDiskFilename = entries.find((n) => !allowlist.has(n));
  }
  if (!unlistedDiskFilename) {
    unlistedDiskFilename = "0000-anya-test-not-in-policy-register.md";
  }
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

describe("dashboard server — GET /api/policy/:filename", () => {
  it("returns 200 and the markdown body for a filename in the live register's sourceFiles union", async () => {
    if (!sampleFilename || sampleDiskBody === undefined) {
      throw new Error("no sample fixture");
    }
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/policy/${encodeURIComponent(sampleFilename)}`,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/markdown");
    const body = await r.text();
    expect(body.length).toBeGreaterThan(0);
    expect(body).toBe(sampleDiskBody);
  });

  it("rejects path-traversal filenames with 400", async () => {
    // Use raw fetch URL — encodeURIComponent would mask the traversal.
    const r = await fetch(`http://127.0.0.1:${serverPort}/api/policy/..%2Fpackage.json`);
    expect([400, 404]).toContain(r.status);
    expect(r.headers.get("content-type")).toContain("application/json");
  });

  it("rejects non-.md filenames with 400", async () => {
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/policy/${encodeURIComponent("something.txt")}`,
    );
    expect(r.status).toBe(400);
  });

  it("rejects unknown filenames with 404", async () => {
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/policy/${encodeURIComponent("0000-00-00_no-such-file.md")}`,
    );
    expect(r.status).toBe(404);
  });

  it("rejects filenames present on disk under Owner Inbox/ but not cited by the policy register with 404", async () => {
    if (!unlistedDiskFilename) throw new Error("no unlistedDiskFilename");
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/policy/${encodeURIComponent(unlistedDiskFilename)}`,
    );
    // The basename does not appear in any policy's sourceFiles[];
    // allow-list rejects before we touch disk, so this is a clean 404.
    expect(r.status).toBe(404);
  });
});
