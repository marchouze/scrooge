// tests/markets-fx-npa.test.ts
//
// Slice 7 — NPA attestation badge projection tests, re-pointed onto the
// umbrella OTC vanilla FX product (D-FX-OTC-NPA-SCOPE-EXPANSION).
//
// Scope (8 cases):
//   1. Empty store → all 4 variants pending
//   2. Umbrella approved (scope spot/forward/swap) → those approved; option pending+outOfScope
//   3. Umbrella withheld → in-scope variants withheld with reason
//   4. Umbrella approved after withheld (latest wins) → approved
//   5. Umbrella approval with no typed scope → falls back to spot/forward/swap approved
//   6. Always returns exactly 4 attestation rows (one per variant)
//   7. approvedAt populated from event as_of on approved variants
//   8. GET /api/markets/fx/products/attestation returns 200 with correct shape
//
// Authority: D-FX-OTC-NPA-SCOPE-EXPANSION (CEO session-delegation 2026-06-10);
//            D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10) Slice 7;
//            D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2.
//
// Author: Scrooge-coordinated session for marc@tgv.co.za · Saskia (Head of
//         Global Markets, governance).

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Subprocess, spawn } from "bun";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  FX_PRODUCT_CODES,
  UMBRELLA_FX_PRODUCT_ID,
  buildNpaView,
} from "../dashboard/markets-fx-npa";
import {
  type ProductScopeForEvent,
  makeProductApproved,
  makeProductWithheld,
} from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";

// ---------------------------------------------------------------------------
// Shared test scaffolding
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const NPA_ACTOR: Actor = { type: "service", id: "agent:helena:npa-committee" };
const CITATIONS = ["D-FX-SALES-TRADING-FRONTEND", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"];

const T1 = "2026-05-10T08:00:00.000Z";
const T2 = "2026-05-10T10:00:00.000Z"; // later than T1
const T_NOW = "2026-05-18T12:00:00.000Z";

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "fx-npa-test-"));
});

afterAll(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function freshStore(): EventStore {
  const path = join(tmpDir, `event-${Math.random().toString(36).slice(2)}.db`);
  return new EventStore(path);
}

const V1_SCOPE: ProductScopeForEvent = {
  executionVenue: "otc",
  fxInstrumentVariants: ["spot", "forward", "swap"],
  currencyPairs: "any",
  counterpartyEligibility: "all",
};

function approveUmbrella(
  store: EventStore,
  asOf: string,
  scope: ProductScopeForEvent | undefined = V1_SCOPE,
): void {
  store.append(
    makeProductApproved({
      asOf,
      entity: ENTITY,
      actor: NPA_ACTOR,
      citations: CITATIONS,
      payload: {
        productId: UMBRELLA_FX_PRODUCT_ID,
        version: "v1",
        conditions: [],
        approvedBy: "helena:npa-committee",
        ...(scope ? { scope } : {}),
      },
    }),
  );
}

function withholdUmbrella(
  store: EventStore,
  asOf: string,
  reason = "pending further review",
): void {
  store.append(
    makeProductWithheld({
      asOf,
      entity: ENTITY,
      actor: NPA_ACTOR,
      citations: CITATIONS,
      payload: {
        productId: UMBRELLA_FX_PRODUCT_ID,
        version: "v1",
        reason,
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("FX Slice 7 — NPA attestation projection (buildNpaView, umbrella-driven)", () => {
  it("1. Empty store → all 4 variants pending", () => {
    const store = freshStore();
    const view = buildNpaView(store, T_NOW);
    expect(view.attestations).toHaveLength(4);
    for (const att of view.attestations) {
      expect(att.status).toBe("pending");
    }
    store.close();
  });

  it("2. Umbrella approved (scope spot/forward/swap) → those approved; option pending+outOfScope", () => {
    const store = freshStore();
    approveUmbrella(store, T1);
    const view = buildNpaView(store, T_NOW);
    for (const code of ["FX-spot", "FX-forward", "FX-swap"]) {
      expect(view.attestations.find((a) => a.productCode === code)?.status).toBe("approved");
    }
    const option = view.attestations.find((a) => a.productCode === "FX-option");
    expect(option?.status).toBe("pending");
    expect(option?.outOfScope).toBe(true);
    store.close();
  });

  it("3. Umbrella withheld → in-scope variants withheld with reason", () => {
    const store = freshStore();
    withholdUmbrella(store, T1, "insufficient risk controls");
    const view = buildNpaView(store, T_NOW);
    const fwd = view.attestations.find((a) => a.productCode === "FX-forward");
    expect(fwd?.status).toBe("withheld");
    expect(fwd?.withheldReason).toBe("insufficient risk controls");
    // option is out of scope → pending, not withheld.
    expect(view.attestations.find((a) => a.productCode === "FX-option")?.status).toBe("pending");
    store.close();
  });

  it("4. Umbrella approved after withheld (latest wins) → approved", () => {
    const store = freshStore();
    withholdUmbrella(store, T1);
    approveUmbrella(store, T2); // T2 > T1 so approved wins
    const view = buildNpaView(store, T_NOW);
    expect(view.attestations.find((a) => a.productCode === "FX-swap")?.status).toBe("approved");
    store.close();
  });

  it("5. Umbrella approval with no typed scope → falls back to spot/forward/swap approved", () => {
    const store = freshStore();
    approveUmbrella(store, T1, undefined); // no scope on the event
    const view = buildNpaView(store, T_NOW);
    expect(view.attestations.find((a) => a.productCode === "FX-spot")?.status).toBe("approved");
    expect(view.attestations.find((a) => a.productCode === "FX-swap")?.status).toBe("approved");
    expect(view.attestations.find((a) => a.productCode === "FX-option")?.status).toBe("pending");
    store.close();
  });

  it("6. Always returns exactly 4 attestation rows", () => {
    const store = freshStore();
    approveUmbrella(store, T1);
    const view = buildNpaView(store, T_NOW);
    expect(view.attestations).toHaveLength(4);
    const codes = view.attestations.map((a) => a.productCode);
    for (const code of FX_PRODUCT_CODES) {
      expect(codes).toContain(code);
    }
    store.close();
  });

  it("7. approvedAt populated from event as_of on approved variants", () => {
    const store = freshStore();
    approveUmbrella(store, T2);
    const view = buildNpaView(store, T_NOW);
    const spot = view.attestations.find((a) => a.productCode === "FX-spot");
    expect(spot?.status).toBe("approved");
    expect(spot?.approvedAt).toBe(T2);
    // approvedAt absent on the out-of-scope (pending) option row.
    const option = view.attestations.find((a) => a.productCode === "FX-option");
    expect(option?.approvedAt).toBeUndefined();
    store.close();
  });
});

// ---------------------------------------------------------------------------
// Server smoke test
// ---------------------------------------------------------------------------

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

async function bootServer(): Promise<BootedServer> {
  const serverTmpDir = mkdtempSync(join(tmpdir(), "bank-npa-server-test-"));
  const runtimeStatePath = join(serverTmpDir, "runtime-dashboard-state.json");
  const eventDbPath = join(serverTmpDir, "event.db");
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
      BANK_DOCUMENT_STORE_PATH: join(serverTmpDir, "docstore"),
      BANK_DASHBOARD_REFRESH_MS: "0",
      LOG_LEVEL: "warn",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  await waitForServer(port);
  return { process: proc, port, tmpDir: serverTmpDir };
}

describe("FX Slice 7 — GET /api/markets/fx/products/attestation (server smoke)", () => {
  let booted: BootedServer | null = null;

  beforeAll(async () => {
    booted = await bootServer();
  });

  afterAll(() => {
    booted?.process.kill();
    if (booted?.tmpDir && existsSync(booted.tmpDir)) {
      rmSync(booted.tmpDir, { recursive: true, force: true });
    }
  });

  it("8. returns 200 with correct shape (attestations array, 4 rows, asOf)", async () => {
    if (!booted) throw new Error("server not booted");
    const res = await fetch(`http://127.0.0.1:${booted.port}/api/markets/fx/products/attestation`, {
      headers: { Accept: "application/json" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    // Shape checks.
    expect(body).toHaveProperty("attestations");
    expect(body).toHaveProperty("asOf");
    expect(Array.isArray(body.attestations)).toBe(true);
    const attestations = body.attestations as Array<{ productCode: string; status: string }>;
    expect(attestations).toHaveLength(4);
    // Fresh empty store → all pending.
    for (const att of attestations) {
      expect(att).toHaveProperty("productCode");
      expect(att).toHaveProperty("status");
      expect(att.status).toBe("pending");
    }
  });
});
