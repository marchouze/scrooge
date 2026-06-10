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

import type { ObligationEquivalenceVerdict } from "../../event-store/event-types/obligation-equivalence";

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

// A verdict can point at a BCBS paragraph the rule-based obligation-graph
// extraction omitted (non-normative prose). Without a node-coverage backfill the
// fold's existence-guard silently skips that verdict — verdicts > edges. This
// guards that regression: a verdict whose BCBS endpoint is NOT in the pre-built
// graphs must still materialise, with the endpoint node created at seed time
// from chapter-text.json and anchored to its urn:reg:bcbs citation.
describe("BCBS equivalence-endpoint coverage backfill (gap-driven, idempotent)", () => {
  // MAR20 20.1 is descriptive prose — absent from the pre-built MAR obligation
  // graph — and is the materially-divergent (CONFLICTS_WITH) verdict's endpoint.
  const SA = "ORG-PR-19";
  const BCBS = "BCBS-MAR-s20.1";

  test("a verdict whose BCBS endpoint is missing from the pre-built graphs still projects", async () => {
    eventStore.append(
      makeObligationEquivalenceClassified({
        asOf: "2026-06-09T00:00:00Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:Atlas" },
        citations: ["D-OBLIGATIONS-REGISTER-CLEANUP", SA],
        payload: {
          saObligationId: SA,
          bcbsObligationId: BCBS,
          verdict: "materially-divergent",
          delta:
            "Basel MAR20 frames market-risk RWA via the standardised approach × 12.5; the SA market-risk return diverges materially in scope/measurement.",
          rationale: "Materially-divergent measurement basis — modelled as CONFLICTS_WITH.",
          classifiedBy: "Atlas (Core banking platform architect, engineering)",
          confidence: 0.9,
          asOf: "2026-06-09T00:00:00Z",
        },
      }),
    );

    const stats = await runSeed();
    const db = getDb();

    // The endpoint node did NOT exist before the backfill — it is created at seed
    // time and surfaced in the seed stats (gap-driven, not hardcoded).
    expect(stats.equivalenceBackfill?.created ?? []).toContain(BCBS);
    // Its text WAS present in chapter-text.json (not an anchor-only node).
    expect(stats.equivalenceBackfill?.missingText ?? []).not.toContain(BCBS);

    // The created node mirrors the native OBL-BCBS-* obligation-node shape.
    const node = db
      .prepare("SELECT node_type, label, metadata FROM graph_nodes WHERE id = ?")
      .get(`OBL-${BCBS}`) as
      | { node_type: string; label: string; metadata: string | null }
      | undefined;
    expect(node).toBeTruthy();
    expect(node?.node_type).toBe("Obligation");
    const nodeMeta = node?.metadata ? (JSON.parse(node.metadata) as Record<string, unknown>) : {};
    expect(nodeMeta.sourceProvision).toBe("urn:reg:bcbs:mar:20.1");
    expect(nodeMeta.chapter).toBe("MAR20");
    expect(nodeMeta.paragraph).toBe("20.1");
    expect(nodeMeta.standard).toBe("MAR");

    // The materially-divergent verdict now projects to a CONFLICTS_WITH edge.
    const edge = db
      .prepare("SELECT edge_type FROM graph_edges WHERE from_id = ? AND to_id = ?")
      .get(`OBL-${SA}`, `OBL-${BCBS}`) as { edge_type: string } | undefined;
    expect(edge?.edge_type).toBe("CONFLICTS_WITH");
  }, 30_000);

  test("the verdict corpus materialises 1:1 — every verdict projects, none skipped for a missing node", async () => {
    // Seed a corpus spanning ALL 6 previously-missing BCBS endpoints (RBC30.2,
    // CRE20.32, MAR20.1, MAR33.1, LCR30.43, NSF30.1) plus endpoints already in
    // the pre-built graphs, then assert edges == distinct verdict pairs. The
    // node-coverage regression drops any verdict whose endpoint node is absent,
    // so the counts would diverge if the backfill regressed.
    const corpus: Array<{ sa: string; bcbs: string; verdict: ObligationEquivalenceVerdict }> = [
      { sa: "ORG-PR-01", bcbs: "BCBS-RBC-s30.2", verdict: "sa-stricter-gold-plates" },
      { sa: "ORG-PR-03", bcbs: "BCBS-RBC-s30.2", verdict: "sa-stricter-gold-plates" },
      { sa: "ORG-PR-RETURNS-007", bcbs: "BCBS-CRE-s20.32", verdict: "equivalent" },
      { sa: "ORG-PR-19", bcbs: "BCBS-MAR-s33.1", verdict: "equivalent" },
      { sa: "ORG-PR-06", bcbs: "BCBS-LCR-s30.43", verdict: "equivalent" },
      { sa: "ORG-PR-36", bcbs: "BCBS-LCR-s30.43", verdict: "equivalent" },
      { sa: "ORG-PR-07", bcbs: "BCBS-NSF-s30.1", verdict: "equivalent" },
      // an endpoint already present in the pre-built graphs (not backfilled)
      { sa: "ORG-PR-40", bcbs: "BCBS-LEX-s10.8", verdict: "equivalent" },
    ];
    for (const c of corpus) {
      eventStore.append(
        makeObligationEquivalenceClassified({
          asOf: "2026-06-09T00:00:00Z",
          entity: "LE-ZA-HOZ-BANK",
          actor: { type: "service", id: "agent:Atlas" },
          citations: ["D-OBLIGATIONS-REGISTER-CLEANUP", c.sa],
          payload: {
            saObligationId: c.sa,
            bcbsObligationId: c.bcbs,
            verdict: c.verdict,
            ...(c.verdict === "equivalent" ? {} : { delta: "stricter SA calibration" }),
            rationale: "corpus coverage assertion",
            classifiedBy: "Atlas (Core banking platform architect, engineering)",
            confidence: 0.9,
            asOf: "2026-06-09T00:00:00Z",
          },
        }),
      );
    }

    await runSeed();
    const db = getDb();

    // Distinct (sa,bcbs) verdict pairs in the store.
    const verdictPairs = new Set<string>();
    for (const event of eventStore.replay({ type: "ObligationEquivalenceClassified" })) {
      const p = event.payload as { saObligationId: string; bcbsObligationId: string };
      verdictPairs.add(`${p.saObligationId}::${p.bcbsObligationId}`);
    }

    // Bridge edges materialised.
    const bridgeEdges = db
      .prepare(
        "SELECT count(*) AS c FROM graph_edges WHERE edge_type IN ('EQUIVALENT_TO','CONFLICTS_WITH')",
      )
      .get() as { c: number };

    // 1:1 — every distinct verdict pair projects to exactly one bridge edge.
    expect(bridgeEdges.c).toBe(verdictPairs.size);
  }, 30_000);
});
