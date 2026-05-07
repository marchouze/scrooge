// platform/recon/mandate-ownership.ts
//
// Continuous-controls pipeline: mandate-ownership integrity.
//
// Asserts that every populated procedure under /Procedures/by-policy/
// resolves to a real mandate-bearing persona. The procedure file's "Owner"
// field is parsed; each named owner must resolve to one of:
//   (a) a persona file at /Team/<name>.md, OR
//   (b) a governance seat name (CEO, CRO, CCO, CFO, COO, CoSec, Treasurer,
//       Information Officer, CAE, Head of Global Markets), OR
//   (c) a known functional seat (Chief of Staff, Scrooge).
//
// Orphans (unknown owners) are reportable findings.
//
// P6 — upward chain. Independent of any first-line module.
//
// Author: Vera

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Locate the bank repo root: walk up from this file until we find CLAUDE.md.
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const PROCEDURES_DIR = resolve(REPO_ROOT, "Procedures/by-policy");
const TEAM_DIR = resolve(REPO_ROOT, "Team");

// Governance seats (named in CLAUDE.md top-of-house) + the CoS function.
const KNOWN_SEATS = new Set([
  "ceo",
  "marc",
  "cro",
  "cco",
  "cfo",
  "coo",
  "cosec",
  "company secretary",
  "treasurer",
  "information officer",
  "io",
  "cae",
  "chief audit executive",
  "head of global markets",
  "chief of staff",
  "scrooge",
  "chief privacy officer",
  "ciso",
  "gc",
  "general counsel",
  "chro",
]);

function loadKnownPersonas(): Set<string> {
  if (!existsSync(TEAM_DIR)) return new Set();
  const personas = new Set<string>();
  for (const f of readdirSync(TEAM_DIR)) {
    if (f.endsWith(".md") && f !== "_index.md") {
      personas.add(f.replace(/\.md$/, "").toLowerCase());
    }
  }
  return personas;
}

function listProcedureFiles(): string[] {
  if (!existsSync(PROCEDURES_DIR)) return [];
  return readdirSync(PROCEDURES_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => resolve(PROCEDURES_DIR, f));
}

function extractOwners(content: string): string[] {
  // Look for the "Owner:" field in the procedure header. Tolerant of
  // various shapes: "**Owner:** X · Y" / "Owner: X (role) · Y (role)".
  const match = content.match(/^\*?\*?Owner:\*?\*?\s+(.+?)$/m);
  if (!match) return [];
  const raw = match[1] ?? "";
  // Strip parenthetical role notes FIRST (they may contain delimiters
  // like "/", ";", "and" that would otherwise corrupt the split). Then
  // split on the owner-list separators.
  const stripped = raw.replace(/\([^)]*\)/g, "");
  return stripped
    .split(/·|,|;|\bor\b|\band\b|\+|\//)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase());
}

function resolves(owner: string, personas: Set<string>): boolean {
  if (personas.has(owner)) return true;
  if (KNOWN_SEATS.has(owner)) return true;
  // Tolerate names with parenthetical role: e.g. "owen + devon" already split,
  // but check substring matches too.
  for (const p of personas) {
    if (owner.includes(p)) return true;
  }
  for (const seat of KNOWN_SEATS) {
    if (owner.includes(seat)) return true;
  }
  return false;
}

export function run(): ReconResult {
  const result = emptyResult("mandate-ownership-integrity");
  const personas = loadKnownPersonas();
  const violations: ReconViolation[] = [];

  for (const file of listProcedureFiles()) {
    const name = file.split("/").pop() ?? file;
    const content = readFileSync(file, "utf8");
    const owners = extractOwners(content);
    if (owners.length === 0) {
      violations.push({
        subject: name,
        message: "Procedure has no parseable Owner field",
        severity: "fail",
      });
      result.asserted++;
      continue;
    }
    for (const o of owners) {
      result.asserted++;
      if (!resolves(o, personas)) {
        violations.push({
          subject: name,
          message: `Owner "${o}" does not resolve to a persona under /Team/ or a known governance seat`,
          severity: "fail",
        });
      }
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
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
      msg: r.ok ? "Mandate-ownership integrity passed" : "Mandate-ownership integrity FAILED",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
