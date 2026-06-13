// platform/recon/regulatory-golden-source-integrity.test.ts
//
// Golden cases for the dangling-golden-source detector:
//   - blob present in the resolved store → clean;
//   - blob only in the legacy in-repo store → warn (pending migration);
//   - blob nowhere, pre-enforcement → warn (Slice-1 advisory window);
//   - blob nowhere, post-enforcement → FAIL;
//   - zero golden-source nodes (clean CI checkout) → warns-clean;
//   - a freshly-seeded tmp graph DB round-trips goldenSourceHash so the
//     live-graph read path is exercised end-to-end.
//
// Author: Mira (Compliance / RegTech engineer, engineering) +
//         Atlas (Core banking platform architect, engineering).

import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { LocalFsDocumentStore } from "../document-store/local-fs";
import { ENFORCEMENT_DATE, type GoldenSourceNode, run } from "./regulatory-golden-source-integrity";

const ENFORCEMENT = "2026-09-01";
const PRE_ENFORCEMENT_NOW = "2026-06-11T10:00:00.000Z";
const POST_ENFORCEMENT_NOW = "2026-09-02T10:00:00.000Z";

let resolvedRoot: string;
let legacyRoot: string;
let resolvedStore: LocalFsDocumentStore;
let legacyStore: LocalFsDocumentStore;

beforeEach(() => {
  resolvedRoot = mkdtempSync(join(tmpdir(), "golden-recon-resolved-"));
  legacyRoot = mkdtempSync(join(tmpdir(), "golden-recon-legacy-"));
  resolvedStore = new LocalFsDocumentStore({ root: resolvedRoot });
  legacyStore = new LocalFsDocumentStore({ root: legacyRoot });
});

afterEach(() => {
  rmSync(resolvedRoot, { recursive: true, force: true });
  rmSync(legacyRoot, { recursive: true, force: true });
});

function node(id: string, hash: string): GoldenSourceNode {
  return { id, goldenSourceHash: hash };
}

const MISSING_HASH = `blake3:${"ab".repeat(32)}`;

describe("recon:regulatory-golden-source-integrity", () => {
  it("passes when every goldenSourceHash resolves in the resolved store", () => {
    const put = resolvedStore.put(new Uint8Array([1, 2, 3]));
    const r = run({
      nodes: [node("DOC-FAIS-ACT", put.hash)],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
      asOfDate: POST_ENFORCEMENT_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(0);
  });

  it("warns-clean on zero golden-source nodes (clean CI checkout)", () => {
    const r = run({
      nodes: [],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
      asOfDate: POST_ENFORCEMENT_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
  });

  // PIN-TEST (D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION): the clean-CI shape.
  // This gate is a SHARED-STORE assertion — in the pipeline the regulatory
  // graph is unseeded, so the gate sees zero golden-source nodes and MUST
  // return ok:true / asserted:0, EVEN at the real ENFORCEMENT_DATE with the
  // advisory window closed. The empty-node population is the only input that
  // determines the verdict here (deterministic; independent of ambient graph
  // DB state in the shared test process). This pins that "nothing to assert"
  // can never produce a violation — the warn→fail grading only bites once
  // there ARE nodes (the populated shared store, via the scheduled tick),
  // never on the empty pipeline graph. A future change that lets the gate
  // fail with zero nodes — at any date — is caught here.
  it("PIN: zero nodes at the real enforcement boundary → ok:true, asserted 0 (clean-CI shape)", () => {
    const r = run({
      nodes: [],
      resolvedStore,
      legacyStore,
      asOfDate: `${ENFORCEMENT_DATE}T12:00:00.000Z`,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
  });

  it("warns (not fails) when the blob exists only in the legacy in-repo store", () => {
    const put = legacyStore.put(new Uint8Array([9, 9, 9]));
    const r = run({
      nodes: [node("DOC-FAIS-ACT", put.hash)],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
      asOfDate: POST_ENFORCEMENT_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("migrate:document-store-blobs");
  });

  it("warns on a pre-enforcement missing blob (Slice-1 advisory window)", () => {
    const r = run({
      nodes: [node("DOC-FAIS-ACT", MISSING_HASH)],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
      asOfDate: PRE_ENFORCEMENT_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("advisory");
  });

  it("FAILS on a post-enforcement missing blob", () => {
    const r = run({
      nodes: [node("DOC-FAIS-ACT", MISSING_HASH)],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
      asOfDate: POST_ENFORCEMENT_NOW,
    });
    expect(r.ok).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("fail");
    expect(r.violations[0]?.message).toContain("DANGLING GOLDEN SOURCE");
    expect(r.violations[0]?.subject).toContain("DOC-FAIS-ACT");
  });

  it("a freshly-seeded tmp graph DB round-trips goldenSourceHash via the live read path", () => {
    // Seed a fresh graph in a tmp DB using the real DDL, then verify the
    // metadata JSON column carries goldenSourceHash and resolves against a
    // store that holds the bytes — exercising the same read shape the
    // production gate uses (SELECT id, metadata FROM graph_nodes).
    const graphDbPath = join(mkdtempSync(join(tmpdir(), "golden-recon-graph-")), "graph.db");
    const schemaPath = resolve(import.meta.dir, "../regulatory/graph/schema.sql");
    const db = new Database(graphDbPath);
    try {
      db.exec(readFileSync(schemaPath, "utf-8"));
      const put = resolvedStore.put(new Uint8Array([7, 7, 7, 7]));
      db.prepare(
        "INSERT INTO graph_nodes (id, node_type, label, metadata) VALUES (?, ?, ?, ?)",
      ).run(
        "DOC-FAIS-ACT",
        "Document",
        "FAIS Act",
        JSON.stringify({ slug: "fais-act", goldenSourceHash: put.hash }),
      );
      const rows = db
        .prepare("SELECT id, metadata FROM graph_nodes WHERE metadata IS NOT NULL")
        .all() as { id: string; metadata: string }[];
      const seeded: GoldenSourceNode[] = rows
        .map((row) => {
          const meta = JSON.parse(row.metadata) as { goldenSourceHash?: string };
          return meta.goldenSourceHash
            ? { id: row.id, goldenSourceHash: meta.goldenSourceHash }
            : null;
        })
        .filter((n): n is GoldenSourceNode => n !== null);

      const r = run({
        nodes: seeded,
        resolvedStore,
        legacyStore,
        enforcementDate: ENFORCEMENT,
        asOfDate: POST_ENFORCEMENT_NOW,
      });
      expect(r.asserted).toBe(1);
      expect(r.ok).toBe(true);
      expect(r.violations).toHaveLength(0);
    } finally {
      db.close();
      rmSync(graphDbPath, { recursive: true, force: true });
    }
  });

  it("asserts a mixed population with per-event severities (post-enforcement)", () => {
    const clean = resolvedStore.put(new Uint8Array([1]));
    const legacy = legacyStore.put(new Uint8Array([2]));
    const r = run({
      nodes: [
        node("DOC-CLEAN", clean.hash),
        node("DOC-LEGACY", legacy.hash),
        node("DOC-DANGLE", MISSING_HASH),
      ],
      resolvedStore,
      legacyStore,
      enforcementDate: ENFORCEMENT,
      asOfDate: POST_ENFORCEMENT_NOW,
    });
    expect(r.asserted).toBe(3);
    expect(r.ok).toBe(false);
    const bySeverity = r.violations.map((v) => v.severity).sort();
    expect(bySeverity).toEqual(["fail", "warn"]);
  });
});
