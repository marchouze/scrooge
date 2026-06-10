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
// Coverage rule (single source: findObjectiveCoverageGaps in
// platform/regulatory/graph/query.ts): an objective is covered by a direct
// Policy ALIGNS_TO edge, or — for `mandate`-level objectives — transitively
// when at least one refining objective is aligned (the mandate is the umbrella
// its sub-objectives decompose; an un-aligned refining objective still surfaces
// as its own gap, so the roll-up never hides a missing leaf).
//
// Mode: ADVISORY (ok:true regardless). After the 2026-06-10 tail-fill the
// remaining gaps are the two FSCA objectives no bank policy genuinely serves
// in the build phase (financial-inclusion + financial-education — FSCA-directed
// statutory functions under FSR Act s.57(a); the bank has no retail
// customers/products until licence-day). A residual gap with a reason beats a
// fake edge, so the gate stays advisory until that policy estate exists.
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
  const { findObjectiveCoverageGaps } = await import("../regulatory/graph/query");
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

  // Single source of the coverage rule (direct ALIGNS_TO, or mandate-level
  // transitive roll-up via REFINES) — platform/regulatory/graph/query.ts.
  const gapIds = new Set(findObjectiveCoverageGaps().map((n) => n.id));

  let covered = 0;
  for (const o of objectives) {
    if (!gapIds.has(o.id)) {
      covered++;
      continue;
    }
    violations.push({
      subject: o.id,
      message: `objective "${o.label}" (${o.level ?? "?"}) has no ALIGNS_TO policy (direct or via mandate roll-up) — purpose-coverage gap`,
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
