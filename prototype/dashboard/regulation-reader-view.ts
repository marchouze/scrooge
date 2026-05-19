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
  number: string;
  heading: string;
  text: string;
  verbatim: boolean;
  subsections?: RegSubsection[];
}

interface RegChapter {
  id: string;
  number: string;
  heading: string;
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
// Section-obligation index
// ---------------------------------------------------------------------------

interface SectionObligationIndex {
  generatedAt: string;
  obligationCount: number;
  sectionCount: number;
  index: Record<string, string[]>;
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
  chapters: ChapterDetail[];
}

// ---------------------------------------------------------------------------
// File paths for each slug
// ---------------------------------------------------------------------------

const SLUG_TO_FILE: Record<string, string> = {
  "banks-act": "Regulations/SARB-PA/source-docs/banks-act-structured.json",
  "fic-act": "Regulations/FIC/source-docs/fic-act-structured.json",
  popia: "Regulations/Information-Regulator/source-docs/popia-structured.json",
  "fais-act": "Regulations/FSCA/source-docs/fais-act-structured.json",
  js2: "Regulations/Joint-Standards/source-docs/js2-structured.json",
  "fais-gcc": "Regulations/FSCA/source-docs/fais-gcc-structured.json",
};

const ALL_SLUGS = ["banks-act", "fic-act", "popia", "fais-act", "js2", "fais-gcc"] as const;

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

function loadSectionIndex(repoRoot: string): SectionObligationIndex {
  const path = resolve(repoRoot, "Regulations", "_section-obligation-index.json");
  if (!existsSync(path)) {
    return { generatedAt: "", obligationCount: 0, sectionCount: 0, index: {} };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as SectionObligationIndex;
  } catch {
    return { generatedAt: "", obligationCount: 0, sectionCount: 0, index: {} };
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
      const title = h1Match ? h1Match[1].trim() : basename(filename, ".md");
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

function getObligationsForSection(
  slug: string,
  sectionId: string,
  sectionIndex: SectionObligationIndex,
  obligationsMap: Record<string, ObligationRow>,
  repoRoot: string,
): ObligationOnSection[] {
  const key = `${slug}/${sectionId}`;
  const ids = sectionIndex.index[key] ?? [];

  // Also check the instrument root (obligations without specific section)
  const rootIds = sectionIndex.index[slug] ?? [];
  const allIds = [...new Set([...ids, ...rootIds])];

  const result: ObligationOnSection[] = [];
  for (const id of allIds) {
    const obl = obligationsMap[id];
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildInstrumentsListView(repoRoot: string): InstrumentsListView {
  const sectionIndex = loadSectionIndex(repoRoot);

  const instruments: InstrumentSummary[] = [];

  for (const slug of ALL_SLUGS) {
    const doc = loadStructuredDoc(repoRoot, slug);
    if (!doc) continue;

    // Count sections
    let sectionCount = 0;
    for (const chapter of doc.chapters) {
      sectionCount += chapter.sections.length;
    }

    // Count obligations that mention this instrument
    const oblIds = new Set<string>();
    for (const [key, ids] of Object.entries(sectionIndex.index)) {
      if (key === slug || key.startsWith(`${slug}/`)) {
        for (const id of ids) oblIds.add(id);
      }
    }

    instruments.push({
      slug: doc.slug,
      title: doc.title,
      shortTitle: doc.shortTitle,
      regulator: doc.regulator,
      year: doc.year,
      priority: doc.priority,
      obligationCount: oblIds.size,
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

  const sectionIndex = loadSectionIndex(repoRoot);
  const obligationsMap = loadObligationsMap(repoRoot);

  // Reset policy cache per call (so tests can override repoRoot)
  _policyCache = null;

  const chapters: ChapterDetail[] = doc.chapters.map((chapter) => ({
    id: chapter.id,
    number: chapter.number,
    heading: chapter.heading,
    sections: chapter.sections.map((section) => {
      const obligations = getObligationsForSection(
        slug,
        section.id,
        sectionIndex,
        obligationsMap,
        repoRoot,
      );

      return {
        ...section,
        obligations,
      };
    }),
  }));

  // Count total unique obligations across all sections
  const allOblIds = new Set<string>();
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      for (const obl of sec.obligations) {
        allOblIds.add(obl.id);
      }
    }
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
    chapters,
  };
}
