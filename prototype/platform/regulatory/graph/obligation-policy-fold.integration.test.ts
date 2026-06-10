// platform/regulatory/graph/obligation-policy-fold.integration.test.ts
//
// Integration tests for the Obligation → Policy IMPLEMENTED_BY fold inside
// the REAL seed projection (WS-OBLIGATION-POLICY-MAPPING).
//
// Guards the #1142 defect class (edge fold running BEFORE the node imports it
// resolves against — the original SA↔BCBS Step-6b fold silently produced zero
// edges): the fold here runs after the register obligations (Step 6), the
// policy nodes (Step 9), and every artefact import, with a DB node-existence
// guard per pair. The tests run the actual `runSeed()` against hermetic tmp
// stores and assert:
//   1. a known stable pair materialises (AML/CFT Policy frontmatter declares
//      ORG-FC-07 — the edge OBL-ORG-FC-07 → POL-aml-cft-policy exists with
//      frontmatter provenance);
//   2. idempotency — a second full reseed yields the IDENTICAL IMPLEMENTED_BY
//      edge count (truncate-and-rebuild, no duplicate accretion);
//   3. coverage consistency — totalAdopted = covered + gaps on the seeded
//      graph, and the covered pair is absent from the gap list;
//   4. coverage golden case — on a synthetic minimal graph (one covered, one
//      uncovered obligation) the gap query returns exactly the uncovered one.
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP (named next step).
// Author: Mira (Compliance / RegTech engineer, engineering)

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Bind BOTH the event store and the graph DB to hermetic tmp paths BEFORE
// importing the db-backed modules — the lazy singletons read these env vars
// at module init. (Same pattern as obligation-equivalence-fold.integration.test.ts.)
const tmpDir = mkdtempSync(join(tmpdir(), "obl-pol-fold-"));
process.env.BANK_EVENT_DB = join(tmpDir, "event.db");
process.env.BANK_GRAPH_DB = join(tmpDir, "graph.db");

const { getDb, truncateGraphTables, upsertEdge, upsertNode } = await import("./db");
const { runSeed } = await import("./seed-projection");
const { findObligationPolicyCoverageGaps, getObligationPolicyCoverage } = await import("./query");

// AML/CFT Policy v1 declares `obligations: [ORG-FC-07, ORG-FC-SANCTIONS-SCREENING]`
// in its frontmatter — a stable, explicitly-authored citation.
const COVERED_OBLIGATION = "ORG-FC-07";
const IMPLEMENTING_POLICY = "POL-aml-cft-policy";

describe("IMPLEMENTED_BY fold runs against the real seed (post-import ordering)", () => {
  test("policy-frontmatter citation materialises as an Obligation → Policy edge", async () => {
    const stats = await runSeed();

    // The fold ran and derived a non-trivial edge set, all derived (zero
    // hand-authored pairs — pure Plane-A derivation).
    expect(stats.obligationPolicyEdges).toBeTruthy();
    expect(stats.obligationPolicyEdges?.derived ?? 0).toBeGreaterThan(0);
    expect(stats.obligationPolicyEdges?.handAuthored).toBe(0);
    expect(stats.edgesByType.IMPLEMENTED_BY).toBe(stats.obligationPolicyEdges?.derived ?? -1);

    const db = getDb();
    const edge = db
      .prepare(
        `SELECT edge_type, extraction_method, metadata FROM graph_edges
         WHERE from_id = ? AND to_id = ? AND edge_type = 'IMPLEMENTED_BY'`,
      )
      .get(`OBL-${COVERED_OBLIGATION}`, IMPLEMENTING_POLICY) as
      | { edge_type: string; extraction_method: string; metadata: string | null }
      | undefined;
    expect(edge).toBeTruthy();
    expect(edge?.extraction_method).toBe("frontmatter");
    const meta = edge?.metadata ? (JSON.parse(edge.metadata) as Record<string, unknown>) : {};
    expect(meta.source).toBe("policy-frontmatter-obligations");
  }, 60_000);

  test("the fold is idempotent — a second full reseed yields the identical edge count", async () => {
    const db = getDb();
    const countImplementedBy = () =>
      (
        db
          .prepare("SELECT COUNT(*) AS c FROM graph_edges WHERE edge_type = 'IMPLEMENTED_BY'")
          .get() as { c: number }
      ).c;

    const first = countImplementedBy();
    expect(first).toBeGreaterThan(0);

    await runSeed(); // second full truncate-and-rebuild
    const second = countImplementedBy();
    expect(second).toBe(first);
  }, 60_000);

  test("coverage is internally consistent and excludes the covered pair from the gaps", () => {
    const coverage = getObligationPolicyCoverage();
    expect(coverage.totalAdopted).toBeGreaterThan(0);
    expect(coverage.covered + coverage.gaps.length).toBe(coverage.totalAdopted);

    const gapIds = coverage.gaps.map((g) => g.id);
    expect(gapIds).not.toContain(`OBL-${COVERED_OBLIGATION}`);
    // Gaps are adopted-plane nodes only (never BCBS knowledge-base nodes).
    for (const id of gapIds) {
      expect(id.startsWith("OBL-ORG-")).toBe(true);
    }
  });
});

describe("coverage golden case (synthetic minimal graph)", () => {
  // Runs LAST in this file — truncates the shared tmp graph DB.
  test("an adopted obligation without an IMPLEMENTED_BY policy is the exact gap set", () => {
    truncateGraphTables();
    const now = "2026-06-10T00:00:00Z";

    upsertNode({
      id: "OBL-ORG-TEST-COVERED",
      nodeType: "Obligation",
      label: "covered test obligation",
      metadata: { obligationId: "ORG-TEST-COVERED" },
    });
    upsertNode({
      id: "OBL-ORG-TEST-UNCOVERED",
      nodeType: "Obligation",
      label: "uncovered test obligation",
      metadata: { obligationId: "ORG-TEST-UNCOVERED" },
    });
    // A BCBS knowledge-base obligation must NOT enter the adopted-coverage scope.
    upsertNode({
      id: "OBL-BCBS-TEST-s1.1",
      nodeType: "Obligation",
      label: "knowledge-base obligation (out of scope)",
      metadata: {},
    });
    upsertNode({
      id: "POL-test-policy",
      nodeType: "Policy",
      label: "Test Policy v1",
      metadata: { policyId: "test-policy" },
    });
    upsertEdge({
      id: "IMPLEMENTED_BY-golden-1",
      fromId: "OBL-ORG-TEST-COVERED",
      toId: "POL-test-policy",
      edgeType: "IMPLEMENTED_BY",
      extractionMethod: "frontmatter",
      confidenceScore: 0.95,
      extractedAt: now,
      metadata: { source: "policy-frontmatter-obligations" },
    });

    const gaps = findObligationPolicyCoverageGaps();
    expect(gaps.map((g) => g.id)).toEqual(["OBL-ORG-TEST-UNCOVERED"]);

    const coverage = getObligationPolicyCoverage();
    expect(coverage.totalAdopted).toBe(2);
    expect(coverage.covered).toBe(1);
    expect(coverage.gaps).toHaveLength(1);
  });

  test("an IMPLEMENTED_BY edge to a non-Policy node does not count as coverage", () => {
    // Defensive: the gap query requires the edge target to BE a Policy node.
    upsertNode({
      id: "DOC-NOT-A-POLICY",
      nodeType: "Document",
      label: "not a policy",
      metadata: {},
    });
    upsertEdge({
      id: "IMPLEMENTED_BY-golden-2",
      fromId: "OBL-ORG-TEST-UNCOVERED",
      toId: "DOC-NOT-A-POLICY",
      edgeType: "IMPLEMENTED_BY",
      extractionMethod: "frontmatter",
      confidenceScore: 0.95,
      extractedAt: "2026-06-10T00:00:00Z",
      metadata: {},
    });
    const gaps = findObligationPolicyCoverageGaps();
    expect(gaps.map((g) => g.id)).toEqual(["OBL-ORG-TEST-UNCOVERED"]);
    expect(getDb()).toBeTruthy();
  });
});
