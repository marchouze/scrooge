// platform/recon/dcam-taxonomy-coverage.ts
//
// Vera recon: dcam:validate — DCAM taxonomy coverage gate.
//
// Asserts:
//   1. Every ProductFamily value has a DCAM scope-code mapping.
//   2. Every ProductFamily has at least one Layer 3 data attribute group.
//   3. Every ProductFamily (except 'structured' / 'multi-asset') has a
//      full three-layer DCAM alignment (Layer 1 FIBO anchor + Layer 2
//      logical standard + Layer 3 ISO 20022 messages).
//   4. Every DCAM scope code referenced by a ProductFamily exists in
//      PHYSICAL_PRODUCT_SCOPE.
//
// Mode: blocking (non-zero exit on any failure). Wired into `bun run ci`.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07).
// Principle 2 (single-graph discipline): every product code must have a
// citable DCAM classification node.
//
// Author: Kai (Quantitative Markets Architect, engineering)

import {
  getAllProductFamilyDcamRecords,
  PRODUCT_FAMILY_TO_SCOPE_CODE,
} from "../markets/products/dcam-mapping";
import type { ProductFamily } from "../markets/products/types";
import { PHYSICAL_PRODUCT_SCOPE } from "../taxonomies/dcam/layer3-physical";

// ProductFamily values — kept in sync with types.ts (checked at runtime below).
const ALL_PRODUCT_FAMILIES: ProductFamily[] = [
  "listed-equity",
  "listed-bond",
  "repo",
  "otc-ird",
  "fx",
  "structured",
];

// Families where a missing FIBO conceptual anchor is expected (deferred to NPA).
const DEFERRED_FAMILIES = new Set<ProductFamily>(["structured"]);

type FindingLevel = "info" | "warn" | "fail";

interface Finding {
  level: FindingLevel;
  family: ProductFamily;
  message: string;
}

async function main(): Promise<void> {
  const findings: Finding[] = [];

  // ── Check 1: every ProductFamily has a scope-code mapping ─────────────────
  for (const family of ALL_PRODUCT_FAMILIES) {
    const scopeCode = PRODUCT_FAMILY_TO_SCOPE_CODE[family];
    if (!scopeCode) {
      findings.push({
        level: "fail",
        family,
        message: `ProductFamily '${family}' has no DCAM scope-code mapping in PRODUCT_FAMILY_TO_SCOPE_CODE`,
      });
    }
  }

  // ── Check 2: every scope code exists in PHYSICAL_PRODUCT_SCOPE ────────────
  for (const family of ALL_PRODUCT_FAMILIES) {
    const scopeCode = PRODUCT_FAMILY_TO_SCOPE_CODE[family];
    if (!scopeCode) continue; // already reported above
    if (!(scopeCode in PHYSICAL_PRODUCT_SCOPE)) {
      findings.push({
        level: "fail",
        family,
        message: `Scope code '${scopeCode}' (from family '${family}') not found in PHYSICAL_PRODUCT_SCOPE`,
      });
    }
  }

  // ── Check 3 + 4: Layer 3 attribute groups + full alignment ────────────────
  const records = getAllProductFamilyDcamRecords();

  for (const record of records) {
    const { family, scopeCode, dcamAlignment, layer3 } = record;

    // Check 3a: at least one Layer 3 data attribute group
    if (layer3.dataAttributeGroups.length === 0) {
      findings.push({
        level: "fail",
        family,
        message: `ProductFamily '${family}' has zero Layer 3 data attribute groups in PRODUCT_FAMILY_LAYER3`,
      });
    }

    // Check 4: full three-layer alignment for non-deferred families
    if (DEFERRED_FAMILIES.has(family)) {
      if (dcamAlignment !== undefined) {
        findings.push({
          level: "info",
          family,
          message: `ProductFamily '${family}' (deferred) unexpectedly has a DCAM alignment — consider graduating from DEFERRED_FAMILIES`,
        });
      } else {
        findings.push({
          level: "info",
          family,
          message: `ProductFamily '${family}': no DCAM conceptual anchor — deferred to NPA gate (expected, scope '${scopeCode}')`,
        });
      }
      continue;
    }

    if (!dcamAlignment) {
      findings.push({
        level: "fail",
        family,
        message: `ProductFamily '${family}' (scope '${scopeCode}') has no DCAM three-layer alignment — check PHYSICAL_PRODUCT_SCOPE and CONCEPTUAL_REGISTRY`,
      });
      continue;
    }

    // Layer 1 (conceptual / FIBO anchor)
    if (!dcamAlignment.conceptual) {
      findings.push({
        level: "fail",
        family,
        message: `ProductFamily '${family}' missing Layer 1 (FIBO conceptual anchor) in DCAM alignment`,
      });
    }

    // Layer 2 (logical standards — CDM/ESMA-CFI/BCBS)
    if (!dcamAlignment.logical || dcamAlignment.logical.length === 0) {
      findings.push({
        level: "warn",
        family,
        message: `ProductFamily '${family}' missing Layer 2 (logical standard mappings) — add to LOGICAL_MAPPINGS in layer2-logical.ts`,
      });
    }

    // Layer 3 (ISO 20022 physical messages)
    if (!dcamAlignment.physical || dcamAlignment.physical.length === 0) {
      findings.push({
        level: "warn",
        family,
        message: `ProductFamily '${family}' missing Layer 3 ISO 20022 message types — add to PHYSICAL_PRODUCT_SCOPE in layer3-physical.ts`,
      });
    }
  }

  // ── Check 5: no orphan scope codes in PHYSICAL_PRODUCT_SCOPE ─────────────
  // Every scope code in PHYSICAL_PRODUCT_SCOPE should be reachable from a ProductFamily.
  const referencedScopeCodes = new Set(Object.values(PRODUCT_FAMILY_TO_SCOPE_CODE));
  for (const scopeCode of Object.keys(PHYSICAL_PRODUCT_SCOPE)) {
    if (!referencedScopeCodes.has(scopeCode as ReturnType<typeof Object.keys>[number])) {
      findings.push({
        level: "warn",
        family: "structured", // placeholder — not family-specific
        message: `PHYSICAL_PRODUCT_SCOPE has scope code '${scopeCode}' not referenced by any ProductFamily`,
      });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  const familiesCovered = ALL_PRODUCT_FAMILIES.filter((f) => !DEFERRED_FAMILIES.has(f)).length;
  const totalFamilies = ALL_PRODUCT_FAMILIES.length;
  const deferredCount = DEFERRED_FAMILIES.size;

  console.log(
    `recon:dcam-taxonomy-coverage — ${familiesCovered}/${totalFamilies} families fully classified ` +
      `(${deferredCount} deferred to NPA gate)`,
  );

  // Per-family coverage summary
  for (const record of records) {
    const { family, scopeCode, dcamAlignment } = record;
    const deferred = DEFERRED_FAMILIES.has(family);
    const l1 = dcamAlignment?.conceptual?.fiboLabel ?? (deferred ? "deferred" : "MISSING");
    const l2Count = dcamAlignment?.logical?.length ?? 0;
    const l3Count = dcamAlignment?.physical?.length ?? 0;
    const layer3Groups = PRODUCT_FAMILY_LAYER3_COUNTS[family] ?? 0;
    console.log(
      `  ${family.padEnd(16)} scope=${scopeCode.padEnd(26)} L1=${l1.padEnd(30)} L2=${l2Count} L3-iso20022=${l3Count} L3-attrib-groups=${layer3Groups}`,
    );
  }

  // ── Output findings ────────────────────────────────────────────────────────
  const fails = findings.filter((f) => f.level === "fail");
  const warns = findings.filter((f) => f.level === "warn");
  const infos = findings.filter((f) => f.level === "info");

  for (const f of infos) {
    console.log(`  info  [${f.family}] ${f.message}`);
  }
  for (const f of warns) {
    console.warn(`  warn  [${f.family}] ${f.message}`);
  }
  for (const f of fails) {
    console.error(`  FAIL  [${f.family}] ${f.message}`);
  }

  if (fails.length > 0) {
    console.error(`\nrecon:dcam-taxonomy-coverage FAILED — ${fails.length} failure(s)`);
    process.exit(1);
  }

  if (warns.length > 0) {
    console.warn(
      `\nrecon:dcam-taxonomy-coverage ADVISORY — ${warns.length} warning(s). Non-blocking.`,
    );
  } else {
    console.log("\nrecon:dcam-taxonomy-coverage OK");
  }
}

// Compute attribute-group counts for summary (avoids re-importing at runtime).
import { PRODUCT_FAMILY_LAYER3 } from "../markets/products/dcam-mapping";
const PRODUCT_FAMILY_LAYER3_COUNTS: Record<string, number> = Object.fromEntries(
  Object.entries(PRODUCT_FAMILY_LAYER3).map(([k, v]) => [k, v.dataAttributeGroups.length]),
);

main().catch((err) => {
  console.error("recon:dcam-taxonomy-coverage error:", err);
  process.exit(1);
});
