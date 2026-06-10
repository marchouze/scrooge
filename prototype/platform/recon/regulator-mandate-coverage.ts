// platform/recon/regulator-mandate-coverage.ts
//
// Vera recon: regulator-mandate-coverage (ADVISORY).
//
// The regulatory-intelligence objective layer (D-REGULATORY-INTELLIGENCE-
// OBJECTIVE-LAYER) records, for each regulator, the mandate/objective it
// pursues (PURSUES edges → RegulatoryObjective nodes). This gate asserts that
// every IN-SCOPE Regulator has at least one PURSUES edge to a `level: mandate`
// objective — i.e. the bank has captured WHY that regulator regulates, not just
// the requirements it issues.
//
// IN-SCOPE = a Regulator that issues at least one instrument (Document or
// Framework node) with a `direct` or `transposed` applicabilityStatus (it binds
// the bank, directly or via a transposed standard). The seed wires ISSUED_BY
// from both Document and Framework nodes, so both count.
//
// Mode: ADVISORY (ok:true regardless). The SARB-PA pilot is GREEN; the other
// in-scope regulators (FSCA, FIC, …) carry no objective backfill yet and surface
// as `warn` findings — that visible gap is the point of the feature, the targeting
// list for the next backfill run. The gate never blocks CI.
//
// The gate seeds a FRESH graph into an isolated tmp DB (runSeed is a truncate-
// and-rebuild projection, Principle 1), so it is deterministic on a clean CI
// runner and never depends on a previously-seeded graph.db.
//
// Authority: D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER (CEO session-delegation 2026-06-10).
// Author: Mira (Regulatory-Reporting / Obligations Engineer, regulatory).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "regulator-mandate-coverage";

// Bind the graph DB to an isolated tmp path BEFORE importing the db-backed
// modules so the lazy singleton (BANK_GRAPH_DB read at module init) uses it.
if (!process.env.BANK_GRAPH_DB) {
  process.env.BANK_GRAPH_DB = join(mkdtempSync(join(tmpdir(), "recon-mandate-cov-")), "graph.db");
}

interface RegulatorRow {
  id: string;
  label: string;
}

/**
 * Run the gate against the seeded graph. Seeds a fresh graph first (idempotent
 * truncate-and-rebuild) so it is self-contained.
 */
export async function run(): Promise<ReconResult> {
  const { runSeed } = await import("../regulatory/graph/seed-projection");
  const { getDb } = await import("../regulatory/graph/db");
  await runSeed();
  const db = getDb();

  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // In-scope regulators: those issuing ≥1 direct/transposed instrument
  // (Document or Framework — the seed wires ISSUED_BY from both).
  const inScope = db
    .prepare(
      `SELECT DISTINCT r.id AS id, r.label AS label
         FROM graph_nodes r
         JOIN graph_edges e ON e.to_id = r.id AND e.edge_type = 'ISSUED_BY'
         JOIN graph_nodes d ON d.id = e.from_id
        WHERE r.node_type = 'Regulator'
          AND json_extract(d.metadata, '$.applicabilityStatus') IN ('direct', 'transposed')
        ORDER BY r.id`,
    )
    .all() as RegulatorRow[];

  result.asserted = inScope.length;

  const hasMandate = db.prepare(
    `SELECT 1
       FROM graph_edges e
       JOIN graph_nodes o ON o.id = e.to_id AND o.node_type = 'RegulatoryObjective'
      WHERE e.from_id = ? AND e.edge_type = 'PURSUES'
        AND json_extract(o.metadata, '$.objectiveLevel') = 'mandate'
      LIMIT 1`,
  );

  let covered = 0;
  for (const r of inScope) {
    if (hasMandate.get(r.id)) {
      covered++;
      continue;
    }
    violations.push({
      subject: r.id,
      message: `in-scope regulator "${r.label}" has no PURSUES edge to a level:mandate objective — objective layer not yet backfilled`,
      severity: "warn",
    });
  }

  result.violations = violations;
  result.ok = true; // advisory
  result.asOf = `in-scope=${inScope.length} mandate-covered=${covered}`;
  return result;
}

if (import.meta.main) {
  const result = await run();
  for (const v of result.violations) {
    console.log(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  console.log(
    `\nrecon:${PIPELINE} OK (advisory) — ${result.asOf}; ${result.violations.length} uncovered regulator(s)`,
  );
}
