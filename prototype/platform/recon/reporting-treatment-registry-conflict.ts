// platform/recon/reporting-treatment-registry-conflict.ts
//
// `recon:reporting-treatment-registry-conflict` — the gate that makes the
// reporting-treatment menu's single-implementation rule mechanical: no two
// treatment modules may claim the same (category, scope) at the same version
// (the OO single-implementation rule, mirrored from `recon:fil-conformance`'s
// FIL-Models registry-integrity check).
//
// POSTURE — ADVISORY, ENFORCING-READY. This matches the fil-models precedent
// (`recon:fil-conformance` is advisory in S0): the register starts EMPTY (no
// treatment module declared until the per-asset-class verticals land), so the
// conflict check passes TRIVIALLY today. The pipeline is stood up now so it is
// enforcing-ready when modules land: it folds the reporting-treatment register
// from any `ReportingTreatmentDeclared` events present and surfaces registry
// conflicts as advisory `warn`s. Only a HARD structural error (a malformed
// declaration event that cannot fold) is `fail`-severity and blocks CI — the
// empty-register and clean-register baselines never block.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST. Principle 1; Principle 2.
// Author: Atlas (Substrate Architect, engineering).

import {
  type ReportingTreatmentRegister,
  foldReportingTreatmentRegister,
} from "../../v2-core/reporting-treatments/registry";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

/**
 * Read any declared reporting-treatment payloads from the live event store and
 * fold them into the register. Reading through the v1 event store here is fine:
 * this is a v1-side recon (the v1→v2 direction is permitted; v2-core itself
 * imports nothing from v1).
 */
function readReportingTreatmentRegister(): ReportingTreatmentRegister {
  const payloads: unknown[] = [];
  for (const ev of eventStore.replay({ type: "ReportingTreatmentDeclared" })) {
    payloads.push((ev as { payload: unknown }).payload);
  }
  return foldReportingTreatmentRegister(payloads);
}

export function run(): ReconResult {
  const result = emptyResult("reporting-treatment-registry-conflict");
  const violations: ReconViolation[] = [];

  // Fold the register. A malformed declaration throws inside the fold — that is
  // a HARD error (a registered event the schema cannot parse), surfaced as a
  // fail. The empty-register baseline folds cleanly.
  let register: ReportingTreatmentRegister;
  try {
    register = readReportingTreatmentRegister();
  } catch (err) {
    violations.push({
      subject: "ReportingTreatmentDeclared",
      message: `declaration event failed to fold: ${(err as Error).message}`,
      severity: "fail",
    });
    return { ...result, asserted: 1, violations, ok: false };
  }

  // Assertion 1 — register integrity: no two modules claim the same
  // category+scope at the same version (the OO single-implementation rule).
  // Advisory until the per-asset-class verticals burn down the rollout, matching
  // the fil-conformance precedent.
  result.asserted += 1;
  for (const conflict of register.conflicts) {
    violations.push({
      subject: conflict.key,
      message: `registry conflict: ${conflict.message} (modules: ${conflict.treatmentIds.join(", ")})`,
      severity: "warn",
    });
  }

  // Advisory gate: only HARD `fail` violations break CI. `warn`s are surfaced
  // but do not fail the build on the empty/clean-register baseline.
  const hardFailures = violations.filter((v) => v.severity === "fail");
  result.violations = violations;
  return { ...result, ok: hardFailures.length === 0 };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const hard = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:reporting-treatment-registry-conflict (advisory) — asserted ${r.asserted}; ${r.violations.length} finding(s), ${hard} hard\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
