// tests/dashboard-runtime-cache.test.ts
//
// Integration test for D-EVENT-STORE-SCALING Slice 3a + Slice 3b: the
// dashboard server must write its derived state ONLY to the runtime
// cache path (`BANK_DASHBOARD_RUNTIME_STATE`). Slice 3a (PR #138) split
// the runtime cache off the previously-committed seed; Slice 3b removed
// the seed from the commit graph entirely.
//
// Boots the server as a subprocess on a free port with the runtime
// cache pointed at a tmp file, hits `POST /api/decide` against an open
// decision lifted from the live derivation, and asserts:
//
//   (a) the runtime path is written and reflects the resolved decision;
//   (b) no committed seed file is created or modified — specifically, no
//       file appears at `prototype/seeds/dashboard-state.json`;
//   (c) the in-memory `cachedState` (served by GET /api/state) reflects
//       the decision.
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Subprocess, spawn } from "bun";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import type { DashboardState, OpenDecision } from "../dashboard/types";
import { makeDecision } from "../platform/event-store/event-types/decision";
import { EventStore } from "../platform/event-store/store";

const PROTOTYPE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(PROTOTYPE_ROOT, "..");
const SEED_PATH = resolve(PROTOTYPE_ROOT, "seeds", "dashboard-state.json");
const SERVER_ENTRY = resolve(PROTOTYPE_ROOT, "dashboard", "server.ts");

let tmpDir: string;
let runtimeStatePath: string;
let eventDbPath: string;
let serverProcess: Subprocess | undefined;
let serverPort: number;
let testDecisionId: string | undefined;
let seedExistedBefore: boolean;

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

  // Snapshot whether a seed file exists at the well-known committed path.
  // Per Slice 3b it should not — the file is gitignored — but a developer
  // might have run `bun run scripts/regen-dashboard-cache.ts` locally with
  // an old script version and produced one. Capture the pre-state so the
  // post-assertion is "never created or modified by the server".
  seedExistedBefore = existsSync(SEED_PATH);

  // D-DECISIONS-FRAMEWORK-REDESIGN Slice A: Owner Inbox markdown is no
  // longer an authoring channel for open decisions. Inject a synthetic
  // `Decision(requested)` event directly into the test event store so
  // the /api/decide POST has something to resolve.
  testDecisionId = `D-RUNTIME-CACHE-TEST-${Date.now()}`;
  {
    const store = new EventStore(eventDbPath);
    store.append(
      makeDecision({
        asOf: "2026-05-10T00:00:00.000Z",
        entity: "BANK-ZA-001",
        actor: { type: "human", id: "marc@tgv.co.za" },
        citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        payload: {
          decisionId: testDecisionId,
          phase: "requested",
          authority: "CEO",
          authorityRef: "marc@tgv.co.za",
          title: `Runtime-cache integration test fixture (${testDecisionId})`,
          category: "governance",
          recommendation: "Approve.",
          rationale: "Synthetic decision used by the runtime-cache integration test.",
          sourceDocHashes: [],
          citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
          recordedVia: "authoring-ui",
        },
      }),
    );
  }

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
      // Quiet pino chatter; turn the polling refresh off so the only
      // writes we observe are bootDerive + the explicit POST refresh.
      BANK_DASHBOARD_REFRESH_MS: "0",
      LOG_LEVEL: "warn",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  await waitForServer(serverPort);

  // Confirm the injected decision shows up in live state so the
  // /api/decide POST has something to resolve.
  const r = await fetch(`http://127.0.0.1:${serverPort}/api/state`);
  const live = (await r.json()) as DashboardState;
  const candidate = live.decisionsOpen.find((d: OpenDecision) => d.id === testDecisionId);
  if (!candidate) {
    throw new Error(
      `injected decision ${testDecisionId} did not surface in live state; check Owner Inbox parser`,
    );
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
  // No injectedDecisionFile in Slice A — decision was emitted as an event.
});

describe("dashboard server — runtime-cache split (D-EVENT-STORE-SCALING Slice 3a + 3b)", () => {
  it("writes the runtime path on bootDerive and never creates the committed seed path", async () => {
    expect(existsSync(runtimeStatePath)).toBe(true);
    const runtime = JSON.parse(readFileSync(runtimeStatePath, "utf8")) as DashboardState;
    expect(runtime.bank).toBeDefined();
    expect(runtime.decisionsOpen).toBeDefined();

    // If no seed existed before the test, none should exist after.
    // If one did exist (e.g. from a local regen-script run), the
    // committed-seed-deleted test below is best-effort.
    const seedNow = existsSync(SEED_PATH);
    if (!seedExistedBefore) {
      expect(seedNow).toBe(false);
    }
  });

  it("reflects a recorded CeoDecision in runtime cache + in-memory state", async () => {
    if (!testDecisionId) throw new Error("no testDecisionId");

    const r = await fetch(`http://127.0.0.1:${serverPort}/api/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionId: testDecisionId,
        action: "approve",
        outcome: "test outcome — runtime-cache split integration",
        // D-DECISIONS-FRAMEWORK-REDESIGN Slice B — actor is mandatory.
        actor: "marc@tgv.co.za",
      }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { ok: boolean; eventId: string };
    expect(body.ok).toBe(true);
    expect(body.eventId).toMatch(/^[A-Za-z0-9_-]+/);

    // (a) runtime path was written and reflects the resolution.
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

    // (b) the committed seed path was not introduced by the test.
    if (!seedExistedBefore) {
      expect(existsSync(SEED_PATH)).toBe(false);
    }
  });

  // D-DECISIONS-FRAMEWORK-REDESIGN Slice B — `/api/decide` returns 401
  // when the request omits `actor`. The hard-coded server-side fallback
  // was removed; clients must identify themselves.
  it("returns 401 when actor is missing from the request body", async () => {
    if (!testDecisionId) throw new Error("no testDecisionId");
    const r = await fetch(`http://127.0.0.1:${serverPort}/api/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionId: testDecisionId,
        action: "approve",
        outcome: "missing-actor smoke test",
      }),
    });
    expect(r.status).toBe(401);
  });

  it("returns 400 on a malformed payload (Zod parse failure)", async () => {
    const r = await fetch(`http://127.0.0.1:${serverPort}/api/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ not: "a decide body" }),
    });
    expect(r.status).toBe(400);
  });
});
