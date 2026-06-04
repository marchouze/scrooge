// platform/recon/basel-constants-coverage.ts
//
// Vera recon: basel-constants-coverage — keeps the Basel-baseline link from
// rotting. Asserts that every live, Basel-derived calibration constant cites a
// baseline provision that actually exists in the BCBS catalogue, and that both
// the Basel and SA-override citations are well-formed canonical URNs.
//
// This is the gate behind "Basel baseline, superseded by local": if an engine
// reads a number whose Basel parent is missing or mis-cited, the chain from
// international floor → SARB instrument → live calc is broken, and this fails.
//
// Assertions (all blocking):
//   1. Every constant in a BASEL_DERIVED_CATEGORY (plus the named ratio minima)
//      has a BASEL_PROVISION_LINKAGE entry.
//   2. Every linkage `baselProvision` is a valid `urn:reg:bcbs:...` URN that is
//      catalogued in BASEL_PROVISIONS (platform/regulatory/basel-adoption.ts).
//   3. Every linkage `localOverride` is a valid `urn:reg:<jur>:...` URN.
//   4. Every linkage key names a real constant in FINANCIAL_CONSTANTS.
//   5. Every adoption edge points at a catalogued Basel provision (graph integrity).
//
// Mode: blocking (non-zero exit on any violation). Wired into
//       `bun run ci:recon:domain`.
//
// Authority: D-BASEL-CATALOGUE-PILLAR-1 (CEO session-delegation 2026-06-04).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { parseUrn } from "../citation/urn";
import {
  BASEL_DERIVED_CATEGORIES,
  BASEL_DERIVED_KEYS,
  BASEL_PROVISION_LINKAGE,
  FINANCIAL_CONSTANTS,
} from "../config/financial-constants";
import { ADOPTION_EDGES, isCataloguedBaselProvision } from "../regulatory/basel-adoption";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "basel-constants-coverage";

export function run(): ReconResult {
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const derivedCategories = new Set<string>(BASEL_DERIVED_CATEGORIES);
  const requiredKeys = new Set<string>(BASEL_DERIVED_KEYS);
  const constantKeys = new Set(FINANCIAL_CONSTANTS.map((c) => c.key));

  // 1. Every Basel-derived constant has a linkage entry.
  const required = FINANCIAL_CONSTANTS.filter(
    (c) => derivedCategories.has(c.category) || requiredKeys.has(c.key),
  );
  result.asserted = required.length;
  for (const c of required) {
    if (!(c.key in BASEL_PROVISION_LINKAGE)) {
      violations.push({
        subject: c.key,
        message: `Basel-derived constant "${c.key}" (category "${c.category}") has no BASEL_PROVISION_LINKAGE entry — every Basel-derived calibration number must cite its baseline provision`,
        severity: "fail",
      });
    }
  }

  // 2-4. Each linkage entry is well-formed and resolvable.
  for (const [key, link] of Object.entries(BASEL_PROVISION_LINKAGE)) {
    if (!constantKeys.has(key)) {
      violations.push({
        subject: key,
        message: `linkage key "${key}" does not name a constant in FINANCIAL_CONSTANTS`,
        severity: "fail",
      });
    }
    const baselParsed = parseUrn(link.baselProvision);
    if (baselParsed.kind === "error" || !link.baselProvision.startsWith("urn:reg:bcbs:")) {
      violations.push({
        subject: key,
        message: `baselProvision "${link.baselProvision}" is not a valid urn:reg:bcbs:... URN`,
        severity: "fail",
      });
    } else if (!isCataloguedBaselProvision(link.baselProvision)) {
      violations.push({
        subject: key,
        message: `baselProvision "${link.baselProvision}" is not catalogued in BASEL_PROVISIONS (basel-adoption.ts)`,
        severity: "fail",
      });
    }
    const localParsed = parseUrn(link.localOverride);
    if (localParsed.kind === "error" || localParsed.urnClass !== "reg") {
      violations.push({
        subject: key,
        message: `localOverride "${link.localOverride}" is not a valid urn:reg:... URN`,
        severity: "fail",
      });
    }
  }

  // 5. Adoption-graph integrity: every edge targets a catalogued provision.
  for (const e of ADOPTION_EDGES) {
    if (!isCataloguedBaselProvision(e.baselProvision)) {
      violations.push({
        subject: e.baselProvision,
        message: `adoption edge (${e.jurisdiction}) points at uncatalogued Basel provision "${e.baselProvision}"`,
        severity: "fail",
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;
  return result;
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");

  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  if (fails.length === 0) {
    console.log(
      `recon:${PIPELINE} OK — ${result.asserted} Basel-derived constant(s), all linked to a catalogued baseline provision`,
    );
  } else {
    console.error(
      `\nrecon:${PIPELINE} — ${result.asserted} Basel-derived constant(s) checked, ${fails.length} violation(s)`,
    );
    console.error(`recon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
