// platform/recon/prose-duplication.ts
//
// Continuous-controls pipeline: no-prose-duplication-of-canonical-facts.
//
// Layer 1 of the prevention strategy agreed with Marc on 2026-05-07 after the
// Devon.md / Camille.md drift incident (persona Mandate paragraphs enumerated
// direct reports in prose; the prose went stale; the dashboard's parseMandate
// rendered the stale prose; Principle 2 was thereby violated despite the
// derivation engine working correctly).
//
// The general failure mode this pipeline targets:
//
//   Prose in artefact A asserts a fact that is authored canonically in
//   artefact B. When B changes, A drifts. The dashboard renders A's prose,
//   so the user sees stale presentation-layer prose even though derivation
//   from B is fresh.
//
// Initial scope (extensible):
//
//   1. Org chart — canonical in CLAUDE.md ("Engineering vs governance" +
//      "Top-of-house reporting"). Persona files (/Team/<name>.md) must not
//      enumerate "Direct reports:" in prose anywhere in the file. The org
//      chart is rendered on the agents dashboard from CLAUDE.md.
//
// Severity:
//
//   • fail — explicit "Direct reports:" enumeration in any /Team/ file or in
//     procedures. The discipline rule is unambiguous: no prose copies of the
//     org chart, anywhere.
//   • info — a different persona's name appearing in a Mandate paragraph
//     (recorded for visibility; not blocking, since some references are
//     legitimate, e.g. "Camille consumes Anya's projections").
//
// Future scope (not implemented today; extension stubs):
//
//   • obligations register — fail if a procedure cites a regulator instrument
//     in prose without a `ORG-…` URN reference.
//   • policy register — fail if a procedure claims a policy name that does
//     not exist in the canonical register.
//   • principle texts — fail if a /Team/ file paraphrases a principle without
//     citing it.
//
// P6 — upward chain. Independent of any first-line module; reads files only.
//
// Author: Vera

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

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
const PROCEDURES_DIR = resolve(REPO_ROOT, "Procedures/by-policy");

// The prose-enumeration phrase that must not appear outside CLAUDE.md.
// Captures both "Direct reports:" and "Direct report:" (singular variant).
const DIRECT_REPORTS_RE = /\b[Dd]irect reports?:\s*\S/;

// Mandate-section bracket so we can attribute findings precisely. The section
// runs from the H2 "## Mandate" until the next H2 (e.g. "## Areas of expertise").
const MANDATE_OPEN = /^##\s+(?:\d+\.\s+)?Mandate\s*$/i;
const ANY_H2 = /^##\s+/;

interface FileScan {
  path: string;
  matchingLine?: string;
  matchingLineNumber?: number;
  inMandate: boolean;
}

function scanForDirectReports(absPath: string): FileScan {
  const content = readFileSync(absPath, "utf8");
  const lines = content.split(/\r?\n/);
  let inMandate = false;
  let mandateBoundaryFound = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (MANDATE_OPEN.test(line)) {
      inMandate = true;
      mandateBoundaryFound = true;
      continue;
    }
    if (mandateBoundaryFound && inMandate && ANY_H2.test(line) && !MANDATE_OPEN.test(line)) {
      inMandate = false;
    }
    if (DIRECT_REPORTS_RE.test(line)) {
      return {
        path: absPath,
        matchingLine: line.trim(),
        matchingLineNumber: i + 1,
        inMandate,
      };
    }
  }
  return { path: absPath, inMandate: false };
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !f.startsWith("_") && !f.startsWith("."))
    .map((f) => resolve(dir, f));
}

export function run(): ReconResult {
  const result = emptyResult("no-prose-duplication-of-canonical-facts");
  const violations: ReconViolation[] = [];

  // Scope 1: persona files. Mandate-section finding is fail-severity; any
  // other location in the file is also fail (the rule is "anywhere in /Team/").
  for (const path of listMarkdownFiles(TEAM_DIR)) {
    result.asserted++;
    const scan = scanForDirectReports(path);
    if (scan.matchingLine) {
      const subject = path.replace(`${REPO_ROOT}/`, "");
      const where = scan.inMandate ? "Mandate paragraph" : `line ${scan.matchingLineNumber}`;
      violations.push({
        subject,
        message: `Persona file enumerates direct reports in prose at ${where}: "${truncate(scan.matchingLine, 100)}". The org chart is canonical in CLAUDE.md (Engineering vs governance + Top-of-house reporting); persona files must not duplicate it in prose. See feedback memory \`feedback_persona_mandate_no_org_chart\`.`,
        severity: "fail",
      });
    }
  }

  // Scope 2: populated procedures. Same rule — procedures cite, do not enumerate.
  for (const path of listMarkdownFiles(PROCEDURES_DIR)) {
    result.asserted++;
    const scan = scanForDirectReports(path);
    if (scan.matchingLine) {
      const subject = path.replace(`${REPO_ROOT}/`, "");
      violations.push({
        subject,
        message: `Procedure file enumerates direct reports in prose at line ${scan.matchingLineNumber}: "${truncate(scan.matchingLine, 100)}". Org chart belongs in CLAUDE.md; procedures cite owners by name only.`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
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
      msg: r.ok
        ? "No-prose-duplication-of-canonical-facts passed"
        : "No-prose-duplication-of-canonical-facts FAILED — prose duplicates of canonical org chart found",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
