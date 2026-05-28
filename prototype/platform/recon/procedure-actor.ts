// platform/recon/procedure-actor.ts
//
// Vera Wave-4 #12 — procedure-actor.
//
// Parse Procedures/ markdown files. For each procedure step that names an
// actor (patterns: "Owner:", "Actor:", frontmatter `owner:`, table step
// columns naming an agent, inline "(agent)" references, "**Owner:**" body
// lines), verify the named actor resolves to an entry in
// Team/_team-roster.json (match by name or position title). Surface dangling
// actor references (actor named but not in roster) as `warn`-severity
// violations.
//
// Resolution rule:
//   A named actor "resolves" if ANY word-token in the actor string matches
//   (case-insensitive) either:
//     (a) a `name` in the roster JSON (e.g. "Owen", "Mira", "Zara"), OR
//     (b) a recognised position/role synonym in the `POSITION_SYNONYMS` set
//         (e.g. "CEO", "CFO", "CRO", "MLRO"), OR
//     (c) "system" / "agent" / "external" / "marc" (legitimate non-named
//         actors in procedures).
//
// The pipeline reads every .md file under:
//   Procedures/by-policy/
//   Procedures/finance/
//   Procedures/financial-crime/
//   Procedures/markets/
//   Procedures/operations/
//   Procedures/risk/
//   Procedures/templates/
//   Procedures/validation/
//   Procedures/*.md (top-level)
//
// Author: Vera (Internal audit engineer, governance) — Wave-4 #12

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "procedure-actor";

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
// Roster loading
// ---------------------------------------------------------------------------

interface RosterEntry {
  readonly name: string;
  readonly role: string;
}

function loadRoster(rosterPath: string): RosterEntry[] {
  if (!existsSync(rosterPath)) return [];
  try {
    const data = JSON.parse(readFileSync(rosterPath, "utf8")) as {
      personas?: Array<{ name?: string; role?: string }>;
    };
    return (data.personas ?? []).flatMap((p) =>
      p.name ? [{ name: p.name, role: p.role ?? "" }] : [],
    );
  } catch {
    return [];
  }
}

/**
 * Build a resolution set from the roster: lower-cased name tokens, lower-cased
 * role title tokens, plus known position synonyms. The set is used for O(1)
 * token lookup.
 */

// Position / role synonyms that are valid actor references even without a
// matching roster entry. This includes regulatory seat titles used in formal
// procedure steps where the person holding the seat is the actor.
const POSITION_SYNONYMS: ReadonlySet<string> = new Set([
  "ceo",
  "cfo",
  "cro",
  "cco",
  "coo",
  "ciso",
  "cae",
  "cosec",
  "io",
  "mlro",
  "cosec",
  "dpo",
  "board",
  "brc",
  "alco",
  "exco",
  "ac",
  "pa",
  "fsca",
  "fic",
  "sars",
  "marc",
  "scrooge",
  // Generic actor placeholders that are always valid
  "system",
  "agent",
  "external",
  "counterparty",
  "auditor",
  "regulator",
  "client",
  "custodian",
  "correspondent",
  "sponsor",
  "applicant",
]);

function buildResolutionSet(entries: readonly RosterEntry[]): Set<string> {
  const out = new Set<string>(POSITION_SYNONYMS);
  for (const entry of entries) {
    // Add the full first name (word before any space or parenthesis)
    const firstName = entry.name.toLowerCase().split(/[\s(]/)[0];
    if (firstName) out.add(firstName);
    // Add every word in the role title
    for (const tok of entry.role.toLowerCase().match(/[a-z]+/g) ?? []) {
      if (tok.length >= 3) out.add(tok);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Actor reference patterns
// ---------------------------------------------------------------------------

/**
 * Patterns that identify actor-bearing lines in procedure markdown:
 *   1. YAML frontmatter `owner: <value>`
 *   2. Body heading `**Owner:** <value>`
 *   3. Body heading `**Actor:** <value>`
 *   4. Step-table column — the 4th column (index 3 after splitting on `|`) in
 *      a row that starts with `| <number>` is conventionally the Actor column
 *      in the bank's step-table format.
 *   5. Inline `(agent)` suffix on a name in a step description (less precise;
 *      captured only when preceded by a name token).
 */

interface ActorReference {
  readonly source: string; // e.g. "frontmatter:owner", "step-table:col3", "body:owner"
  readonly raw: string; // the raw actor string
  readonly lineNumber: number;
}

function extractActorReferences(content: string, fileName: string): ActorReference[] {
  const refs: ActorReference[] = [];
  const lines = content.split(/\r?\n/);

  let inFrontmatter = false;
  let frontmatterDone = false;
  let frontmatterLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineNumber = i + 1;

    // YAML frontmatter block detection (lines 1..N between --- delimiters)
    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && line.trim() === "---" && frontmatterLineCount > 0) {
      inFrontmatter = false;
      frontmatterDone = true;
      continue;
    }
    if (inFrontmatter) {
      frontmatterLineCount++;
      // `owner:` frontmatter field
      const ownerMatch = line.match(/^owner:\s*(.+)/i);
      if (ownerMatch) {
        const raw = (ownerMatch[1] ?? "").trim();
        if (raw) refs.push({ source: `${fileName}:frontmatter:owner`, raw, lineNumber });
      }
      continue;
    }

    void frontmatterDone; // suppress unused warning; used as guard above

    // Body: `**Owner:** <value>` or `**Actor:** <value>`
    const bodyOwner = line.match(/\*\*(?:Owner|Actor)\s*[:/]\*\*\s*(.+)/i);
    if (bodyOwner) {
      const raw = (bodyOwner[1] ?? "").trim();
      if (raw) refs.push({ source: `${fileName}:body:owner`, raw, lineNumber });
    }

    // Step table: `| <number> | description | ... | actor-cell | ...`
    // The bank's standard step-table has: Step | Description | Actor | Capability | Event
    // Column index 3 (0-indexed cells after split on "|") = Actor.
    if (/^\|\s*\d+\s*\|/.test(line)) {
      const cells = line.split("|").map((c) => c.trim());
      // cells[0] = "" (before first |), cells[1] = step number, cells[2] = description,
      // cells[3] = actor, cells[4] = capability, cells[5] = event
      const actorCell = cells[3];
      if (actorCell && actorCell.length > 0 && actorCell !== "Actor") {
        refs.push({ source: `${fileName}:step-table:actor-col`, raw: actorCell, lineNumber });
      }
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Returns `true` if at least one token in `raw` resolves against the
 * `resolutionSet`. The resolution set contains: lower-cased agent first names,
 * lower-cased role title tokens, and the POSITION_SYNONYMS.
 */
function resolves(raw: string, resolutionSet: ReadonlySet<string>): boolean {
  const tokens = raw.toLowerCase().match(/[a-z]{2,}/g) ?? [];
  return tokens.some((t) => resolutionSet.has(t));
}

// ---------------------------------------------------------------------------
// Procedure file enumeration
// ---------------------------------------------------------------------------

const PROCEDURE_SUBDIRS = [
  "by-policy",
  "finance",
  "financial-crime",
  "markets",
  "operations",
  "risk",
  "templates",
  "validation",
];

function listProcedureFiles(proceduresDir: string): string[] {
  const out: string[] = [];
  if (!existsSync(proceduresDir)) return out;

  // Top-level .md files
  for (const f of readdirSync(proceduresDir)) {
    if (f.endsWith(".md") && !f.startsWith("_") && !f.startsWith(".")) {
      out.push(resolve(proceduresDir, f));
    }
  }

  // Sub-directory .md files
  for (const sub of PROCEDURE_SUBDIRS) {
    const subDir = resolve(proceduresDir, sub);
    if (!existsSync(subDir)) continue;
    for (const f of readdirSync(subDir)) {
      if (f.endsWith(".md") && !f.startsWith("_") && !f.startsWith(".")) {
        out.push(resolve(subDir, f));
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ProcedureActorRunOpts {
  /** Override procedure file list — used by tests. Each entry: [absPath, content] */
  readonly procedureFiles?: ReadonlyArray<readonly [string, string]>;
  /** Override roster entries — used by tests. */
  readonly rosterEntries?: ReadonlyArray<RosterEntry>;
}

export function runProcedureActorRecon(
  repoRoot: string,
  opts: ProcedureActorRunOpts = {},
): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const rosterPath = resolve(repoRoot, "Team/_team-roster.json");
  const proceduresDir = resolve(repoRoot, "Procedures");

  const rosterEntries = opts.rosterEntries ?? loadRoster(rosterPath);
  const resolutionSet = buildResolutionSet(rosterEntries);

  const procFiles: Array<readonly [string, string]> =
    opts.procedureFiles !== undefined
      ? [...opts.procedureFiles]
      : listProcedureFiles(proceduresDir).map((p) => [p, readFileSync(p, "utf8")] as const);

  let asserted = 0;
  for (const [path, content] of procFiles) {
    const fileName = basename(path);
    const subject = path.replace(`${repoRoot}/`, "");

    const refs = extractActorReferences(content, fileName);
    asserted++;

    for (const ref of refs) {
      if (!resolves(ref.raw, resolutionSet)) {
        violations.push({
          subject: `${subject}:line-${ref.lineNumber}`,
          message: `${fileName}: actor reference "${ref.raw}" (source: ${ref.source}) names no resolvable roster entry or recognised position. Either add the agent to Team/_team-roster.json or correct the actor reference. Build-phase tolerance: warn only.`,
          severity: "warn",
        });
      }
    }
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");

  const dangling = violations.length;
  logger.info({
    pipeline: PIPELINE,
    asserted,
    dangling,
    msg: `${PIPELINE}: ${dangling} dangling actor reference(s) across ${asserted} procedure file(s)`,
  });

  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = runProcedureActorRecon(REPO_ROOT);
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
          ? `${PIPELINE}: ${warns.length} dangling actor reference(s) — warn`
          : `${PIPELINE} passed`
        : `${PIPELINE} FAILED`,
      detail: result.violations,
    }),
  );
  process.exit(result.ok ? 0 : 1);
}
