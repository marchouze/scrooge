// prototype/scripts/generate-adopted-serves-backfill.ts
//
// Generator for `Regulations/_adopted-serves-backfill-objective-graph.json` —
// the rule-based SERVES backfill linking the bank's adopted obligations
// (`OBL-ORG-*`, from `Regulations/_obligations.seed.json`) to the regulator
// leaf objectives they serve. The derivation rules live in
// platform/regulatory/graph/serves-backfill-derivation.ts (pure, tested);
// this script only does I/O:
//   - reads the adopted register seed (the single authored source),
//   - reads the sibling *-objective-graph.json artefacts to compute the set of
//     obligations ALREADY covered by hand-authored SERVES edges (#1150–#1164 —
//     those edges stay canonical; the backfill never duplicates or overrides),
//   - validates every target objective id exists in those artefacts (a typo'd
//     objective id must fail HERE, loudly — not get silently FK-skipped at
//     fold time, the #1142 defect class),
//   - writes the artefact (edges only, no nodes) + the residual list.
//
// The committed artefact is Plane-A reference data, re-derivable, NO events
// (D-REGULATORY-ARCHITECTURE-TWO-PLANE). graph:seed picks it up via the
// importObjectiveArtefacts `-objective-graph.json` walk; the `Regulations/_`
// path sorts AFTER every per-regulator subdirectory artefact, so all OBJ-*
// endpoint nodes exist by the time its edges fold.
//
// Residuals are committed INSIDE the artefact (`residuals` field, ignored by
// the importer) — the honesty bar of #1192: a residual with a reason beats a
// fake edge.
//
// Authority: D-QUEUE-CLOSEOUT-2026-06-10 (CEO, 2026-06-10), continuing
// WS-REG-INTELLIGENCE-OBJECTIVE-LAYER.
// Author: Mira (Compliance / RegTech engineer, engineering).
//
// Usage (from prototype/):  bun run scripts/generate-adopted-serves-backfill.ts

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  SERVES_BACKFILL_OUT_RELPATH,
  buildAdoptedServesBackfillArtefact,
} from "../platform/regulatory/graph/serves-backfill-artefact";

const REPO_ROOT = join(import.meta.dir, "..", "..");

const { artefact, result } = buildAdoptedServesBackfillArtefact(REPO_ROOT);

const out = join(REPO_ROOT, SERVES_BACKFILL_OUT_RELPATH);
writeFileSync(out, `${JSON.stringify(artefact, null, 2)}\n`);

console.log(`Wrote ${out}`);
console.log(`  already covered (hand-authored): ${result.alreadyCovered}`);
console.log(`  derived SERVES edges:            ${result.edges.length}`);
console.log(`  residuals (stay unmapped):       ${result.residuals.length}`);

const perObjective = new Map<string, number>();
for (const e of result.edges) {
  perObjective.set(e.toId, (perObjective.get(e.toId) ?? 0) + 1);
}
console.log("  edges per objective:");
for (const [obj, n] of [...perObjective.entries()].sort()) console.log(`    ${obj}: ${n}`);

const perConfidence = new Map<number, number>();
for (const e of result.edges) {
  perConfidence.set(e.confidenceScore, (perConfidence.get(e.confidenceScore) ?? 0) + 1);
}
console.log("  confidence distribution:");
for (const [conf, n] of [...perConfidence.entries()].sort((a, b) => b[0] - a[0])) {
  console.log(`    ${conf.toFixed(2)}: ${n}`);
}

const perReason = new Map<string, number>();
for (const r of result.residuals) {
  perReason.set(r.reasonClass, (perReason.get(r.reasonClass) ?? 0) + 1);
}
console.log("  residuals per reason class:");
for (const [cls, n] of [...perReason.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${cls}: ${n}`);
}
