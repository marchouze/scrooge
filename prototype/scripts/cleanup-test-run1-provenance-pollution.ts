// scripts/cleanup-test-run1-provenance-pollution.ts
//
// One-shot maintenance script: reclassify ~123k ProvenanceReclassified events
// that were erroneously tagged kind:production/sourceLineage:test-run-1.
//
// Root cause
// ----------
// The test at `tests/backfill-build-phase-fixture-provenance.test.ts` imported
// `runBackfill` directly from the main backfill script. That script calls
// `applyDispatchEventDbResolution()` at module load, which pointed the
// EventStore at `~/.local/share/bank/event.db` (the shared production store)
// rather than a throwaway test DB. The test then called `runBackfill({ runRef:
// "test-run-1" })`, emitting ~123k ProvenanceReclassified events — one per row
// reclassified from simulated → build-phase-fixture — into the production
// event store.
//
// Root-cause fix: `scripts/backfill-build-phase-fixture-provenance-rules.ts`
// extracts the pure identification rules (no composition imports) so tests can
// assert the allowlist without loading the production event store as a side
// effect (PR on branch claude/wizardly-beaver-0afe0b).
//
// What this script does
// ---------------------
// Bulk UPDATE: changes provenance from
//   { kind: "production", sourceLineage: "test-run-1" }
// to
//   { kind: "simulated", scenario: "test-pollution:test-run-1",
//     sourceLineage: "test-run-1" }
//
// Only ProvenanceReclassified events with kind:production and
// sourceLineage:test-run-1 are touched. All other events are untouched.
//
// After reclassification the events are kind:simulated, so they are excluded
// from all production-only projection reads (ProvenanceFilter default mode).
// The `recon:test-lineage-not-in-production` gate will then report 0 violations.
//
// Principle 1 compliance
// ----------------------
// The append-only invariant covers the payload + event_id + actor + citations +
// sequence columns. The `provenance` column is an envelope axis, not payload;
// it is managed via the same UPDATE pattern as the `reclassifyProvenance` /
// soft-tagger mechanism. The reclassification is documented by this script +
// its commit. A per-row ProvenanceReclassified audit event would add 123k more
// events to the log — more pollution than it cures — so the audit trail lives
// in the commit history and the one-time script.
//
// Idempotency
// -----------
// The WHERE clause requires kind:'production'. After the first successful run,
// the matching rows are kind:'simulated'. Re-running the script produces 0
// changes.
//
// Usage
// -----
//   bun run scripts/cleanup-test-run1-provenance-pollution.ts
//   bun run scripts/cleanup-test-run1-provenance-pollution.ts --dry-run
//
// Exit codes: 0 always.
//
// Authority: D-DATA-PROVENANCE-SUBSTRATE (CEO-approved 2026-05-10)
// Author: Atlas (Core banking platform architect, engineering — substrate)

import { Database } from "bun:sqlite";

import { resolveEventDbPath } from "../platform/event-store/resolve-event-db";

const PIPELINE = "cleanup:test-run1-provenance-pollution";

function main(argv: ReadonlyArray<string>): number {
  const dryRun = argv.includes("--dry-run");

  const resolved = resolveEventDbPath();
  process.stdout.write(
    `${PIPELINE}: db=${resolved.path} (source:${resolved.source}) mode:${dryRun ? "dry-run" : "apply"}\n`,
  );

  const db = dryRun ? new Database(resolved.path, { readonly: true }) : new Database(resolved.path);
  db.exec("PRAGMA busy_timeout = 5000;");

  const SQL_MATCH = `
    SELECT COUNT(*) AS n
    FROM events
    WHERE type = 'ProvenanceReclassified'
      AND json_extract(provenance, '$.kind') = 'production'
      AND json_extract(provenance, '$.sourceLineage') = 'test-run-1'
  `;

  const SQL_UPDATE = `
    UPDATE events
    SET provenance = json_set(
      json_set(provenance, '$.kind', 'simulated'),
      '$.scenario', 'test-pollution:test-run-1'
    )
    WHERE type = 'ProvenanceReclassified'
      AND json_extract(provenance, '$.kind') = 'production'
      AND json_extract(provenance, '$.sourceLineage') = 'test-run-1'
  `;

  const countRow = db.prepare(SQL_MATCH).get() as { n: number };
  const matchCount = countRow.n;

  if (dryRun) {
    process.stdout.write(
      `${PIPELINE}: would reclassify ${matchCount} event(s) (dry-run; no changes applied)\n`,
    );
    db.close();
    return 0;
  }

  if (matchCount === 0) {
    process.stdout.write(`${PIPELINE}: 0 matching events — nothing to do (already clean)\n`);
    db.close();
    return 0;
  }

  const result = db.prepare(SQL_UPDATE).run();
  db.close();

  process.stdout.write(
    `${PIPELINE}: reclassified ${result.changes} ProvenanceReclassified event(s) kind:production→kind:simulated (sourceLineage:test-run-1)\n`,
  );
  process.stdout.write(
    `${PIPELINE}: run 'bun run recon:test-lineage-not-in-production' to verify 0 violations\n`,
  );

  return 0;
}

if (import.meta.path === Bun.main) {
  process.exit(main(process.argv.slice(2)));
}
