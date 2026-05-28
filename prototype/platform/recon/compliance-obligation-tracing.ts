// platform/recon/compliance-obligation-tracing.ts
//
// Vera Wave-4 #13 — compliance-obligation-tracing.
//
// Asserts that each obligation in the obligations register that has a
// policy closure (Fulfilment-policy column populated) traces to a policy
// file that (a) exists in Policies/ and (b) itself references the
// obligation back (by obligation ID or a related citation key). This
// closes the Principle 2 single-graph discipline loop: obligations →
// policy → procedure → capability must be a bidirectional graph; one-way
// references leave the chain non-auditable.
//
// Checking direction:
//   1. Parse `_obligations-register.md` → collect all obligation rows
//      that have a non-empty Fulfilment-policy column.
//   2. For each such row, extract candidate policy file names from the
//      Fulfilment-policy cell. Match against known Policies/*.md files by:
//        (a) exact kebab-case slug match (e.g. "aml-cft-policy-v1")
//        (b) partial token match (e.g. "AML/CFT Policy" → aml-cft-policy-*)
//   3. For rows that resolve to at least one policy file, verify the
//      policy file contains the obligation ID (e.g. "ORG-FC-02") in its
//      body — confirming the back-reference.
//   4. Obligations whose Fulfilment-policy column is empty are skipped
//      (not all obligations have a closed policy yet — build-phase gap).
//   5. Violations:
//        - `warn` if the obligation names a policy but no matching file
//          is found in Policies/ (file missing — spec gap).
//        - `warn` if the policy file is found but does not back-reference
//          the obligation ID (one-way reference — graph discipline breach).
//
// All violations are `warn`-severity (build-phase tolerance; this pipeline
// surfaces graph-discipline gaps for grooming, not blocking CI).
//
// Authority:
//   - P2-SINGLE-GRAPH-DISCIPLINE (Principle 2)
//   - D-REGULATORY-READINESS-GATE-PLAN (CEO-approved 2026-05-10) §3
//   - D-POLICY-DOCUMENT-HOME (CEO-approved 2026-05-12)
//
// Author: Vera (Internal audit engineer, governance) — Wave-4 #13

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "compliance-obligation-tracing";

// ---------------------------------------------------------------------------
// Repo-root resolution
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

// ---------------------------------------------------------------------------
// Obligation row parsing (column layout from obligation-review-status)
// ---------------------------------------------------------------------------

interface ObligationRow {
  readonly id: string;
  readonly fulfilmentPolicy: string;
}

function parseObligationRows(content: string): ObligationRow[] {
  const rows: ObligationRow[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!/^\|\s*ORG-/.test(line)) continue;
    const cells = line.split("|").map((c) => c.trim());
    const id = cells[1] ?? "";
    if (!id.startsWith("ORG-")) continue;
    const fulfilmentPolicy = cells[5] ?? "";
    rows.push({ id, fulfilmentPolicy });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Policy file index
// ---------------------------------------------------------------------------

/**
 * Build a map of slug → absolute path for every Policies/*.md file.
 * Slug = basename without .md extension.
 */
function buildPolicyIndex(policiesDir: string): Map<string, string> {
  const index = new Map<string, string>();
  if (!existsSync(policiesDir)) return index;
  for (const f of readdirSync(policiesDir)) {
    if (!f.endsWith(".md") || f.startsWith("_") || f.startsWith(".")) continue;
    const slug = basename(f, ".md");
    index.set(slug, resolve(policiesDir, f));
  }
  return index;
}

// ---------------------------------------------------------------------------
// Policy resolution — find matching policy files from a fulfilment-policy
// cell value.
// ---------------------------------------------------------------------------

/**
 * Tokenise a string into lower-cased alpha-num tokens of ≥ 3 chars.
 */
function tokenise(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
}

/**
 * Given a fulfilment-policy cell value, return matching policy slugs from
 * the index. Matching strategy:
 *   1. If the cell contains a markdown link `[text](../Policies/slug.md)`,
 *      extract slug directly.
 *   2. Otherwise token-overlap: require ≥ 2 tokens from the cell to appear
 *      in the slug (minimises false positives).
 */
function resolveToSlugs(
  fulfilmentPolicy: string,
  policyIndex: ReadonlyMap<string, string>,
): string[] {
  const matched: string[] = [];

  // Strategy 1: extract explicit links `[...](../Policies/<slug>.md)`
  const linkRe = /\((?:\.\.\/)?Policies\/([^)]+)\.md\)/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: common regex loop pattern
  while ((m = linkRe.exec(fulfilmentPolicy)) !== null) {
    const slug = m[1];
    if (slug && policyIndex.has(slug)) matched.push(slug);
  }
  if (matched.length > 0) return [...new Set(matched)];

  // Strategy 2: token-overlap
  const cellTokens = new Set(tokenise(fulfilmentPolicy));
  for (const slug of policyIndex.keys()) {
    const slugTokens = tokenise(slug);
    const overlap = slugTokens.filter((t) => cellTokens.has(t));
    if (overlap.length >= 2) matched.push(slug);
  }
  return [...new Set(matched)];
}

// ---------------------------------------------------------------------------
// Back-reference check
// ---------------------------------------------------------------------------

/**
 * Return true if the policy file body contains the obligation ID string
 * (e.g. "ORG-FC-02") anywhere — confirming a back-reference.
 */
function hasBackReference(policyPath: string, obligationId: string): boolean {
  try {
    const content = readFileSync(policyPath, "utf8");
    return content.includes(obligationId);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ComplianceObligationTracingRunOpts {
  /** Override obligations content — used by tests. */
  readonly obligationsOverride?: string;
  /** Override policies directory — used by tests. */
  readonly policiesDirOverride?: string;
}

export function runComplianceObligationTracingRecon(
  repoRoot: string,
  opts: ComplianceObligationTracingRunOpts = {},
): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const obligationsPath = resolve(repoRoot, "Regulations/_obligations-register.md");
  const policiesDir = opts.policiesDirOverride ?? resolve(repoRoot, "Policies");

  const obligationsContent =
    opts.obligationsOverride ??
    (existsSync(obligationsPath) ? readFileSync(obligationsPath, "utf8") : null);

  if (!obligationsContent) {
    logger.warn({ pipeline: PIPELINE, msg: "Obligations register not found — skipping" });
    result.ok = true;
    return result;
  }

  const policyIndex = buildPolicyIndex(policiesDir);
  const obligations = parseObligationRows(obligationsContent);

  let asserted = 0;
  let traced = 0;
  let noFile = 0;
  let noBackRef = 0;

  for (const obl of obligations) {
    if (!obl.fulfilmentPolicy || obl.fulfilmentPolicy === "—" || obl.fulfilmentPolicy === "-") {
      // No policy closure claimed — skip (build-phase gap, not a violation)
      continue;
    }

    asserted++;
    const matchedSlugs = resolveToSlugs(obl.fulfilmentPolicy, policyIndex);

    if (matchedSlugs.length === 0) {
      violations.push({
        subject: `Regulations/_obligations-register.md:${obl.id}`,
        message: `Obligation ${obl.id} names fulfilment policy "${obl.fulfilmentPolicy}" but no matching file found in Policies/. Add the policy file or correct the fulfilment-policy cell. Build-phase tolerance: warn only.`,
        severity: "warn",
      });
      noFile++;
      continue;
    }

    // At least one file found — check at least one has a back-reference
    const slugsWithRef = matchedSlugs.filter((s) => {
      const path = policyIndex.get(s);
      return path !== undefined && hasBackReference(path, obl.id);
    });

    if (slugsWithRef.length === 0) {
      const fileList = matchedSlugs.map((s) => `Policies/${s}.md`).join(", ");
      violations.push({
        subject: `Regulations/_obligations-register.md:${obl.id}`,
        message: `Obligation ${obl.id} references policy file(s) [${fileList}] but none back-reference the obligation ID. Add "${obl.id}" to the policy's obligations closure list. Build-phase tolerance: warn only.`,
        severity: "warn",
      });
      noBackRef++;
    } else {
      traced++;
    }
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  logger.info({
    pipeline: PIPELINE,
    asserted,
    traced,
    noFile,
    noBackRef,
    msg: `${PIPELINE}: ${traced}/${asserted} obligations fully traced (policy found + back-reference confirmed)`,
  });

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = runComplianceObligationTracingRecon(REPO_ROOT);
  const warns = result.violations.filter((v) => v.severity === "warn");

  console.log(
    JSON.stringify({
      level: result.ok ? (warns.length ? "warn" : "info") : "error",
      time: result.asOf,
      service: "bank-prototype",
      pipeline: result.pipeline,
      asserted: result.asserted,
      violations: result.violations.length,
      ok: result.ok,
      msg: result.ok
        ? warns.length
          ? `${PIPELINE}: ${warns.length} obligation(s) with tracing gap — warn`
          : `${PIPELINE} passed`
        : `${PIPELINE} FAILED`,
      detail: result.violations,
    }),
  );
  process.exit(result.ok ? 0 : 1);
}
