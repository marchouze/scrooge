// platform/regulatory/graph/obligation-equivalence-fold.integration.test.ts
//
// Integration test for the SA↔BCBS equivalence FOLD inside the real seed
// projection — the gap the pure-builder unit test (obligation-equivalence.test.ts)
// missed.
//
// That unit test pre-inserts BOTH the SA and the BCBS obligation node into an
// in-memory graph and calls `buildObligationEquivalenceEdge` directly, so it
// never exercises the seed's node-resolution ordering. The defect (the original
// Step 6b) folded the equivalence events BEFORE `importBcbsObligationGraphs(now)`
// created the BCBS nodes — and resolved the BCBS endpoint via the in-memory
// `obligationNodes` map (which never holds BCBS nodes). So every bridge edge was
// silently skipped and ZERO edges materialised, while the unit test stayed green.
//
// This test runs the ACTUAL `runSeed()` against a hermetic event store carrying
// one ObligationEquivalenceClassified verdict (the LEV proof pair) — exercising
// the real post-import ordering: the SA node comes from the obligations register
// markdown, the BCBS counterpart comes from the imported obligation graph, and
// the fold runs after the import and resolves both endpoints via a DB lookup.
// It asserts the EQUIVALENT_TO edge is present in `graph_edges` and that the
// cross-plane trace hop reaches the BCBS counterpart against the reseeded DB.
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP — WS-OBLIGATIONS-CLEANUP P5.
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Bind BOTH the event store and the graph DB to hermetic tmp paths BEFORE
// importing the db-backed modules — the lazy singletons read these env vars at
// module init. (Same pattern as obligation-equivalence.test.ts.)
const tmpDir = mkdtempSync(join(tmpdir(), "p5-fold-"));
process.env.BANK_EVENT_DB = join(tmpDir, "event.db");
process.env.BANK_GRAPH_DB = join(tmpDir, "graph.db");

const { eventStore } = await import("../../composition");
const { makeObligationEquivalenceClassified } = await import(
  "../../event-store/event-types/obligation-equivalence"
);
const { getDb } = await import("./db");
const { runSeed } = await import("./seed-projection");
const { traceObligationChain } = await import("./query");

const SA_ID = "ORG-PR-05";
const BCBS_ID = "BCBS-LEV-s20.7";

describe("SA↔BCBS equivalence fold runs AFTER importBcbsObligationGraphs (real ordering)", () => {
  test("the EQUIVALENT_TO bridge edge materialises in graph_edges after a full reseed", async () => {
    // One verdict event in the hermetic store — the LEV proof pair. The SA node
    // (OBL-ORG-PR-05) is seeded from the obligations register; the BCBS node
    // (OBL-BCBS-LEV-s20.7) is created by importBcbsObligationGraphs. The fold
    // must resolve BOTH from the DB after the import.
    eventStore.append(
      makeObligationEquivalenceClassified({
        asOf: "2026-06-09T00:00:00Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:Atlas" },
        citations: ["D-OBLIGATIONS-REGISTER-CLEANUP", SA_ID],
        payload: {
          saObligationId: SA_ID,
          bcbsObligationId: BCBS_ID,
          verdict: "sa-stricter-gold-plates",
          delta:
            "Basel sets a 3% leverage-ratio floor; SA adopts it via Reg 38 and the RAS operates a stricter green band above it.",
          rationale:
            "Same regulatory outcome (Tier-1 ÷ exposure ≥ floor); the SA/RAS position is stricter — a gold-plate.",
          classifiedBy: "Atlas (Core banking platform architect, engineering)",
          confidence: 0.95,
          asOf: "2026-06-09T00:00:00Z",
        },
      }),
    );

    await runSeed();

    const db = getDb();

    // Both endpoint nodes really exist after the seed (sanity — the fold's guard
    // would otherwise silently skip and the test would prove nothing).
    const saExists = db.prepare("SELECT 1 FROM graph_nodes WHERE id = ?").get(`OBL-${SA_ID}`);
    const bcbsExists = db.prepare("SELECT 1 FROM graph_nodes WHERE id = ?").get(`OBL-${BCBS_ID}`);
    expect(saExists).toBeTruthy();
    expect(bcbsExists).toBeTruthy();

    // THE assertion the unit test could not make: the edge is in graph_edges,
    // produced by the real fold against post-import node ordering.
    const edge = db
      .prepare(
        "SELECT edge_type, source_provision, metadata FROM graph_edges WHERE from_id = ? AND to_id = ?",
      )
      .get(`OBL-${SA_ID}`, `OBL-${BCBS_ID}`) as
      | { edge_type: string; source_provision: string | null; metadata: string | null }
      | undefined;
    expect(edge).toBeTruthy();
    expect(edge?.edge_type).toBe("EQUIVALENT_TO");
    expect(edge?.source_provision).toBe("urn:reg:bcbs:lev:20.7");
    const meta = edge?.metadata ? (JSON.parse(edge.metadata) as Record<string, unknown>) : {};
    expect(meta.verdict).toBe("sa-stricter-gold-plates");
    expect(meta.divergence).toBe("sa-stricter");

    // And the cross-plane trace hop reaches the BCBS counterpart on the reseeded DB.
    const bridged = traceObligationChain(SA_ID, undefined, { includeCrossPlane: true });
    const counterpartIds = bridged?.crossPlaneCounterparts.map((n) => n.id) ?? [];
    expect(counterpartIds).toContain(`OBL-${BCBS_ID}`);
  }, 30_000);
});
