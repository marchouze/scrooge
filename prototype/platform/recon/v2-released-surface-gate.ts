// platform/recon/v2-released-surface-gate.ts
//
// LOAD-BEARING STRUCTURAL GATE — the released-surface clean-core boundary (V2 S5).
//
// This gate enforces the K/R/C tier structure (D-V2-BBAAS-TIER-STRUCTURE) at the
// code level. It FAILS CI if:
//
//   (a) TIER LEAK: Any export in `v2-core/index.ts` annotated `@tier K` appears
//       in the R or C surface lists of RELEASED_SURFACE. K-internal types must
//       never bleed into the regulated-tenant or commercial surface.
//
//   (b) UNANNOTATED: Any `export * from` line in `v2-core/index.ts` lacks a
//       `@tier K|R|C` JSDoc annotation in the immediately preceding comment block.
//       Every export must be classified.
//
// WHY this gate lives in v1 infra: recon infrastructure (`node:fs`, ./types)
// is v1 code; v2-core must not import it. This gate checks v2-core FROM the
// v1 side. The dependency direction v1→v2 is the permitted one. A regression
// test (`v2-released-surface-gate.test.ts`) constructs both a clean and a
// violating manifest to prove the gate works.
//
// Token convention: tokens in RELEASED_SURFACE match the relative path in
// `v2-core/index.ts` after stripping the leading `./`.
//   "./fil-core/primitives"    → "fil-core/primitives"
//   "./fil-facets/facets"      → "fil-facets/facets"
//   "./fil-models/registry"    → "fil-models/registry"
//
// Authority: D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Principle 2 (single-graph discipline — tier topology is a topology invariant).
// Author: Vera (Internal Audit Engineer, governance).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

/** Absolute path to v2-core/index.ts. */
const V2_INDEX_PATH = resolve(import.meta.dir, "..", "..", "v2-core", "index.ts");

/** Tier labels understood by this gate. */
export type TierLabel = "K" | "R" | "C";

/**
 * A parsed export entry from v2-core/index.ts: the module path token and the
 * tier annotation found in the JSDoc immediately above the export line.
 */
export interface ParsedExport {
  /** The `./rel/path` extracted from `export * from "./rel/path"`. */
  relPath: string;
  /**
   * Token used in RELEASED_SURFACE manifest comparison.
   * Convention: relPath stripped of leading `./`.
   *   "./fil-core/primitives" → "fil-core/primitives"
   *   "./fil-facets/facets"   → "fil-facets/facets"
   */
  token: string;
  /**
   * Tier annotation found in the JSDoc immediately before this export line.
   * `null` if no `@tier` tag was present (a violation).
   */
  tier: TierLabel | null;
  /** The source line number (1-based) for diagnostic messages. */
  lineNo: number;
}

/**
 * The minimal surface manifest shape that the gate works against.
 * Matches the structure of `RELEASED_SURFACE` in `v2-core/released-surface.ts`,
 * but expressed as plain arrays so callers can pass synthetic manifests in tests.
 */
export interface SurfaceManifest {
  K: { kOnlyExports: string[] };
  R: { exports: string[] };
  C: { exports: string[] };
}

/** @internal — exported for tests only. */
export function parseIndexExports(src: string): ParsedExport[] {
  const lines = src.split("\n");
  const result: ParsedExport[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match: `export * from "./some/path";` (with optional semicolon)
    const exportMatch = line.match(/^\s*export\s+\*\s+from\s+["'](\.[^"']+)["']/);
    if (!exportMatch) continue;

    const relPath = exportMatch[1];
    // Token: strip the leading "./" from the relative path.
    const token = relPath.replace(/^\.\//, "");

    // Scan backwards for a `@tier` tag in the JSDoc immediately above.
    // Rules: scan up to 8 lines back; stop if we hit a non-comment non-blank
    // line that is not part of the JSDoc block (e.g. another export statement
    // or a non-comment code line), but continue through blank lines ONLY if
    // we have not yet left the comment block.
    let tier: TierLabel | null = null;
    let inCommentBlock = false;
    for (let j = i - 1; j >= 0 && j >= i - 8; j--) {
      const prev = lines[j].trim();

      // A line that starts an export means we've gone past the JSDoc.
      if (prev.startsWith("export ") || prev.startsWith("export*")) break;

      // Empty line: if we haven't entered a comment block yet, it's the gap
      // between this export and any comment above — skip it. If we're inside
      // a comment block that ends with `*/`, we'd have broken already.
      if (prev === "") {
        // If we already found we're inside a JSDoc block, an empty line ends it.
        if (inCommentBlock) break;
        // Otherwise skip the blank separator line and keep looking.
        continue;
      }

      // Detect JSDoc comment lines.
      if (
        prev.startsWith("/**") ||
        prev.startsWith("*") ||
        prev.startsWith("//")
      ) {
        inCommentBlock = true;
        const tierMatch = prev.match(/@tier\s+([KRC](?:\s*\|\s*[KRC])*)/);
        if (tierMatch) {
          // Take the first tier listed as the authoritative annotation.
          const tiers = tierMatch[1].split(/\s*\|\s*/) as TierLabel[];
          tier = tiers[0] as TierLabel;
          break;
        }
        // End of JSDoc block (`/**` on a single line opens it, `*/` closes it).
        if (prev.endsWith("*/")) {
          // Keep scanning into the block.
        }
        continue;
      }

      // Any other non-blank, non-comment line means we've left the comment context.
      break;
    }

    result.push({ relPath, token, tier, lineNo: i + 1 });
  }

  return result;
}

/**
 * Run the released-surface clean-core gate against the given manifest and
 * parsed exports. This is the core logic, separated from file I/O so tests
 * can drive it with synthetic data.
 */
export function runGate(
  exports: ParsedExport[],
  manifest: SurfaceManifest,
): { violations: ReconViolation[]; asserted: number } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  for (const exp of exports) {
    asserted += 1;

    // (b) UNANNOTATED check
    if (exp.tier === null) {
      violations.push({
        subject: `v2-core/index.ts:${exp.lineNo}`,
        message: `export \`${exp.relPath}\` has no @tier annotation — every export must be classified as K, R, or C`,
        severity: "fail",
      });
      continue; // Can't do tier-leak check without a tier.
    }

    // (a) TIER LEAK check: K-only exports must not appear in R or C surface.
    if (exp.tier === "K") {
      if (manifest.R.exports.includes(exp.token)) {
        violations.push({
          subject: `v2-core/index.ts:${exp.lineNo}`,
          message: `K-internal export \`${exp.token}\` (${exp.relPath}) appears in the R-tier surface — K-internal types must not bleed into regulated-tenant surface`,
          severity: "fail",
        });
      }
      if (manifest.C.exports.includes(exp.token)) {
        violations.push({
          subject: `v2-core/index.ts:${exp.lineNo}`,
          message: `K-internal export \`${exp.token}\` (${exp.relPath}) appears in the C-tier surface — K-internal types must not bleed into commercial-SaaS surface`,
          severity: "fail",
        });
      }
    }
  }

  return { violations, asserted };
}

/** Runs the gate against the real v2-core/index.ts and RELEASED_SURFACE manifest. */
export function run(): ReconResult {
  const result = emptyResult("v2-released-surface-clean-core");

  // Import the manifest from v2-core — safe because we are v1 infra reading a
  // pure-data module (no node builtins in released-surface.ts).
  let manifest: SurfaceManifest;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(resolve(import.meta.dir, "..", "..", "v2-core", "released-surface.ts")) as {
      RELEASED_SURFACE: SurfaceManifest;
    };
    manifest = mod.RELEASED_SURFACE;
  } catch (err) {
    result.violations = [
      {
        subject: "v2-core/released-surface.ts",
        message: `Could not load RELEASED_SURFACE manifest: ${err instanceof Error ? err.message : String(err)}`,
        severity: "fail",
      },
    ];
    return { ...result, ok: false };
  }

  let src: string;
  try {
    src = readFileSync(V2_INDEX_PATH, "utf8");
  } catch (err) {
    result.violations = [
      {
        subject: "v2-core/index.ts",
        message: `Could not read v2-core/index.ts: ${err instanceof Error ? err.message : String(err)}`,
        severity: "fail",
      },
    ];
    return { ...result, ok: false };
  }

  const exports = parseIndexExports(src);
  const { violations, asserted } = runGate(exports, manifest);

  result.asserted = asserted;
  result.violations = violations;
  return { ...result, ok: violations.length === 0 };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(
    `recon:v2-released-surface-clean-core — asserted ${r.asserted} exports in v2-core/index.ts; ${r.violations.length} violation(s)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
