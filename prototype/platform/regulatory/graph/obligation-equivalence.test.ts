// platform/regulatory/graph/obligation-equivalence.test.ts
//
// Proof fixture — WS-OBLIGATIONS-CLEANUP (P5) SA↔BCBS same-outcome / divergent
// substrate. The known case: the SA leverage-ratio obligation (ORG-PR-05)
// GOLD-PLATES the Basel 3% leverage floor (BCBS-LEV-s20.7). It must classify as
// `sa-stricter-gold-plates` → an EQUIVALENT_TO edge carrying
// divergence='sa-stricter' + a delta, and `traceObligationChain('ORG-PR-05')`
// with the cross-plane hop must reach the BCBS LEV counterpart.
//
// We also assert the substrate end-to-end: the verdict edge type mapping, the
// recon's expected-overlap enumeration off the ADOPTION_EDGES spine, and the
// gate flipping the proof pair from unclassified → classified.
//
// Author: Atlas (Core banking platform architect, engineering).

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate the graph DB to a tmp path BEFORE importing the db-backed modules so
// the lazy singleton binds to it (BANK_GRAPH_DB is read at module init).
const tmpGraph = join(mkdtempSync(join(tmpdir(), "p5-graph-")), "graph.db");
process.env.BANK_GRAPH_DB = tmpGraph;

import { makeObligationEquivalenceClassified } from "../../event-store/event-types/obligation-equivalence";
import type { ObligationEquivalenceClassifiedPayload } from "../../event-store/event-types/obligation-equivalence";
import {
  bcbsObligationIdFromProvision,
  enumerateExpectedOverlaps,
} from "../../recon/obligation-divergence";
import { getDb, truncateGraphTables, upsertEdge, upsertNode } from "./db";
import { traceObligationChain } from "./query";
import { buildObligationEquivalenceEdge, verdictEdgeType } from "./seed-projection";
import type { GraphNode } from "./types";

const SA_ID = "ORG-PR-05";
const BCBS_ID = "BCBS-LEV-s20.7";

const saNode: GraphNode = {
  id: `OBL-${SA_ID}`,
  nodeType: "Obligation",
  label: "Maintain leverage ratio ≥ regulatory minimum",
  metadata: { obligationId: SA_ID, domain: "A" },
};
const bcbsNode: GraphNode = {
  id: `OBL-${BCBS_ID}`,
  nodeType: "Obligation",
  label: "LEV20 20.7 — must",
  metadata: { sourceProvision: "urn:reg:bcbs:lev:20.7", standard: "LEV", paragraph: "20.7" },
};

const goldPlatePayload: ObligationEquivalenceClassifiedPayload = {
  saObligationId: SA_ID,
  bcbsObligationId: BCBS_ID,
  verdict: "sa-stricter-gold-plates",
  delta:
    "Basel sets a 3% leverage-ratio floor; the bank's RAS operates a stricter green band (green ≥ 4.5%) above it (D-RAS / D-BOND-RAS-APPETITE).",
  rationale:
    "Same regulatory outcome (Tier-1 ÷ exposure measure ≥ floor) but the SA/RAS position is stricter than the 3% Basel minimum — a gold-plate.",
  classifiedBy: "Mira (Compliance / RegTech engineer, engineering)",
  confidence: 0.95,
  asOf: "2026-06-09T00:00:00Z",
};

beforeAll(() => {
  // Clean slate, then seed only the two obligation nodes the fixture needs.
  truncateGraphTables();
  upsertNode(saNode);
  upsertNode(bcbsNode);
});

afterAll(() => {
  truncateGraphTables();
});

describe("ObligationEquivalenceClassified — verdict → edge type mapping", () => {
  test("equivalent and gold-plate map to EQUIVALENT_TO; divergent maps to CONFLICTS_WITH", () => {
    expect(verdictEdgeType("equivalent")).toBe("EQUIVALENT_TO");
    expect(verdictEdgeType("sa-stricter-gold-plates")).toBe("EQUIVALENT_TO");
    expect(verdictEdgeType("materially-divergent")).toBe("CONFLICTS_WITH");
  });
});

describe("Proof fixture — SA leverage gold-plates Basel 3% floor", () => {
  test("the classification event is well-formed (delta required for gold-plate)", () => {
    const event = makeObligationEquivalenceClassified({
      asOf: goldPlatePayload.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:Mira" },
      citations: ["D-OBLIGATIONS-REGISTER-CLEANUP", "ORG-PR-05"],
      payload: goldPlatePayload,
    });
    expect(event.type).toBe("ObligationEquivalenceClassified");
    expect((event.payload as ObligationEquivalenceClassifiedPayload).verdict).toBe(
      "sa-stricter-gold-plates",
    );
  });

  test("gold-plate verdict without a delta is rejected by the schema", () => {
    expect(() =>
      makeObligationEquivalenceClassified({
        asOf: goldPlatePayload.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:Mira" },
        citations: ["D-OBLIGATIONS-REGISTER-CLEANUP"],
        payload: { ...goldPlatePayload, delta: undefined },
      }),
    ).toThrow();
  });

  test("the fold projects an EQUIVALENT_TO edge with divergence='sa-stricter' + delta", () => {
    const edge = buildObligationEquivalenceEdge(
      goldPlatePayload,
      saNode,
      bcbsNode,
      "EQUIVALENT_TO-test-1",
      "2026-06-09T00:00:00Z",
    );
    expect(edge.edgeType).toBe("EQUIVALENT_TO");
    expect(edge.fromId).toBe(`OBL-${SA_ID}`);
    expect(edge.toId).toBe(`OBL-${BCBS_ID}`);
    expect(edge.sourceProvision).toBe("urn:reg:bcbs:lev:20.7");
    expect(edge.metadata?.divergence).toBe("sa-stricter");
    expect(edge.metadata?.delta).toBe(goldPlatePayload.delta);
    expect(edge.metadata?.verdict).toBe("sa-stricter-gold-plates");

    // Persist it so the trace hop can follow it.
    upsertEdge(edge);
    const persisted = getDb()
      .prepare("SELECT edge_type FROM graph_edges WHERE from_id = ? AND to_id = ?")
      .get(`OBL-${SA_ID}`, `OBL-${BCBS_ID}`) as { edge_type: string } | null;
    expect(persisted?.edge_type).toBe("EQUIVALENT_TO");
  });

  test("traceObligationChain('ORG-PR-05', includeCrossPlane) reaches the BCBS LEV counterpart", () => {
    // Default behaviour unchanged: no cross-plane counterparts.
    const single = traceObligationChain(SA_ID);
    expect(single).not.toBeNull();
    expect(single?.crossPlaneCounterparts).toEqual([]);

    // Opt-in hop bridges SA → BCBS.
    const bridged = traceObligationChain(SA_ID, undefined, { includeCrossPlane: true });
    expect(bridged).not.toBeNull();
    const counterpartIds = bridged?.crossPlaneCounterparts.map((n) => n.id) ?? [];
    expect(counterpartIds).toContain(`OBL-${BCBS_ID}`);

    // And the bridge is navigable from the BCBS side too.
    const fromBcbs = traceObligationChain(BCBS_ID, undefined, { includeCrossPlane: true });
    const backIds = fromBcbs?.crossPlaneCounterparts.map((n) => n.id) ?? [];
    expect(backIds).toContain(`OBL-${SA_ID}`);
  });
});

describe("recon:obligation-divergence — expected-overlap enumeration off the spine", () => {
  const seed = [
    {
      id: SA_ID,
      citation:
        "BCBS LEV (leverage ratio ≥ 3%) → SA: Regulation 38 of the Regulations relating to Banks.",
    },
    { id: "ORG-AC-01", citation: "IFRS 9" }, // not a Basel-standard overlap
  ];

  test("ORG-PR-05 ↔ BCBS-LEV-s20.7 is in the expected-overlap set", () => {
    const { pairs } = enumerateExpectedOverlaps(seed);
    const found = pairs.find((p) => p.saObligationId === SA_ID && p.bcbsObligationId === BCBS_ID);
    expect(found).toBeDefined();
    expect(found?.standard).toBe("LEV");
  });

  test("the URN → BCBS obligation id derivation matches the graph node id", () => {
    expect(bcbsObligationIdFromProvision("urn:reg:bcbs:lev:20.7")).toBe(BCBS_ID);
  });

  test("the proof pair flips unclassified → classified once an event exists", () => {
    const { pairs } = enumerateExpectedOverlaps(seed);
    const key = `${SA_ID}::${BCBS_ID}`;

    // Before: no classification events loaded → unclassified.
    const classifiedBefore = new Set<string>();
    const unclassifiedBefore = pairs.filter(
      (p) => !classifiedBefore.has(`${p.saObligationId}::${p.bcbsObligationId}`),
    );
    expect(
      unclassifiedBefore.some((p) => `${p.saObligationId}::${p.bcbsObligationId}` === key),
    ).toBe(true);

    // After: the proof event is loaded → classified, gap closed for this pair.
    const classifiedAfter = new Set<string>([key]);
    const unclassifiedAfter = pairs.filter(
      (p) => !classifiedAfter.has(`${p.saObligationId}::${p.bcbsObligationId}`),
    );
    expect(
      unclassifiedAfter.some((p) => `${p.saObligationId}::${p.bcbsObligationId}` === key),
    ).toBe(false);
  });
});
