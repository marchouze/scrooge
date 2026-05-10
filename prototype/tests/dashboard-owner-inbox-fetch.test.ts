// tests/dashboard-owner-inbox-fetch.test.ts
//
// Integration test for the inline-preview endpoint that backs the home-
// dashboard Owner-Inbox feed-polish work (Anya, 2026-05-10).
//
//   GET /api/owner-inbox/:filename
//
// Asserts:
//   • Happy path — a filename that exists in the live ownerInboxFeed
//     returns 200 + the markdown body.
//   • Path traversal attempt is rejected (400 / 404, never 200).
//   • Non-.md filenames are rejected.
//   • Filenames not in the live feed allow-list are rejected.
//
// Author: Anya (Data / analytics engineer, engineering)

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Subprocess, spawn } from "bun";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import type { DashboardState, OwnerInboxItem } from "../dashboard/types";

const PROTOTYPE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(PROTOTYPE_ROOT, "..");
const SERVER_ENTRY = resolve(PROTOTYPE_ROOT, "dashboard", "server.ts");

let tmpDir: string;
let runtimeStatePath: string;
let eventDbPath: string;
let serverProcess: Subprocess | undefined;
let serverPort: number;
let sampleFilename: string | undefined;

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
  tmpDir = mkdtempSync(join(tmpdir(), "bank-dashboard-oi-fetch-"));
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

  // Pick the first item in the live feed as our sample fixture.
  const r = await fetch(`http://127.0.0.1:${serverPort}/api/state`);
  const state = (await r.json()) as DashboardState;
  const sample = (state.ownerInboxFeed as readonly OwnerInboxItem[])[0];
  if (!sample) {
    throw new Error("expected at least one item in live ownerInboxFeed");
  }
  sampleFilename = sample.filename;
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

describe("dashboard server — GET /api/owner-inbox/:filename", () => {
  it("returns 200 and the markdown body for an item in the live feed", async () => {
    if (!sampleFilename) throw new Error("no sampleFilename");
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/owner-inbox/${encodeURIComponent(sampleFilename)}`,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/markdown");
    const body = await r.text();
    expect(body.length).toBeGreaterThan(0);
  });

  it("rejects path-traversal filenames with 400", async () => {
    // Use raw fetch URL — encodeURIComponent would mask the traversal.
    const r = await fetch(`http://127.0.0.1:${serverPort}/api/owner-inbox/..%2Fpackage.json`);
    expect([400, 404]).toContain(r.status);
    expect(r.headers.get("content-type")).toContain("application/json");
  });

  it("rejects non-.md filenames with 400", async () => {
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/owner-inbox/${encodeURIComponent("something.txt")}`,
    );
    expect(r.status).toBe(400);
  });

  it("rejects filenames not in the current feed with 404", async () => {
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/owner-inbox/${encodeURIComponent("0000-00-00_no-such-file.md")}`,
    );
    expect(r.status).toBe(404);
  });
});
