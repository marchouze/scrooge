// platform/recon/category-policy-coverage.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE Phase C — regression guard for the
// event-sourced per-category provenance policy.
//
// Asserts the generalisation of the legacy hardcoded PRODUCTION_CARVE_OUTS into
// the settable category policy never silently demotes a carve-out: every
// production carve-out event type must still resolve to `kind: production`
// under the default policy (with its original sourceLineage preserved).
//
// Authority: D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE. Author: Vera / Scrooge.

import {
  PRODUCTION_CARVE_OUTS,
  defaultProvenanceFor,
  setActiveCategoryPolicy,
} from "../event-store/provenance";
import { categoryForEventType } from "../event-store/provenance-category";
import { type ReconResult, emptyResult } from "./types";

const PIPELINE = "recon:category-policy-coverage";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  // Assert against the static default policy (unpinned).
  setActiveCategoryPolicy(undefined);

  for (const [type, tag] of Object.entries(PRODUCTION_CARVE_OUTS)) {
    result.asserted += 1;
    const got = defaultProvenanceFor(type);
    if (got.kind !== "production") {
      result.violations.push({
        subject: type,
        message: `production carve-out demoted to '${got.kind}' under the default category policy — categoryForEventType('${type}')=${categoryForEventType(type) ?? "(unmapped)"} must resolve to a production category`,
        severity: "fail",
      });
    } else if (got.sourceLineage !== tag.sourceLineage) {
      result.violations.push({
        subject: type,
        message: `carve-out sourceLineage drift: expected '${tag.sourceLineage}', got '${got.sourceLineage}'`,
        severity: "warn",
      });
    }
  }

  result.ok = result.violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  if (r.ok) {
    process.stdout.write(
      `${PIPELINE}: ok — ${r.asserted} production carve-out(s) preserved under the default category policy\n`,
    );
    process.exit(0);
  }
  process.stderr.write(`${PIPELINE}: FAIL\n`);
  for (const v of r.violations) {
    process.stderr.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.exit(1);
}
