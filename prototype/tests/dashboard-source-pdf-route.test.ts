// tests/dashboard-source-pdf-route.test.ts
//
// Integration test for the golden-source PDF provenance download route
// (WS-REGULATORY unified-reader Slice 4):
//
//   GET /api/regulation-reader/:slug/source-pdf
//
// The structured tree remains the default/canonical render
// (D-REGULATORY-STRUCTURED-FIRST-CANONICAL); this route is an ADDITIONAL
// provenance affordance that streams the regulator's published source PDF
// from the content-addressed document store, resolved via the slug's
// structured-doc goldenSourceHash (never from the URL).
//
// Asserts (fail-closed throughout — 404, never 500):
//   • hash present + blob resolves → 200 + application/pdf + attachment.
//   • hand-authored source with NO goldenSourceHash → 404.
//   • unknown slug → 404.
//
// The server boots against the REAL repo root (so it derives state and
// discovers the real instrument set normally) with a TEMP document store. A
// throwaway fixture instrument is written into a dedicated `Regulations/`
// subdir for the duration of the test, pointing at a real blob seeded into
// the temp store — so the 200 path streams genuine bytes through the
// production store-resolution code, then it is removed in afterAll.
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Subprocess, spawn } from "bun";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { LocalFsDocumentStore } from "../platform/document-store";

const PROTOTYPE_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(PROTOTYPE_ROOT, "..");
const SERVER_ENTRY = resolve(PROTOTYPE_ROOT, "dashboard", "server.ts");

// Dedicated throwaway regulator dir under the real Regulations tree. Removed
// in afterAll. Discovery scans Regulations/<regulator>/source-docs/*.json.
const FIXTURE_REGULATOR = "ZZ-PROVENANCE-TEST";
const fixtureRegulatorDir = join(REPO_ROOT, "Regulations", FIXTURE_REGULATOR);
const fixtureSourceDocsDir = join(fixtureRegulatorDir, "source-docs");

let tmpDir: string;
let docStoreRoot: string;
let serverProcess: Subprocess | undefined;
let serverPort: number;

function writeStructuredFixture(slug: string, goldenSourceHash?: string): void {
  mkdirSync(fixtureSourceDocsDir, { recursive: true });
  const doc = {
    slug,
    title: `Provenance test instrument ${slug}`,
    shortTitle: slug.toUpperCase(),
    regulator: FIXTURE_REGULATOR,
    year: 2026,
    priority: 999,
    citationPatterns: [],
    ...(goldenSourceHash ? { goldenSourceHash } : {}),
    chapters: [
      {
        id: `${slug}-ch1`,
        number: "1",
        heading: "Chapter 1",
        sections: [
          {
            id: `${slug}-s1`,
            number: "1",
            heading: "Section 1",
            text: "Verbatim section text for the provenance test instrument.",
            verbatim: true,
          },
        ],
      },
    ],
  };
  writeFileSync(join(fixtureSourceDocsDir, `${slug}-structured.json`), JSON.stringify(doc, null, 2));
}

async function findFreePort(): Promise<number> {
  const probe = Bun.serve({ port: 0, fetch: () => new Response("probe") });
  const port = probe.port;
  probe.stop();
  if (typeof port !== "number") throw new Error("probe returned no port");
  return port;
}

async function waitForServer(port: number, timeoutMs = 25_000): Promise<void> {
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
    await Bun.sleep(200);
  }
  throw new Error(`server never ready on ${port}: ${String(lastErr)}`);
}

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "bank-source-pdf-route-"));
  docStoreRoot = join(tmpDir, "documents");

  // Seed a real PDF blob into the temp document store; its hash is genuine.
  const store = new LocalFsDocumentStore({ root: docStoreRoot });
  const pdfBytes = new TextEncoder().encode(
    "%PDF-1.4\n% golden-source provenance fixture\n%%EOF\n",
  );
  const pdfHash = store.put(pdfBytes).hash;
  expect(pdfHash).toMatch(/^blake3:[a-f0-9]{64}$/);

  // One instrument WITH the matching hash, one hand-authored WITHOUT a hash.
  writeStructuredFixture("provtest-hashed", pdfHash);
  writeStructuredFixture("provtest-nohash");

  serverPort = await findFreePort();
  serverProcess = spawn({
    cmd: ["bun", "run", SERVER_ENTRY],
    cwd: PROTOTYPE_ROOT,
    env: {
      ...process.env,
      BANK_DASHBOARD_PORT: String(serverPort),
      BANK_DASHBOARD_RUNTIME_STATE: join(tmpDir, "runtime-dashboard-state.json"),
      BANK_EVENT_DB: join(tmpDir, "event.db"),
      BANK_REPO_ROOT: REPO_ROOT,
      BANK_DOCUMENT_STORE: docStoreRoot,
      BANK_DASHBOARD_REFRESH_MS: "0",
      LOG_LEVEL: "warn",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  await waitForServer(serverPort);
}, 35_000);

afterAll(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    try {
      await serverProcess.exited;
    } catch {
      /* ignore */
    }
  }
  if (existsSync(fixtureRegulatorDir)) rmSync(fixtureRegulatorDir, { recursive: true, force: true });
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

describe("dashboard server — GET /api/regulation-reader/:slug/source-pdf", () => {
  it("streams the golden-source PDF with application/pdf + attachment when the hash resolves", async () => {
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/regulation-reader/provtest-hashed/source-pdf`,
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toContain(
      'attachment; filename="provtest-hashed.pdf"',
    );
    const body = new Uint8Array(await r.arrayBuffer());
    // Real bytes streamed through the production store resolver.
    expect(new TextDecoder().decode(body.slice(0, 8))).toBe("%PDF-1.4");
  });

  it("returns 404 for a hand-authored source with no goldenSourceHash", async () => {
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/regulation-reader/provtest-nohash/source-pdf`,
    );
    expect(r.status).toBe(404);
    expect(r.headers.get("content-type") ?? "").not.toContain("application/pdf");
  });

  it("returns 404 for an unknown slug", async () => {
    const r = await fetch(
      `http://127.0.0.1:${serverPort}/api/regulation-reader/no-such-instrument/source-pdf`,
    );
    expect(r.status).toBe(404);
  });
});
