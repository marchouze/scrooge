// platform/recon/obligation-policy-coverage.ts
//
// Advisory recon pipeline: obligation-policy-coverage.
//
// Walks `Regulations/_obligations-register.md` and reports how many
// reviewed (review-status in [`reviewed-confirmed`, `reviewed-modified`])
// bank-applicable (applicabilityScore ≥ 0.4) obligations have at least
// one fulfilment policy in `Policies/` with a frontmatter `closes:` entry
// pointing back to the obligation URN. Coverage % is grouped by domain
// (A..J) and uncovered obligations are listed as advisory findings.
//
// Coupling model — **asymmetric, measure-only**:
//   - Policies *opt in* to claiming obligation closure via frontmatter
//     `closes: [<obligation-urn>, ...]`. No obligation row claims its
//     fulfilment policy back. The recon walks the policies, not the
//     register.
//   - Special-case: obligation rows annotated `coverage: persisting-no-
//     policy` in their frontmatter-style cell suffix are excluded from
//     the gap list — these are explicitly informational obligations that
//     do not need a fulfilment policy.
//
// Mode: advisory (v1) — `ok: true` regardless of findings. The recon
// surfaces gaps; closure is a governance-seat workstream (Owen / Zara),
// not a CI gate. The recon graduates to enforcing once the LLM-pipeline
// closure of the review backlog stabilises.
//
// Authority:
//   - D-OBLIGATION-REVIEW-SUBSTRATE (CEO-approved 2026-05-21 via session
//     delegation).
//   - D-KG-GRAPHITI-ADOPT (CEO-approved 2026-05-21).
//   - P2-SINGLE-GRAPH-DISCIPLINE (Principle 2 — Policy → Obligation
//     closure is the policy-axis facet of the bidirectional graph).
//
// Authors:
//   - Atlas (Core banking platform architect, engineering)
//   - Vera (Internal audit engineer, engineering — third-line)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "obligation-policy-coverage";

const APPLICABILITY_FLOOR = 0.4;

const CITATIONS = [
  "D-OBLIGATION-REVIEW-SUBSTRATE",
  "D-KG-GRAPHITI-ADOPT",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P1-EVENTS-AS-TRUTH",
];

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
// Obligation parsing
// ---------------------------------------------------------------------------

interface ObligationRow {
  readonly id: string;
  readonly urn: string;
  readonly domain: string;
  readonly applicabilityScore: number | null;
  readonly reviewStatus: string;
  readonly coverageHint: string | null;
  readonly lineNumber: number;
}

/** Single-letter domain code derived from the obligation ID. */
function deriveDomain(id: string): string {
  // ORG-PR-* → A (Prudential), ORG-FC-* → B (FIC/AML), ORG-EXCON-* → C,
  // ORG-CY-* → E (Cyber), ORG-GV-* → F (Governance), ORG-MK-* / ORG-JSE-* → J,
  // ORG-RM-* → RM, ORG-FAIS-* / ORG-FAIS-RK-* → D / P (Conduct).
  const prefix = id.replace(/^ORG-/, "").split("-")[0] ?? "";
  switch (prefix) {
    case "PR":
      return "A";
    case "FC":
      return "B";
    case "EXCON":
    case "FX":
      return "C";
    case "CY":
      return "E";
    case "GV":
      return "F";
    case "MK":
    case "JSE":
      return "J";
    case "FAIS":
      return "D";
    case "RM":
      return "RM";
    case "BNK":
    case "GRP":
      return "Q";
    default:
      return "Z";
  }
}

/** Parse `applicabilityScore: 0.6` style suffix from any cell. */
function parseApplicability(line: string): number | null {
  const m = line.match(/applicabilityScore:\s*([0-9]*\.?[0-9]+)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1] ?? "");
  return Number.isFinite(n) ? n : null;
}

/** Parse `review-status: reviewed-confirmed` style suffix from any cell. */
function parseReviewStatus(line: string): string {
  const m = line.match(/review-status:\s*([a-z-]+)/i);
  return (m?.[1] ?? "").toLowerCase().trim();
}

/** Parse `coverage: persisting-no-policy` opt-out marker. */
function parseCoverageHint(line: string): string | null {
  const m = line.match(/coverage:\s*([a-z-]+)/i);
  return m?.[1] ? m[1].toLowerCase().trim() : null;
}

/** Parse the URN cell (column 2). Falls back to "[TBD]" when missing. */
function parseRow(line: string, lineNumber: number): ObligationRow | null {
  if (!/^\|\s*ORG-/.test(line)) return null;
  const cells = line.split("|").map((c) => c.trim());
  const id = cells[1] ?? "";
  const urn = cells[2] ?? "";
  if (!id.startsWith("ORG-")) return null;

  return {
    id,
    urn: urn === "[TBD]" || urn === "" ? `urn:obligation:bank:${id.toLowerCase()}` : urn,
    domain: deriveDomain(id),
    applicabilityScore: parseApplicability(line),
    reviewStatus: parseReviewStatus(line),
    coverageHint: parseCoverageHint(line),
    lineNumber,
  };
}

// ---------------------------------------------------------------------------
// Policy `closes:` frontmatter parsing
// ---------------------------------------------------------------------------

/** Build a set of obligation URNs referenced from policy `closes:` arrays. */
function buildClosesIndex(policiesDir: string): Set<string> {
  const closed = new Set<string>();
  if (!existsSync(policiesDir)) return closed;

  let files: string[];
  try {
    files = readdirSync(policiesDir).filter((f) => f.endsWith(".md") && !f.startsWith("README"));
  } catch {
    return closed;
  }

  for (const file of files) {
    const path = resolve(policiesDir, file);
    let content: string;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    // Frontmatter is the leading `---...---` block; only parse if present.
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!fmMatch) continue;
    const fm = fmMatch[1] ?? "";

    // YAML-ish parse: look for `closes:` followed by inline list or block list.
    const inlineMatch = fm.match(/^closes:\s*\[([^\]]*)\]/m);
    if (inlineMatch) {
      const items = inlineMatch[1] ?? "";
      for (const raw of items.split(",")) {
        const v = raw.trim().replace(/^["']|["']$/g, "");
        if (v) closed.add(v);
      }
      continue;
    }

    // Block-list form:
    //   closes:
    //     - urn:obligation:...
    const blockMatch = fm.match(/^closes:\s*\n((?:\s+-\s+\S.*\n?)+)/m);
    if (blockMatch) {
      const block = blockMatch[1] ?? "";
      for (const line of block.split(/\r?\n/)) {
        const v = line
          .replace(/^\s*-\s+/, "")
          .trim()
          .replace(/^["']|["']$/g, "");
        if (v) closed.add(v);
      }
    }
  }

  return closed;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

export interface ObligationPolicyCoverageRunOpts {
  /** Test override: feed synthetic obligations register. */
  readonly obligationsOverride?: string;
  /** Test override: feed synthetic `closes:` URNs. */
  readonly closesOverride?: Set<string>;
}

export interface DomainCoverage {
  readonly domain: string;
  readonly applicable: number;
  readonly covered: number;
  readonly coveragePct: number;
}

export interface ObligationPolicyCoverageResult extends ReconResult {
  readonly coverageByDomain: DomainCoverage[];
  readonly overallCoveragePct: number;
}

export function runObligationPolicyCoverageRecon(
  repoRoot: string,
  opts: ObligationPolicyCoverageRunOpts = {},
): ObligationPolicyCoverageResult {
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const obligationsPath = resolve(repoRoot, "Regulations/_obligations-register.md");
  const policiesDir = resolve(repoRoot, "Policies");

  const content =
    opts.obligationsOverride ??
    (existsSync(obligationsPath) ? readFileSync(obligationsPath, "utf8") : null);

  if (!content) {
    logger.warn({ pipeline: PIPELINE, msg: "Obligations register not found — skipping" });
    return { ...base, coverageByDomain: [], overallCoveragePct: 0 };
  }

  const closesIndex = opts.closesOverride ?? buildClosesIndex(policiesDir);

  // Group counters per domain.
  const applicablePerDomain = new Map<string, number>();
  const coveredPerDomain = new Map<string, number>();

  let asserted = 0;
  let totalApplicable = 0;
  let totalCovered = 0;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const row = parseRow(line, i + 1);
    if (!row) continue;
    asserted++;

    // Filter: review-status must be reviewed-confirmed or reviewed-modified.
    if (row.reviewStatus !== "reviewed-confirmed" && row.reviewStatus !== "reviewed-modified") {
      continue;
    }

    // Filter: applicability-score must be ≥ 0.4 (when known).
    if (row.applicabilityScore !== null && row.applicabilityScore < APPLICABILITY_FLOOR) {
      continue;
    }

    // Filter: opt-out marker (`coverage: persisting-no-policy`).
    if (row.coverageHint === "persisting-no-policy") {
      continue;
    }

    totalApplicable++;
    applicablePerDomain.set(row.domain, (applicablePerDomain.get(row.domain) ?? 0) + 1);

    const covered = closesIndex.has(row.urn) || closesIndex.has(row.id);
    if (covered) {
      totalCovered++;
      coveredPerDomain.set(row.domain, (coveredPerDomain.get(row.domain) ?? 0) + 1);
    } else {
      violations.push({
        subject: `Regulations/_obligations-register.md:line-${row.lineNumber}:${row.id}`,
        message: `Obligation ${row.id} (${row.urn}) is reviewed-${row.reviewStatus} and bank-applicable, but no Policy in Policies/ closes it (no closes: frontmatter entry).`,
        severity: "warn",
      });
    }
  }

  const coverageByDomain: DomainCoverage[] = [...applicablePerDomain.keys()]
    .sort()
    .map((domain) => {
      const applicable = applicablePerDomain.get(domain) ?? 0;
      const covered = coveredPerDomain.get(domain) ?? 0;
      return {
        domain,
        applicable,
        covered,
        coveragePct: applicable === 0 ? 0 : Math.round((covered / applicable) * 1000) / 10,
      };
    });

  const overallCoveragePct =
    totalApplicable === 0 ? 0 : Math.round((totalCovered / totalApplicable) * 1000) / 10;

  // Advisory — ok always true.
  base.asserted = asserted;
  base.violations = violations;
  base.ok = true;

  logger.info({
    pipeline: PIPELINE,
    asserted,
    applicable: totalApplicable,
    covered: totalCovered,
    coveragePct: overallCoveragePct,
    byDomain: coverageByDomain,
    citations: CITATIONS,
    msg: `${PIPELINE} (advisory): ${totalCovered}/${totalApplicable} reviewed bank-applicable obligations have a closing Policy (${overallCoveragePct}%)`,
  });

  return { ...base, coverageByDomain, overallCoveragePct };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = runObligationPolicyCoverageRecon(REPO_ROOT);
  console.log(
    JSON.stringify({
      level: "info",
      time: result.asOf,
      service: "bank-prototype",
      pipeline: result.pipeline,
      asserted: result.asserted,
      violations: result.violations.length,
      ok: result.ok,
      mode: "advisory",
      coveragePct: result.overallCoveragePct,
      byDomain: result.coverageByDomain,
      detail: result.violations.slice(0, 40),
    }),
  );
  process.exit(0);
}
