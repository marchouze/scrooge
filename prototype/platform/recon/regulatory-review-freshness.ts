// platform/recon/regulatory-review-freshness.ts
//
// `recon:regulatory-review-freshness` — ADVISORY gate for the regulatory
// review-marker lifecycle (acquire → LLM-review → trace back → maintain).
//
// ADVISORY (exits 0 even with violations; surfaces findings as "warn" severity).
// Never fails CI. It is the maintenance lens that keeps the bank's read of each
// binding regulator current: once a source is re-acquired (golden-source hash
// drift) the prior review is "stale" until re-reviewed.
//
// Assertions (warn-severity only):
//   For every instrument whose source has been acquired AND whose applicability
//   is `direct` or `transposed` (the instruments that actually bind the bank):
//     - warn when the instrument has never been reviewed (no
//       RegulatorySourceReviewed event);
//     - warn when the latest review was for a superseded source hash (stale).
//
// Data source: `buildSourceCoverage()` — the same projection the committed
// `_source-coverage.json` register is built from. It replays
// RegulatorySourceReviewed + RecordFiled{regulatory-source} from the event
// store and derives applicabilityStatus, so the recon reflects the live store,
// not the committed snapshot.
//
// Authority: brief:atlas:phase-1-regulatory-review-marker-foundation-regu:2026-06-15;
// D-REGULATORY-LIBRARY-V1.
// Author: Atlas (Core Banking Platform Architect, engineering).

import { buildSourceCoverage } from "../../scripts/regulatory/build-source-coverage";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

/** Applicability statuses that bind the bank and therefore require review. */
const BINDING_STATUSES = new Set(["direct", "transposed"]);

export function run(): ReconResult {
  const result = emptyResult("regulatory-review-freshness");
  const violations: ReconViolation[] = [];

  let report: ReturnType<typeof buildSourceCoverage>;
  try {
    report = buildSourceCoverage();
  } catch {
    // Coverage projection unavailable (no event/graph store) — nothing to
    // assert. Advisory gate: pass clean.
    return { ...result, asserted: 0, ok: true };
  }

  for (const row of report.rows) {
    if (!row.sourceAcquired) continue;
    if (!BINDING_STATUSES.has(row.applicabilityStatus)) continue;

    result.asserted += 1;

    if (row.reviewStatus === "unreviewed") {
      violations.push({
        subject: row.slug,
        message: `${row.applicabilityStatus} instrument "${row.slug}" (${row.title}) has acquired source but no RegulatorySourceReviewed event — run \`bun run scripts/backfill-regulatory-reviews.ts\` (or perform an LLM review) to record the review marker`,
        severity: "warn",
      });
    } else if (row.reviewStatus === "stale") {
      violations.push({
        subject: row.slug,
        message: `${row.applicabilityStatus} instrument "${row.slug}" (${row.title}) was reviewed on ${row.reviewedAt ?? "(unknown)"} against a superseded source hash — the source has since been re-acquired; re-review and emit a fresh RegulatorySourceReviewed`,
        severity: "warn",
      });
    }
  }

  return {
    ...result,
    violations,
    // Advisory: ok=true even with warn-severity findings.
    ok: true,
  };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  process.stdout.write(
    `recon:regulatory-review-freshness (advisory) — asserted ${r.asserted} binding instrument(s); ` +
      `${warnCount} freshness finding(s)\n`,
  );
  // Advisory gate: always exit 0.
  process.exit(0);
}
