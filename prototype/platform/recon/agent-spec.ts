// platform/recon/agent-spec.ts
//
// Continuous-controls pipeline: agent-spec integrity (Vera Wave-4 #10).
//
// Asserts that every persona file under `/Team/<Name>.md` (excluding files
// whose basename starts with `_`) is in canonical agent-spec form per the
// 17-section template at `Team/_agent-spec-template.md`. CLAUDE.md
// Principle 6 ("Persona files default to agent-spec form") makes this
// non-optional: without §6–§17, the agent-runtime registry can't parse
// the spec, the permission-policy generator has no decisions/capabilities
// to derive policy from, and Vera's downstream pipelines have no
// structured handle on the agent.
//
// What this pipeline asserts, per persona file:
//
//   1. The file's H1 is `# <Name>` matching the filename stem.
//   2. §1 Identity is present and names a parseable "Reports to:" bullet.
//   3. Sections §6 Cadence through §17 Change log are all present
//      (case-insensitive `## 6.`, `## 7.`, ..., `## 17.` markers, with the
//      label tolerance the spec-parser uses — numbered or unnumbered).
//   4. Each §6–§17 section has substantive body content — at least 50
//      characters of body OR a markdown table with ≥1 data row.
//   5. §17 Change log has at least one data row in its table (i.e. the
//      authorship history is recorded).
//
// Findings are listed per file with the specific violation. Severity is
// `fail` for missing required sections / empty change-log; `fail` also
// for absent §1 Identity or unparseable Reports-to. The pipeline exits
// non-zero on any fail violation.
//
// Independence note: this pipeline is **structural** — it asserts the
// presence and substantive fill of sections. It does NOT depend on the
// agent-runtime `spec-parser.ts` succeeding. The parser is opinionated
// about field shapes (e.g. it returns a parse error if §11 lacks an
// "Events emitted:" bullet); the recon's question is the prior one — is
// the section even there to be parsed? Keeping the two separate means a
// parser bug does not silently downgrade integrity, and a presence-level
// regression is caught even when parser tolerance is widened.
//
// P6 — upward chain (no orphan personas; every persona is structurally
// available to the policy / procedure / regulation reconciliation graph).
// P7 — autonomous-by-default (the runtime substrate consumes this graph
// to register agents, derive permissions, and surface escalations).
//
// Author: Vera

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Walk up from this file until we find CLAUDE.md (the canonical repo-root
// marker used by the other recon pipelines). Keeps this pipeline portable
// across worktrees and test harnesses.
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const TEAM_DIR = resolve(REPO_ROOT, "Team");

/**
 * The canonical operating-spec sections (§6 onwards). Each tuple is
 * `[number, label]`. The label is the canonical heading text from the
 * template at `Team/_agent-spec-template.md`; section detection is
 * case-insensitive and tolerates the unnumbered `## Cadence` shape used
 * by a few legacy upgrades (mirrors `spec-parser.ts`).
 */
const REQUIRED_SECTIONS: ReadonlyArray<readonly [number, string]> = [
  [6, "Cadence"],
  [7, "Triggers"],
  [8, "Inputs"],
  [9, "Decisions in scope"],
  [10, "Decisions that escalate"],
  [11, "Outputs"],
  [12, "System capabilities called"],
  [13, "Procedures owned"],
  [14, "Data contracts"],
  [15, "Independence / conflicts"],
  [16, "Substrate gaps (current state)"],
  [17, "Change log"],
];

/**
 * Minimum substantive-body byte count. A bare heading is ~30 chars and a
 * single-bullet placeholder ("- TBD") is shorter still; 50 chars filters
 * those out without rejecting genuinely terse but real content. Sections
 * that meet the threshold via a markdown table (≥1 data row) are also
 * accepted — counting bytes underweights tabular content.
 */
const MIN_BODY_CHARS = 50;

/**
 * Section heading regex builders.
 *
 * The integrity recon is about *presence*, not strict label conformance
 * (the spec-parser at `agent-runtime/spec-parser.ts` enforces the
 * label-exact form for downstream consumption). A persona may
 * legitimately annotate its section heading — e.g. Scrooge's
 * `## 10. Decisions that escalate (to CEO)` is a meaningful
 * clarification of the canonical `Decisions that escalate` label.
 *
 * We accept a section as present when *either*:
 *
 *   (a) The canonical exact-label heading matches (`## 6. Cadence` or
 *       `## Cadence` — what spec-parser accepts), OR
 *   (b) For numbered sections (§6–§17), the heading begins with the
 *       number (`## 10.` or `## 10. <anything>`) — the numeric anchor
 *       is the structural primitive.
 *
 * Form (b) keeps the recon stable when a persona elaborates a label.
 * The spec-parser would still flag a non-canonical label downstream;
 * that's a different (and stricter) concern, addressed by Wave-4 #11
 * actor-discipline + parser-success reconciliation.
 */
function exactLabelRegex(num: number, label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+(?:${num}\\.\\s+)?${escaped}\\s*$`, "i");
}

function numberedHeadingRegex(num: number): RegExp {
  return new RegExp(`^##\\s+${num}\\.\\s+`);
}

/**
 * Extract the body of a section. Returns `undefined` if neither the
 * exact-label form nor (for numbered sections) the number-prefix form
 * is present; otherwise returns everything between the heading and the
 * next `## ` heading, with leading / trailing blank lines trimmed.
 */
function extractSection(content: string, num: number, label: string): string | undefined {
  const lines = content.split(/\r?\n/);
  const exact = exactLabelRegex(num, label);
  const numbered = numberedHeadingRegex(num);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (exact.test(line) || numbered.test(line)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return undefined;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && /^##\s/.test(line)) {
      end = i;
      break;
    }
  }
  return lines
    .slice(start, end)
    .join("\n")
    .replace(/^\s+|\s+$/g, "");
}

/**
 * True iff the section body is substantive — either ≥ MIN_BODY_CHARS
 * characters, or contains a markdown table with at least one data row.
 *
 * Stripping markdown noise (bullets, list markers, table separators)
 * before the byte count keeps the threshold meaningful: a "## 14. Data
 * contracts" with only "- **Produces:**" + "- **Consumes:**" labels and
 * no actual contracts would otherwise pass. We strip prefix bullets and
 * trailing colons-at-end-of-line markers before counting.
 */
function isSubstantive(body: string): boolean {
  if (body.length === 0) return false;
  if (countTableDataRows(body) >= 1) return true;
  const stripped = body
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\-*]\s+/, "").trim())
    .filter((l) => l.length > 0)
    .join(" ");
  return stripped.length >= MIN_BODY_CHARS;
}

/**
 * Count the data rows in the first markdown table inside `section`.
 * Mirrors `spec-parser.ts.countTableDataRows`. A table is a header row,
 * a separator row (`|---|---|...`), and ≥ 0 data rows; we count only the
 * data rows.
 */
function countTableDataRows(section: string): number {
  const lines = section.split(/\r?\n/);
  let inTable = false;
  let separatorSeen = false;
  let dataRows = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inTable) {
      if (/^\|\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(trimmed)) {
        inTable = true;
        separatorSeen = true;
        continue;
      }
      continue;
    }
    if (trimmed.startsWith("|")) {
      if (separatorSeen) dataRows++;
      continue;
    }
    if (trimmed === "") break;
    break;
  }
  return dataRows;
}

/**
 * Extract the "Reports to:" value from §1 Identity. Returns the trimmed
 * raw value (which may include parenthetical role split notes) or
 * undefined if the bullet isn't present.
 */
function extractReportsTo(identity: string): string | undefined {
  const m = identity.match(/^[\-*]\s+\*\*Reports to:\*\*\s+(.+)$/im);
  return m?.[1] ? m[1].trim() : undefined;
}

/** Extract the file's H1 title (first `# <text>` line). */
function extractH1(content: string): string | undefined {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

/**
 * Pull the persona name out of an H1. Personas use `# Helena — Chief Risk
 * Officer (governance)` — em-dash separator. We accept either `—` or
 * `-` between name and role. The extracted name is compared (case-
 * insensitive) against the filename stem.
 */
function extractH1Name(h1: string): string {
  // Split on the first em-dash or hyphen surrounded by spaces.
  const parts = h1.split(/\s+[—–-]\s+/, 2);
  return (parts[0] ?? h1).trim();
}

/**
 * List persona files (skip `_` and dotfiles, skip the template).
 */
function listPersonaFiles(): string[] {
  if (!existsSync(TEAM_DIR)) return [];
  return readdirSync(TEAM_DIR)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !f.startsWith("_") && !f.startsWith("."))
    .map((f) => resolve(TEAM_DIR, f));
}

export interface AssertOpts {
  /** Override the team directory — used by tests against synthetic specs. */
  teamDir?: string;
  /**
   * Override the file list — used by tests that inject a single synthetic
   * spec without writing it under /Team/. Each entry is `[absPath, content]`.
   */
  specs?: ReadonlyArray<readonly [string, string]>;
}

/**
 * Assert agent-spec integrity over `specs`. Pure function; reads only
 * the strings provided (or, if `specs` is omitted, reads every persona
 * file under `teamDir` ?? TEAM_DIR).
 */
export function assertSpecs(opts: AssertOpts = {}): ReconResult {
  const result = emptyResult("agent-spec-integrity");
  const violations: ReconViolation[] = [];

  const specs: Array<readonly [string, string]> =
    opts.specs !== undefined
      ? [...opts.specs]
      : listPersonaFilesIn(opts.teamDir ?? TEAM_DIR).map(
          (p) => [p, readFileSync(p, "utf8")] as const,
        );

  for (const [path, content] of specs) {
    const fileName = basename(path);
    const subject = path.replace(`${REPO_ROOT}/`, "");
    const personaName = fileName.replace(/\.md$/i, "");
    result.asserted++;

    // 1. H1 must match filename stem (case-insensitive).
    const h1 = extractH1(content);
    if (!h1) {
      violations.push({
        subject,
        message: `${personaName}: missing H1 title`,
        severity: "fail",
      });
    } else {
      const h1Name = extractH1Name(h1);
      if (h1Name.toLowerCase() !== personaName.toLowerCase()) {
        violations.push({
          subject,
          message: `${personaName}: H1 name "${h1Name}" does not match filename stem "${personaName}"`,
          severity: "fail",
        });
      }
    }

    // 2. §1 Identity must be present with a parseable Reports to.
    const identity = extractSection(content, 1, "Identity");
    if (!identity) {
      violations.push({
        subject,
        message: `${personaName}: missing § 1 (Identity)`,
        severity: "fail",
      });
    } else {
      const reportsTo = extractReportsTo(identity);
      if (!reportsTo || reportsTo.length === 0) {
        violations.push({
          subject,
          message: `${personaName}: § 1 Identity has no parseable **Reports to:** bullet`,
          severity: "fail",
        });
      }
    }

    // 3 + 4. §6–§17 must each be present and substantively filled.
    for (const [num, label] of REQUIRED_SECTIONS) {
      const body = extractSection(content, num, label);
      if (body === undefined) {
        violations.push({
          subject,
          message: `${personaName}: missing § ${num} (${label})`,
          severity: "fail",
        });
        continue;
      }
      if (!isSubstantive(body)) {
        violations.push({
          subject,
          message: `${personaName}: § ${num} (${label}) has no substantive content (≥${MIN_BODY_CHARS} chars of body or a markdown table with ≥1 data row)`,
          severity: "fail",
        });
      }
    }

    // 5. §17 Change log must have at least one table data row.
    const changeLog = extractSection(content, 17, "Change log");
    if (changeLog !== undefined && countTableDataRows(changeLog) < 1) {
      violations.push({
        subject,
        message: `${personaName}: § 17 (Change log) has no data rows — at least one authorship row is required`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

/** Internal — list persona files under an explicit dir. */
function listPersonaFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !f.startsWith("_") && !f.startsWith("."))
    .map((f) => resolve(dir, f));
}

/**
 * Convenience entry point — runs the assertion over the live `/Team/`
 * directory. Mirrors the shape of the other recon pipelines.
 */
export function run(): ReconResult {
  // Touch the helper so dead-code elimination doesn't drop it under the
  // test-only injection path.
  if (false as boolean) listPersonaFiles();
  return assertSpecs({});
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok ? "Agent-spec integrity passed" : "Agent-spec integrity FAILED",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
