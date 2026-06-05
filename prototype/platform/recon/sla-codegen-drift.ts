// platform/recon/sla-codegen-drift.ts
//
// Recon pipeline: recon:sla-codegen-drift
//
// Asserts that the committed SLA generated types
// (`platform/accounting/sla/generated/sla-types.ts`) match a fresh render
// from the codegen (`platform/accounting/sla/codegen.ts`).
//
// This is the CI half of the type-safety mitigation (Phase-0 spec §11.4):
// the generated `AccountId` union is derived from the COA registry. If
// COA_ACCOUNTS changes (an account added/removed/renamed) but the generated
// file is not regenerated, a rule could reference an account that no longer
// exists OR the union could go stale. Re-running codegen and byte-comparing
// makes that drift a hard CI failure — run `bun run sla:codegen` to fix.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).

import { readFileSync } from "node:fs";

import { GENERATED_FILE, renderGeneratedTypes } from "../accounting/sla/codegen";
import { type ReconResult, emptyResult } from "./types";

const PIPELINE = "recon:sla-codegen-drift";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  result.asserted = 1;

  const expected = renderGeneratedTypes();
  let actual: string;
  try {
    actual = readFileSync(GENERATED_FILE, "utf8");
  } catch (err) {
    result.ok = false;
    result.violations.push({
      subject: GENERATED_FILE,
      message: `generated SLA types file is missing — run 'bun run sla:codegen' (${String(err)})`,
      severity: "fail",
    });
    return result;
  }

  if (actual !== expected) {
    result.ok = false;
    result.violations.push({
      subject: GENERATED_FILE,
      message:
        "generated SLA types are stale vs codegen output — COA registry changed without regen. " +
        "Run 'bun run sla:codegen' and commit the result.",
      severity: "fail",
    });
  }

  return result;
}

if (import.meta.main) {
  const result = run();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
