// dashboard/policy-register.ts
//
// Parses `Owner Inbox/2026-05-06_policy-register.md` into typed Policy
// entries and cross-references against `Regulations/_obligations-register.md`
// to populate each policy's `linkedObligations[]`.
//
// Per CLAUDE.md Principle 1: this is a pure projection over canonical source.
// The register is the truth; we re-derive on every dashboard tick — no cache.
//
// Per Principle 2 (the upward chain): every policy carries the source
// authority it implements (REGULATORY / OBJECTIVE) and the bind state of
// the underlying obligation (CORPORATE / LICENCE / COMMENCEMENT /
// CONDITIONAL). Both classifications fall out of the citation text plus
// the obligations-register cross-reference.
//
// Author: Anya (data)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

import type { Policy, PolicyBind, PolicySource, PolicyStatus } from "./types";

// ---------------------------------------------------------------------------
// Minimal YAML frontmatter reader (mirrors the one in products-policy-chain.ts
// but kept inline to avoid a circular import).
// ---------------------------------------------------------------------------

const FM_DELIM = /^---\s*$/;

function readFrontmatter(content: string): string {
  const lines = content.split(/\r?\n/);
  if (!FM_DELIM.test(lines[0] ?? "")) return "";
  for (let i = 1; i < lines.length; i++) {
    if (FM_DELIM.test(lines[i] ?? "")) return lines.slice(1, i).join("\n");
  }
  return "";
}

function fmScalar(raw: string, key: string): string | undefined {
  const m = raw.match(new RegExp(`^${key}\\s*:\\s*(.+?)\\s*$`, "im"));
  if (!m?.[1]) return undefined;
  return m[1].replace(/^["']|["']$/g, "").trim();
}

const TABLE_ROW = /^\s*\|(.*)\|\s*$/;

// The canonical policy register basename — included as a `sourceFiles[]`
// fallback for every policy so that a row always has *something*
// previewable, and the user lands on the row-of-truth for any policy
// whose authoring document is not yet split out into a standalone file.
const POLICY_REGISTER_BASENAME = "2026-05-06_policy-register.md";

// Match `Owner Inbox/<name>.md` references appearing inline in any cell
// (typically the status cell). We deliberately match `Owner Inbox/`
// rather than a bare `.md` so we don't pick up procedure-file mentions
// like `procedure secure-sdlc.md` (those live under
// `Procedures/by-policy/`, not `Owner Inbox/`).
const OWNER_INBOX_MD_REF = /Owner\s+Inbox\/([A-Za-z0-9._-]+\.md)/g;

// Match `Policies/<name>.md` references appearing inline in any cell —
// the canonical Policies/ home introduced by D-POLICY-DOCUMENT-HOME
// Option C (CEO-approved 2026-05-12).
const POLICIES_MD_REF = /Policies\/([A-Za-z0-9._-]+\.md)/g;

function extractOwnerInboxPolicyFiles(...cells: string[]): string[] {
  const out = new Set<string>();
  for (const cell of cells) {
    if (!cell) continue;
    for (const m of cell.matchAll(OWNER_INBOX_MD_REF)) {
      const name = m[1];
      if (!name) continue;
      // Defensive: strip any path segment so the result is always a
      // basename suitable for the `/api/policy/:filename` allow-list.
      out.add(basename(name));
    }
    for (const m of cell.matchAll(POLICIES_MD_REF)) {
      const name = m[1];
      if (!name) continue;
      // Store with Policies/ prefix so the server knows which directory to read from
      // (D-POLICY-DOCUMENT-HOME Option C).
      out.add(`Policies/${basename(name)}`);
    }
  }
  return Array.from(out);
}

/**
 * List all `.md` files in `Policies/` (D-POLICY-DOCUMENT-HOME Option C).
 * Returns basenames only. Returns `[]` if the directory does not exist.
 */
function listPoliciesDirFiles(policiesDir: string): string[] {
  if (!existsSync(policiesDir)) return [];
  try {
    return readdirSync(policiesDir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .sort();
  } catch {
    return [];
  }
}

/**
 * Loosely match a `Policies/` filename stem against a policy name slug.
 * E.g. `liquidity-risk-management-policy-v1` matches `liquidity-risk-management-policy`.
 * We check whether the policy slug is a prefix of the filename stem (ignoring
 * trailing version markers like `-v1`, `-v2`, etc.).
 */
function policyFileStemMatchesSlug(stem: string, slug: string): boolean {
  // Strip trailing `-v<n>` or `-v<n>.<m>` version suffix from the stem.
  const stemWithoutVersion = stem.replace(/-v\d+(\.\d+)*$/, "");
  // Strip trailing `-policy` from the stem (so `liquidity-risk-management-policy`
  // matches `liquidity-risk-management`) — many policy slugs don't carry the
  // `-policy` suffix that the filename does.
  const slugNorm = slug.replace(/-policy$/, "");
  const stemNorm = stemWithoutVersion.replace(/-policy$/, "");
  return stemNorm === slugNorm || stemNorm.startsWith(slugNorm) || slugNorm.startsWith(stemNorm);
}

// ---------------------------------------------------------------------------
// Citation classifiers — keyword sets harvested from the obligations and
// policy registers. Each set names the canonical citation tokens that
// signal the corresponding source / bind class. Order is meaningful for
// bind-classification: more specific tokens win.
//
// References:
//   • memory: project_policies_implement_regs_and_objectives — REGULATORY vs
//     OBJECTIVE definition.
//   • memory: project_rules_bind_at_commencement — four-bucket bind taxonomy.
// ---------------------------------------------------------------------------

const REGULATORY_TOKENS: readonly string[] = [
  // Banking
  "Banks Act",
  "Reg Banks",
  "Regulations Relating to Banks",
  "BCBS",
  "Basel",
  "BA 110",
  "BA 120",
  "BA 330",
  "Pillar 1",
  "Pillar 2",
  "FRTB",
  "BCBS 144",
  "BCBS 223",
  "BCBS 239",
  "BCBS 248",
  "BCBS 295",
  "D295",
  "D335",
  "D352",
  "D368",
  "D457",
  "Joint Standard",
  "Joint Notice",
  "PA Guidance Note",
  "PA Directive",
  "SARB Directive",
  "SARB",
  "PA ",
  // Financial crime
  "FIC Act",
  "FATF",
  "FIC GN",
  "FIC Guidance Note",
  "POCDATARA",
  "DTI list",
  "OFAC",
  "UN Security Council",
  "EU consolidated",
  "HMT",
  "PRECCA",
  "UK Bribery Act",
  "FCPA",
  // Conduct / FAIS
  "FAIS",
  "FSCA",
  "FSR Act",
  "TCF outcomes",
  "Code of Conduct",
  "General Code of Conduct",
  "Conflict of Interest Code",
  "FMA",
  "Financial Markets Act",
  "JSE",
  "COFI",
  // Privacy / data
  "POPIA",
  "PAIA",
  "Information Regulator",
  "GDPR",
  // Cyber / IT / standards
  "ISO 27001",
  "ISO/IEC 27001",
  "NIST",
  "NIST SSDF",
  "SLSA",
  "FIPS 140",
  "SOC 2",
  "PCI",
  "ITIL",
  "COBIT",
  "ECTA",
  "Electronic Communications and Transactions Act",
  // Governance / company law
  "King IV",
  "Companies Act",
  "JSE LR",
  "JSE Listings",
  "IRBA",
  "Trust Property Control Act",
  // Accounting / tax
  "IFRS",
  "IAS ",
  "Income Tax Act",
  "VAT Act",
  "Tax Admin",
  "Tax Administration Act",
  "SARS",
  "FATCA",
  "CRS",
  "OECD",
  "BRS",
  "STT",
  // Labour / HR
  "Labour Relations Act",
  "BCEA",
  "Basic Conditions of Employment",
  "Employment Equity Act",
  "Skills Development Act",
  "Occupational Health and Safety Act",
  "B-BBEE",
  "Codes of Good Practice",
  "Protected Disclosures Act",
  "FSC",
  "SDL",
  // Treasury / markets infra
  "ISDA",
  "GMRA",
  "Currency and Exchanges Manual",
  "TCFD",
  // Audit
  "IIA IPPF",
  "IIA",
  // Credit
  "National Credit Act",
];

const OBJECTIVE_TOKENS: readonly string[] = [
  "Internal",
  "internal — implements",
  "Implements RAS",
  "Implements P2",
  "Implements P",
  "RAS",
  "Risk Appetite",
  "Bank objective",
  "Bank Objective",
  "Strategic foundation",
  "strategic-foundation",
];

// Bind classifiers. Each entry is a (tokens → bind) pair; the first
// matching entry wins per citation. Multiple matches can produce multiple
// binds (we run all entries and union).
const BIND_RULES: ReadonlyArray<{ readonly bind: PolicyBind; readonly tokens: readonly string[] }> =
  [
    {
      // Things that bind the moment the bank exists as a corporate entity
      // (Companies Act director duties, POPIA on personal-data processing,
      // ECTA on electronic execution, PRECCA bribery, tax-admin baseline,
      // labour law for any current/future employee).
      bind: "CORPORATE-BIND",
      tokens: [
        "Companies Act",
        "POPIA",
        "PAIA",
        "ECTA",
        "Electronic Communications and Transactions Act",
        "PRECCA",
        "UK Bribery Act",
        "FCPA",
        "Labour Relations Act",
        "BCEA",
        "Basic Conditions of Employment",
        "Employment Equity Act",
        "Skills Development Act",
        "Occupational Health and Safety Act",
        "B-BBEE",
        "Codes of Good Practice",
        "Protected Disclosures Act",
        "Tax Admin",
        "Tax Administration Act",
        "Income Tax Act",
        "VAT Act",
        "King IV",
        "Trust Property Control Act",
        "SDL",
        "FSC",
        // Accounting-standards / IT-governance frameworks bind from
        // corporate existence — IFRS preparation applies to any company
        // that publishes financial statements, ISO/COBIT/NIST are
        // self-imposed reference frameworks the bank has adopted.
        "IFRS",
        "IAS ",
        "ISO 27001",
        "ISO/IEC 27001",
        "COBIT",
        "NIST",
        "NIST SSDF",
        "SLSA",
        "FIPS 140",
        "ITIL",
        "IRBA",
      ],
    },
    {
      // Banking-specific rules that switch on at SARB licence grant.
      bind: "LICENCE-BIND",
      tokens: [
        "Banks Act",
        "Reg Banks",
        "Regulations Relating to Banks",
        "BCBS",
        "Basel",
        "BA 110",
        "BA 120",
        "BA 330",
        "FRTB",
        "Pillar 1",
        "Pillar 2",
        "BCBS 144",
        "BCBS 223",
        "BCBS 239",
        "BCBS 248",
        "BCBS 295",
        "D295",
        "D335",
        "D352",
        "D368",
        "D457",
        "FIC Act",
        "FIC GN",
        "FATF",
        "POCDATARA",
        "OFAC",
        "UN Security Council",
        "EU consolidated",
        "HMT",
        "Joint Standard",
        "Joint Notice",
        "SARB Directive",
        "PA Directive",
        "PA Guidance Note",
        "FSR Act",
        "FATCA",
        "CRS",
        "BRS",
        "Currency and Exchanges Manual",
        "Information Regulator",
      ],
    },
    {
      // Rules that switch on once the bank actively trades in the market.
      bind: "COMMENCEMENT-BIND",
      tokens: [
        "FMA",
        "Financial Markets Act",
        "FSCA conduct standards",
        "FSCA",
        "FSCA Conduct Standards",
        "TCF outcomes",
        "TCF",
        "JSE rules",
        "STT",
        "ISDA",
        "GMRA",
        "TCFD",
      ],
    },
    {
      // Rules that bind only on a specific licence / listing being held.
      bind: "CONDITIONAL-BIND",
      tokens: ["FAIS", "JSE LR", "JSE Listings", "National Credit Act", "COFI"],
    },
  ];

function citationContains(citation: string, tokens: readonly string[]): boolean {
  if (!citation) return false;
  const hay = citation.toLowerCase();
  for (const t of tokens) {
    if (hay.includes(t.toLowerCase())) return true;
  }
  return false;
}

export function classifySources(citation: string): PolicySource[] {
  const out: PolicySource[] = [];
  if (citationContains(citation, REGULATORY_TOKENS)) out.push("REGULATORY");
  if (citationContains(citation, OBJECTIVE_TOKENS)) out.push("OBJECTIVE");
  return out;
}

export function classifyBinds(citation: string): PolicyBind[] {
  const out: PolicyBind[] = [];
  for (const rule of BIND_RULES) {
    if (citationContains(citation, rule.tokens)) out.push(rule.bind);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Status normalisation. Status cells in the register often carry
// parenthetical context — e.g. ``EXISTS` (approved A1)`` — and may include
// backticks, bold markers, or trailing notes. We:
//   1. preserve the verbatim cell (post-trim) as `statusRaw`,
//   2. attempt to match the leading bare keyword against the canonical set,
//   3. fall back to "OTHER".
// ---------------------------------------------------------------------------

const STATUS_KEYWORDS: readonly PolicyStatus[] = [
  "IN FORCE",
  "EXISTS",
  "DRAFTING",
  "PLANNED",
  "BOARD-RES",
];

export function normaliseStatus(raw: string): PolicyStatus {
  if (!raw) return "OTHER";
  const stripped = raw.replace(/\*\*/g, "").replace(/`/g, "").toUpperCase();
  for (const kw of STATUS_KEYWORDS) {
    // Word-boundary-ish: require the keyword start at index 0 or follow
    // whitespace / opening bracket. Position 0 always matches.
    const idx = stripped.indexOf(kw);
    if (idx < 0) continue;
    if (idx === 0) return kw;
    const before = stripped[idx - 1] ?? "";
    if (/\s|\(|\[/.test(before)) return kw;
  }
  return "OTHER";
}

// ---------------------------------------------------------------------------
// Slug + ID
// ---------------------------------------------------------------------------

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[★]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function policyId(domainNumber: string, name: string): string {
  return `pol-${domainNumber}-${slugify(name)}`;
}

// ---------------------------------------------------------------------------
// Register parser
//
// Walks the markdown line-by-line. Tracks the current `## N. Domain` heading
// and parses every `| ... |` row beneath until the next heading. Skips
// header / separator rows. Skips non-numbered domain sections (How to
// read, Summary, Drafting sequence, etc.) so re-listed policies in those
// sections do not double-count.
// ---------------------------------------------------------------------------

interface RawRow {
  domainNumber: string;
  domainTitle: string;
  cells: string[];
}

function readRows(path: string): RawRow[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  const rows: RawRow[] = [];
  let inDomainSection = false;
  let domainNumber = "";
  let domainTitle = "";

  for (const line of lines) {
    const heading = line.match(/^## (.+)$/);
    if (heading?.[1]) {
      const title = heading[1].trim();
      const numMatch = title.match(/^(\d+)\.\s*(.+)$/);
      if (numMatch?.[1] && numMatch[2]) {
        inDomainSection = true;
        domainNumber = numMatch[1];
        domainTitle = `${numMatch[1]}. ${stripParens(numMatch[2]).trim()}`;
      } else {
        inDomainSection = false;
      }
      continue;
    }
    if (!inDomainSection) continue;
    const m = line.match(TABLE_ROW);
    if (!m) continue;
    const cells = (m[1] ?? "").split("|").map((c) => c.trim());
    if (cells.length < 6) continue;
    if (cells.every((c) => /^-+$|^:?-+:?$/.test(c) || c === "")) continue;
    if (!cells[0]) continue;
    // Header row check: "Policy" cell title.
    if (cells[0].toLowerCase() === "policy") continue;
    rows.push({ domainNumber, domainTitle, cells });
  }
  return rows;
}

// Strip a leading parenthetical author note from a section title — e.g.
// "Risk policies (Helena, with Rohan engineering)" → "Risk policies".
function stripParens(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, "");
}

// ---------------------------------------------------------------------------
// Cross-reference: which obligations name this policy in their Fulfilment cell.
//
// The obligations register's Fulfilment-policy column lists one or more
// policy names separated by `;`. We build an inverse map: policyName →
// [ORG-* IDs]. Matching is case-insensitive and tolerant of trailing
// notes — we strip parentheticals and bracketed addenda before comparing.
// ---------------------------------------------------------------------------

function normalisePolicyName(s: string): string {
  return s
    .replace(/^★\s*/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildLinkedObligationsIndex(obligationsRegister: string): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  if (!existsSync(obligationsRegister)) return idx;
  const text = readFileSync(obligationsRegister, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(TABLE_ROW);
    if (!m) continue;
    const cells = (m[1] ?? "").split("|").map((c) => c.trim());
    // Nine-column register (v1.13+):
    //   ID | URN | Citation | Requirement | Fulfilment | Owner | Status | Entity scope | Applies-at
    if (cells.length < 9) continue;
    const id = cells[0] ?? "";
    if (!/^ORG-/i.test(id)) continue;
    const fulfilment = cells[4] ?? "";
    if (!fulfilment) continue;
    // Each cell may name several policies separated by ';' — split, normalise,
    // strip "Policy" qualifiers / trailing notes.
    for (const piece of fulfilment.split(";")) {
      const name = normalisePolicyName(piece);
      if (!name) continue;
      const list = idx.get(name) ?? [];
      list.push(id);
      idx.set(name, list);
    }
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

export interface ParsePolicyRegisterOpts {
  readonly path: string;
  /**
   * Path to `Regulations/_obligations-register.md` for cross-referencing.
   * If omitted (or the file is missing), every policy gets `linkedObligations: []`.
   */
  readonly obligationsRegister?: string;
  /**
   * Path to the canonical `Policies/` directory (D-POLICY-DOCUMENT-HOME
   * Option C, CEO-approved 2026-05-12). When supplied, any `.md` file in
   * that directory whose basename (without path prefix) matches a token in
   * a policy row's citation or status cell is added to `sourceFiles[]`.
   *
   * Also, any `Policies/*.md` file whose kebab-stem loosely matches a
   * policy's slugified name is included in `sourceFiles[]` so the policy
   * page can surface the canonical Policies/ document alongside the
   * Owner Inbox/ original.
   */
  readonly policiesDir?: string;
}

export function parsePolicyRegister(opts: ParsePolicyRegisterOpts): Policy[] {
  const rows = readRows(opts.path);
  const linkIdx = opts.obligationsRegister
    ? buildLinkedObligationsIndex(opts.obligationsRegister)
    : new Map<string, string[]>();

  // Pre-load the list of Policies/ files so we can cross-reference them
  // for each policy row (D-POLICY-DOCUMENT-HOME Option C, 2026-05-12).
  const policiesDirFiles = opts.policiesDir ? listPoliciesDirFiles(opts.policiesDir) : [];

  const out: Policy[] = [];
  for (const row of rows) {
    // Columns: Policy | Owner | Approval | Cadence | Citation | Status
    const [rawName, owner, approval, cadence, citation, statusCell] = row.cells;
    if (!rawName) continue;
    const mvp = rawName.startsWith("★");
    const name = rawName.replace(/^★\s*/, "").trim();
    const sources = classifySources(citation ?? "");
    const binds = classifyBinds(citation ?? "");
    const id = policyId(row.domainNumber, name);
    const linkedObligations = linkIdx.get(normalisePolicyName(name)) ?? [];

    // Per-policy source files: any `Owner Inbox/<name>.md` or `Policies/<name>.md`
    // reference in the citation or status cell, plus the policy register itself
    // as the canonical fallback. De-duped, register first so the default preview
    // lands on the row-of-truth.
    const explicit = extractOwnerInboxPolicyFiles(citation ?? "", statusCell ?? "");

    // Additionally scan Policies/ for files whose stem loosely matches this
    // policy's slug — picks up the canonical Policies/ copy even when the
    // policy register row does not yet reference it inline.
    const slug = slugify(name);
    for (const f of policiesDirFiles) {
      const stem = f.replace(/\.md$/, "");
      const qualified = `Policies/${f}`;
      if (policyFileStemMatchesSlug(stem, slug) && !explicit.includes(qualified)) {
        explicit.push(qualified);
      }
    }

    const sourceFiles = [
      POLICY_REGISTER_BASENAME,
      ...explicit.filter((f) => f !== POLICY_REGISTER_BASENAME),
    ];

    out.push({
      id,
      name,
      domain: row.domainTitle,
      owner: (owner ?? "").trim(),
      approval: (approval ?? "").trim(),
      cadence: (cadence ?? "").trim(),
      citation: (citation ?? "").trim(),
      sources,
      binds,
      status: normaliseStatus(statusCell ?? ""),
      statusRaw: (statusCell ?? "").trim(),
      mvp,
      linkedObligations,
      sourceFiles,
    });
  }

  // ---------------------------------------------------------------------------
  // Standalone pass — emit entries for any Policies/*.md file that was not
  // claimed by a register row above. This ensures documents like
  // bank-strategy-v1.md show up on the policies page without needing a
  // manual register entry (D-POLICY-DOCUMENT-HOME Option C).
  // ---------------------------------------------------------------------------
  if (opts.policiesDir) {
    const claimedFiles = new Set(out.flatMap((p) => p.sourceFiles));
    for (const filename of policiesDirFiles) {
      const qualified = `Policies/${filename}`;
      if (claimedFiles.has(qualified)) continue;
      const absPath = join(opts.policiesDir, filename);
      let content: string;
      try {
        content = readFileSync(absPath, "utf-8");
      } catch {
        continue;
      }
      const fm = readFrontmatter(content);
      const h1 = content.match(/^#\s+(.+)$/m);
      const stem = basename(filename, ".md");
      const title = fmScalar(fm, "title") ?? h1?.[1]?.trim() ?? stem;
      const owner = fmScalar(fm, "owner") ?? "";
      const statusRaw = fmScalar(fm, "status") ?? "";
      const citation = fmScalar(fm, "citations") ?? "";
      out.push({
        id: `pol-standalone-${slugify(stem)}`,
        name: title,
        domain: "Policy Documents",
        owner,
        approval: "",
        cadence: "",
        citation,
        sources: classifySources(citation),
        binds: classifyBinds(citation),
        status: normaliseStatus(statusRaw),
        statusRaw,
        mvp: false,
        linkedObligations: [],
        sourceFiles: [qualified],
      });
    }
  }

  return out;
}
