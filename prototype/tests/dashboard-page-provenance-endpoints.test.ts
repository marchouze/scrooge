// tests/dashboard-page-provenance-endpoints.test.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 3.5 — per-endpoint `pageProvenance`
// integration tests.
//
// Each dashboard API endpoint that surfaces data attaches a typed
// `pageProvenance` field so the front-end badge can paint the right
// mode for the page that called it. This test boots the real
// dashboard server (build phase + licence-day variants) and asserts:
//
//   • /api/state         → pageProvenance.mode = "production-only" (always)
//   • /api/obligations   → pageProvenance.mode = "production-only" (constant)
//   • /api/escalations   → pageProvenance.mode = "production-only" (always)
//   • /api/fleet         → pageProvenance.mode = "production-only" (always)
//   • /api/agent-runs    → pageProvenance.mode = "production-only" (constant)
//   • /api/substrate-gaps → pageProvenance.mode = "production-only" (constant)
//   • /api/procedures    → pageProvenance = null (authored markdown, no data)
//   • /api/rms           → pageProvenance.mode = "production-only" (always)
//
// D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12): the default
// provenance mode is now always production-only, regardless of BANK_PHASE.
// All event-derived endpoints therefore resolve to production-only at every
// phase. The BANK_PHASE-driven simulated-only default was removed.
//
// Bug context: Marc 2026-05-10 flagged that the dashboard was painting
// "Simulated data" on every page (including prose / production-data
// pages). Root cause: badge resolved a single page-global mode from
// `/api/provenance/mode` regardless of the data the page surfaced.
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

async function waitForServer(port: number, timeoutMs = 20_000): Promise<void> {
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
  const tmpDir = mkdtempSync(join(tmpdir(), "bank-dashboard-page-prov-"));
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

interface ResponseWithPageProvenance {
  pageProvenance?: { mode?: string } | null;
}

async function getJson(port: number, path: string): Promise<ResponseWithPageProvenance> {
  const r = await fetch(`http://127.0.0.1:${port}${path}`);
  expect(r.ok).toBe(true);
  return (await r.json()) as ResponseWithPageProvenance;
}

describe("pageProvenance — build phase", () => {
  let booted: BootedServer | undefined;

  beforeAll(async () => {
    booted = await bootServer({ BANK_PHASE: "build" });
  });

  afterAll(async () => {
    await teardown(booted);
  });

  it("/api/state attaches pageProvenance.mode='operating-book' (event-derived default, D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/state");
    expect(body.pageProvenance).toBeDefined();
    expect(body.pageProvenance?.mode).toBe("operating-book");
  });

  it("/api/obligations attaches pageProvenance.mode='production-only' (constant)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/obligations");
    expect(body.pageProvenance).toBeDefined();
    expect(body.pageProvenance?.mode).toBe("production-only");
  });

  it("/api/escalations attaches pageProvenance.mode='operating-book' (event-derived default)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/escalations");
    expect(body.pageProvenance).toBeDefined();
    expect(body.pageProvenance?.mode).toBe("operating-book");
  });

  it("/api/fleet attaches pageProvenance.mode='operating-book' (event-derived default)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/fleet");
    expect(body.pageProvenance).toBeDefined();
    expect(body.pageProvenance?.mode).toBe("operating-book");
  });

  it("/api/agent-runs attaches pageProvenance.mode='production-only' (CI runs are real)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/agent-runs");
    expect(body.pageProvenance).toBeDefined();
    expect(body.pageProvenance?.mode).toBe("production-only");
  });

  it("/api/substrate-gaps attaches pageProvenance.mode='production-only' (authored register)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/substrate-gaps");
    expect(body.pageProvenance).toBeDefined();
    expect(body.pageProvenance?.mode).toBe("production-only");
  });

  it("/api/procedures attaches pageProvenance=null (authored prose, no data surface)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/procedures");
    // pageProvenance must be present as a field (explicit declaration)
    // but the value is null → badge suppresses.
    expect(Object.prototype.hasOwnProperty.call(body, "pageProvenance")).toBe(true);
    expect(body.pageProvenance).toBeNull();
  });

  it("/api/rms attaches pageProvenance.mode='operating-book' (event-derived default)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/rms");
    expect(body.pageProvenance).toBeDefined();
    expect(body.pageProvenance?.mode).toBe("operating-book");
  });
});

describe("pageProvenance — licence-day phase flips event-derived endpoints", () => {
  let booted: BootedServer | undefined;

  beforeAll(async () => {
    booted = await bootServer({ BANK_PHASE: "licence-day" });
  });

  afterAll(async () => {
    await teardown(booted);
  });

  it("/api/state stays pageProvenance.mode='operating-book' at licence-day (mode resolves to production-only behaviour at commencement)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/state");
    expect(body.pageProvenance?.mode).toBe("operating-book");
  });

  it("/api/obligations stays production-only (constant, BANK_PHASE-independent)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/obligations");
    expect(body.pageProvenance?.mode).toBe("production-only");
  });

  it("/api/procedures stays null at licence-day (authoring layer, not BANK_PHASE-coupled)", async () => {
    if (!booted) throw new Error("server not booted");
    const body = await getJson(booted.port, "/api/procedures");
    expect(body.pageProvenance).toBeNull();
  });
});
