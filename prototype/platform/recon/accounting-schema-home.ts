// platform/recon/accounting-schema-home.ts
//
// recon:accounting-schema-home — accounting-schema canonical-home gate.
//
// WHY THIS EXISTS
// ---------------
// The modular fold (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD) put accounting
// determination canonical at the approved Product, with the treatment / FIL /
// IFRS schemas as Zod in `v2-core`. Two residual gaps remained: the
// chart-of-accounts was dual-sourced (`coa-registry.ts` typed registry vs
// `chart-of-accounts.json` flat seed), and the posting-rule registry was a
// plain-TS array with no schema. This gate names the canonical home and makes
// the consolidation non-regressable.
//
// THREE ASSERTIONS (per brief WS-ACCT-FX-COMPLETENESS Slice 0)
// -----------------------------------------------------------
//   (a) No accounting *schema* is hand-declared outside `v2-core`. The
//       authoritative Zod schemas for the accounting determination (chart of
//       accounts, posting-rule registry) live under `v2-core/`; the v1 side
//       (`platform/accounting/`) only RE-EXPORTS them and wires the runtime
//       registry. A bare `z.object(` defining an accounting schema on the v1
//       side is a violation.
//   (b) The chart of accounts has exactly ONE source. After Slice 1 the typed
//       Zod `COA_ACCOUNTS` constant under `v2-core` is canonical; any second
//       independent account list (e.g. a hand-maintained `chart-of-accounts.json`
//       that is NOT generated from the canonical source) is a violation.
//   (c) Every posting rule referenced by a treatment module
//       (`FX_TREATMENT_MODULES.applicablePostingRuleIds`, …) resolves to a
//       DEFINED rule in the posting-rule registry. A dangling reference is a
//       violation.
//
// ADVISORY → ENFORCING (Charter cmd 3 — ratchets harden only)
// -----------------------------------------------------------
// Landed ADVISORY in Slice 0 so its first output is the scope map for slices
// 1–2 (it lists every current violation without failing CI). Hardened to
// ENFORCING in Slice 4 once slices 1–3 leave zero violations. The
// `ENFORCING` flag below is the single switch; flipping it is the Slice-4
// ratchet step (recorded against D-ACCT-SCHEMA-CANONICAL-HOME).
//
// Authority: D-ACCT-SCHEMA-CANONICAL-HOME (eng, CEO-approved 2026-06-18);
//   D-ACCT-FX-IFRS-POSTING-COMPLETENESS (finance, CEO-approved 2026-06-18);
//   cites D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-ENGINEERING-INTEGRITY-CHARTER.
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "accounting-schema-home";

/**
 * Ratchet switch (Charter cmd 3). `false` = advisory (warns, exits 0);
 * `true` = enforcing (any violation exits non-zero). Slice 4 flips this to
 * `true` once slices 1–3 are clean. Hardens only — never relax back to `false`.
 */
const ENFORCING = false;

const HERE = dirname(fileURLToPath(import.meta.url));
const ACCT_DIR = resolve(HERE, "../accounting");

// ---------------------------------------------------------------------------
// (a) No accounting schema hand-declared outside v2-core.
//
// The v1 accounting files that legitimately RE-EXPORT a v2-core schema are
// allow-listed by the fact that they import the schema from v2-core. We scan
// each v1 accounting file for a bare accounting-schema declaration: a
// `z.object(` whose surrounding identifier names an accounting schema
// (`*Schema` paired with a CoA / posting-rule term) that is NOT sourced from
// v2-core. Files that declare NON-accounting schemas (e.g. an internal helper
// shape) are out of scope — the term gate keys on the accounting vocabulary.
// ---------------------------------------------------------------------------

/** v1 accounting files whose canonical schema now lives in v2-core — they must
 * only re-export, never re-declare. Keyed by file, value is the v2-core module
 * the schema must be imported from. */
const SCHEMA_REEXPORT_CONTRACT: ReadonlyArray<{
  readonly file: string;
  readonly schemaName: string;
  readonly v2CoreModule: string;
}> = [
  {
    file: "coa-registry.ts",
    schemaName: "CoaAccountEntrySchema",
    v2CoreModule: "v2-core/accounting/chart-of-accounts",
  },
  {
    file: "posting-rule-registry.ts",
    schemaName: "PostingRuleEntrySchema",
    v2CoreModule: "v2-core/posting-rules/registry",
  },
];

function readIf(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function assertSchemaReexport(violations: ReconViolation[]): number {
  let asserted = 0;
  for (const c of SCHEMA_REEXPORT_CONTRACT) {
    asserted++;
    const src = readIf(resolve(ACCT_DIR, c.file));
    if (src === undefined) {
      // The file no longer exists on the v1 side — acceptable (schema fully
      // moved). Nothing to re-declare, nothing to assert.
      continue;
    }
    // Does this file DECLARE the schema with `z.object(` rather than import it?
    const declaresSchema = new RegExp(
      `export const ${c.schemaName}\\s*=\\s*z\\.(object|enum|union|discriminatedUnion|array)\\(`,
    ).test(src);
    const importsFromV2Core =
      src.includes(c.v2CoreModule) &&
      new RegExp(`\\b${c.schemaName}\\b`).test(src) &&
      // an `import { ... CoaAccountEntrySchema ... } from "...v2-core..."` line
      new RegExp(`import[\\s\\S]*?\\b${c.schemaName}\\b[\\s\\S]*?from[^\\n]*v2-core`).test(src);
    if (declaresSchema && !importsFromV2Core) {
      violations.push({
        subject: `${c.file}:${c.schemaName}`,
        message: `Accounting schema ${c.schemaName} is hand-declared on the v1 side (platform/accounting/${c.file}). It must live in ${c.v2CoreModule} and be re-exported here (D-ACCT-SCHEMA-CANONICAL-HOME).`,
        severity: ENFORCING ? "fail" : "warn",
      });
    }
  }
  return asserted;
}

// ---------------------------------------------------------------------------
// (b) Chart of accounts has exactly one source.
//
// After Slice 1 the canonical CoA is the typed Zod `COA_ACCOUNTS` under
// v2-core; `chart-of-accounts.json` (if retained) must be GENERATED from it, so
// its account set must be IDENTICAL to the canonical set. A divergence means
// two independent sources of truth.
// ---------------------------------------------------------------------------

async function loadCanonicalCoaIds(): Promise<readonly string[]> {
  // Import the canonical constant. After Slice 1 this resolves to v2-core; until
  // then the v1 registry re-exports it. Import by the stable v1 entry point.
  const mod = (await import("../accounting/coa-registry.ts")) as {
    COA_ACCOUNTS: ReadonlyArray<{ id: string }>;
  };
  return mod.COA_ACCOUNTS.map((a) => a.id);
}

function loadJsonCoaIds(): readonly string[] | undefined {
  const src = readIf(resolve(ACCT_DIR, "chart-of-accounts.json"));
  if (src === undefined) return undefined; // JSON retired — single source achieved.
  const parsed = JSON.parse(src) as { accounts?: Array<{ id?: unknown }> };
  return (parsed.accounts ?? [])
    .map((a) => a.id)
    .filter((id): id is string => typeof id === "string");
}

async function assertSingleCoaSource(violations: ReconViolation[]): Promise<number> {
  let asserted = 0;
  const jsonIds = loadJsonCoaIds();
  if (jsonIds === undefined) {
    // No JSON file → exactly one source. Nothing to diverge.
    return asserted;
  }
  const canonical = new Set(await loadCanonicalCoaIds());
  const jsonSet = new Set(jsonIds);
  asserted++;
  const onlyInJson = [...jsonSet].filter((id) => !canonical.has(id));
  const onlyInCanonical = [...canonical].filter((id) => !jsonSet.has(id));
  for (const id of onlyInJson) {
    violations.push({
      subject: `chart-of-accounts.json:${id}`,
      message: `Account ${id} exists in chart-of-accounts.json but NOT in the canonical typed registry. The JSON must be generated from the canonical CoA source — it is not an independent list (D-ACCT-SCHEMA-CANONICAL-HOME).`,
      severity: ENFORCING ? "fail" : "warn",
    });
  }
  for (const id of onlyInCanonical) {
    violations.push({
      subject: `coa-registry:${id}`,
      message: `Account ${id} exists in the canonical typed registry but NOT in chart-of-accounts.json. The JSON is out of sync with its source — regenerate it (D-ACCT-SCHEMA-CANONICAL-HOME).`,
      severity: ENFORCING ? "fail" : "warn",
    });
  }
  return asserted;
}

// ---------------------------------------------------------------------------
// (c) Every treatment-module posting-rule reference resolves to a defined rule.
// ---------------------------------------------------------------------------

async function assertTreatmentPostingRulesResolve(violations: ReconViolation[]): Promise<number> {
  let asserted = 0;
  const fxModules = (await import("../../v2-core/reporting-treatments/fx-modules.ts")) as {
    FX_TREATMENT_MODULES: ReadonlyArray<{
      treatmentId: string;
      applicablePostingRuleIds?: readonly string[];
    }>;
  };
  const registry = (await import("../accounting/posting-rule-registry.ts")) as {
    POSTING_RULE_REGISTRY: ReadonlyArray<{ postingRuleId: string }>;
  };
  const definedRuleIds = new Set(registry.POSTING_RULE_REGISTRY.map((r) => r.postingRuleId));
  for (const m of fxModules.FX_TREATMENT_MODULES) {
    for (const ruleId of m.applicablePostingRuleIds ?? []) {
      asserted++;
      if (!definedRuleIds.has(ruleId)) {
        violations.push({
          subject: `${m.treatmentId}:${ruleId}`,
          message: `Treatment module ${m.treatmentId} references posting rule ${ruleId}, which is not defined in POSTING_RULE_REGISTRY (D-ACCT-SCHEMA-CANONICAL-HOME).`,
          severity: ENFORCING ? "fail" : "warn",
        });
      }
    }
  }
  return asserted;
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

export async function run(): Promise<ReconResult> {
  const result = emptyResult(PIPELINE);
  let asserted = 0;
  asserted += assertSchemaReexport(result.violations);
  asserted += await assertSingleCoaSource(result.violations);
  asserted += await assertTreatmentPostingRulesResolve(result.violations);
  result.asserted = asserted;
  result.ok = !result.violations.some((v) => v.severity === "fail");
  return result;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  const warns = result.violations.filter((v) => v.severity === "warn");
  const mode = ENFORCING ? "ENFORCING" : "ADVISORY";
  if (result.violations.length > 0) {
    console.error(
      `\n${PIPELINE} (${mode}): ${result.asserted} asserted, ${fails.length} fail / ${warns.length} warn:\n`,
    );
    for (const v of result.violations) {
      console.error(`  [${v.severity}] ${v.subject}: ${v.message}`);
    }
    if (!result.ok) process.exit(1);
    console.log(
      `\n${PIPELINE} (${mode}): advisory — exiting 0 (warnings above are the scope map).`,
    );
  } else {
    console.log(`${PIPELINE} (${mode}): ${result.asserted} asserted, no violations`);
  }
}
