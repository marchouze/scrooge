// dashboard/regulation-reader-view.ts
//
// Builds structured views over the regulation JSON files for the
// /api/regulation-reader/* endpoints.
//
// Reads:
//   1. Regulations/<regulator>/source-docs/<slug>-structured.json — section text
//   2. Regulations/_section-obligation-index.json — which obligations cite each section
//   3. Regulations/_obligations-register.md — obligation requirement text + status
//   4. Policies/*.md — URN → title + filename resolution
//
// Per CLAUDE.md Principle 1: pure read-side projection; no events emitted.
// Per CLAUDE.md Principle 2: obligations register is the canonical source;
// this view is a query-time shape-shift, not authored content.
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import { getDb } from "../platform/regulatory/graph/db";
import { getObligationCountForDocument } from "../platform/regulatory/graph/query";

/** Normalise a section reference: lowercase + dots stripped. */
const normSectionRef = (raw: string) => raw.toLowerCase().replace(/\./g, "");

// ---------------------------------------------------------------------------
// Structured regulation JSON types
// ---------------------------------------------------------------------------

interface RegSubsection {
  id: string;
  number: string;
  text: string;
  verbatim: boolean;
}

interface RegSection {
  id: string;
  /**
   * Canonical numeric/alphanumeric section number, e.g. "1", "21A", "3.1".
   * Some instrument files (rrb, excon) omit `number` and carry the human-
   * readable `sectionNumber` form ("Regulation 1") instead — the view
   * derives the canonical key via `numberFromSection`.
   */
  number?: string;
  sectionNumber?: string;
  heading?: string;
  title?: string;
  text: string;
  verbatim: boolean;
  subsections?: RegSubsection[];
}

interface RegChapter {
  id: string;
  number?: string;
  heading?: string;
  title?: string;
  sections: RegSection[];
}

interface RegStructuredDoc {
  slug: string;
  title: string;
  shortTitle: string;
  regulator: string;
  year: number;
  citationPatterns: string[];
  priority: number;
  chapters: RegChapter[];
}

// ---------------------------------------------------------------------------
// Obligations register row (minimal subset we need)
// ---------------------------------------------------------------------------

interface ObligationRow {
  id: string;
  requirement: string;
  fulfilment: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

interface ResolvedPolicy {
  urn: string;
  title: string;
  filename: string;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface InstrumentSummary {
  slug: string;
  title: string;
  shortTitle: string;
  regulator: string;
  year: number;
  priority: number;
  obligationCount: number;
  sectionCount: number;
  hasFullText: boolean;
}

export interface InstrumentsListView {
  instruments: InstrumentSummary[];
}

export interface ObligationOnSection {
  id: string;
  requirement: string;
  status: string;
  policy: ResolvedPolicy | null;
}

export interface SectionDetail extends RegSection {
  obligations: ObligationOnSection[];
}

export interface ChapterDetail extends Omit<RegChapter, "sections"> {
  sections: SectionDetail[];
}

export interface InstrumentDetailView {
  slug: string;
  title: string;
  shortTitle: string;
  regulator: string;
  year: number;
  priority: number;
  citationPatterns: string[];
  totalObligations: number;
  /**
   * Obligations whose citation anchors to this instrument as a whole, with
   * no section reference. Rendered in a panel above the chapter list so they
   * are not fanned across every section (Bug 1 fix).
   */
  instrumentWideObligations: ObligationOnSection[];
  chapters: ChapterDetail[];
}

// ---------------------------------------------------------------------------
// File paths for each slug
// ---------------------------------------------------------------------------

const SLUG_TO_FILE: Record<string, string> = {
  "banks-act": "Regulations/SARB-PA/source-docs/banks-act-structured.json",
  rrb: "Regulations/SARB-PA/source-docs/rrb-structured.json",
  "fic-act": "Regulations/FIC/source-docs/fic-act-structured.json",
  popia: "Regulations/Information-Regulator/source-docs/popia-structured.json",
  "fais-act": "Regulations/FSCA/source-docs/fais-act-structured.json",
  js2: "Regulations/Joint-Standards/source-docs/js2-structured.json",
  "fais-gcc": "Regulations/FSCA/source-docs/fais-gcc-structured.json",
  excon: "Regulations/SARB-FinSurv/source-docs/excon-structured.json",
  "cs-1-2018": "Regulations/ODP/source-docs/cs-1-2018-structured.json",
  "cs-2-2018": "Regulations/ODP/source-docs/cs-2-2018-structured.json",
  "cs-3-2018": "Regulations/ODP/source-docs/cs-3-2018-structured.json",
  "js-2-2020": "Regulations/ODP/source-docs/js-2-2020-structured.json",
  "jn-2-2024": "Regulations/ODP/source-docs/jn-2-2024-structured.json",
  // ── PA Co-operative Banks / CFI Guidance Notes & Directives ──────────────
  "gn1-2019": "Regulations/CoopBanks/source-docs/gn1-2019-structured.json",
  "gn2-2019": "Regulations/CoopBanks/source-docs/gn2-2019-structured.json",
  "gn1-2020": "Regulations/CoopBanks/source-docs/gn1-2020-structured.json",
  "gn2-2020": "Regulations/CoopBanks/source-docs/gn2-2020-structured.json",
  "gn1-2021": "Regulations/CoopBanks/source-docs/gn1-2021-structured.json",
  "d1-2023": "Regulations/CoopBanks/source-docs/d1-2023-structured.json",
  "gn1-2026": "Regulations/CoopBanks/source-docs/gn1-2026-structured.json",
  // ── Banks Act Guidance Notes (effective per GN 1/2026) ───────────────────
  "banks-gn1-2008": "Regulations/Banks/source-docs/banks-gn1-2008-structured.json",
  "banks-gn2-2008": "Regulations/Banks/source-docs/banks-gn2-2008-structured.json",
  "banks-gn5-2008": "Regulations/Banks/source-docs/banks-gn5-2008-structured.json",
  "banks-gn7-2008": "Regulations/Banks/source-docs/banks-gn7-2008-structured.json",
  "banks-gn8-2008": "Regulations/Banks/source-docs/banks-gn8-2008-structured.json",
  "banks-gn9-2008": "Regulations/Banks/source-docs/banks-gn9-2008-structured.json",
  "banks-gn3-2010": "Regulations/Banks/source-docs/banks-gn3-2010-structured.json",
  "banks-gn3-2011": "Regulations/Banks/source-docs/banks-gn3-2011-structured.json",
  "banks-gn5-2013": "Regulations/Banks/source-docs/banks-gn5-2013-structured.json",
  "banks-gn3-2014": "Regulations/Banks/source-docs/banks-gn3-2014-structured.json",
  "banks-gn4-2014": "Regulations/Banks/source-docs/banks-gn4-2014-structured.json",
  "banks-gn5-2014": "Regulations/Banks/source-docs/banks-gn5-2014-structured.json",
  "banks-gn4-2015": "Regulations/Banks/source-docs/banks-gn4-2015-structured.json",
  "banks-gn3-2016": "Regulations/Banks/source-docs/banks-gn3-2016-structured.json",
  "banks-gn4-2016": "Regulations/Banks/source-docs/banks-gn4-2016-structured.json",
  "banks-gn5-2016": "Regulations/Banks/source-docs/banks-gn5-2016-structured.json",
  "banks-gn7-2016": "Regulations/Banks/source-docs/banks-gn7-2016-structured.json",
  "banks-gn3-2017": "Regulations/Banks/source-docs/banks-gn3-2017-structured.json",
  "banks-gn5-2018": "Regulations/Banks/source-docs/banks-gn5-2018-structured.json",
  "banks-gn8-2020": "Regulations/Banks/source-docs/banks-gn8-2020-structured.json",
  "banks-gn5-2022": "Regulations/Banks/source-docs/banks-gn5-2022-structured.json",
  "banks-gn6-2022": "Regulations/Banks/source-docs/banks-gn6-2022-structured.json",
  "banks-gn7-2022": "Regulations/Banks/source-docs/banks-gn7-2022-structured.json",
  "banks-gn9-2022": "Regulations/Banks/source-docs/banks-gn9-2022-structured.json",
  "banks-gn10-2022": "Regulations/Banks/source-docs/banks-gn10-2022-structured.json",
  "banks-gn12-2022": "Regulations/Banks/source-docs/banks-gn12-2022-structured.json",
  "banks-gn4-2023": "Regulations/Banks/source-docs/banks-gn4-2023-structured.json",
  "banks-gn2-2024": "Regulations/Banks/source-docs/banks-gn2-2024-structured.json",
  "banks-gn4-2024": "Regulations/Banks/source-docs/banks-gn4-2024-structured.json",
  "banks-gn5-2024": "Regulations/Banks/source-docs/banks-gn5-2024-structured.json",
  "banks-gn2-2025": "Regulations/Banks/source-docs/banks-gn2-2025-structured.json",
  "banks-gn3-2025": "Regulations/Banks/source-docs/banks-gn3-2025-structured.json",
  "banks-gn1-2026": "Regulations/Banks/source-docs/banks-gn1-2026-structured.json",
};

const ALL_SLUGS = [
  "banks-act",
  "rrb",
  "fic-act",
  "popia",
  "fais-act",
  "js2",
  "fais-gcc",
  "excon",
  "cs-1-2018",
  "cs-2-2018",
  "cs-3-2018",
  "js-2-2020",
  "jn-2-2024",
  "gn1-2019",
  "gn2-2019",
  "gn1-2020",
  "gn2-2020",
  "gn1-2021",
  "d1-2023",
  "gn1-2026",
  "banks-gn1-2008",
  "banks-gn2-2008",
  "banks-gn5-2008",
  "banks-gn7-2008",
  "banks-gn8-2008",
  "banks-gn9-2008",
  "banks-gn3-2010",
  "banks-gn3-2011",
  "banks-gn5-2013",
  "banks-gn3-2014",
  "banks-gn4-2014",
  "banks-gn5-2014",
  "banks-gn4-2015",
  "banks-gn3-2016",
  "banks-gn4-2016",
  "banks-gn5-2016",
  "banks-gn7-2016",
  "banks-gn3-2017",
  "banks-gn5-2018",
  "banks-gn8-2020",
  "banks-gn5-2022",
  "banks-gn6-2022",
  "banks-gn7-2022",
  "banks-gn9-2022",
  "banks-gn10-2022",
  "banks-gn12-2022",
  "banks-gn4-2023",
  "banks-gn2-2024",
  "banks-gn4-2024",
  "banks-gn5-2024",
  "banks-gn2-2025",
  "banks-gn3-2025",
  "banks-gn1-2026",
] as const;

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

function loadStructuredDoc(repoRoot: string, slug: string): RegStructuredDoc | null {
  const rel = SLUG_TO_FILE[slug];
  if (!rel) return null;

  const path = resolve(repoRoot, rel);
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, "utf-8")) as RegStructuredDoc;
  } catch {
    return null;
  }
}

function loadObligationsMap(repoRoot: string): Record<string, ObligationRow> {
  const path = resolve(repoRoot, "Regulations", "_obligations-register.md");
  if (!existsSync(path)) return {};

  const content = readFileSync(path, "utf-8");
  const map: Record<string, ObligationRow> = {};

  for (const line of content.split("\n")) {
    if (!line.startsWith("| ORG")) continue;

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cells.length < 7) continue;

    const id = (cells[0] ?? "").trim();
    if (!id.startsWith("ORG")) continue;

    const requirement = (cells[3] ?? "").trim();
    const fulfilment = (cells[4] ?? "").trim();
    const status = (cells[6] ?? "").replace(/\*\*/g, "").trim();

    map[id] = { id, requirement, fulfilment, status };
  }

  return map;
}

// ---------------------------------------------------------------------------
// Policy URN resolution
// ---------------------------------------------------------------------------

let _policyCache: Map<string, ResolvedPolicy> | null = null;

function loadPolicies(repoRoot: string): Map<string, ResolvedPolicy> {
  if (_policyCache) return _policyCache;

  _policyCache = new Map<string, ResolvedPolicy>();

  const dir = resolve(repoRoot, "Policies");
  if (!existsSync(dir)) return _policyCache;

  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return _policyCache;
  }

  for (const filename of files) {
    const path = resolve(dir, filename);
    try {
      const content = readFileSync(path, "utf-8");
      // Extract first H1 as title
      const h1Match = content.match(/^#\s+(.+)$/m);
      const title = h1Match?.[1] ? h1Match[1].trim() : basename(filename, ".md");
      _policyCache.set(filename, {
        urn: "",
        title,
        filename,
      });
    } catch {
      // skip
    }
  }

  return _policyCache;
}

function resolvePolicy(urn: string, repoRoot: string): ResolvedPolicy | null {
  if (!urn) return null;

  const policies = loadPolicies(repoRoot);

  // Extract the slug part: "urn:policy:conduct:aml-cft:v1" → "aml-cft"
  // Try progressively shorter segments until we find a match
  const parts = urn.split(":");
  const candidates: string[] = [];

  // Build candidates from longest to shortest slug
  if (parts.length >= 4) {
    // Try the domain-slug part (e.g. "aml-cft" from "urn:policy:conduct:aml-cft:v1")
    for (let i = 2; i < parts.length; i++) {
      const slug = parts[i];
      if (slug && slug !== "v1" && !slug.match(/^v\d+$/)) {
        candidates.push(slug);
      }
    }
  }

  // Also try the whole URN minus "urn:policy:" prefix
  const withoutPrefix = urn.replace(/^urn:policy:[^:]+:/, "").replace(/:v\d+$/, "");
  if (withoutPrefix) candidates.push(withoutPrefix);

  for (const candidate of candidates) {
    // Search policy files for filename containing the candidate
    for (const [filename, policy] of policies.entries()) {
      if (filename.includes(candidate)) {
        return { urn, title: policy.title, filename };
      }
    }
  }

  return null;
}

function resolveObligationPolicy(fulfilment: string, repoRoot: string): ResolvedPolicy | null {
  if (!fulfilment) return null;

  // Extract URNs from fulfilment text (format: `urn:policy:...`)
  const urnMatches = fulfilment.match(/`(urn:policy:[^`]+)`/g);
  if (urnMatches && urnMatches.length > 0) {
    const urn = urnMatches[0].replace(/`/g, "");
    return resolvePolicy(urn, repoRoot);
  }

  // Fall back: scan policy files for name match against fulfilment text
  const policies = loadPolicies(repoRoot);
  const fulfilmentLower = fulfilment.toLowerCase();

  for (const [filename, policy] of policies.entries()) {
    const namePart = basename(filename, "-v1.md").replace(/-/g, " ");
    if (fulfilmentLower.includes(namePart)) {
      return { urn: "", title: policy.title, filename };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Obligation lookup for a section
// ---------------------------------------------------------------------------

/**
 * Derive the canonical number suffix for a section, identical to the form
 * used by the index generator. Returns `null` when no usable number can be
 * recovered.
 *
 * Order of precedence:
 *   1. `section.number` if present (e.g. "60", "3.1", "21A").
 *   2. `section.sectionNumber` parsed as "Regulation 27" → "27" (rrb, excon).
 *   3. `section.id` stripped of known prefixes (e.g. `reg27` → "27",
 *      `excon-reg22A` → "22A", `gcc11` → "11", `s60` → "60", `s3-1` → "3-1").
 */
function numberFromSection(section: RegSection): string | null {
  if (section.number?.trim() && !/^preamble/i.test(section.number)) {
    return normSectionRef(section.number.trim());
  }

  if (section.sectionNumber) {
    const m = section.sectionNumber.match(/(\d+[A-Za-z]?(?:\.\d+)?)/);
    if (m?.[1]) return normSectionRef(m[1]);
  }

  // Strip known instrument-specific id prefixes.
  const id = section.id;
  const stripped = id
    .replace(/^excon-reg/i, "")
    .replace(/^reg/i, "")
    .replace(/^gcc/i, "")
    .replace(/^s/i, "");
  if (stripped !== id && /^\d/.test(stripped)) {
    return normSectionRef(stripped);
  }
  return null;
}

function getObligationsForSection(
  slug: string,
  section: RegSection,
  obligationsMap: Record<string, ObligationRow>,
  repoRoot: string,
): ObligationOnSection[] {
  const raw = numberFromSection(section);
  if (!raw) return [];

  const normSect = normSectionRef(raw);
  const provisionId = `PROV-${slug.toUpperCase()}-s${normSect}`;

  const db = getDb();
  const oblRows = db
    .prepare(
      `SELECT n.* FROM graph_nodes n
       JOIN graph_edges e ON e.to_id = n.id
       WHERE e.from_id = ? AND e.edge_type = 'EXPRESSES'
         AND n.node_type = 'Obligation'`,
    )
    .all(provisionId) as Array<{ id: string; metadata: string | null }>;

  const result: ObligationOnSection[] = [];
  for (const row of oblRows) {
    const meta = row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {};
    const oblId = (meta.obligationId as string | undefined) ?? row.id.replace(/^OBL-/, "");
    const obl = obligationsMap[oblId];
    if (!obl) continue;
    const policy = resolveObligationPolicy(obl.fulfilment, repoRoot);
    result.push({
      id: obl.id,
      requirement: obl.requirement.slice(0, 400),
      status: obl.status,
      policy,
    });
  }
  return result;
}

function getInstrumentWideObligations(
  _slug: string,
  _obligationsMap: Record<string, ObligationRow>,
  _repoRoot: string,
): ObligationOnSection[] {
  // Obligations with no section anchor were a workaround for the static regex matcher.
  // With the graph backend, all obligations link via EXPRESSES edges to Provision nodes.
  // Instrument-wide display is no longer needed — return empty.
  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildInstrumentsListView(repoRoot: string): InstrumentsListView {
  const instruments: InstrumentSummary[] = [];

  for (const slug of ALL_SLUGS) {
    const doc = loadStructuredDoc(repoRoot, slug);
    if (!doc) continue;

    let sectionCount = 0;
    for (const chapter of doc.chapters) {
      sectionCount += chapter.sections.length;
    }

    const obligationCount = getObligationCountForDocument(`DOC-${slug.toUpperCase()}`);

    instruments.push({
      slug: doc.slug,
      title: doc.title,
      shortTitle: doc.shortTitle,
      regulator: doc.regulator,
      year: doc.year,
      priority: doc.priority,
      obligationCount,
      sectionCount,
      hasFullText: doc.chapters.some((ch) => ch.sections.some((s) => s.verbatim)),
    });
  }

  instruments.sort((a, b) => a.priority - b.priority);
  return { instruments };
}

export function buildInstrumentDetailView(
  repoRoot: string,
  slug: string,
): InstrumentDetailView | null {
  const doc = loadStructuredDoc(repoRoot, slug);
  if (!doc) return null;

  const obligationsMap = loadObligationsMap(repoRoot);

  // Reset policy cache per call (so tests can override repoRoot)
  _policyCache = null;

  const chapters: ChapterDetail[] = doc.chapters.map((chapter) => ({
    id: chapter.id,
    number: chapter.number ?? "",
    heading: chapter.heading ?? chapter.title ?? "",
    sections: chapter.sections.map((section) => ({
      ...section,
      obligations: getObligationsForSection(slug, section, obligationsMap, repoRoot),
    })),
  }));

  const instrumentWideObligations = getInstrumentWideObligations(slug, obligationsMap, repoRoot);

  // Count total unique obligations: section-anchored + instrument-wide
  const allOblIds = new Set<string>();
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      for (const obl of sec.obligations) {
        allOblIds.add(obl.id);
      }
    }
  }
  for (const obl of instrumentWideObligations) {
    allOblIds.add(obl.id);
  }

  return {
    slug: doc.slug,
    title: doc.title,
    shortTitle: doc.shortTitle,
    regulator: doc.regulator,
    year: doc.year,
    priority: doc.priority,
    citationPatterns: doc.citationPatterns,
    totalObligations: allOblIds.size,
    instrumentWideObligations,
    chapters,
  };
}
