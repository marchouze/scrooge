// dashboard/policy-register.ts
//
// Parses `Owner Inbox/2026-05-06_policy-register.md` into typed Policy
// entries and cross-references against `Regulations/_obligations-register.md`
// to populate each policy's `linkedObligations[]`.
//
// Per CLAUDE.md Principle 1: this is a pure projection over canonical source.
// The register is the truth; we re-derive on every dashboard tick — no cache.
//
// Per Principle 6 (the upward chain): every policy carries the source
// authority it implements (REGULATORY / OBJECTIVE) and the bind state of
// the underlying obligation (CORPORATE / LICENCE / COMMENCEMENT /
// CONDITIONAL). Both classifications fall out of the citation text plus
// the obligations-register cross-reference.
//
// Author: Anya (data)

import { existsSync, readFileSync } from "node:fs";

import type { Policy, PolicyBind, PolicySource, PolicyStatus } from "./types";

const TABLE_ROW = /^\s*\|(.*)\|\s*$/;

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
  "BA 325",
  "BA 326",
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
        "BA 325",
        "BA 326",
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
    if (cells.length < 6) continue;
    const id = cells[0] ?? "";
    if (!/^ORG-/i.test(id)) continue;
    const fulfilment = cells[3] ?? "";
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
}

export function parsePolicyRegister(opts: ParsePolicyRegisterOpts): Policy[] {
  const rows = readRows(opts.path);
  const linkIdx = opts.obligationsRegister
    ? buildLinkedObligationsIndex(opts.obligationsRegister)
    : new Map<string, string[]>();

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
    });
  }
  return out;
}
