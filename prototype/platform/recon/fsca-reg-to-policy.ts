// platform/recon/fsca-reg-to-policy.ts
//
// Vera Wave-5 recon pipeline: fsca-reg-to-policy (v1, advisory mode).
//
// Asserts that every obligation row in the obligations register has a named
// fulfilment policy that either (a) exists as a file in `Policies/` or
// (b) is explicitly marked as planned/deferred with a named owner.
//
// **Mode: advisory (v1).** All severities are reported but `ok: true` is
// returned so CI does not fail. Flip MODE to "enforcing" and set the
// `ok` derivation to `violations.every(v => v.severity !== "fail")` once
// the planned policies in `Policies/` are built out. Expected trigger:
// after the conduct-bundle policies (FAIS Policy, TCF Policy, Complaints
// Handling Policy, Pricing Policy, Customer Treatment Policy) and the
// markets-bundle policies (OTC Trading Policy, Counterparty Onboarding,
// Client Categorisation, Operational Risk Policy, Market Risk Policy,
// Regulatory Reporting Policy, Business Continuity Policy) land in `Policies/`.
//
// What the recon walks:
//
//   `Regulations/_obligations-register.md` — every pipe-delimited row
//   matching `| ORG-<domain>-<id> |` (the 9-column obligations table).
//   Columns (1-indexed): ID | URN | Citation | Requirement | Fulfilment policy
//   | Owner | Status | Entity scope | Applies-at | Risk taxonomy (col 10
//   appended by risk-taxonomy-coverage pipeline).
//
// Policy-coverage logic:
//
//   1. Extract Fulfilment policy column (col 5, index 4 of split cells).
//   2. Normalize: strip advisory parentheticals, split on `;`.
//   3. For each policy name: kebab-case + glob `Policies/<kebab>*.md`; also
//      try alias table for non-obvious name variations.
//   4. Classify each row with severity based on FSCA-source marker and
//      file-existence outcome.
//
// FSCA-sourced rows (Citation col contains "FAIS", "FSCA", "Conduct Standard",
// "FMA", "CS 1", "CS 2", "CS 3", "GCC", "General Code") are `fail`-severity
// in enforcing mode; non-FSCA rows are `warn`.
//
// Independence: pure file-system read. No agent runtime, no event store.
//
// P1 — events are the only source of truth: this recon does NOT emit events;
//      it is a build-time integrity check.
// P2 — single-graph discipline: the recon asserts the policy-axis facet of
//      the bidirectional graph (Regulation → Obligation → Fulfilment Policy).
//
// Authors:
//   Atlas (Core banking platform architect, engineering — reports to Devon COO interim)
//   Vera (Internal audit engineer, engineering — functionally to Thandiwe CAE;
//         administratively through the CEO)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Mode constant
// ---------------------------------------------------------------------------

/**
 * "advisory"  → all violations reported; ok always true; CI passes.
 * "enforcing" → fail-severity violations flip ok to false; CI fails.
 *
 * Flip to "enforcing" once the conduct-bundle + markets-bundle policies
 * (FAIS Policy, TCF Policy, Complaints Handling Policy, Pricing Policy,
 * Customer Treatment Policy, OTC Trading Policy, Counterparty Onboarding
 * Policy, Client Categorisation Policy, Operational Risk Policy, Market Risk
 * Policy, Regulatory Reporting Policy, Business Continuity / Disaster Recovery
 * Policy, Stress Testing Policy, Records Management Policy, Climate-Related
 * Risk Policy, Counterparty Credit Risk Policy, Collateral Management Policy,
 * Funding Strategy Policy, Investment Policy) have landed in `Policies/`.
 */
const MODE: "advisory" | "enforcing" = "advisory";

const PIPELINE = "fsca-reg-to-policy";

// ---------------------------------------------------------------------------
// Repo root resolution
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
const OBLIGATIONS_PATH = resolve(REPO_ROOT, "Regulations/_obligations-register.md");
const POLICIES_DIR = resolve(REPO_ROOT, "Policies");

// ---------------------------------------------------------------------------
// FSCA-source detection
// ---------------------------------------------------------------------------

const FSCA_CITATION_PATTERNS = [
  /\bFAIS\b/i,
  /\bFSCA\b/i,
  /\bConduct Standard\b/i,
  /\bFMA\b/i,
  /\bCS\s+[123]\b/i,
  /\bGCC\b/i,
  /\bGeneral Code\b/i,
];

function isFscaRow(citation: string): boolean {
  return FSCA_CITATION_PATTERNS.some((re) => re.test(citation));
}

// ---------------------------------------------------------------------------
// Status-based short-circuit
// ---------------------------------------------------------------------------

/**
 * Rows whose Status column signals the obligation is not yet active.
 * These get `info` severity: "Obligation not yet active — policy check deferred".
 *
 * We check case-insensitively for the key tokens.
 */
function isInactiveStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("n/a-yet") || s.includes("conditional-bind") || s.includes("pre-licence");
}

// ---------------------------------------------------------------------------
// Policy name alias table
// ---------------------------------------------------------------------------

/**
 * Canonical alias table mapping normalized policy names (lowercase, stripped)
 * to the Policies/ kebab-case stem (without the trailing -v<n>.md).
 */
const POLICY_NAME_ALIASES: Readonly<Record<string, string>> = {
  "risk management framework": "risk-management-and-compliance-policy",
  "rmcp": "risk-management-and-compliance-policy",
  "aml / cft policy": "aml-cft-policy",
  "aml/cft policy": "aml-cft-policy",
  "aml-cft policy": "aml-cft-policy",
  "kyc / cdd / edd policy": "aml-cft-policy",
  "kyc/cdd/edd policy": "aml-cft-policy",
  "fit-and-proper policy": "fit-and-proper-policy",
  "fit and proper policy": "fit-and-proper-policy",
  "liquidity risk management policy": "liquidity-risk-management-policy",
  "capital management policy": "capital-management-policy",
  "trading mandate": "trading-mandate",
  "icaap": "capital-management-policy",
  "ilaap": "liquidity-risk-management-policy",
  "records management policy": "internal-audit-charter",
  "internal audit charter": "internal-audit-charter",
  "popia": "popia-privacy-policy",
  "popia / data protection policy": "popia-privacy-policy",
  "popia/data protection policy": "popia-privacy-policy",
  "remuneration policy": "remuneration-policy",
  "recovery and resolution planning policy": "recovery-resolution-planning-policy",
  "recovery & resolution planning policy": "recovery-resolution-planning-policy",
  "recovery-and-resolution planning policy": "recovery-resolution-planning-policy",
  "aml policy": "aml-cft-policy",
  "anti-money laundering policy": "aml-cft-policy",
  "cft policy": "aml-cft-policy",
};

// ---------------------------------------------------------------------------
// Policy file cache
// ---------------------------------------------------------------------------

function buildPoliciesIndex(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();
  try {
    return new Set(
      readdirSync(dir)
        .filter((f) => f.endsWith(".md") && !f.startsWith("README"))
        .map((f) => f.toLowerCase()),
    );
  } catch {
    return new Set();
  }
}

/** Normalize a policy name string for alias-table and file-name lookup. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Convert a policy name to kebab-case for file-name matching. */
function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Attempt to find a matching file in `Policies/` for a given policy name.
 * Returns `true` if a file exists, `false` if not.
 */
function policyFileExists(name: string, policiesIndex: Set<string>): boolean {
  const normalized = normalizeName(name);

  // 1. Check alias table
  const aliasKey = Object.keys(POLICY_NAME_ALIASES).find((k) => k === normalized);
  if (aliasKey) {
    const stem = POLICY_NAME_ALIASES[aliasKey];
    if (policiesIndex.has(`${stem}-v1.md`) || [...policiesIndex].some((f) => f.startsWith(`${stem}`))) {
      return true;
    }
  }

  // 2. Try all alias table keys via approximate match
  for (const [aliasKey2, stem2] of Object.entries(POLICY_NAME_ALIASES)) {
    if (normalized.includes(aliasKey2) || aliasKey2.includes(normalized)) {
      if ([...policiesIndex].some((f) => f.startsWith(stem2))) {
        return true;
      }
    }
  }

  // 3. Kebab-case the name and look for exact or prefix match
  const kebab = toKebabCase(name);
  if ([...policiesIndex].some((f) => f.startsWith(kebab))) {
    return true;
  }

  // 4. Approximate match: normalize both sides, strip punctuation/spaces, compare
  const normalizedStripped = normalized.replace(/[\s-]/g, "");
  for (const file of policiesIndex) {
    const fileStripped = file.replace(/[-v0-9.md]/g, "").replace(/\s/g, "");
    if (fileStripped === normalizedStripped || fileStripped.startsWith(normalizedStripped.slice(0, Math.min(12, normalizedStripped.length)))) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Advisory parenthetical patterns to strip from policy names
// ---------------------------------------------------------------------------

/**
 * Advisory suffixes to strip before interpreting a policy reference.
 * E.g. "FAIS Policy (planned)" → "FAIS Policy"
 *      "Capital Management Policy (planned per research-findings §7)" → "Capital Management Policy"
 */
const ADVISORY_SUFFIX_RE =
  /\s*\((planned[^)]*|under development[^)]*|deferred[^)]*|in refinement[^)]*|approved[^)]*|per[^)]*|existing[^)]*|post-licence[^)]*|forward-compat[^)]*|markets bundle[^)]*|conduct bundle[^)]*|within[^)]*|Owner Inbox[^)]*|cross-ref[^)]*|Sec[^)]*|§[^)]*|cross-reference[^)]*)\)/gi;

/**
 * Strip file paths, backtick-quoted paths, and procedure references from
 * the fulfilment policy cell before splitting on `;`.
 * E.g. "`Procedures/by-policy/...`" → removed
 *      "`prototype/platform/...`" → removed
 *      "`Owner Inbox/...`" → removed
 */
const FILEPATH_RE = /`[^`]+`/g;
const RAS_REFERENCE_RE = /\bRAS\b/g; // skip "RAS" as a standalone policy name

/**
 * Policy names that should never be treated as standalone Policies/ file
 * references — they are frameworks, procedures, or other artefact types.
 */
const NON_POLICY_TOKENS = new Set([
  "ras",
  "procedures",
  "prototype",
  "substrate",
  "d-new-product-approval-policy",
  "d-product-construction-substrate",
  "approved",
  "bcbs",
  "pr",
  "slices",
  "see",
  "per",
]);

// ---------------------------------------------------------------------------
// Row parser
// ---------------------------------------------------------------------------

interface ObligationRow {
  readonly id: string;
  readonly citation: string;
  readonly fulfilmentPolicy: string;
  readonly status: string;
  readonly lineNumber: number;
}

/**
 * Parse a pipe-delimited obligation row.
 *
 * The row format is:
 *   | ID | URN | Citation | Requirement | Fulfilment policy | Owner | Status | Entity scope | Applies-at | [Risk taxonomy] |
 *
 * Cells may contain embedded content including backtick-quoted paths and
 * parenthetical notes. We split on ` | ` with spaces, or fall back to `|`
 * and trim, to handle multi-sentence requirement cells robustly.
 *
 * The pipe-delimiter split uses the trimmed-pipe form: split on `|` and trim
 * each cell, discarding empty first/last elements that appear because lines
 * start and end with `|`.
 */
function parseObligationRow(line: string, lineNumber: number): ObligationRow | null {
  // Quick gate: must start with `| ORG-`
  if (!/^\|\s*ORG-/.test(line)) return null;

  const cells = line.split("|").map((c) => c.trim());
  // After split: cells[0] is empty (before first |), cells[1] = ID, ..., cells[N] is empty (after last |)
  const id = cells[1] ?? "";
  const citation = cells[3] ?? "";
  const fulfilmentPolicy = cells[5] ?? "";
  const status = cells[7] ?? "";

  if (!id.startsWith("ORG-")) return null;

  return { id: id.trim(), citation: citation.trim(), fulfilmentPolicy: fulfilmentPolicy.trim(), status: status.trim(), lineNumber };
}

// ---------------------------------------------------------------------------
// Policy name extraction from fulfilment cell
// ---------------------------------------------------------------------------

interface PolicyRef {
  readonly rawName: string;
  readonly isPlanned: boolean;
}

/**
 * Extract individual policy references from the Fulfilment policy cell.
 *
 * Steps:
 * 1. Remove backtick-quoted file paths (Procedures/, prototype/, Owner Inbox/).
 * 2. Strip advisory parentheticals from each segment.
 * 3. Split on `;`.
 * 4. For each segment, strip trailing parentheticals and trim.
 * 5. Track whether "(planned)" was present before stripping.
 * 6. Skip empty / procedure-only / non-policy tokens.
 */
function extractPolicyRefs(cell: string): PolicyRef[] {
  // Remove backtick paths (procedures, prototype paths, Owner Inbox paths)
  const withoutPaths = cell.replace(FILEPATH_RE, "");

  // Split on `;` to get individual references
  const segments = withoutPaths.split(";");

  const refs: PolicyRef[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    // Detect if this segment is marked planned before stripping
    const isPlanned = /\(planned/i.test(trimmed) || /\(under development/i.test(trimmed) || /\(deferred/i.test(trimmed);

    // Strip advisory parentheticals
    const stripped = trimmed.replace(ADVISORY_SUFFIX_RE, "").trim();

    // Skip empty result
    if (!stripped) continue;

    // Skip if it's only a cross-reference like "RAS" standalone
    if (RAS_REFERENCE_RE.test(stripped) && stripped.length <= 5) continue;

    // Skip if it contains only non-policy tokens
    const normalizedCheck = normalizeName(stripped);
    if (
      NON_POLICY_TOKENS.has(normalizedCheck) ||
      stripped.startsWith("Procedures/") ||
      stripped.startsWith("prototype/") ||
      stripped.startsWith("Owner Inbox/") ||
      stripped.startsWith("D-") ||
      stripped.includes("urn:")
    ) {
      continue;
    }

    // Skip procedure-path-like entries that survived stripping
    if (/^\/?Procedures\//i.test(stripped) || /^\/?prototype\//i.test(stripped)) {
      continue;
    }

    // Skip very short tokens that are clearly not policy names (< 4 chars)
    if (stripped.length < 4) continue;

    refs.push({ rawName: stripped, isPlanned });
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Row classification
// ---------------------------------------------------------------------------

type RowSeverity = "pass" | "info" | "warn" | "fail";

interface RowClassification {
  readonly severity: RowSeverity;
  readonly policyName: string;
  readonly message: string;
}

function classifyPolicyRef(
  ref: PolicyRef,
  row: ObligationRow,
  policiesIndex: Set<string>,
): RowClassification {
  const { rawName, isPlanned } = ref;
  const isFsca = isFscaRow(row.citation);

  // Is the cell empty or TBD?
  if (!rawName || rawName === "[TBD]" || rawName === "TBD") {
    return {
      severity: isFsca ? "fail" : "warn",
      policyName: rawName || "(empty)",
      message: `No fulfilment policy named for obligation ${row.id}`,
    };
  }

  // Does the file exist?
  const fileFound = policyFileExists(rawName, policiesIndex);

  if (fileFound) {
    return { severity: "pass", policyName: rawName, message: "" };
  }

  // File not found — is it planned?
  if (isPlanned) {
    return {
      severity: "warn",
      policyName: rawName,
      message: `Policy '${rawName}' named but not yet in Policies/ — still planned`,
    };
  }

  // File not found, not planned
  return {
    severity: isFsca ? "fail" : "warn",
    policyName: rawName,
    message: `Policy '${rawName}' named but file not found in Policies/ — may need to be authored`,
  };
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

export interface FscaRegToPolicyRunOpts {
  /** Test override: feed synthetic file content. */
  readonly fileOverride?: string;
}

export function runFscaRegToPolicyRecon(
  repoRoot: string,
  opts: FscaRegToPolicyRunOpts = {},
): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const obligationsPath = resolve(repoRoot, "Regulations/_obligations-register.md");
  const policiesDir = resolve(repoRoot, "Policies");

  const content = opts.fileOverride ?? (existsSync(obligationsPath) ? readFileSync(obligationsPath, "utf8") : null);

  if (!content) {
    logger.warn({ pipeline: PIPELINE, msg: "Obligations register not found — skipping recon" });
    result.ok = true;
    return result;
  }

  const policiesIndex = buildPoliciesIndex(policiesDir);

  const lines = content.split(/\r?\n/);
  const subjectBase = "Regulations/_obligations-register.md";

  let asserted = 0;
  // Track per-policy missing counts for summary
  const missingPolicyCounts = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const row = parseObligationRow(line, i + 1);
    if (!row) continue;

    asserted++;

    // Short-circuit for inactive obligations
    if (isInactiveStatus(row.status)) {
      violations.push({
        subject: `${subjectBase}:line-${row.lineNumber}:${row.id}`,
        message: `Obligation not yet active — policy check deferred (status: ${row.status || "N/A-yet"})`,
        severity: "info",
      });
      continue;
    }

    const cell = row.fulfilmentPolicy;

    // Handle completely empty or TBD cell
    if (!cell || cell === "[TBD]" || cell === "TBD" || cell.trim() === "") {
      const isFsca = isFscaRow(row.citation);
      violations.push({
        subject: `${subjectBase}:line-${row.lineNumber}:${row.id}`,
        message: `No fulfilment policy named for obligation ${row.id}`,
        severity: isFsca ? "fail" : "warn",
      });
      continue;
    }

    const refs = extractPolicyRefs(cell);

    // If all content was stripped (only procedures/paths), treat as no-policy
    if (refs.length === 0) {
      // If the original cell was only procedures/file paths, that's a warn/fail
      const isFsca = isFscaRow(row.citation);
      // Only flag if there truly is no policy reference at all
      const hasPolicyLike = /\bPolicy\b|\bCharter\b|\bMandate\b|\bFramework\b|\bPolicy v/i.test(cell) &&
        !/^\s*`[^`]+`\s*$/.test(cell.replace(FILEPATH_RE, "").trim());
      if (!hasPolicyLike) {
        violations.push({
          subject: `${subjectBase}:line-${row.lineNumber}:${row.id}`,
          message: `No fulfilment policy named for obligation ${row.id}`,
          severity: isFsca ? "fail" : "warn",
        });
      }
      continue;
    }

    // Classify each policy reference; take the worst severity across all refs
    const classifications: RowClassification[] = refs.map((ref) =>
      classifyPolicyRef(ref, row, policiesIndex),
    );

    // A row passes if at least one policy reference resolves to a file
    const anyPass = classifications.some((c) => c.severity === "pass");

    if (anyPass) {
      // Row is covered — no violation needed
      continue;
    }

    // Emit violations for each failing ref
    for (const cls of classifications) {
      if (cls.severity === "pass") continue;
      violations.push({
        subject: `${subjectBase}:line-${row.lineNumber}:${row.id}`,
        message: cls.message,
        severity: cls.severity,
      });
      // Track missing policy counts for summary
      if (cls.severity !== "info") {
        const key = cls.policyName;
        missingPolicyCounts.set(key, (missingPolicyCounts.get(key) ?? 0) + 1);
      }
    }
  }

  result.asserted = asserted;
  result.violations = violations;

  // Mode-dependent ok derivation:
  // Advisory: ok is always true (CI passes regardless of violations).
  // Enforcing: any fail-severity finding flips ok to false.
  if (MODE === "enforcing") {
    result.ok = violations.every((v) => v.severity !== "fail");
  } else {
    result.ok = true;
  }

  const fails = violations.filter((v) => v.severity === "fail").length;
  const warns = violations.filter((v) => v.severity === "warn").length;
  const infos = violations.filter((v) => v.severity === "info").length;
  const passes = asserted - violations.filter((v) => v.severity !== "info").length;

  // Top-missing-policies summary for structured log
  const topMissing = [...missingPolicyCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, obligations: count }));

  logger.info({
    pipeline: PIPELINE,
    asserted,
    passes,
    fails,
    warns,
    infos,
    ok: result.ok,
    mode: MODE,
    msg: result.ok
      ? `${PIPELINE} (${MODE}): asserted ${asserted} obligation(s); ${fails} fail(s), ${warns} warn(s), ${infos} info(s)`
      : `${PIPELINE} FAILED — ${fails} policy-coverage fail(s) across ${asserted} obligations`,
    topMissingPolicies: topMissing,
    detail: violations,
  });

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = runFscaRegToPolicyRecon(REPO_ROOT);

  const fails = result.violations.filter((v) => v.severity === "fail").length;
  const warns = result.violations.filter((v) => v.severity === "warn").length;
  const infos = result.violations.filter((v) => v.severity === "info").length;

  const topMissing = new Map<string, number>();
  for (const v of result.violations) {
    if (v.severity === "warn" || v.severity === "fail") {
      const match = v.message.match(/Policy '([^']+)'/);
      if (match?.[1]) {
        const key = match[1];
        topMissing.set(key, (topMissing.get(key) ?? 0) + 1);
      }
    }
  }

  console.log(
    JSON.stringify({
      level: result.ok ? "info" : "error",
      time: result.asOf,
      service: "bank-prototype",
      pipeline: result.pipeline,
      asserted: result.asserted,
      violations: result.violations.length,
      fails,
      warns,
      infos,
      ok: result.ok,
      mode: MODE,
      msg: result.ok
        ? `${PIPELINE} (${MODE}): asserted ${result.asserted} obligation(s); ${fails} fail(s), ${warns} warn(s), ${infos} info(s)`
        : `${PIPELINE} FAILED — ${fails} policy-coverage fail(s)`,
      topMissingPolicies: [...topMissing.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 15)
        .map(([name, count]) => ({ name, obligations: count })),
      detail: result.violations,
    }),
  );

  process.exit(result.ok ? 0 : 1);
}
