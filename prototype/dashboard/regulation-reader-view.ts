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

import type { EventStore } from "../platform/event-store/store";
import { getDb } from "../platform/regulatory/graph/db";
import { getObligationCountForDocument } from "../platform/regulatory/graph/query";
import { ensureProvisionIds, normSectionRef } from "../platform/regulatory/structured-doc-loader";
import {
  type EnrichedObligationRef,
  type RegulationObligationIndex,
  buildRegulationObligationIndex,
  provisionKey,
} from "./regulation-obligation-index";

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
  /**
   * Excerpt records filed via recordRegulatoryExcerpt()
   * (WS-REGULATORY-LIBRARY-V1 Slice 4, D-REGULATORY-LIBRARY-V1).
   * Passed through to the client for inline image rendering.
   */
  excerpts?: Array<{
    id: string;
    kind: string;
    hash?: string;
    pages?: string;
    caption?: string;
  }>;
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
  /**
   * Number of bank obligations traced back to this source, sourced from
   * `_source-coverage.json` (which counts both graph EXPRESSES edges and
   * adopted-obligation citation matches). Falls back to the graph-only
   * `obligationCount` when the coverage row is absent.
   */
  obligationsLinked: number;
  /**
   * Review-marker state from the latest `RegulatorySourceReviewed` event,
   * surfaced via `_source-coverage.json`.
   */
  reviewStatus: "reviewed" | "stale" | "unreviewed";
  /** ISO timestamp of the latest review, or null when never reviewed. */
  reviewedAt: string | null;
  /**
   * Adopted bank obligations (Plane B) traced back to this instrument via the
   * reverse index — the "back-population" count. 0 when no event store was
   * supplied (the view degrades to reference-only data).
   */
  derivedObligationCount: number;
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
  /**
   * Adopted bank obligations (Plane B, event-sourced) traced back to this
   * section via the reverse index — enriched with lifecycle status,
   * applicability verdict, and owner seat TITLE. The "back-population" of the
   * regulation viewer; deduped by obligation id. Empty when no event store was
   * supplied or nothing traces here.
   */
  derivedObligations: EnrichedObligationRef[];
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
  /** Distinct adopted bank obligations traced back to this instrument. */
  derivedObligationCount: number;
  /** Status histogram across the derived obligations (status → count). */
  derivedStatusRollup: Record<string, number>;
}

// ---------------------------------------------------------------------------
// File paths for each slug
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dynamic instrument discovery
//
// Scans all Regulations/<regulator>/source-docs/*-structured.json files and
// returns a slug→absolutePath map. Replaces the previous hardcoded
// SLUG_TO_FILE / ALL_SLUGS so newly-extracted instruments appear automatically.
// ---------------------------------------------------------------------------

let _slugPathCache: Map<string, string> | null = null;

function discoverSlugPaths(repoRoot: string): Map<string, string> {
  if (_slugPathCache) return _slugPathCache;

  const map = new Map<string, string>();
  const regsDir = resolve(repoRoot, "Regulations");

  let regulatorDirs: string[];
  try {
    regulatorDirs = readdirSync(regsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => resolve(regsDir, d.name, "source-docs"));
  } catch {
    return map;
  }

  for (const sourceDocsDir of regulatorDirs) {
    if (!existsSync(sourceDocsDir)) continue;
    let files: string[];
    try {
      files = readdirSync(sourceDocsDir).filter((f) => f.endsWith("-structured.json"));
    } catch {
      continue;
    }
    for (const file of files) {
      const absPath = resolve(sourceDocsDir, file);
      // Use the internal slug field from the JSON as the map key — it may
      // differ from the filename (e.g. file=mar-structured.json but slug=bcbs-mar).
      let slug = file.replace(/-structured\.json$/, "");
      try {
        const raw = JSON.parse(readFileSync(absPath, "utf-8")) as { slug?: string };
        if (raw.slug) slug = raw.slug;
      } catch {
        // fallback to filename-derived slug
      }
      map.set(slug, absPath);
    }
  }

  _slugPathCache = map;
  return map;
}

// ---------------------------------------------------------------------------
// BCBS chapter-text enrichment
//
// BCBS *-structured.json files carry section metadata (number, heading) but
// empty `text` fields. The actual paragraph text lives in chapter-text.json,
// keyed as <INSTRUMENT_PREFIX><section_number> (e.g. MAR10, MAR11…).
// This function fills the gap at load time so the reader renders real content.
// ---------------------------------------------------------------------------

interface ChapterTextEntry {
  paragraph: string;
  heading: string;
  text: string;
}

let _bcbsChapterTextCache: Record<string, ChapterTextEntry[]> | null = null;

function loadBcbsChapterText(repoRoot: string): Record<string, ChapterTextEntry[]> {
  if (_bcbsChapterTextCache) return _bcbsChapterTextCache;
  const path = resolve(repoRoot, "Regulations", "BCBS", "chapter-text.json");
  if (!existsSync(path)) {
    _bcbsChapterTextCache = {};
    return _bcbsChapterTextCache;
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as {
      chapters: Record<string, ChapterTextEntry[]>;
    };
    _bcbsChapterTextCache = raw.chapters ?? {};
  } catch {
    _bcbsChapterTextCache = {};
  }
  return _bcbsChapterTextCache;
}

function enrichBcbsDocSections(repoRoot: string, doc: RegStructuredDoc): void {
  if (!doc.slug.startsWith("bcbs-")) return;

  const chapterText = loadBcbsChapterText(repoRoot);
  // slug "bcbs-mar" → prefix "MAR"; "bcbs-cre" → "CRE"
  const prefix = doc.slug.replace(/^bcbs-/, "").toUpperCase();

  for (const chapter of doc.chapters) {
    for (const section of chapter.sections) {
      if (section.text) continue; // already populated
      const num = section.number?.trim();
      if (!num) continue;

      const key = `${prefix}${num}`; // e.g. "MAR10"
      const paras = chapterText[key];
      if (!paras || paras.length === 0) continue;

      section.text = paras.map((p) => `${p.paragraph}  ${p.text}`).join("\n\n");
      section.verbatim = true;
      if (!section.id) section.id = `${doc.slug}-${num}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

function loadStructuredDoc(repoRoot: string, slug: string): RegStructuredDoc | null {
  const absPath = discoverSlugPaths(repoRoot).get(slug);
  if (!absPath || !existsSync(absPath)) return null;

  try {
    const doc = JSON.parse(readFileSync(absPath, "utf-8")) as RegStructuredDoc;
    enrichBcbsDocSections(repoRoot, doc);
    // Same deterministic id assignment as the adopt/distill routes and the
    // drift recon (platform/regulatory/structured-doc-loader.ts) — the
    // client-rendered scopeIds MUST match the server-resolved provision tree.
    ensureProvisionIds(doc as unknown as Parameters<typeof ensureProvisionIds>[0]);
    return doc;
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
  // numberFromSection already returns the canonical `normSectionRef` form.
  const normSect = numberFromSection(section);
  if (!normSect) return [];

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

/**
 * Candidate provision ids for a section, spanning BOTH id spaces so the reverse
 * index resolves regardless of which space the obligation linked through:
 *   - graph `EXPRESSES` form: `PROV-<SLUG>-s<n>` (section-anchored adoptions)
 *   - structured-doc form:    `section.id` + each subsection id (tick-flow
 *     adoptions carry these directly in `derivesFrom`)
 */
function candidateProvisionIds(slug: string, section: RegSection): string[] {
  const ids = new Set<string>();
  const raw = numberFromSection(section);
  if (raw) ids.add(`PROV-${slug.toUpperCase()}-s${normSectionRef(raw)}`);
  if (section.id) ids.add(section.id);
  for (const sub of section.subsections ?? []) {
    if (sub.id) ids.add(sub.id);
  }
  return [...ids];
}

/**
 * Adopted bank obligations traced back to this section via the reverse index,
 * deduped by obligation id (a section spanning several provision ids must not
 * list the same obligation twice).
 */
function derivedObligationsForSection(
  slug: string,
  section: RegSection,
  index: RegulationObligationIndex | null,
): EnrichedObligationRef[] {
  if (!index) return [];
  const seen = new Set<string>();
  const refs: EnrichedObligationRef[] = [];
  for (const provId of candidateProvisionIds(slug, section)) {
    // Qualify the lookup by THIS instrument's slug so a bare section id does not
    // pull obligations that trace to a same-numbered section in another reg.
    for (const ref of index.byProvision.get(provisionKey(slug, provId)) ?? []) {
      if (seen.has(ref.id)) continue;
      seen.add(ref.id);
      refs.push(ref);
    }
  }
  return refs;
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

/** Per-slug review + traceback markers loaded from `_source-coverage.json`. */
interface CoverageMarker {
  obligationsLinked: number;
  reviewStatus: "reviewed" | "stale" | "unreviewed";
  reviewedAt: string | null;
}

/**
 * Load `Regulations/_source-coverage.json` and index its rows by slug. The
 * file is generated post-merge by `scripts/regulatory/build-source-coverage.ts`
 * (committed, not run in CI). Absent or malformed → empty map (view degrades to
 * graph-only counts + "unreviewed").
 */
function loadCoverageMarkers(repoRoot: string): Map<string, CoverageMarker> {
  const bySlug = new Map<string, CoverageMarker>();
  const path = resolve(repoRoot, "Regulations", "_source-coverage.json");
  if (!existsSync(path)) return bySlug;

  let report: unknown;
  try {
    report = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return bySlug;
  }

  const rows = (report as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return bySlug;

  for (const raw of rows) {
    const row = raw as {
      slug?: unknown;
      obligationsLinked?: unknown;
      reviewStatus?: unknown;
      reviewedAt?: unknown;
    };
    if (typeof row.slug !== "string") continue;
    const reviewStatus =
      row.reviewStatus === "reviewed" || row.reviewStatus === "stale"
        ? row.reviewStatus
        : "unreviewed";
    bySlug.set(row.slug, {
      obligationsLinked: typeof row.obligationsLinked === "number" ? row.obligationsLinked : 0,
      reviewStatus,
      reviewedAt: typeof row.reviewedAt === "string" ? row.reviewedAt : null,
    });
  }
  return bySlug;
}

export function buildInstrumentsListView(
  repoRoot: string,
  store?: EventStore,
): InstrumentsListView {
  const instruments: InstrumentSummary[] = [];
  const coverage = loadCoverageMarkers(repoRoot);

  // One reverse index for the whole list (Plane B → Plane A). Absent store →
  // derivedObligationCount degrades to 0 (reference-only list view).
  const index = store ? buildRegulationObligationIndex(store) : null;

  for (const slug of discoverSlugPaths(repoRoot).keys()) {
    const doc = loadStructuredDoc(repoRoot, slug);
    if (!doc) continue;

    let sectionCount = 0;
    const derivedIds = new Set<string>();
    for (const chapter of doc.chapters) {
      sectionCount += chapter.sections.length;
      for (const section of chapter.sections) {
        for (const ref of derivedObligationsForSection(doc.slug, section, index)) {
          derivedIds.add(ref.id);
        }
      }
    }

    const obligationCount = getObligationCountForDocument(`DOC-${slug.toUpperCase()}`);
    const marker = coverage.get(doc.slug);

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
      obligationsLinked: marker
        ? Math.max(marker.obligationsLinked, obligationCount)
        : obligationCount,
      reviewStatus: marker?.reviewStatus ?? "unreviewed",
      reviewedAt: marker?.reviewedAt ?? null,
      derivedObligationCount: derivedIds.size,
    });
  }

  instruments.sort((a, b) => a.priority - b.priority);
  return { instruments };
}

// ---------------------------------------------------------------------------
// Backward navigation: obligation → its source provision(s) in the reader
// ---------------------------------------------------------------------------

/** One instrument the obligation traces into, with the matched provision ids. */
export interface ObligationSourceLink {
  slug: string;
  provisionIds: string[];
}

/**
 * Resolve the source instrument(s) and provision id(s) an obligation derives
 * from — the deep-link target for the backward jump. Reads the reverse index's
 * already-qualified provisions (each carries its owning slug), so an obligation
 * surfaces ONLY under the regulation(s) it genuinely traces to (no bare-id
 * cross-instrument collisions).
 */
export function sourceLinksForObligation(
  _repoRoot: string,
  store: EventStore,
  id: string,
): ObligationSourceLink[] {
  const index = buildRegulationObligationIndex(store);
  const owned = index.provisionsForObligation.get(id) ?? [];
  const bySlug = new Map<string, string[]>();
  for (const { slug, provId } of owned) {
    const list = bySlug.get(slug) ?? [];
    list.push(provId);
    bySlug.set(slug, list);
  }
  return [...bySlug.entries()].map(([slug, provisionIds]) => ({
    slug,
    provisionIds: provisionIds.sort(),
  }));
}

/** A resolved verbatim provision: a stable label + its source text. */
export interface VerbatimProvision {
  label: string;
  text: string;
}

/**
 * Verbatim source text for a set of provision ids within ONE instrument, in
 * document order. Used by the obligation detail to show each cited source's
 * actual wording (grouped per regulation). Sections with no extractable text
 * are skipped.
 */
export function verbatimForProvisions(
  repoRoot: string,
  slug: string,
  provisionIds: readonly string[],
): VerbatimProvision[] {
  const doc = loadStructuredDoc(repoRoot, slug);
  if (!doc) return [];
  const want = new Set(provisionIds);
  const out: VerbatimProvision[] = [];
  // Collect a section's full verbatim text — section body PLUS its subsection
  // tree (where most regulatory wording actually lives), in document order.
  interface TextNode {
    text?: string;
    number?: string;
    subsections?: TextNode[];
  }
  const collectText = (node: TextNode): string => {
    const parts: string[] = [];
    const body = (node.text ?? "").trim();
    if (body) parts.push(body);
    for (const ss of node.subsections ?? []) {
      const sub = collectText(ss);
      if (sub) parts.push(ss.number ? `${ss.number}  ${sub}` : sub);
    }
    return parts.join("\n\n");
  };
  for (const chapter of doc.chapters) {
    for (const section of chapter.sections) {
      const hit = candidateProvisionIds(slug, section).some((c) => want.has(c));
      if (!hit) continue;
      const text = collectText(section as TextNode).trim();
      if (!text) continue;
      const num = section.number ?? section.sectionNumber ?? "";
      const heading = section.heading ?? section.title ?? "";
      out.push({ label: [num, heading].filter(Boolean).join(" "), text });
    }
  }
  return out;
}

export function buildInstrumentDetailView(
  repoRoot: string,
  slug: string,
  store?: EventStore,
): InstrumentDetailView | null {
  const doc = loadStructuredDoc(repoRoot, slug);
  if (!doc) return null;

  const obligationsMap = loadObligationsMap(repoRoot);

  // Reset policy cache per call (so tests can override repoRoot)
  _policyCache = null;

  // Reverse index (Plane B → Plane A). Absent store → reference-only view.
  const index = store ? buildRegulationObligationIndex(store) : null;

  const chapters: ChapterDetail[] = doc.chapters.map((chapter) => ({
    id: chapter.id,
    number: chapter.number ?? "",
    heading: chapter.heading ?? chapter.title ?? "",
    sections: chapter.sections.map((section) => ({
      ...section,
      obligations: getObligationsForSection(slug, section, obligationsMap, repoRoot),
      derivedObligations: derivedObligationsForSection(slug, section, index),
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

  // Back-population rollup: distinct adopted obligations + status histogram
  // across the reverse index for this instrument's sections.
  const derivedIds = new Set<string>();
  const derivedStatusRollup: Record<string, number> = {};
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      for (const ref of sec.derivedObligations) {
        if (derivedIds.has(ref.id)) continue;
        derivedIds.add(ref.id);
        const key = ref.status || "(unset)";
        derivedStatusRollup[key] = (derivedStatusRollup[key] ?? 0) + 1;
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
    instrumentWideObligations,
    chapters,
    derivedObligationCount: derivedIds.size,
    derivedStatusRollup,
  };
}
