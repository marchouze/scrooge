// platform/recon/objective-policy-alignment.ts
//
// Vera recon: objective-policy-alignment (ADVISORY).
//
// The regulatory-intelligence objective layer (D-REGULATORY-INTELLIGENCE-
// OBJECTIVE-LAYER) lets a bank policy align to a regulator's PURPOSE, not just
// to a rule, via the ALIGNS_TO edge: Policy → RegulatoryObjective. This gate
// asserts that every IN-SCOPE RegulatoryObjective has at least one incoming
// ALIGNS_TO edge — i.e. the bank's policy estate speaks to that objective.
//
// IN-SCOPE = every RegulatoryObjective node currently in the graph. (Today these
// are the SARB-PA pilot's five — once other regulators' objective graphs land,
// their objectives join the scope automatically.)
//
// Mode: ADVISORY (ok:true regardless). In the SARB-PA pilot, the safety-and-
// soundness + financial-stability objectives are aligned (capital + liquidity
// policies); the mandate, market-infrastructure-soundness, and customer-
// protection objectives carry no aligned policy yet and surface as `warn`
// findings — the purpose-coverage gaps the bank has not yet written policy to.
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

const PIPELINE = "objective-policy-alignment";

if (!process.env.BANK_GRAPH_DB) {
  process.env.BANK_GRAPH_DB = join(mkdtempSync(join(tmpdir(), "recon-obj-pol-")), "graph.db");
}

interface ObjectiveRow {
  id: string;
  label: string;
  level: string | null;
}

export async function run(): Promise<ReconResult> {
  const { runSeed } = await import("../regulatory/graph/seed-projection");
  const { getDb } = await import("../regulatory/graph/db");
  await runSeed();
  const db = getDb();

  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const objectives = db
    .prepare(
      `SELECT id, label, json_extract(metadata, '$.objectiveLevel') AS level
         FROM graph_nodes
        WHERE node_type = 'RegulatoryObjective'
        ORDER BY id`,
    )
    .all() as ObjectiveRow[];

  result.asserted = objectives.length;

  const hasAlignedPolicy = db.prepare(
    `SELECT 1 FROM graph_edges e
       JOIN graph_nodes p ON p.id = e.from_id AND p.node_type = 'Policy'
      WHERE e.to_id = ? AND e.edge_type = 'ALIGNS_TO' LIMIT 1`,
  );

  let covered = 0;
  for (const o of objectives) {
    if (hasAlignedPolicy.get(o.id)) {
      covered++;
      continue;
    }
    violations.push({
      subject: o.id,
      message: `objective "${o.label}" (${o.level ?? "?"}) has no ALIGNS_TO policy — purpose-coverage gap`,
      severity: "warn",
    });
  }

  result.violations = violations;
  result.ok = true; // advisory
  result.asOf = `objectives=${objectives.length} aligned=${covered}`;
  return result;
}

if (import.meta.main) {
  const result = await run();
  for (const v of result.violations) {
    console.log(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  console.log(
    `\nrecon:${PIPELINE} OK (advisory) — ${result.asOf}; ${result.violations.length} objective(s) without an aligned policy`,
  );
}
