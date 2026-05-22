// platform/recon/provenance-tag-coverage.ts
//
// D-DATA-PROVENANCE-SUBSTRATE — Slice 1 recon (Vera, owned).
//
// Asserts: every event in the local event store carries a `ProvenanceTag`
// (the `provenance` column is non-NULL). Per pack §4.3, this pipeline
// closes the "no silent unflagged events" guarantee — the substrate
// audit trail is incomplete if any event lacks the typed dimension.
//
// In practice the EventStore constructor invokes a soft-tagger that
// auto-heals untagged rows on open, so a green run after backfill is
// the steady state. This recon catches:
//   - A future migration that sneaks an INSERT bypassing `append()`.
//   - A schema change that re-introduces NULL provenance.
//   - An imported / synced event from an upstream that omits the tag.
//
// Severity: `fail`. Untagged events are a P1 audit-integrity risk and
// should block CI.
//
// Author: Atlas (Core banking platform architect, engineering — substrate)
//   on behalf of Vera (Internal audit / continuous-assurance engineer).

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:provenance-tag-coverage";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const counts = eventStore.countByProvenanceKind();
  const total = counts.production + counts.simulated + counts.buildPhaseFixture + counts.untagged;
  result.asserted = total;

  const violations: ReconViolation[] = [];
  if (counts.untagged > 0) {
    violations.push({
      subject: `event-store: ${counts.untagged} untagged event(s)`,
      message:
        "D-DATA-PROVENANCE-SUBSTRATE Slice 1 — every event must carry a typed ProvenanceTag. " +
        "Run `bun run provenance:backfill` to apply default tags (carve-outs first; build-phase simulated otherwise).",
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.length === 0;
  return result;
}

if (import.meta.main) {
  const r = run();
  // Concise console reporting; mirrors retention-citation-coverage.
  if (r.ok) {
    process.stdout.write(
      `${PIPELINE}: ok — asserted ${r.asserted} event(s) carry a ProvenanceTag\n`,
    );
    process.exit(0);
  }
  process.stderr.write(`${PIPELINE}: FAIL\n`);
  for (const v of r.violations) {
    process.stderr.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.exit(1);
}
