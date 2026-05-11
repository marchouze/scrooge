// platform/recon/risk-taxonomy-coverage.ts
//
// Vera Wave-5 recon pipeline: risk-taxonomy-coverage (v1, advisory mode).
//
// Asserts that every obligation row, RAS line, and policy/charter/mandate
// document carries a valid `riskTaxonomy` code drawn from the canonical
// register at `Regulations/_risk-taxonomy.md` (typed mirror at
// `prototype/platform/risk/taxonomy.ts`, exported as `RiskTaxonomyCode`
// + `RISK_TAXONOMY` + `getRiskTaxonomyNode()`). The taxonomy is the
// risk-axis facet of the single-graph (Principle 2): every policy,
// obligation, RAS line, control, incident, and finding maps to exactly
// one terminal node so cross-cutting queries (e.g. "all credit-risk
// obligations + their fulfilment policies + outstanding RAS calibrations")
// resolve with a single graph walk.
//
// **Mode: advisory.** v1 emits findings rather than failing CI. The
// recon framework's severity vocabulary is `info | warn | fail` (see
// `types.ts`); advisory findings are emitted at `warn` severity and the
// pipeline always returns `ok: true` (only `fail`-severity findings
// flip `ok` to `false`). The upgrade plan is documented in the v1
// completion brief at
// `Owner Inbox/2026-05-11_vera_risk-taxonomy-coverage-recon-v1.md`:
//   1. Mira (Compliance / RegTech engineer, engineering — reports to
//      Zara CCO) backfills `riskTaxonomy` across the obligations register
//      (~259 rows).
//   2. Helena (CRO) + Rohan (Risk engineer) backfill RAS lines (~9 in
//      Part B).
//   3. Policy owners backfill frontmatter on the 10 policies / charters /
//      mandates merged in PRs #255–#264.
//   4. Once all three backfills land, v2 of this recon flips advisory →
//      enforcing (`warn` → `fail`) in a single PR.
//
// What the recon walks:
//
//   1. **Obligations register** at `Regulations/_obligations-register.md`.
//      Every row in a 9-column obligations table (ID | URN | Citation |
//      Requirement | Fulfilment policy | Owner | Status | Entity scope |
//      Applies-at) is expected to carry a `riskTaxonomy` field. v1
//      scans for either (a) a tenth column appended to the row, or
//      (b) a `riskTaxonomy: RT-<code>` inline annotation on a row-tail
//      sub-line. If neither shape is present the row is flagged.
//
//   2. **RAS document** at `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`.
//      Every `B<n>` line in Part B (operational limits and KRIs) is
//      expected to carry a `riskTaxonomy:` annotation in its
//      sub-paragraph. v1 flags lines where the annotation is missing.
//
//   3. **Policies / charters / mandates** in `Owner Inbox/` whose
//      frontmatter `title:` contains "Policy", "Charter", or "Mandate"
//      (case-insensitive). Each such file is expected to carry a
//      `riskTaxonomy:` field in its frontmatter (single code or array
//      of codes). v1 flags files where the field is missing.
//
// What "valid code" means:
//
//   • Single code: matches `RiskTaxonomyCode` (any of the 94 nodes in
//     the typed enum — 11 L1, 56 L2, 27 L3).
//   • Array of codes: each element matches `RiskTaxonomyCode`.
//   • An unrecognised code (e.g. `RT-NONEXISTENT`) is flagged with the
//     specific message "code not in canonical register".
//
// Independence: this pipeline reads files only. No agent runtime, no
// event store. Build-time pure.
//
// P1 — events are the only source of truth: this recon does NOT emit
// events; it is a build-time integrity check.
// P2 — single-graph discipline: the recon asserts the risk-axis facet
// of the bidirectional graph.
//
// Author: Vera (Internal audit engineer, engineering — functionally to
//         Thandiwe (Chief Audit Executive, governance); administratively
//         through the CEO).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { RISK_TAXONOMY_CODES, type RiskTaxonomyCode } from "../risk/taxonomy";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "risk-taxonomy-coverage";

// Canonical code set for fast membership test.
const VALID_CODES: ReadonlySet<string> = new Set<string>(RISK_TAXONOMY_CODES);

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
const RAS_PATH = resolve(
  REPO_ROOT,
  "Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md",
);
const OWNER_INBOX_DIR = resolve(REPO_ROOT, "Owner Inbox");

// Pattern: `riskTaxonomy: RT-<code>` or `riskTaxonomy: [RT-X, RT-Y, ...]`
// in frontmatter, body, or row annotation.
const RISK_TAXONOMY_FIELD_RE =
  /riskTaxonomy\s*:\s*(\[[^\]\n]*\]|RT-[A-Z0-9.]+(?:\s*,\s*RT-[A-Z0-9.]+)*)/;

const POLICY_TITLE_RE = /^\s*title\s*:\s*.*\b(Policy|Charter|Mandate)\b/i;
const FRONTMATTER_OPEN_RE = /^---\s*$/;

// Obligations table row marker — pipe-separated row starting with `| ORG-`.
const OBLIGATION_ROW_RE = /^\|\s*ORG-[A-Z]+-[A-Z0-9-]+\s*\|/;

// RAS Part-B line marker — header style `## B<n>` or `### B<n>.<m>`.
const RAS_B_LINE_RE = /^#{2,4}\s+(B\d+(?:[a-z]?|\.\d+)?)\b/;

export interface RunOpts {
  /**
   * Test override: feed a synthetic `(path, content)` map instead of
   * reading the live filesystem. Path keys are absolute; values are the
   * full file text.
   */
  readonly fileOverrides?: ReadonlyMap<string, string>;
  /**
   * Test override: scope the recon to a subset of inputs. When supplied,
   * the recon walks only the named scopes. Default: all three.
   */
  readonly scopes?: ReadonlyArray<"obligations" | "ras" | "policies">;
  /**
   * Test override: when supplied, the policies scope walks this directory
   * instead of `Owner Inbox/`. Useful for isolating test fixtures.
   */
  readonly policyDirOverride?: string;
}

function readFile(path: string, opts: RunOpts): string | null {
  if (opts.fileOverrides?.has(path)) {
    return opts.fileOverrides.get(path) ?? null;
  }
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function listOwnerInboxMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .filter((f) => !f.startsWith("_") && !f.startsWith("."))
      .map((f) => resolve(dir, f))
      .filter((p) => {
        try {
          return statSync(p).isFile();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

/**
 * Extract `riskTaxonomy` codes from a captured field-value group, returning
 * the list of raw code strings. The capture from `RISK_TAXONOMY_FIELD_RE`
 * is either `RT-X` or `RT-X, RT-Y` or `[RT-X, RT-Y]` (with optional
 * whitespace / quoting).
 */
function extractCodes(captured: string): string[] {
  const stripped = captured.replace(/^\[|\]$/g, "").trim();
  if (stripped.length === 0) return [];
  return stripped
    .split(/\s*,\s*/)
    .map((s) => s.replace(/^["']|["']$/g, "").trim())
    .filter((s) => s.length > 0);
}

interface FieldHit {
  readonly captured: string;
  readonly lineNumber: number;
}

function findRiskTaxonomyField(content: string, opts?: { upToLine?: number }): FieldHit | null {
  const lines = content.split(/\r?\n/);
  const end = opts?.upToLine ?? lines.length;
  for (let i = 0; i < end; i++) {
    const line = lines[i] ?? "";
    const m = line.match(RISK_TAXONOMY_FIELD_RE);
    if (m?.[1]) {
      return { captured: m[1], lineNumber: i + 1 };
    }
  }
  return null;
}

interface FrontmatterScan {
  readonly hasFrontmatter: boolean;
  readonly frontmatterEndLine: number;
  readonly titleMatchesPolicy: boolean;
}

function scanFrontmatter(content: string): FrontmatterScan {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || !FRONTMATTER_OPEN_RE.test(lines[0] ?? "")) {
    return { hasFrontmatter: false, frontmatterEndLine: 0, titleMatchesPolicy: false };
  }
  let titleMatches = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (FRONTMATTER_OPEN_RE.test(line)) {
      return {
        hasFrontmatter: true,
        frontmatterEndLine: i + 1,
        titleMatchesPolicy: titleMatches,
      };
    }
    if (POLICY_TITLE_RE.test(line)) titleMatches = true;
  }
  return { hasFrontmatter: false, frontmatterEndLine: 0, titleMatchesPolicy: false };
}

// ---------------------------------------------------------------------------
// Scope 1 — obligations register.
// ---------------------------------------------------------------------------

function scanObligations(opts: RunOpts): {
  asserted: number;
  violations: ReconViolation[];
} {
  const violations: ReconViolation[] = [];
  let asserted = 0;
  const content = readFile(OBLIGATIONS_PATH, opts);
  if (content === null) {
    return { asserted, violations };
  }
  const subjectBase = OBLIGATIONS_PATH.replace(`${REPO_ROOT}/`, "");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!OBLIGATION_ROW_RE.test(line)) continue;
    asserted++;
    // Row ID is the first cell.
    const cells = line.split("|").map((c) => c.trim());
    const id = cells[1] ?? "<unknown>";
    // Look on the row line first, then on the next line (some rows are
    // wrapped or annotated on a sub-line).
    const lookahead = `${line}\n${lines[i + 1] ?? ""}`;
    const m = lookahead.match(RISK_TAXONOMY_FIELD_RE);
    if (!m?.[1]) {
      violations.push({
        subject: `${subjectBase}:line-${i + 1}:${id}`,
        message:
          `Obligation row \`${id}\` is missing the \`riskTaxonomy\` field. ` +
          "Expected behaviour: annotate the row with `riskTaxonomy: RT-<code>` " +
          "drawn from the canonical register at `Regulations/_risk-taxonomy.md` " +
          "(typed enum at `prototype/platform/risk/taxonomy.ts`). Backfill is " +
          "scoped to Mira (Compliance / RegTech engineer) under standing " +
          "register-curator mandate. Recon mode is advisory in v1.",
        severity: "warn",
      });
      continue;
    }
    const codes = extractCodes(m[1]);
    if (codes.length === 0) {
      violations.push({
        subject: `${subjectBase}:line-${i + 1}:${id}`,
        message:
          `Obligation row \`${id}\` declares \`riskTaxonomy\` but the value parsed empty. ` +
          "Use `riskTaxonomy: RT-<code>` (single) or `riskTaxonomy: [RT-X, RT-Y]` (multi).",
        severity: "warn",
      });
      continue;
    }
    for (const code of codes) {
      if (!VALID_CODES.has(code)) {
        violations.push({
          subject: `${subjectBase}:line-${i + 1}:${id}`,
          message:
            `Obligation row \`${id}\` declares \`riskTaxonomy: ${code}\` — code not in ` +
            "canonical register at `Regulations/_risk-taxonomy.md` (94 codes: 11 L1 + 56 L2 + 27 L3). " +
            "Replace with a valid `RiskTaxonomyCode` or, if no fit, propose a taxonomy " +
            "amendment via the Board-gated process in register §9.",
          severity: "warn",
        });
      }
    }
  }
  return { asserted, violations };
}

// ---------------------------------------------------------------------------
// Scope 2 — RAS document.
// ---------------------------------------------------------------------------

function scanRas(opts: RunOpts): {
  asserted: number;
  violations: ReconViolation[];
} {
  const violations: ReconViolation[] = [];
  let asserted = 0;
  const content = readFile(RAS_PATH, opts);
  if (content === null) {
    return { asserted, violations };
  }
  const subjectBase = RAS_PATH.replace(`${REPO_ROOT}/`, "");
  const lines = content.split(/\r?\n/);
  // Locate every Part-B line header. For each, look in the body that
  // follows (up to the next B-header or top-level header) for a
  // `riskTaxonomy:` annotation.
  const headerIndices: Array<{ idx: number; line: string; label: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = line.match(RAS_B_LINE_RE);
    if (m?.[1]) headerIndices.push({ idx: i, line, label: m[1] });
  }
  for (let h = 0; h < headerIndices.length; h++) {
    const cur = headerIndices[h];
    if (!cur) continue;
    asserted++;
    const next = headerIndices[h + 1];
    const bodyEnd = next ? next.idx : lines.length;
    const body = lines.slice(cur.idx, bodyEnd).join("\n");
    const m = body.match(RISK_TAXONOMY_FIELD_RE);
    if (!m?.[1]) {
      violations.push({
        subject: `${subjectBase}:line-${cur.idx + 1}:${cur.label}`,
        message:
          `RAS line \`${cur.label}\` is missing the \`riskTaxonomy\` annotation. ` +
          "Expected behaviour: add `riskTaxonomy: RT-<code>` (or array) to the " +
          "line's body, drawn from `Regulations/_risk-taxonomy.md`. Backfill " +
          "owner: Helena (Chief Risk Officer, governance) + Rohan (Risk engineer). " +
          "Recon mode is advisory in v1.",
        severity: "warn",
      });
      continue;
    }
    const codes = extractCodes(m[1]);
    for (const code of codes) {
      if (!VALID_CODES.has(code)) {
        violations.push({
          subject: `${subjectBase}:line-${cur.idx + 1}:${cur.label}`,
          message:
            `RAS line \`${cur.label}\` declares \`riskTaxonomy: ${code}\` — code not in ` +
            "canonical register at `Regulations/_risk-taxonomy.md`. Replace with a valid " +
            "`RiskTaxonomyCode` or propose a taxonomy amendment.",
          severity: "warn",
        });
      }
    }
  }
  return { asserted, violations };
}

// ---------------------------------------------------------------------------
// Scope 3 — policies / charters / mandates in Owner Inbox.
// ---------------------------------------------------------------------------

function scanPolicies(opts: RunOpts): {
  asserted: number;
  violations: ReconViolation[];
} {
  const violations: ReconViolation[] = [];
  let asserted = 0;
  const dir = opts.policyDirOverride ?? OWNER_INBOX_DIR;
  const paths = opts.fileOverrides
    ? [...opts.fileOverrides.keys()].filter((p) => p.startsWith(dir) && p.endsWith(".md"))
    : listOwnerInboxMarkdown(dir);
  for (const path of paths) {
    const content = readFile(path, opts);
    if (content === null) continue;
    const fm = scanFrontmatter(content);
    if (!fm.hasFrontmatter || !fm.titleMatchesPolicy) continue;
    asserted++;
    const subject = path.replace(`${REPO_ROOT}/`, "");
    const hit = findRiskTaxonomyField(content, { upToLine: fm.frontmatterEndLine });
    if (!hit) {
      violations.push({
        subject,
        message:
          `Policy / charter / mandate file is missing the \`riskTaxonomy\` field in frontmatter. ` +
          "Expected behaviour: add `riskTaxonomy: RT-<code>` (or array for multi-risk policies) " +
          "to the document's YAML frontmatter, drawn from `Regulations/_risk-taxonomy.md`. " +
          "Backfill owner: the policy's stated `author:` seat. Recon mode is advisory in v1.",
        severity: "warn",
      });
      continue;
    }
    const codes = extractCodes(hit.captured);
    if (codes.length === 0) {
      violations.push({
        subject: `${subject}:line-${hit.lineNumber}`,
        message:
          "Policy declares `riskTaxonomy` but the value parsed empty. Use " +
          "`riskTaxonomy: RT-<code>` (single) or `riskTaxonomy: [RT-X, RT-Y]` (multi).",
        severity: "warn",
      });
      continue;
    }
    for (const code of codes) {
      if (!VALID_CODES.has(code)) {
        violations.push({
          subject: `${subject}:line-${hit.lineNumber}`,
          message:
            `Policy declares \`riskTaxonomy: ${code}\` — code not in canonical register ` +
            "at `Regulations/_risk-taxonomy.md`. Replace with a valid `RiskTaxonomyCode` " +
            "or propose a taxonomy amendment via the Board-gated process in register §9.",
          severity: "warn",
        });
      }
    }
  }
  return { asserted, violations };
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  const scopes = opts.scopes ?? (["obligations", "ras", "policies"] as const);

  if (scopes.includes("obligations")) {
    const r = scanObligations(opts);
    result.asserted += r.asserted;
    violations.push(...r.violations);
  }
  if (scopes.includes("ras")) {
    const r = scanRas(opts);
    result.asserted += r.asserted;
    violations.push(...r.violations);
  }
  if (scopes.includes("policies")) {
    const r = scanPolicies(opts);
    result.asserted += r.asserted;
    violations.push(...r.violations);
  }

  result.violations = violations;
  // Advisory mode: only `fail`-severity findings flip ok to false. v1
  // emits everything at `warn`, so a green run is the default even when
  // findings are present.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// Re-export the type for downstream callers (tests / handlers) that
// want to typecheck a manually-constructed code list.
export type { RiskTaxonomyCode };

if (import.meta.main) {
  const r = run();
  const fails = r.violations.filter((v) => v.severity === "fail").length;
  const warns = r.violations.filter((v) => v.severity === "warn").length;
  const infos = r.violations.filter((v) => v.severity === "info").length;
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      fails,
      warns,
      infos,
      ok: r.ok,
      mode: "advisory",
      msg: r.ok
        ? `risk-taxonomy-coverage (advisory): asserted ${r.asserted} artefact(s); ${warns} backfill finding(s)`
        : "risk-taxonomy-coverage FAILED — fail-severity finding present (should not happen in advisory mode v1)",
      detail: r.violations,
    }),
  );
  // Advisory mode: exit 0 unless a fail-severity finding sneaked in.
  process.exit(r.ok ? 0 : 1);
}
