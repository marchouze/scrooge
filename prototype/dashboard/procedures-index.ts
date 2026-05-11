// dashboard/procedures-index.ts
//
// Parses `Procedures/_index.md` (the master inventory of every procedure
// authored under each approved policy) and the per-procedure files under
// `Procedures/by-policy/`, and returns a structured view for the
// /api/procedures endpoint consumed by `procedures.html`.
//
// The index file groups rows under H2 sections — "Foundation & meta-policies",
// "Risk", "Compliance & financial crime", "Operations & technology", etc. —
// each containing a four-column table: `| Policy | Procedure | Owner |
// Status |`. The "Procedure" cell may carry the file name as bare text
// (`procedures-rmf-governance.md`) or as a markdown link
// (`[caption](by-policy/<file>.md)`); the link form indicates the file
// exists. We resolve every file-bearing cell against
// `Procedures/by-policy/` and parse the YAML frontmatter present on the
// authored procedures (id, title, owner, policy-parent, status,
// last-reviewed, reconciliation-cadence) to enrich each row.
//
// Per CLAUDE.md Principle 2 — single citable graph: this is a read-only
// projection over the canonical procedures index + procedure files. No
// authored content lives here. The procedures-index file is the single
// citable source for the policy → procedure mapping; per-procedure files
// are the citable source for procedure metadata.
//
// Per the prose-duplication rule (memory: feedback_canonical_source_registry):
// the view returns *structured pointers* (file path, frontmatter values),
// never substantive procedure-text copies. The browser links straight to
// the source markdown.
//
// Author: Atlas (substrate seam: /api/procedures)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ProcedureRow {
  /** Policy column from `_index.md` (free-text — multiple policies separated by " + " or "/"). */
  policy: string;
  /**
   * Procedure file name (e.g. `kyc-onboarding.md`) when the cell resolves
   * to a real file under `Procedures/by-policy/`; empty when the cell is
   * descriptive text only (e.g. shared-ownership annotations).
   */
  procedureFile: string;
  /** The first link caption / filename when present, plus any inline notes captured verbatim from the cell. */
  procedureLabel: string;
  /** The visible cell text including any trailing parenthetical notes the index author added. */
  procedureCellRaw: string;
  /** Owner column from `_index.md`. */
  owner: string;
  /** Normalised status: `POPULATED` / `STUB` / `PLANNED` / `DRAFT` / "" (unparseable). */
  status: string;
  /** Status cell as authored (may include version notes — kept for surface display). */
  statusRaw: string;
  /** Frontmatter `id` from the procedure file (e.g. `PROC-MK-NPA-DD-01`); empty when no file or no frontmatter id. */
  procedureId: string;
  /** Frontmatter `title` from the procedure file; empty when no file or no frontmatter title. */
  procedureTitle: string;
  /** Frontmatter `policy-parent`. */
  policyParent: string;
  /** Frontmatter `last-reviewed` (ISO-ish date authored by procedure owner). */
  lastReviewed: string;
  /** Frontmatter `reconciliation-cadence` (free-text). */
  reconciliationCadence: string;
  /**
   * `true` when `_index.md` cites a `by-policy/<file>.md` path that does
   * not exist on disk. These are the "no-orphans" findings the page
   * surfaces.
   */
  orphan: boolean;
  /**
   * Verify hints surfaced when expected fields are missing. Each hint is
   * a short token: `NO-FRONTMATTER`, `NO-ID`, `NO-POLICY-PARENT`,
   * `NO-LAST-REVIEWED`, `ORPHAN-FILE-MISSING`. Empty array means the
   * row is fully resolved at the procedure-file layer.
   */
  verifyHints: string[];
}

export interface ProcedureGroup {
  /** H2 section heading from `_index.md` (e.g. "Foundation & meta-policies", "Risk"). */
  domain: string;
  rows: ProcedureRow[];
}

export interface ProceduresIndexView {
  asOf: string;
  /** Total rows parsed across every domain. */
  count: number;
  /** Histogram of normalised status values across all rows. */
  statusCounts: Record<string, number>;
  /** Number of rows whose `_index.md` citation references a file that doesn't exist on disk. */
  orphanCount: number;
  /** Number of rows whose `procedureFile` resolves to an existing file (i.e. authored). */
  authoredCount: number;
  groups: ProcedureGroup[];
}

const TABLE_ROW = /^\s*\|(.*)\|\s*$/;
const H2_HEADING = /^##\s+(.+?)\s*$/;
// Markdown link in the procedure cell: [caption](by-policy/file.md) — caption may be backticked.
const LINK_RE = /\[`?([^\]`]+)`?\]\(by-policy\/([^)]+)\)/;
// Bare backticked filename: `procedures-rmf-governance.md`.
const BARE_FILE_RE = /`([a-z0-9-]+\.md)`/i;

/** Normalise the status cell into one of the canonical tokens. */
function normaliseStatus(cell: string): string {
  const stripped = cell.replace(/\*\*/g, "").trim();
  if (!stripped) return "";
  const upper = stripped.toUpperCase();
  if (upper.startsWith("POPULATED")) return "POPULATED";
  if (upper.startsWith("STUB")) return "STUB";
  if (upper.startsWith("PLANNED")) return "PLANNED";
  if (upper.startsWith("DRAFT")) return "DRAFT";
  return stripped;
}

/** Parse a single H2 heading line. Returns the section title or null. */
function parseHeading(line: string): string | null {
  const m = line.match(H2_HEADING);
  return m ? (m[1] ?? "").trim() : null;
}

/** Identify table-header / divider rows so we don't ingest them as data. */
function isHeaderOrDivider(cells: string[]): boolean {
  if (cells.length < 4) return false;
  const first = (cells[0] ?? "").toLowerCase();
  if (first === "policy") return true;
  // Markdown table divider: cells of the form `---` / `:---:` etc.
  if (cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))) return true;
  return false;
}

interface ProcedureCellParse {
  /** The resolved file name (without `by-policy/` prefix), or empty when none. */
  procedureFile: string;
  /** The link caption, or the bare filename, or the cell stripped to its first chunk. */
  procedureLabel: string;
  /**
   * `true` when the cell uses an explicit `[caption](by-policy/<file>.md)`
   * link form — the index author is asserting the file exists. A bare
   * backticked filename is treated as a *forward reference* (typically on
   * a PLANNED row) and does NOT trigger orphan flagging when the file is
   * absent.
   */
  isExplicitLink: boolean;
}

/** Pull the procedure file name + label out of the index cell. */
function parseProcedureCell(cell: string): ProcedureCellParse {
  const link = cell.match(LINK_RE);
  if (link) {
    return {
      procedureFile: (link[2] ?? "").trim(),
      procedureLabel: (link[1] ?? "").trim(),
      isExplicitLink: true,
    };
  }
  const bare = cell.match(BARE_FILE_RE);
  if (bare) {
    return {
      procedureFile: (bare[1] ?? "").trim(),
      procedureLabel: (bare[1] ?? "").trim(),
      isExplicitLink: false,
    };
  }
  // No file reference — cell is descriptive text only ("shared", "future CAE", etc.).
  return {
    procedureFile: "",
    procedureLabel: cell.replace(/\*\*/g, "").trim(),
    isExplicitLink: false,
  };
}

interface ProcedureFrontmatter {
  id: string;
  title: string;
  policyParent: string;
  lastReviewed: string;
  reconciliationCadence: string;
  hadFrontmatter: boolean;
}

const EMPTY_FRONTMATTER: ProcedureFrontmatter = {
  id: "",
  title: "",
  policyParent: "",
  lastReviewed: "",
  reconciliationCadence: "",
  hadFrontmatter: false,
};

/**
 * Read the YAML frontmatter block from a procedure file. Frontmatter is a
 * single `---` … `---` block at the top of the file with simple
 * `key: value` lines (no nested structure). Returns blank fields when
 * the block is absent or a key is missing.
 */
function readProcedureFrontmatter(path: string): ProcedureFrontmatter {
  if (!existsSync(path)) return EMPTY_FRONTMATTER;
  const text = readFileSync(path, "utf8");
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return EMPTY_FRONTMATTER;
  const block = match[1] ?? "";
  const fields: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = (kv[1] ?? "").trim();
    const value = (kv[2] ?? "").trim();
    fields[key] = value;
  }
  return {
    id: fields.id ?? "",
    title: fields.title ?? "",
    policyParent: fields["policy-parent"] ?? "",
    lastReviewed: fields["last-reviewed"] ?? "",
    reconciliationCadence: fields["reconciliation-cadence"] ?? "",
    hadFrontmatter: true,
  };
}

function buildVerifyHints(
  parsed: ProcedureCellParse,
  fileExists: boolean,
  fm: ProcedureFrontmatter,
): string[] {
  const hints: string[] = [];
  if (!parsed.procedureFile) return hints; // descriptive cell — no hints expected
  if (!fileExists) {
    // Only an explicit `[caption](by-policy/<file>.md)` link missing on
    // disk is an orphan. A bare backticked filename is a forward
    // reference (typical on PLANNED rows) and does not warrant a hint.
    if (parsed.isExplicitLink) hints.push("ORPHAN-FILE-MISSING");
    return hints;
  }
  if (!fm.hadFrontmatter) {
    hints.push("NO-FRONTMATTER");
    return hints;
  }
  if (!fm.id) hints.push("NO-ID");
  if (!fm.policyParent) hints.push("NO-POLICY-PARENT");
  if (!fm.lastReviewed) hints.push("NO-LAST-REVIEWED");
  return hints;
}

export function getProceduresIndex(repoRoot: string): ProceduresIndexView {
  const indexPath = resolve(repoRoot, "Procedures", "_index.md");
  const groups: ProcedureGroup[] = [];
  const statusCounts: Record<string, number> = {};
  let orphanCount = 0;
  let authoredCount = 0;
  let total = 0;

  if (!existsSync(indexPath)) {
    return {
      asOf: new Date().toISOString(),
      count: 0,
      statusCounts,
      orphanCount: 0,
      authoredCount: 0,
      groups,
    };
  }

  const text = readFileSync(indexPath, "utf8");
  const lines = text.split(/\r?\n/);
  let currentGroup: ProcedureGroup | null = null;
  // After "---" the index transitions into the status-summary appendix
  // (Status summary table, How-to-extend, etc.). We stop ingesting domain
  // groups at the first horizontal-rule divider.
  let inAppendix = false;

  for (const raw of lines) {
    if (/^\s*---\s*$/.test(raw)) {
      inAppendix = true;
      continue;
    }
    if (inAppendix) continue;

    const heading = parseHeading(raw);
    if (heading) {
      currentGroup = { domain: heading, rows: [] };
      groups.push(currentGroup);
      continue;
    }

    const m = raw.match(TABLE_ROW);
    if (!m || !currentGroup) continue;

    const cells = (m[1] ?? "").split("|").map((c) => c.trim());
    if (cells.length < 4) continue;
    if (isHeaderOrDivider(cells)) continue;

    const policyCell = cells[0] ?? "";
    const procedureCellRaw = cells[1] ?? "";
    const ownerCell = cells[2] ?? "";
    const statusCell = cells[3] ?? "";

    // Skip the appendix's "Status summary" rows (different schema).
    // We're already gated by `inAppendix`, but defensive: skip any row
    // whose first cell looks like a status keyword from the summary.
    if (/^\*\*?(POPULATED|PLANNED|Total)/i.test(policyCell)) continue;

    const parsed = parseProcedureCell(procedureCellRaw);
    const procedureFile = parsed.procedureFile;
    const filePath = procedureFile
      ? resolve(repoRoot, "Procedures", "by-policy", procedureFile)
      : "";
    const fileExists = procedureFile ? existsSync(filePath) : false;
    const fm = fileExists ? readProcedureFrontmatter(filePath) : EMPTY_FRONTMATTER;
    // Orphan = the index *links* to a file that does not exist on disk.
    // Bare backticked filenames are forward references (PLANNED rows) and
    // are not orphans even when the file is absent.
    const orphan = Boolean(procedureFile) && !fileExists && parsed.isExplicitLink;
    const verifyHints = buildVerifyHints(parsed, fileExists, fm);

    const status = normaliseStatus(statusCell);
    const row: ProcedureRow = {
      policy: policyCell.replace(/\*\*/g, "").trim(),
      procedureFile,
      procedureLabel: parsed.procedureLabel,
      procedureCellRaw,
      owner: ownerCell.replace(/\*\*/g, "").trim(),
      status,
      statusRaw: statusCell.replace(/\*\*/g, "").trim(),
      procedureId: fm.id,
      procedureTitle: fm.title,
      policyParent: fm.policyParent,
      lastReviewed: fm.lastReviewed,
      reconciliationCadence: fm.reconciliationCadence,
      orphan,
      verifyHints,
    };

    currentGroup.rows.push(row);
    total += 1;
    if (orphan) orphanCount += 1;
    if (fileExists) authoredCount += 1;
    const statusKey = status || "UNCLASSIFIED";
    statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1;
  }

  // Drop empty groups (H2 sections that contained only prose and no rows).
  const nonEmpty = groups.filter((g) => g.rows.length > 0);

  return {
    asOf: new Date().toISOString(),
    count: total,
    statusCounts,
    orphanCount,
    authoredCount,
    groups: nonEmpty,
  };
}
