// tests/dashboard-provenance-mode-endpoint.test.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 3 — server endpoint integration test.
//
// Spawns the dashboard server, hits `/api/provenance/mode`, and asserts
// the response shape:
//
//   {
//     asOf: <ISO-8601>,
//     bankPhase: "build" | "licence-day" | "live" | ...,
//     filter: { mode: "production-only" | "simulated-only" | "combined", ... },
//     sliceAuthority: "D-DATA-PROVENANCE-SUBSTRATE-SLICE-3"
//   }
//
// Also asserts the env-derived default flips correctly when BANK_PHASE is
// pinned to `licence-day` — confirming the substrate seam from Slice 2
// (`defaultProvenanceFilter()`) is the single source of truth and the
// endpoint is a thin pass-through.
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime
//   + watermark layer).

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Subprocess, spawn } from "bun";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

const PROTOTYPE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(PROTOTYPE_ROOT, "..");
const SERVER_ENTRY = resolve(PROTOTYPE_ROOT, "dashboard", "server.ts");

interface BootedServer {
  process: Subprocess;
  port: number;
  tmpDir: string;
}

async function findFreePort(): Promise<number> {
  const probe = Bun.serve({ port: 0, fetch: () => new Response("probe") });
  const port = probe.port;
  probe.stop();
  if (typeof port !== "number") throw new Error("probe port not numeric");
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

async function bootServer(envOverrides: Record<string, string>): Promise<BootedServer> {
  const tmpDir = mkdtempSync(join(tmpdir(), "bank-dashboard-prov-mode-"));
  const runtimeStatePath = join(tmpDir, "runtime-dashboard-state.json");
  const eventDbPath = join(tmpDir, "event.db");
  const port = await findFreePort();
  const proc = spawn({
    cmd: ["bun", "run", SERVER_ENTRY],
    cwd: PROTOTYPE_ROOT,
    env: {
      ...process.env,
      BANK_DASHBOARD_PORT: String(port),
      BANK_DASHBOARD_RUNTIME_STATE: runtimeStatePath,
      BANK_EVENT_DB: eventDbPath,
      BANK_REPO_ROOT: REPO_ROOT,
      // Point the RMS document store at the tmp dir so the spawned
      // server doesn't drop blobs under prototype/prototype/data/documents/
      // (gitignore is relative to prototype/, so a leak there would
      // dirty git state).
      BANK_DOCUMENT_STORE_PATH: join(tmpDir, "docstore"),
      BANK_DASHBOARD_REFRESH_MS: "0",
      LOG_LEVEL: "warn",
      ...envOverrides,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  await waitForServer(port);
  return { process: proc, port, tmpDir };
}

async function teardown(b: BootedServer | undefined): Promise<void> {
  if (!b) return;
  if (!b.process.killed) {
    b.process.kill();
    try {
      await b.process.exited;
    } catch {
      /* ignore */
    }
  }
  if (existsSync(b.tmpDir)) rmSync(b.tmpDir, { recursive: true, force: true });
}

// D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12): default is always
// production-only regardless of BANK_PHASE. Updated from simulated-only.
describe("/api/provenance/mode — build phase (default)", () => {
  let booted: BootedServer | undefined;

  beforeAll(async () => {
    booted = await bootServer({ BANK_PHASE: "build" });
  });

  afterAll(async () => {
    await teardown(booted);
  });

  it("returns production-only filter (BANK_PHASE no longer changes default)", async () => {
    if (!booted) throw new Error("server not booted");
    const r = await fetch(`http://127.0.0.1:${booted.port}/api/provenance/mode`);
    expect(r.ok).toBe(true);
    const body = (await r.json()) as {
      asOf: string;
      bankPhase: string;
      filter: { mode: string };
      sliceAuthority: string;
    };
    expect(body.bankPhase).toBe("build");
    expect(body.filter).toBeDefined();
    expect(body.filter.mode).toBe("production-only");
    expect(body.sliceAuthority).toBe("D-DATA-PROVENANCE-SUBSTRATE-SLICE-3");
    expect(typeof body.asOf).toBe("string");
    // ISO-8601-ish — Date constructor must accept it.
    expect(Number.isFinite(Date.parse(body.asOf))).toBe(true);
  });
});

describe("/api/provenance/mode — licence-day", () => {
  let booted: BootedServer | undefined;

  beforeAll(async () => {
    booted = await bootServer({ BANK_PHASE: "licence-day" });
  });

  afterAll(async () => {
    await teardown(booted);
  });

  it("returns production-only when BANK_PHASE is licence-day", async () => {
    if (!booted) throw new Error("server not booted");
    const r = await fetch(`http://127.0.0.1:${booted.port}/api/provenance/mode`);
    expect(r.ok).toBe(true);
    const body = (await r.json()) as {
      bankPhase: string;
      filter: { mode: string };
    };
    expect(body.bankPhase).toBe("licence-day");
    expect(body.filter.mode).toBe("production-only");
  });
});
