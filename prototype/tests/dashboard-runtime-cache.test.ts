// tests/dashboard-runtime-cache.test.ts
//
// Integration test for D-EVENT-STORE-SCALING Slice 3a: the dashboard
// server must write its derived state to the runtime cache path
// (`BANK_DASHBOARD_RUNTIME_STATE`), never to the committed seed path
// (`BANK_DASHBOARD_STATE` → `seeds/dashboard-state.json`).
//
// Boots the server as a subprocess on a free port with both env vars
// pointed at tmp files, hits `POST /api/decide` against an open
// decision lifted from the test seed, and asserts:
//
//   (a) the runtime path is written and reflects the resolved decision;
//   (b) the seed at `seeds/dashboard-state.json` is unchanged
//       (compared by mtime + content hash to a snapshot taken before
//       the boot);
//   (c) the in-memory `cachedState` (served by GET /api/state) reflects
//       the decision.
//
// Author: Atlas (Core banking platform architect, engineering)

import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Subprocess, spawn } from "bun";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import type { DashboardState, OpenDecision } from "../dashboard/types";

const PROTOTYPE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(PROTOTYPE_ROOT, "..");
const SEED_PATH = resolve(PROTOTYPE_ROOT, "seeds", "dashboard-state.json");
const SERVER_ENTRY = resolve(PROTOTYPE_ROOT, "dashboard", "server.ts");

let tmpDir: string;
let runtimeStatePath: string;
let eventDbPath: string;
let seedSnapshotPath: string;
let serverProcess: Subprocess | undefined;
let serverPort: number;
let testDecisionId: string | undefined;

async function findFreePort(): Promise<number> {
  // Bun.serve accepts port:0 to pick a free one; we test by binding
  // briefly then closing.
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
        // Drain the body so the connection releases cleanly.
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
  tmpDir = mkdtempSync(join(tmpdir(), "bank-dashboard-runtime-cache-"));
  runtimeStatePath = join(tmpDir, "runtime-dashboard-state.json");
  eventDbPath = join(tmpDir, "event.db");
  seedSnapshotPath = join(tmpDir, "seed-snapshot.json");

  // Snapshot the committed seed before boot. After the test we compare
  // bytes to assert the server did not write to it.
  copyFileSync(SEED_PATH, seedSnapshotPath);

  serverPort = await findFreePort();

  serverProcess = spawn({
    cmd: ["bun", "run", SERVER_ENTRY],
    cwd: PROTOTYPE_ROOT,
    env: {
      ...process.env,
      BANK_DASHBOARD_PORT: String(serverPort),
      BANK_DASHBOARD_RUNTIME_STATE: runtimeStatePath,
      BANK_DASHBOARD_STATE: SEED_PATH,
      BANK_EVENT_DB: eventDbPath,
      BANK_REPO_ROOT: REPO_ROOT,
      // Quiet pino chatter; turn the polling refresh off so the only
      // writes we observe are bootDerive + the explicit POST refresh.
      BANK_DASHBOARD_REFRESH_MS: "0",
      LOG_LEVEL: "warn",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  await waitForServer(serverPort);

  // Pull an open decision id from the live state so the test is robust
  // to seed-content evolution.
  const r = await fetch(`http://127.0.0.1:${serverPort}/api/state`);
  const live = (await r.json()) as DashboardState;
  const candidate = live.decisionsOpen.find((d: OpenDecision) => Boolean(d.id));
  if (!candidate) {
    throw new Error("no open decisions available in live seed; cannot run /api/decide test");
  }
  testDecisionId = candidate.id;
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

describe("dashboard server — runtime-cache split (D-EVENT-STORE-SCALING Slice 3a)", () => {
  it("writes the runtime path on bootDerive and never touches the seed", async () => {
    expect(existsSync(runtimeStatePath)).toBe(true);
    const runtime = JSON.parse(readFileSync(runtimeStatePath, "utf8")) as DashboardState;
    expect(runtime.bank).toBeDefined();
    expect(runtime.decisionsOpen).toBeDefined();

    // Compare seed bytes to the pre-boot snapshot.
    const seedNow = readFileSync(SEED_PATH);
    const seedBefore = readFileSync(seedSnapshotPath);
    expect(Buffer.compare(seedNow, seedBefore)).toBe(0);
  });

  it("reflects a recorded CeoDecision in runtime cache + in-memory state without touching the seed", async () => {
    if (!testDecisionId) throw new Error("no testDecisionId");
    const seedMtimeBefore = statSync(SEED_PATH).mtimeMs;

    const r = await fetch(`http://127.0.0.1:${serverPort}/api/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionId: testDecisionId,
        action: "approve",
        outcome: "test outcome — runtime-cache split integration",
      }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { ok: boolean; eventId: string };
    expect(body.ok).toBe(true);
    expect(body.eventId).toMatch(/^[A-Za-z0-9_-]+/);

    // (a) runtime path was written (mtime moved or contents reflect resolution).
    const runtime = JSON.parse(readFileSync(runtimeStatePath, "utf8")) as DashboardState;
    const resolved = runtime.decisionsResolved.find((d) => d.id === testDecisionId);
    expect(resolved).toBeDefined();

    // (c) in-memory state served by GET /api/state reflects the same.
    const state = (await (
      await fetch(`http://127.0.0.1:${serverPort}/api/state`)
    ).json()) as DashboardState;
    const cached = state.decisionsResolved.find((d) => d.id === testDecisionId);
    expect(cached).toBeDefined();
    expect(state.decisionsOpen.find((d) => d.id === testDecisionId)).toBeUndefined();

    // (b) seed file is unchanged — neither in mtime nor in bytes.
    const seedMtimeAfter = statSync(SEED_PATH).mtimeMs;
    expect(seedMtimeAfter).toBe(seedMtimeBefore);
    const seedNow = readFileSync(SEED_PATH);
    const seedBefore = readFileSync(seedSnapshotPath);
    expect(Buffer.compare(seedNow, seedBefore)).toBe(0);
  });

  it("honours a recovery overwrite to the seed path (ensures snapshot path is not accidentally written)", () => {
    // Defensive: write a sentinel into the snapshot path and confirm it
    // is not the same inode as the seed. (Catches a bug where mkdtemp
    // failed and we accidentally wrote into the repo.)
    writeFileSync(seedSnapshotPath, "sentinel\n", "utf8");
    const seedNow = readFileSync(SEED_PATH, "utf8");
    expect(seedNow.startsWith("sentinel")).toBe(false);
  });
});
