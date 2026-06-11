// platform/regulatory/graph/query-policy-trace.test.ts
//
// Tests for tracePolicyBackToRegulation (WS-REGULATORY-LIBRARY-V1 Slice 3,
// D-REGULATORY-LIBRARY-V1). Uses an isolated in-memory SQLite graph so the
// test does not depend on a seeded home store.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate the graph DB to a tmp path BEFORE importing the db-backed modules so
// the lazy singleton binds to it (BANK_GRAPH_DB is read at module init).
const tmpGraph = join(mkdtempSync(join(tmpdir(), "policy-trace-")), "graph.db");
process.env.BANK_GRAPH_DB = tmpGraph;

import { getDb, truncateGraphTables, upsertEdge, upsertNode } from "./db";
import { type PolicyRegulationTraceItem, tracePolicyBackToRegulation } from "./query";
import type { GraphNode } from "./types";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let edgeSeq = 0;
function edgeId(type: string): string {
  return `${type}-${++edgeSeq}`;
}

function makePolicy(id: string, label = "Test Policy"): GraphNode {
  return { id: `POL-${id}`, nodeType: "Policy", label, metadata: { policyId: id } };
}

function makeObligation(id: string, sourceProvision?: string): GraphNode {
  return {
    id: `OBL-${id}`,
    nodeType: "Obligation",
    label: `Obligation ${id}`,
    metadata: { obligationId: id, ...(sourceProvision ? { sourceProvision } : {}) },
  };
}

function makeProvision(
  id: string,
  opts: { text?: string; goldenSourceHash?: string; sourcePages?: string } = {},
): GraphNode {
  return {
    id: `PROV-${id}`,
    nodeType: "Provision",
    label: `Provision ${id}`,
    metadata: {
      sectionId: id,
      ...(opts.text ? { text: opts.text } : {}),
      ...(opts.goldenSourceHash ? { goldenSourceHash: opts.goldenSourceHash } : {}),
      ...(opts.sourcePages ? { sourcePages: opts.sourcePages } : {}),
    },
  };
}

function makeDocument(id: string): GraphNode {
  return { id: `DOC-${id}`, nodeType: "Document", label: `Document ${id}`, metadata: {} };
}

function closesEdge(policyId: string, oblId: string) {
  upsertEdge({
    id: edgeId("CLOSES"),
    fromId: `POL-${policyId}`,
    toId: `OBL-${oblId}`,
    edgeType: "CLOSES",
    extractionMethod: "register",
    confidenceScore: 1,
    extractedAt: "2026-01-01",
  });
}

function expressesEdge(provisionFullId: string, oblFullId: string) {
  upsertEdge({
    id: edgeId("EXPRESSES"),
    fromId: provisionFullId,
    toId: oblFullId,
    edgeType: "EXPRESSES",
    extractionMethod: "register",
    confidenceScore: 1,
    extractedAt: "2026-01-01",
  });
}

function containsEdge(docFullId: string, provisionFullId: string) {
  upsertEdge({
    id: edgeId("CONTAINS"),
    fromId: docFullId,
    toId: provisionFullId,
    edgeType: "CONTAINS",
    extractionMethod: "register",
    confidenceScore: 1,
    extractedAt: "2026-01-01",
  });
}

function derivesFromEdge(adoptedOblFullId: string, sourceOblFullId: string) {
  upsertEdge({
    id: edgeId("DERIVES_FROM"),
    fromId: adoptedOblFullId,
    toId: sourceOblFullId,
    edgeType: "DERIVES_FROM",
    extractionMethod: "register",
    confidenceScore: 1,
    extractedAt: "2026-01-01",
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  truncateGraphTables();
  edgeSeq = 0;
});

afterEach(() => {
  // no-op — truncateGraphTables in beforeEach is enough
});

describe("tracePolicyBackToRegulation", () => {
  test("returns empty array when policy node does not exist", () => {
    const result = tracePolicyBackToRegulation("NONEXISTENT-POLICY");
    expect(result).toEqual([]);
  });

  test("returns empty array when policy has no CLOSES edges", () => {
    upsertNode(makePolicy("AML-KYC-001"));
    const result = tracePolicyBackToRegulation("AML-KYC-001");
    expect(result).toEqual([]);
  });

  test("golden path: Policy → Obligation → Provision → Document with verbatimText + goldenSourceHash + sourcePages", () => {
    const policy = makePolicy("AML-KYC-001");
    const obl = makeObligation("ORG-FC-01", "urn:reg:za:fais-act:s23");
    const prov = makeProvision("FAIS-ACT-37-2002-s23", {
      text: "Every authorised financial services provider must maintain adequate records.",
      goldenSourceHash: "blake3:ecd52d04eaf0ad744e6454f8fd47186ac87da83450cdc5ad380e0ad11c4b73c8",
      sourcePages: "14–15",
    });
    const doc = makeDocument("FAIS-ACT-37-2002");

    upsertNode(policy);
    upsertNode(obl);
    upsertNode(prov);
    upsertNode(doc);

    closesEdge("AML-KYC-001", "ORG-FC-01");
    expressesEdge("PROV-FAIS-ACT-37-2002-s23", "OBL-ORG-FC-01");
    containsEdge("DOC-FAIS-ACT-37-2002", "PROV-FAIS-ACT-37-2002-s23");

    const result = tracePolicyBackToRegulation("AML-KYC-001");

    expect(result).toHaveLength(1);
    const item = result[0] as PolicyRegulationTraceItem;
    expect(item.policy.id).toBe("POL-AML-KYC-001");
    expect(item.obligation.id).toBe("OBL-ORG-FC-01");
    expect(item.provision?.id).toBe("PROV-FAIS-ACT-37-2002-s23");
    expect(item.document?.id).toBe("DOC-FAIS-ACT-37-2002");
    expect(item.verbatimText).toBe(
      "Every authorised financial services provider must maintain adequate records.",
    );
    expect(item.goldenSourceHash).toBe(
      "blake3:ecd52d04eaf0ad744e6454f8fd47186ac87da83450cdc5ad380e0ad11c4b73c8",
    );
    expect(item.sourcePages).toBe("14–15");
    expect(item.sourceProvisionUrn).toBe("urn:reg:za:fais-act:s23");
    expect(item.crossPlane).toBeUndefined();
  });

  test("partial trace when obligation has no EXPRESSES edge — provision and document are null", () => {
    const policy = makePolicy("AML-KYC-001");
    const obl = makeObligation("ORG-FC-02");

    upsertNode(policy);
    upsertNode(obl);
    closesEdge("AML-KYC-001", "ORG-FC-02");

    const result = tracePolicyBackToRegulation("AML-KYC-001");

    expect(result).toHaveLength(1);
    const item = result[0] as PolicyRegulationTraceItem;
    expect(item.obligation.id).toBe("OBL-ORG-FC-02");
    expect(item.provision).toBeNull();
    expect(item.document).toBeNull();
    expect(item.verbatimText).toBeNull();
    expect(item.goldenSourceHash).toBeNull();
    expect(item.sourcePages).toBeNull();
  });

  test("multiple obligations for one policy — returns one item per obligation", () => {
    const policy = makePolicy("CONDUCT-001");
    const obl1 = makeObligation("ORG-CD-01");
    const obl2 = makeObligation("ORG-CD-02");

    upsertNode(policy);
    upsertNode(obl1);
    upsertNode(obl2);
    closesEdge("CONDUCT-001", "ORG-CD-01");
    closesEdge("CONDUCT-001", "ORG-CD-02");

    const result = tracePolicyBackToRegulation("CONDUCT-001");
    expect(result).toHaveLength(2);
    const oblIds = result.map((r) => r.obligation.id).sort();
    expect(oblIds).toEqual(["OBL-ORG-CD-01", "OBL-ORG-CD-02"]);
  });

  test("includeCrossPlane: follows DERIVES_FROM to unadopted source obligation + Provision + Document", () => {
    const policy = makePolicy("MARKET-RISK-001");
    const adoptedObl = makeObligation("ORG-PR-05");
    const sourceObl = makeObligation("BCBS-LEV-s20.7");
    const adoptedProv = makeProvision("SA-BANKS-ACT-s60", {
      text: "SA leverage requirement text.",
    });
    const sourceProv = makeProvision("BCBS-LEV-20.7", {
      text: "Banks must maintain a leverage ratio of at least 3%.",
    });
    const sourceDoc = makeDocument("BCBS-LEV");

    upsertNode(policy);
    upsertNode(adoptedObl);
    upsertNode(sourceObl);
    upsertNode(adoptedProv);
    upsertNode(sourceProv);
    upsertNode(sourceDoc);

    closesEdge("MARKET-RISK-001", "ORG-PR-05");
    expressesEdge("PROV-SA-BANKS-ACT-s60", "OBL-ORG-PR-05");
    derivesFromEdge("OBL-ORG-PR-05", "OBL-BCBS-LEV-s20.7");
    expressesEdge("PROV-BCBS-LEV-20.7", "OBL-BCBS-LEV-s20.7");
    containsEdge("DOC-BCBS-LEV", "PROV-BCBS-LEV-20.7");

    const result = tracePolicyBackToRegulation("MARKET-RISK-001", {
      includeCrossPlane: true,
    });

    expect(result).toHaveLength(1);
    const item = result[0] as PolicyRegulationTraceItem;
    expect(item.crossPlane).toBeDefined();
    expect(item.crossPlane?.sourceObligation.id).toBe("OBL-BCBS-LEV-s20.7");
    expect(item.crossPlane?.sourceProvision?.id).toBe("PROV-BCBS-LEV-20.7");
    expect(item.crossPlane?.sourceDocument?.id).toBe("DOC-BCBS-LEV");
  });

  test("includeCrossPlane: false (default) — crossPlane field absent", () => {
    const policy = makePolicy("POLICY-X");
    const obl = makeObligation("ORG-X-01");
    const sourceObl = makeObligation("BCBS-X-01");

    upsertNode(policy);
    upsertNode(obl);
    upsertNode(sourceObl);
    closesEdge("POLICY-X", "ORG-X-01");
    derivesFromEdge("OBL-ORG-X-01", "OBL-BCBS-X-01");

    const result = tracePolicyBackToRegulation("POLICY-X");
    expect(result).toHaveLength(1);
    expect((result[0] as PolicyRegulationTraceItem).crossPlane).toBeUndefined();
  });

  test("goldenSourceHash null when provision has no hash stamped", () => {
    const policy = makePolicy("POL-NO-HASH");
    const obl = makeObligation("ORG-NO-HASH-01");
    const prov = makeProvision("PROV-NO-HASH-s1", {
      text: "Some text without a golden source hash.",
    });
    const doc = makeDocument("DOC-NO-HASH");

    upsertNode(policy);
    upsertNode(obl);
    upsertNode(prov);
    upsertNode(doc);
    closesEdge("POL-NO-HASH", "ORG-NO-HASH-01");
    expressesEdge("PROV-PROV-NO-HASH-s1", "OBL-ORG-NO-HASH-01");
    containsEdge("DOC-DOC-NO-HASH", "PROV-PROV-NO-HASH-s1");

    const result = tracePolicyBackToRegulation("POL-NO-HASH");
    expect(result).toHaveLength(1);
    const noHashItem = result[0] as PolicyRegulationTraceItem;
    expect(noHashItem.verbatimText).toBe("Some text without a golden source hash.");
    expect(noHashItem.goldenSourceHash).toBeNull();
    expect(noHashItem.sourcePages).toBeNull();
  });
});

// Verify the DB singleton actually initialised (smoke test for test isolation)
test("graph db is accessible after isolation setup", () => {
  const db = getDb();
  expect(db).toBeDefined();
});
