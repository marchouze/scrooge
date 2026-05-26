// platform/recon/test-lineage-not-in-production.ts
//
// Continuous-controls gate: no ProvenanceReclassified event tagged
// kind:production may carry a sourceLineage starting with "test-".
//
// Rationale
// ---------
// ProvenanceReclassified events are emitted by scripts that re-tag existing
// event rows (e.g. the build-phase-fixture backfill). Their own provenance is
// set to kind:production with a sourceLineage derived from the script's runRef.
//
// The "test-" prefix is reserved for test fixtures. A production-tagged
// ProvenanceReclassified event with sourceLineage:"test-run-1" (or any
// "test-*" value) indicates the test suite accidentally exercised a backfill
// script against the shared production event store — i.e. test pollution.
//
// Remedy
// ------
// Run the cleanup script to bulk-reclassify offending rows to kind:simulated:
//
//   bun run scripts/cleanup-test-run1-provenance-pollution.ts
//
// Prevention: the root cause was importing a script with composition
// side-effects in a unit test. Fixed by extracting pure rule modules (no
// eventStore import). See `scripts/backfill-build-phase-fixture-provenance-rules.ts`.
//
// Severity: fail. Leaked test events inflate production provenance counts and
// contaminate any future projection that folds ProvenanceReclassified events.
//
// Authority:
//   - D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10)
//   - Principle 1 — events are the only source of truth
//
// Author: Atlas (Core banking platform architect, engineering — substrate)
//   on behalf of Vera (Internal audit / continuous-assurance engineer).

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:test-lineage-not-in-production";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // Count offending events aggregated by lineage value so 123k individual
  // events produce a single actionable violation rather than log spam.
  const offendersByLineage = new Map<string, number>();
  let asserted = 0;

  for (const event of eventStore.replay({ type: "ProvenanceReclassified" })) {
    asserted++;
    const tag = event.provenance;
    if (!tag) continue;
    if (tag.kind !== "production") continue;
    const lineage = String(tag.sourceLineage);
    if (!lineage.startsWith("test-")) continue;
    offendersByLineage.set(lineage, (offendersByLineage.get(lineage) ?? 0) + 1);
  }

  result.asserted = asserted;

  for (const [lineage, count] of offendersByLineage.entries()) {
    violations.push({
      subject: `lineage:${lineage} (${count} ProvenanceReclassified event(s) with kind:production)`,
      message:
        "Test-prefixed sourceLineage found on production-tagged ProvenanceReclassified events — " +
        "test suite leaked writes into the production event store. " +
        "Run `bun run scripts/cleanup-test-run1-provenance-pollution.ts` to reclassify.",
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.length === 0;
  return result;
}

if (import.meta.main) {
  const r = run();
  if (r.ok) {
    process.stdout.write(
      `${PIPELINE}: ok — scanned ${r.asserted} ProvenanceReclassified event(s); no test-lineage pollution in production\n`,
    );
    process.exit(0);
  }
  process.stderr.write(`${PIPELINE}: FAIL\n`);
  for (const v of r.violations) {
    process.stderr.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.exit(1);
}
