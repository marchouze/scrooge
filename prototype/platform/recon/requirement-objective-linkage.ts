// platform/recon/requirement-objective-linkage.ts
//
// Vera recon: requirement-objective-linkage (ADVISORY).
//
// The keystone of the regulatory-intelligence objective layer (D-REGULATORY-
// INTELLIGENCE-OBJECTIVE-LAYER) is the SERVES edge: Obligation → Regulatory-
// Objective — WHY a requirement exists. This gate asserts that every IN-SCOPE
// adopted Obligation carries at least one SERVES edge.
//
// IN-SCOPE ADOPTED = the bank's own adopted obligation register rows — the
// `OBL-ORG-*` nodes seeded from Regulations/_obligations-register.md. (The
// imported BCBS `OBL-BCBS-*` corpus is reference data, not the bank's adopted
// set, so it is out of scope here.)
//
// Mode: ADVISORY (ok:true regardless). The SARB-PA pilot wired SERVES onto the
// PA prudential obligations (capital, leverage, large-exposures, LCR/NSFR); the
// remaining adopted obligations (FIC, FSCA, conduct, …) carry no SERVES edge yet
// and surface as `warn` findings — the targeting list for the next backfill run.
// The gate never blocks CI.
//
// Self-contained: seeds a FRESH graph into an isolated tmp DB (truncate-and-
// rebuild projection, Principle 1) so it is deterministic on a clean CI runner.
//
// Authority: D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER (CEO session-delegation 2026-06-10).
// Author: Mira (Regulatory-Reporting / Obligations Engineer, regulatory).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "requirement-objective-linkage";

if (!process.env.BANK_GRAPH_DB) {
  process.env.BANK_GRAPH_DB = join(mkdtempSync(join(tmpdir(), "recon-req-obj-")), "graph.db");
}

interface ObligationRow {
  id: string;
  label: string;
}

export async function run(): Promise<ReconResult> {
  const { runSeed } = await import("../regulatory/graph/seed-projection");
  const { getDb } = await import("../regulatory/graph/db");
  await runSeed();
  const db = getDb();

  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // In-scope adopted obligations: OBL-ORG-* (the bank's adopted register).
  const inScope = db
    .prepare(
      `SELECT id, label FROM graph_nodes
        WHERE node_type = 'Obligation' AND id LIKE 'OBL-ORG-%'
        ORDER BY id`,
    )
    .all() as ObligationRow[];

  result.asserted = inScope.length;

  const hasServes = db.prepare(
    `SELECT 1 FROM graph_edges e
       JOIN graph_nodes o ON o.id = e.to_id AND o.node_type = 'RegulatoryObjective'
      WHERE e.from_id = ? AND e.edge_type = 'SERVES' LIMIT 1`,
  );

  let covered = 0;
  for (const o of inScope) {
    if (hasServes.get(o.id)) {
      covered++;
      continue;
    }
    violations.push({
      subject: o.id,
      message: `adopted obligation has no SERVES edge to a RegulatoryObjective — the "why" is not yet recorded`,
      severity: "warn",
    });
  }

  result.violations = violations;
  result.ok = true; // advisory
  result.asOf = `in-scope=${inScope.length} serves-covered=${covered}`;
  return result;
}

if (import.meta.main) {
  const result = await run();
  for (const v of result.violations.slice(0, 50)) {
    console.log(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  console.log(
    `\nrecon:${PIPELINE} OK (advisory) — ${result.asOf}; ${result.violations.length} obligation(s) without a SERVES edge`,
  );
}
