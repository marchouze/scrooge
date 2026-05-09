// platform/recon/agent-spec-cross-link.ts
//
// Continuous-controls pipeline: agent-spec cross-link integrity
// (Vera Wave-4 #10 — graph-layer extension).
//
// Sibling to `platform/recon/agent-spec.ts`. The structural recon asserts
// that each /Team/<Name>.md carries §6–§17 with substantive bodies. This
// pipeline asserts the next layer up: that the *cross-references* in
// those sections resolve into the single citable graph mandated by
// Principle 6 (no orphans; every reference is a typed citation that
// resolves to a real artefact, not a prose mention). It is the upward
// half of "every persona is structurally available to the
// policy / procedure / regulation reconciliation graph".
//
// What this pipeline asserts, per persona file:
//
//   1. §13 Procedures owned — every bullet that cites a procedure path
//      under `Procedures/` either resolves to an actual file under
//      `Procedures/by-policy/`, `Procedures/templates/`, or
//      `Procedures/validation/`, OR carries an explicit `(planned)` /
//      `(planned, ...)` marker (procedure is roadmap-only).
//   2. §12 System capabilities called — every bullet whose first inline
//      code span starts with `@platform/` either resolves to a real
//      `prototype/platform/<...>` file (with `.ts` appended where the
//      reference omits an extension) OR carries an explicit
//      `(planned)` / `[substrate-gap: ...]` / `(gated on ...)` marker.
//   3. §10 Decisions that escalate — every named overseer in the
//      `Target overseer` column resolves to either: an entry in
//      CLAUDE.md's team table, or `Marc (CEO)` / a recognised CEO
//      synonym, or a governance-seat name plainly cited (e.g.
//      `Thandiwe (CAE)`). Side-channel escalations to non-resolvable
//      humans are findings.
//
// Severity is `warn` rather than `fail` for the initial run: today's
// persona corpus pre-dates this pipeline's strict resolution discipline,
// and a portion of the bullets cite procedures or capabilities that are
// genuinely on the roadmap but lack the parenthetical marker. Surfacing
// the count as warn-severity gives the same controls signal as the
// `decision-recommendation` recon today — visible in the overnight
// digest, not blocking on every PR. Once the corpus is groomed, this
// pipeline lifts to `fail` (Wave-4 #10 closure step).
//
// Independence note: this pipeline is *graph-level*. It does not import
// any domain module; it reads files only. The structural recon
// (`agent-spec.ts`) is the prior gate — if a persona is missing §12 or
// §13 entirely, that's its finding, not ours; we only assert *resolution*
// of the references in sections that exist.
//
// P6 — upward chain (every cross-reference is a typed citation that
// reconciles into the policy / procedure / regulation graph).
// P7 — autonomous-by-default (the runtime substrate consumes the graph
// to register agents, derive permissions, and surface escalations).
//
// Author: Vera (Internal audit engineer) — Wave-4 #10

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// Walk up from this file until we find CLAUDE.md (the canonical repo-root
// marker used by the other recon pipelines).
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
const PROCEDURES_DIR = resolve(REPO_ROOT, "Procedures");
const PROTOTYPE_DIR = resolve(REPO_ROOT, "prototype");
const CLAUDE_MD = resolve(REPO_ROOT, "CLAUDE.md");

/**
 * The tokens that exempt a bullet from resolution. A bullet is exempted
 * if it carries any of these substrings (case-insensitive). The list is
 * conservative: the canonical roadmap markers are `(planned)` and
 * `[substrate-gap: ...]`, with `(gated on ...)` and `(not yet ...)` as
 * recognised variations the existing personas use.
 */
const EXEMPT_MARKERS: ReadonlyArray<string> = [
  "(planned)",
  "(planned,",
  "[substrate-gap:",
  "(gated on",
  "(not yet",
  "(deferred",
];

function isExempt(line: string): boolean {
  const lower = line.toLowerCase();
  return EXEMPT_MARKERS.some((m) => lower.includes(m.toLowerCase()));
}

/**
 * Section heading regex builders — same as `agent-spec.ts`. Mirror the
 * structural recon's tolerance: numbered prefix (`## 12.`) is the
 * structural primitive; exact-label form is also accepted.
 */
function exactLabelRegex(num: number, label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+(?:${num}\\.\\s+)?${escaped}\\s*$`, "i");
}

function numberedHeadingRegex(num: number): RegExp {
  return new RegExp(`^##\\s+${num}\\.\\s+`);
}

/** Extract the body of a section, or undefined if not present. */
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
 * Parse the team table from CLAUDE.md. Each `| <Name> | <Role> | ... |`
 * row contributes one entry. Returns the lower-cased name set. Used as
 * the resolution table for §10 escalation targets.
 */
function loadTeamRoster(): Set<string> {
  if (!existsSync(CLAUDE_MD)) return new Set();
  const content = readFileSync(CLAUDE_MD, "utf8");
  const lines = content.split(/\r?\n/);
  const out = new Set<string>();
  let sawHeader = false;
  for (const line of lines) {
    const m = line.match(/^\|\s*([A-Z][A-Za-z]+)\s*\|/);
    if (!m) continue;
    const name = m[1];
    if (!name) continue;
    if (!sawHeader && name === "Name") {
      sawHeader = true;
      continue;
    }
    if (!sawHeader) continue;
    out.add(name.toLowerCase());
  }
  // Marc (CEO) and Scrooge (CoS) are valid escalation targets even
  // though the team table starts with PAX. CLAUDE.md treats Marc as
  // the CEO and Scrooge as the Chief of Staff (orchestrator) above the
  // engineering / governance roster — both are legitimate overseers
  // for §10 escalations. Add them explicitly.
  out.add("marc");
  out.add("scrooge");
  return out;
}

/**
 * Tokens that resolve to "a named human / governance body the bank
 * recognises" without appearing as a row in CLAUDE.md's team table.
 * These are valid §10 escalation targets per the governance framework
 * even though they are not individual agents — `Board`, `ALCO`, `BRC`,
 * `AC` (Audit Committee), `CEO`, `Audit Forum`. The audit intent of the
 * §10 cross-link is "the cell names someone who can receive the
 * escalation"; the corporate-body forms are legitimate.
 */
const RECOGNISED_BODIES: ReadonlyArray<string> = [
  "ceo",
  "board",
  "alco",
  "brc",
  "ac", // Audit Committee
  "exco",
  "shareholder",
  "shareholders",
  "regulator",
  "pa", // Prudential Authority
  "fsca",
  "fic",
  "ir", // Information Regulator
  "sars",
  "cae", // Chief Audit Executive (a seat title; resolves to Thandiwe)
  "cro",
  "cfo",
  "coo",
  "cco",
  "cosec",
  "ciso",
  "io",
  "audit",
];

/**
 * Snapshot the procedure-file index. Returns the relative paths under
 * `Procedures/` that exist on disk (e.g. `Procedures/by-policy/foo.md`).
 */
function loadProcedureIndex(): Set<string> {
  const out = new Set<string>();
  if (!existsSync(PROCEDURES_DIR)) return out;
  const subdirs = ["by-policy", "templates", "validation"];
  for (const sub of subdirs) {
    const dir = resolve(PROCEDURES_DIR, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      out.add(`Procedures/${sub}/${f}`);
    }
  }
  // Top-level files (e.g. _index.md) — included for completeness.
  for (const f of readdirSync(PROCEDURES_DIR)) {
    if (!f.endsWith(".md")) continue;
    out.add(`Procedures/${f}`);
  }
  return out;
}

/**
 * Extract bullet lines from a markdown section body. A "bullet" is any
 * line whose first non-whitespace character is `-` or `*`. Continuation
 * lines (sub-bullets) are not flattened — they are returned as their own
 * bullets, which is what we want: the resolution tokens (procedure
 * paths, capability paths) are always on a single bullet.
 */
function extractBullets(body: string): string[] {
  return body
    .split(/\r?\n/)
    .filter((l) => /^\s*[\-*]\s+/.test(l))
    .map((l) => l.replace(/^\s*[\-*]\s+/, "").trim());
}

/**
 * Pull the first procedure path out of a bullet line. Recognises the
 * canonical `Procedures/<sub>/<file>.md` form (in inline code, in plain
 * text, or with backticks). Returns the relative path or undefined.
 */
function extractProcedurePath(line: string): string | undefined {
  // Match `Procedures/by-policy/foo.md`, optionally inside backticks.
  const m = line.match(/`?(Procedures\/[A-Za-z0-9_\-./]+\.md)`?/);
  return m?.[1];
}

/**
 * Pull the first `@platform/...` capability reference out of a bullet
 * line. Recognises the inline-code form (the canonical) and the plain
 * form. Returns the path with the `@platform/` prefix or undefined.
 */
function extractCapabilityPath(line: string): string | undefined {
  // Match `@platform/foo/bar.ts` or `@platform/foo/bar` (with or without
  // backticks). The character class excludes whitespace and most
  // punctuation that would terminate a path token.
  const m = line.match(/`?(@platform\/[A-Za-z0-9_\-./]+)`?/);
  return m?.[1];
}

/**
 * Resolve a `@platform/...` reference to a real file under
 * `prototype/platform/`. The reference may include or omit the `.ts`
 * extension and may name a directory (resolves if `index.ts` exists).
 */
function capabilityResolves(ref: string): boolean {
  // Strip the `@platform/` prefix.
  const tail = ref.replace(/^@platform\//, "");
  const candidates = [
    resolve(PROTOTYPE_DIR, "platform", tail),
    resolve(PROTOTYPE_DIR, "platform", `${tail}.ts`),
    resolve(PROTOTYPE_DIR, "platform", tail, "index.ts"),
  ];
  return candidates.some((p) => existsSync(p));
}

/**
 * Resolve the named overseer in a `## 10. Decisions that escalate`
 * table row. Audit intent: the cell must name at least one human or
 * recognised corporate body that can receive the escalation. Side-
 * channel escalations to non-resolvable humans are findings.
 *
 * Resolution rule: if the cell contains *any* token that resolves to
 * either a team-roster entry (CLAUDE.md team table + Marc + Scrooge) or
 * a `RECOGNISED_BODIES` keyword (CEO, Board, ALCO, BRC, AC, etc.), the
 * cell resolves. Free-form prose annotations alongside a recognised
 * name (e.g. `Helena (CRO) → CEO; PA path lit if regulatory`) are
 * therefore tolerated — the recon's question is "is at least one
 * legitimate overseer named?", not "is the entire cell a clean
 * name list?".
 *
 * Returns `undefined` on success, or the (truncated) cell value on
 * failure for the violation message.
 */
function resolveOverseer(cellValue: string, roster: ReadonlySet<string>): string | undefined {
  // Tokenise the cell on any non-letter boundary, lower-case, and check
  // each token against the roster + recognised-bodies list. The lowest
  // false-positive rate comes from accepting any single-name match —
  // this matches the audit intent (one named overseer = resolvable).
  const tokens = cellValue.match(/[A-Za-z]+/g) ?? [];
  for (const t of tokens) {
    const lower = t.toLowerCase();
    if (roster.has(lower)) return undefined;
    if (RECOGNISED_BODIES.includes(lower)) return undefined;
  }
  return cellValue;
}

/**
 * Extract the `Target overseer` column values from §10's markdown table.
 * Expects the canonical column order from the template:
 *   `| Decision | Escalation criterion | Target overseer | Channel | Deadline |`
 * but tolerates additional or differently-labelled columns by detecting
 * the header row and indexing the column whose label contains "target".
 */
function extractEscalationTargets(body: string): string[] {
  const lines = body.split(/\r?\n/);
  let headerIdx = -1;
  let targetCol = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length === 0) continue;
    // Detect header: any cell containing "target" (case-insensitive).
    const colIdx = cells.findIndex((c) => /target/i.test(c));
    if (colIdx >= 0) {
      headerIdx = i;
      targetCol = colIdx;
      break;
    }
  }
  if (headerIdx < 0 || targetCol < 0) return [];
  const out: string[] = [];
  // Skip the header and the separator row that follows it.
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (!line.trim().startsWith("|")) break;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const cell = cells[targetCol];
    if (cell !== undefined && cell.length > 0) out.push(cell);
  }
  return out;
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
  /**
   * Override the procedure index — used by tests that don't want to touch
   * the live `/Procedures/` directory. The test passes the exact set of
   * relative paths that should be considered "resolvable".
   */
  procedureIndex?: ReadonlySet<string>;
  /**
   * Override the team roster — used by tests that exercise overseer
   * resolution against a known synthetic name set rather than CLAUDE.md.
   */
  teamRoster?: ReadonlySet<string>;
  /**
   * Override the capability resolver — used by tests that need to assert
   * resolution behaviour against a synthetic capability set rather than
   * walking `prototype/platform/`.
   */
  capabilityResolves?: (ref: string) => boolean;
}

/**
 * Assert agent-spec cross-link integrity over `specs`. Pure function:
 * reads only the strings provided (or, if `specs` is omitted, reads
 * every persona file under `teamDir` ?? TEAM_DIR), plus the procedure
 * index and team roster from disk (override-able for tests).
 */
export function assertCrossLinks(opts: AssertOpts = {}): ReconResult {
  const result = emptyResult("agent-spec-cross-link");
  const violations: ReconViolation[] = [];

  const specs: Array<readonly [string, string]> =
    opts.specs !== undefined
      ? [...opts.specs]
      : listPersonaFilesIn(opts.teamDir ?? TEAM_DIR).map(
          (p) => [p, readFileSync(p, "utf8")] as const,
        );

  const procedureIndex = opts.procedureIndex ?? loadProcedureIndex();
  const teamRoster = opts.teamRoster ?? loadTeamRoster();
  const resolveCapability = opts.capabilityResolves ?? capabilityResolves;

  for (const [path, content] of specs) {
    const fileName = basename(path);
    const subject = path.replace(`${REPO_ROOT}/`, "");
    const personaName = fileName.replace(/\.md$/i, "");
    result.asserted++;

    // 1. §13 Procedures owned — every cited procedure path resolves or
    //    carries a roadmap marker.
    const procsBody = extractSection(content, 13, "Procedures owned");
    if (procsBody !== undefined) {
      for (const bullet of extractBullets(procsBody)) {
        const ref = extractProcedurePath(bullet);
        if (!ref) continue; // bullet has no procedure path (legitimate prose)
        if (procedureIndex.has(ref)) continue;
        if (isExempt(bullet)) continue;
        violations.push({
          subject,
          message: `${personaName}: § 13 procedure path "${ref}" does not resolve to an existing file under Procedures/ and the bullet carries no roadmap marker (e.g. "(planned)"). Either create the procedure or annotate the bullet.`,
          severity: "warn",
        });
      }
    }

    // 2. §12 System capabilities called — every `@platform/...` reference
    //    resolves to a real file under `prototype/platform/` or carries a
    //    roadmap marker.
    const capsBody = extractSection(content, 12, "System capabilities called");
    if (capsBody !== undefined) {
      for (const bullet of extractBullets(capsBody)) {
        const ref = extractCapabilityPath(bullet);
        if (!ref) continue;
        if (resolveCapability(ref)) continue;
        if (isExempt(bullet)) continue;
        violations.push({
          subject,
          message: `${personaName}: § 12 capability "${ref}" does not resolve to a file under prototype/platform/ and the bullet carries no roadmap marker (e.g. "(planned)" or "[substrate-gap: ...]"). Either land the capability or annotate the bullet.`,
          severity: "warn",
        });
      }
    }

    // 3. §10 Decisions that escalate — every `Target overseer` cell
    //    must name at least one resolvable human or recognised
    //    corporate body. Side-channel escalations to non-resolvable
    //    humans are findings.
    const escBody = extractSection(content, 10, "Decisions that escalate");
    if (escBody !== undefined && teamRoster.size > 0) {
      for (const cell of extractEscalationTargets(escBody)) {
        const failing = resolveOverseer(cell, teamRoster);
        if (failing === undefined) continue;
        violations.push({
          subject,
          message: `${personaName}: § 10 escalation target "${cell}" names no resolvable overseer — not a CLAUDE.md team-roster entry, not Marc (CEO) / Scrooge, and not a recognised corporate body (Board, ALCO, BRC, AC, EXCO). Side-channel escalations to non-resolvable humans are findings.`,
          severity: "warn",
        });
      }
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
  return assertCrossLinks({});
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? (r.violations.length ? "warn" : "info") : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? r.violations.length
          ? `Agent-spec cross-link recon: ${r.violations.length} warn(s)`
          : "Agent-spec cross-link recon passed"
        : "Agent-spec cross-link recon FAILED",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
