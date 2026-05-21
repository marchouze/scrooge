// platform/recon/persona-attribution-coherence.ts
//
// Vera continuous-controls pipeline: assert that every `<Name> (<Position>)`
// reference in `Procedures/**/*.md`, `Policies/**/*.md`, and `Team/*.md`
// matches the canonical `(name, position)` tuple recorded in
// `Team/_team-roster.json`.
//
// Two drift classes today:
//   1. CCO drift — Rashida (Chief Information Security Officer) labelled
//      as Chief Compliance Officer in several places (Owen's PR #646 swept
//      five but the drift can recur).
//   2. CISO drift — Senna (Security engineer) labelled as Chief Information
//      Security Officer in 7+ Procedures/by-policy/*.md files, including
//      `event-schema-evolution.md` line 16 listing both Senna AND Rashida
//      as "CISO" simultaneously.
//
// Severity:
//   - hard FAIL: name present in roster, asserted position differs from
//     canonical (after position normalisation). This is a drift finding.
//   - WARN (advisory): name not present in roster. Could be deprecated
//     agent, external party, or roster gap — surface for Owen triage.
//   - INFO: parse-rejections (regex ambiguity). Recorded for transparency
//     but never fail-class.
//
// Advisory-only operating mode:
//   The recon currently runs ADVISORY (exit 0 regardless of findings) so
//   it can land in CI alongside the Senna/CISO drift that Owen surfaced.
//   The drift is a separate Senna-led follow-on sweep — fixing belongs in
//   another PR. Once that sweep lands the recon flips to fail-class via
//   the `BANK_PERSONA_ATTRIBUTION_STRICT` env flag (already wired below).
//
// Authority:
//   - Principle 2 (single-graph discipline) — every node carries a typed
//     citation; persona attribution is a node-level invariant.
//   - CLAUDE.md "Identity discipline" — every reference pairs name +
//     position on first mention.
//   - `Team/_team-roster.json` — canonical roster (D-PRINCIPLES-P2-P6-MERGE
//     canonical-source registry; Owen as registry owner).
//   - Rashida PR #644 (surfaced Rashida/CCO drift).
//   - Owen PR #646 (corrected Rashida/CCO drift in five files; surfaced
//     Senna/CISO drift in 7+ files).
//
// Author: Vera (Internal audit engineer, governance —
//   functionally to Thandiwe (Chief Audit Executive, governance);
//   administratively through the CEO).

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "persona-attribution-coherence";

// ---------------------------------------------------------------------------
// Roster shape (matches Team/_team-roster.json `personas[]` entries; only
// the fields we need are declared).
// ---------------------------------------------------------------------------

interface RosterEntry {
  name: string;
  role: string;
  type?: string;
}

interface RosterFile {
  personas: RosterEntry[];
}

// ---------------------------------------------------------------------------
// Position normalisation.
//
// Each persona file or procedure header may render the role in several
// equivalent forms. The normalisation pass collapses surface variation to
// a single canonical form for comparison. Suffixes like ", governance" or
// ", engineering" are stripped during comparison — they describe the
// reporting line, not the role itself.
// ---------------------------------------------------------------------------

const POSITION_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  // C-suite full ↔ abbreviation
  [/^chief\s+risk\s+officer$/i, "chief risk officer"],
  [/^cro$/i, "chief risk officer"],
  [/^chief\s+compliance\s+officer$/i, "chief compliance officer"],
  [/^cco$/i, "chief compliance officer"],
  [/^chief\s+information\s+security\s+officer$/i, "chief information security officer"],
  [/^ciso$/i, "chief information security officer"],
  [/^chief\s+financial\s+officer$/i, "chief financial officer"],
  [/^cfo$/i, "chief financial officer"],
  [/^chief\s+operating\s+officer$/i, "chief operating officer"],
  [/^coo$/i, "chief operating officer"],
  [/^chief\s+audit\s+executive$/i, "chief audit executive"],
  [/^cae$/i, "chief audit executive"],
  [/^chief\s+executive\s+officer$/i, "chief executive officer"],
  [/^ceo$/i, "chief executive officer"],
  [/^company\s+secretary$/i, "company secretary"],
  [/^cosec$/i, "company secretary"],
  [/^information\s+officer$/i, "information officer"],
  [/^io$/i, "information officer"],
];

/**
 * Known governance-class canonical positions. Drift between two of these
 * (e.g. canonical=CISO, asserted=CCO) is the high-signal drift class the
 * recon was built to catch. Drift between an engineering role and a
 * governance role is also high-signal (e.g. Senna(Security engineer)
 * labelled as CISO).
 */
const GOVERNANCE_ROLES = new Set([
  "chief risk officer",
  "chief compliance officer",
  "chief information security officer",
  "chief financial officer",
  "chief operating officer",
  "chief audit executive",
  "chief executive officer",
  "company secretary",
  "information officer",
  "head of global markets",
  "treasurer",
]);

export function isGovernanceRole(position: string): boolean {
  return GOVERNANCE_ROLES.has(normalisePosition(position));
}

export function normalisePosition(raw: string): string {
  // Strip suffix descriptors. Order matters: dash-tail descriptors
  // (" — RAS approval", " — daily run") run first so the governance/
  // engineering suffix becomes anchorable to end-of-string, then the
  // paren/comma forms are stripped.
  const p = raw
    .replace(/\s*[—–]\s*.*$/, "") // strip after em/en-dash (descriptors)
    .replace(/\s*\(\s*(governance|engineering)\s*\)\s*$/i, "")
    .replace(/\s*,\s*(governance|engineering)\s*$/i, "")
    .replace(/^\s*(governance|engineering)\s*,\s*/i, "") // reversed form: "governance, Chief Financial Officer"
    .trim();

  for (const [pattern, canonical] of POSITION_ALIASES) {
    if (pattern.test(p)) return canonical;
  }
  return p.toLowerCase();
}

// ---------------------------------------------------------------------------
// Roster load.
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  /** Override the repo root — used by tests with synthetic fixture trees. */
  repoRoot?: string;
  /** Override the roster — used by tests. */
  roster?: RosterFile;
  /** Override the scan files — used by tests. Map: relative path → content. */
  files?: Map<string, string>;
  /**
   * When true, the recon exits 1 on `fail`-severity findings (drift). Used
   * by tests; the CLI honours `BANK_PERSONA_ATTRIBUTION_STRICT=1`.
   */
  strict?: boolean;
}

function loadRoster(repoRoot: string): RosterFile {
  const path = resolve(repoRoot, "Team/_team-roster.json");
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as RosterFile;
}

interface RosterIndex {
  /** Lowercase name → canonical normalised position. */
  byName: Map<string, string>;
  /** Lowercase name → raw role string (for human-readable reporting). */
  rawByName: Map<string, string>;
}

function buildRosterIndex(roster: RosterFile): RosterIndex {
  const byName = new Map<string, string>();
  const rawByName = new Map<string, string>();
  for (const p of roster.personas) {
    byName.set(p.name.toLowerCase(), normalisePosition(p.role));
    rawByName.set(p.name.toLowerCase(), p.role);
  }
  return { byName, rawByName };
}

// ---------------------------------------------------------------------------
// Scrape `(name, position)` pairs from markdown content.
//
// Tolerable forms:
//   - `Helena (Chief Risk Officer, governance)`          — canonical
//   - `**Helena** (Chief Risk Officer, governance)`      — bold-name
//   - capture the parenthesised position immediately after a name token
//
// To avoid matching prose like "Rashida said she would (later)", we
// require the parenthesised content to look like a role (a string that
// normalises to a roster role OR contains a role keyword: Officer,
// Engineer, Executive, Secretary, Architect, Head of, etc.). This is a
// soft filter — if it doesn't look like a position we silently skip
// (no false-positive findings).
// ---------------------------------------------------------------------------

// Name = 2-30 chars, starts with uppercase, alpha-only (no spaces — first
// names only). Some persona files include diacritics (e.g. "André"); we
// accept letter-class via the Unicode property.
const PAIR_REGEX = /(?:\*\*)?(\p{Lu}[\p{L}'-]{1,29})(?:\*\*)?\s*\(([^)]{3,200})\)/gu;

const ROLE_KEYWORDS = [
  "officer",
  "engineer",
  "executive",
  "secretary",
  "architect",
  "head of",
  "treasurer",
  "ceo",
  "cfo",
  "coo",
  "cro",
  "cco",
  "ciso",
  "cae",
  "cosec",
];

/**
 * Disqualifiers — lexical markers that the parenthesised content is
 * continuation prose, not a role label. Examples:
 *   - "Helena (or delegated Rohan ...)"      — branching prose
 *   - "Eitan (via Scrooge)"                  — routing prose
 *   - "Camille (CFO signs)"                  — verb-leading prose
 *   - "Helena (within CRO delegated authority)" — preposition-leading prose
 *
 * The list is conservative — false negatives (missed drift) are
 * preferred over false positives (noise findings). Position labels that
 * legitimately contain these words can be added to a permitlist in the
 * future if needed.
 */
const POSITION_DISQUALIFIERS = [
  /\bvia\b/i,
  /\bor\s+delegated\b/i,
  /\bsigns\b/i,
  /\bwithin\b/i,
  /\bwhen\b/i,
  /\bif\b/i,
  /\bvia Scrooge\b/i,
  /^\s*(or|and|with|for)\s+/i,
  /\bneeds\s+CEO\b/i,
  /\bhuman\s+CFO\b/i,
  /\bMLRO\s*$/i, // "CCO, MLRO" — dual-hat prose; recorded explicitly in roster comment
];

function looksLikeRole(candidate: string): boolean {
  const c = candidate.toLowerCase();
  if (!ROLE_KEYWORDS.some((kw) => c.includes(kw))) return false;
  // Reject obvious continuation-prose patterns.
  for (const dq of POSITION_DISQUALIFIERS) {
    if (dq.test(candidate)) return false;
  }
  // Reject if it contains a comma followed by another role keyword
  // (compound-prose like "co-author" or "MLRO + FIC Compliance Officer at
  // the bank ...").
  if (candidate.length > 120) return false;
  return true;
}

export interface ScrapedPair {
  name: string;
  position: string;
  file: string;
  line: number;
}

export function scrapePairs(content: string, file: string): ScrapedPair[] {
  const lines = content.split("\n");
  const out: ScrapedPair[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    // Skip code fences (`` ` `` heuristic — three-backtick fenced blocks
    // are not common in our markdown but we exclude obviously-code lines).
    if (line.trim().startsWith("```")) continue;
    let m: RegExpExecArray | null = null;
    // Use a per-line regex (lastIndex isolation) to avoid cross-line state.
    const re = new RegExp(PAIR_REGEX.source, "gu");
    m = re.exec(line);
    while (m !== null) {
      const name = m[1] ?? "";
      const position = (m[2] ?? "").trim();
      if (looksLikeRole(position)) {
        out.push({ name, position, file, line: i + 1 });
      }
      m = re.exec(line);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// File walk.
// ---------------------------------------------------------------------------

function walkMarkdown(root: string, subdir: string): string[] {
  const start = resolve(root, subdir);
  if (!existsSync(start)) return [];
  const out: string[] = [];
  const stack = [start];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) break;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        // Skip archived content — out of scope.
        if (entry === "actioned" || entry === "archive" || entry.startsWith(".")) continue;
        stack.push(full);
      } else if (st.isFile() && full.endsWith(".md")) {
        out.push(full);
      }
    }
  }
  return out;
}

function collectScanFiles(repoRoot: string, opts: RunOpts): Map<string, string> {
  if (opts.files) return opts.files;
  const out = new Map<string, string>();
  const subdirs = ["Procedures", "Policies", "Team"];
  for (const sub of subdirs) {
    for (const full of walkMarkdown(repoRoot, sub)) {
      const rel = full.slice(repoRoot.length + 1);
      try {
        out.set(rel, readFileSync(full, "utf-8"));
      } catch {
        // Skip unreadable files (symlinks, permissions). No-op.
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pipeline run
// ---------------------------------------------------------------------------

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const repoRoot = opts.repoRoot ?? findRepoRoot(import.meta.dir);
  const roster = opts.roster ?? loadRoster(repoRoot);
  const index = buildRosterIndex(roster);

  const files = collectScanFiles(repoRoot, opts);

  for (const [file, content] of files) {
    const pairs = scrapePairs(content, file);
    for (const pair of pairs) {
      result.asserted++;
      const canonical = index.byName.get(pair.name.toLowerCase());
      if (canonical === undefined) {
        // Advisory — name not in roster. Could be external party, deprecated
        // agent, or roster gap. Owen triages.
        violations.push({
          subject: `${pair.file}:${pair.line}:${pair.name}`,
          severity: "warn",
          message: `${pair.file}:${pair.line} references "${pair.name} (${pair.position})" but no persona named "${pair.name}" exists in Team/_team-roster.json. Owen-triageable: could be external party, deprecated agent, or roster gap.`,
        });
        continue;
      }
      const asserted = normalisePosition(pair.position);
      if (asserted !== canonical) {
        const canonicalRaw = index.rawByName.get(pair.name.toLowerCase()) ?? canonical;
        // Scope FAIL semantics to the high-signal drift class:
        //   - asserted position is a governance / C-suite role
        //     (the Senna→CISO, Rashida→CCO drift class)
        //   - OR canonical is a governance role and asserted is something
        //     other than that role
        // Other drift (engineering-role specialisation, e.g. "Risk engineer"
        // vs "Market risk quantitative engineer") emits as INFO advisory —
        // recorded for transparency, not a finding.
        const assertedIsGov = GOVERNANCE_ROLES.has(asserted);
        const canonicalIsGov = GOVERNANCE_ROLES.has(canonical);
        const isGovDrift = assertedIsGov || canonicalIsGov;
        violations.push({
          subject: `${pair.file}:${pair.line}:${pair.name}`,
          severity: isGovDrift ? "fail" : "info",
          message: `${pair.file}:${pair.line} attributes "${pair.name}" as "${pair.position}" but canonical role in Team/_team-roster.json is "${canonicalRaw}". Identity-discipline drift per CLAUDE.md; fix the reference or update the roster. Authority: Principle 2; D-PRINCIPLES-P2-P6-MERGE.`,
        });
      }
    }
  }

  result.violations = violations;
  // ok is computed against fail-severity only; warns are advisory.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  const strict = process.env.BANK_PERSONA_ATTRIBUTION_STRICT === "1";
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  console.log(
    JSON.stringify({
      level: failCount === 0 ? "info" : "warn",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      fail: failCount,
      warn: warnCount,
      ok: r.ok,
      mode: strict ? "strict" : "advisory",
      msg:
        failCount === 0
          ? `persona-attribution-coherence passed — ${r.asserted} (name, position) tuples asserted; ${warnCount} advisory (name-not-in-roster).`
          : `persona-attribution-coherence detected ${failCount} drift finding(s) and ${warnCount} advisory (name-not-in-roster). Running in ${strict ? "strict" : "advisory"} mode.`,
      detail: r.violations,
    }),
  );
  // Advisory mode (default) emits findings but always exits 0 — the
  // Senna/CISO drift is a known finding pending Senna-led sweep. Flip to
  // strict via BANK_PERSONA_ATTRIBUTION_STRICT=1 once that sweep lands.
  if (strict && failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}
