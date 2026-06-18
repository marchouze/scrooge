// platform/regulatory/structured-doc-loader.ts
//
// Shared slug-resolving, enriching loader for structured regulation JSON.
//
// Why this exists: three consumers (regulation-reader detail view, the
// provision-scope adopt/distill routes, and recon:provision-tick-drift) need
// the SAME document shape for the SAME slug — otherwise tick scopeIds minted
// by the UI don't resolve on the server and verbatim hashes never match.
// The original tick routes probed `<slug>-structured.json` by filename, which
// breaks for every BCBS instrument (file `mar-structured.json`, slug
// `bcbs-mar`) and skipped the BCBS chapter-text enrichment entirely (empty
// section text → meaningless hashes, empty distill prompts).
//
// Three responsibilities:
//   1. Slug resolution — scan Regulations/<reg>/source-docs/*-structured.json
//      and key by the JSON's internal `slug` field (may differ from filename).
//   2. BCBS enrichment — fill empty section text from BCBS/chapter-text.json
//      (keyed `<PREFIX><num>`, e.g. MAR10) and mark verbatim.
//   3. ID assignment — deterministically assign missing chapter / section /
//      subsection ids so every node is tickable. The formulas here are the
//      single source of truth; the reader view calls the same functions, so
//      client-rendered scopeIds always match server-resolved ones.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// Structural shape — intentionally loose: BCBS files omit ids; SA files carry
// extra fields (verbatim, excerpts, …) that pass through untouched.
export interface LoaderSubsection {
  id?: string;
  number?: string;
  text?: string;
  subsections?: LoaderSubsection[];
  [k: string]: unknown;
}

export interface LoaderSection {
  id?: string;
  number?: string;
  sectionNumber?: string;
  heading?: string;
  title?: string;
  text?: string;
  /** Editorial précis used when no verbatim text was extracted (see schema). */
  summary?: string;
  verbatim?: boolean;
  subsections?: LoaderSubsection[];
  [k: string]: unknown;
}

export interface LoaderChapter {
  id?: string;
  number?: string;
  heading?: string;
  title?: string;
  sections: LoaderSection[];
  [k: string]: unknown;
}

export interface LoaderDoc {
  slug: string;
  title?: string;
  chapters: LoaderChapter[];
  [k: string]: unknown;
}

function defaultRepoRoot(): string {
  // import.meta.dir = <root>/prototype/platform/regulatory
  return resolve(import.meta.dir, "..", "..", "..");
}

// ---------------------------------------------------------------------------
// Section-number canonicalisation — the single source of truth
//
// Provision ids are minted as `PROV-<SLUG>-s<normSectionRef(number)>`. The
// obligation-linker's citation side (`normaliseSectionRef`) and this doc/graph
// side MUST agree on what `<number>` canonicalises to, or a citation token like
// `§4` never matches a provision the structured doc numbers `(4)` — the two
// sides mint different ids and the obligation→provision link silently drops to
// PARTIAL. (Root cause: two divergent copies of this normaliser. This is now
// the single shared definition; the reader view and the graph seed both import
// it, so the two sides can never drift again.)
//
// Cleaning rules (must mirror the wrappers `normaliseSectionRef` strips):
//   - strip a leading section sign `§` and any whitespace around it
//   - strip a leading section marker `s.` / `s` (so `s.4`, `s4`, `§4`, `4`,
//     and `(4)` all converge)
//   - strip surrounding parentheses (a doc numbered `(4)` is section 4)
//   - strip a TRAILING subsection paren to the top-level section, mirroring the
//     citation side's `(\d+[A-Za-z]?)(?:\(|$)` capture: `22(1)` → `22`,
//     `18(b)` → `18`, `1(6)` → `1`. (POPIA/FAIS structured docs number sections
//     `11(1)`, `1(6)` etc.; citations cite `s.11` / `§22`. Without this the two
//     sides mint `PROV-POPIA-s11(1)` vs `s11` and the link drops to PARTIAL.)
//   - lowercase
//   - strip dots (existing doc-side convention: `2.1.3` → `213`, matching the
//     graph seed's Step-5 `normSectionRef` over `RegulatoryConceptExtracted`)
//
// Deliberately NON-collapsing: a trailing letter suffix on the SECTION number
// is preserved, so `s7` ≠ `s7A`. Only the dot-stripping collapses `5.5` vs
// `5.5.1` — that is the pre-existing convention on BOTH the citation side (the
// graph seed strips `s` then dots) and the doc side, so it is not changed here.
// ---------------------------------------------------------------------------

/**
 * Canonicalise a raw section number/reference to the bare `<num>` form used
 * inside `PROV-<SLUG>-s<num>` ids.
 *
 *   "4"        → "4"
 *   "(4)"      → "4"
 *   "§4"       → "4"
 *   "§ 4"      → "4"
 *   "s.4"      → "4"
 *   "s4"       → "4"
 *   "13A"      → "13a"   (letter preserved, lowercased)
 *   "(13A)"    → "13a"
 *   "22(1)"    → "22"    (subsection dropped to top-level section)
 *   "18(b)"    → "18"
 *   "3.1"      → "31"    (existing dot-stripped convention)
 *
 * Inverse-of-prefix note: callers prepend the literal `s`, so this returns the
 * number WITHOUT the `s` marker.
 */
export function normSectionRef(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    // strip a leading section sign and any following whitespace: "§ 4" → "4"
    .replace(/^§\s*/, "")
    // strip surrounding parentheses: "(4)" → "4", "(13a)" → "13a"
    .replace(/^\(([^)]*)\)$/, "$1")
    // strip a leading section marker so "s.4" / "s4" → "4" (but never eat a
    // bare letter-led token — only strip `s` when a digit immediately follows,
    // optionally after a dot, e.g. "s.4" or "s4")
    .replace(/^s\.?(?=\d)/, "");

  // Drop a trailing subsection paren to the top-level section, mirroring the
  // citation side. Only when the value is a digit-led section number followed
  // by a parenthesised subsection — never touch a bare alpha token.
  const subsectionMatch = cleaned.match(/^(\d+[a-z]?)\(/);
  const topLevel = subsectionMatch?.[1] ?? cleaned;

  // existing convention: drop dots ("3.1" → "31")
  return topLevel.replace(/\./g, "");
}

// ---------------------------------------------------------------------------
// Slug → path discovery (internal `slug` field wins over filename)
// ---------------------------------------------------------------------------

const _slugPathCaches = new Map<string, Map<string, string>>();

export function discoverStructuredDocPaths(repoRoot?: string): Map<string, string> {
  const root = repoRoot ?? defaultRepoRoot();
  const cached = _slugPathCaches.get(root);
  if (cached) return cached;

  const map = new Map<string, string>();
  const regsDir = resolve(root, "Regulations");
  let regulatorDirs: string[] = [];
  try {
    regulatorDirs = readdirSync(regsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => resolve(regsDir, d.name, "source-docs"));
  } catch {
    _slugPathCaches.set(root, map);
    return map;
  }

  for (const dir of regulatorDirs) {
    if (!existsSync(dir)) continue;
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith("-structured.json"));
    } catch {
      continue;
    }
    for (const file of files) {
      const absPath = resolve(dir, file);
      let slug = file.replace(/-structured\.json$/, "");
      try {
        const raw = JSON.parse(readFileSync(absPath, "utf-8")) as { slug?: string };
        if (raw.slug) slug = raw.slug;
      } catch {
        // fall back to filename-derived slug
      }
      map.set(slug, absPath);
    }
  }

  _slugPathCaches.set(root, map);
  return map;
}

/** Test hook — drop the discovery cache (e.g. after writing fixture files). */
export function _resetStructuredDocCachesForTests(): void {
  _slugPathCaches.clear();
  _bcbsChapterTextCaches.clear();
}

// ---------------------------------------------------------------------------
// BCBS chapter-text enrichment
// ---------------------------------------------------------------------------

interface ChapterTextEntry {
  paragraph: string;
  heading: string;
  text: string;
}

const _bcbsChapterTextCaches = new Map<string, Record<string, ChapterTextEntry[]>>();

function loadBcbsChapterText(root: string): Record<string, ChapterTextEntry[]> {
  const cached = _bcbsChapterTextCaches.get(root);
  if (cached) return cached;
  const path = resolve(root, "Regulations", "BCBS", "chapter-text.json");
  let result: Record<string, ChapterTextEntry[]> = {};
  if (existsSync(path)) {
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as {
        chapters: Record<string, ChapterTextEntry[]>;
      };
      result = raw.chapters ?? {};
    } catch {
      result = {};
    }
  }
  _bcbsChapterTextCaches.set(root, result);
  return result;
}

/**
 * Fill empty BCBS section text from chapter-text.json. Sections gain
 * `verbatim: true` and (if missing) the canonical `<slug>-<num>` id —
 * identical to the regulation-reader's historical behaviour.
 */
export function enrichBcbsDoc(doc: LoaderDoc, repoRoot?: string): void {
  if (!doc.slug.startsWith("bcbs-")) return;
  const root = repoRoot ?? defaultRepoRoot();
  const chapterText = loadBcbsChapterText(root);
  const prefix = doc.slug.replace(/^bcbs-/, "").toUpperCase();

  for (const chapter of doc.chapters) {
    for (const section of chapter.sections) {
      if (section.text) continue;
      const num = section.number?.trim();
      if (!num) continue;
      const paras = chapterText[`${prefix}${num}`];
      if (!paras || paras.length === 0) continue;
      section.text = paras.map((p) => `${p.paragraph}  ${p.text}`).join("\n\n");
      section.verbatim = true;
      if (!section.id) section.id = `${doc.slug}-${num}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Deterministic ID assignment — the tickability contract
// ---------------------------------------------------------------------------

/**
 * Assign missing chapter / section / subsection ids in place. Formulas:
 *   chapter.id    → `ch-<slug>-<ordinal>`
 *   section.id    → `<slug>-<number>` (ordinal fallback `s<ordinal>`)
 *   subsection.id → `<sectionId>-<number>` (ordinal fallback), recursively
 * Number-derived (not position-derived) wherever a number exists, so a
 * formatting-only restructure keeps ids stable (Phase 6 drift contract).
 */
export function ensureProvisionIds(doc: LoaderDoc): void {
  const assignSubs = (subs: LoaderSubsection[] | undefined, parentId: string): void => {
    if (!subs) return;
    subs.forEach((sub, k) => {
      if (!sub.id) sub.id = `${parentId}-${sub.number?.trim() || String(k + 1)}`;
      assignSubs(sub.subsections, sub.id);
    });
  };

  doc.chapters.forEach((chapter, i) => {
    if (!chapter.id) chapter.id = `ch-${doc.slug}-${i + 1}`;
    chapter.sections.forEach((section, j) => {
      if (!section.id) {
        const num = section.number?.trim() || section.sectionNumber?.trim();
        section.id = `${doc.slug}-${num || `s${j + 1}`}`;
      }
      assignSubs(section.subsections, section.id);
    });
  });
}

// ---------------------------------------------------------------------------
// The loader
// ---------------------------------------------------------------------------

/**
 * Load, enrich and id-normalise the structured doc for a slug.
 * Returns null when the slug resolves to no file or the JSON is unreadable.
 */
export function loadStructuredDocBySlug(slug: string, repoRoot?: string): LoaderDoc | null {
  const absPath = discoverStructuredDocPaths(repoRoot).get(slug);
  if (!absPath || !existsSync(absPath)) return null;
  let doc: LoaderDoc;
  try {
    doc = JSON.parse(readFileSync(absPath, "utf-8")) as LoaderDoc;
  } catch {
    return null;
  }
  if (!doc.slug) doc.slug = slug;
  enrichBcbsDoc(doc, repoRoot);
  ensureProvisionIds(doc);
  return doc;
}

// ---------------------------------------------------------------------------
// Normalized provision tree — the single canonical text-assembly path
//
// Why this exists: the same structured-doc provision tree was assembled into
// display text TWO incompatible ways — the reader view's local `collectText`
// closure (section.text + ALL nested subsection text, folded recursively) and
// the V2 view's `flattenSubsections` (leaf subsection `.text` only, dropping
// top-level `section.text`). On-disk `summary` fields were read by neither, so
// 31 rrb sections rendered blank. This normalizer collapses both onto ONE
// contract, mirroring the `normSectionRef` precedent (PR #1429) of folding
// divergent copies onto a shared helper.
//
// It runs as a 4th pipeline step AFTER load → enrichBcbsDoc → ensureProvisionIds.
// It only ADDS verbatimText / textSource / completeness; it NEVER re-keys an id
// or number — those are the tickability contract (`ensureProvisionIds` output)
// and feed the tick/adoption flow + reverse index. The id-stability guard in
// the test asserts this byte-for-byte.
//
// Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL (CEO-approved this
// session), citing D-REGULATORY-LIBRARY-V1 + D-REGULATORY-VERBATIM-RENDERING-V1.
// ---------------------------------------------------------------------------

/** Where a provision's `verbatimText` was sourced from. */
export type TextSource = "own" | "folded" | "enriched" | "summary" | "heading";

/** How complete a provision's rendered text is (drives the Slice-2 badge). */
export type CompletenessTier = "verbatim" | "summary" | "heading-only" | "enriched";

/** An image/table/diagram excerpt, passed through verbatim from the doc. */
export interface NormalizedExcerpt {
  id: string;
  kind: string;
  hash?: string;
  pages?: string;
  caption?: string;
}

export interface NormalizedProvision {
  /** Stable id from `ensureProvisionIds` — preserved byte-for-byte. */
  id: string;
  /** Section/subsection number, preserved verbatim from the doc. */
  number: string;
  /** Heading / title, preserved verbatim from the doc. */
  heading: string;
  /** The assembled display text under the single text-assembly rule. */
  verbatimText: string;
  /** Provenance of `verbatimText`. */
  textSource: TextSource;
  /** Completeness tier, rolled up over the subtree. */
  completeness: CompletenessTier;
  /** True when text was folded from MORE THAN ONE subsection. */
  isComposite: boolean;
  /** PDF page range, when stamped. */
  pages?: string;
  excerpts: NormalizedExcerpt[];
  subsections: NormalizedProvision[];
}

export interface NormalizedDoc {
  slug: string;
  title: string;
  shortTitle?: string;
  regulator?: string;
  year?: number;
  priority?: number;
  citationPatterns?: string[];
  goldenSourceHash: string | null;
  chapters: Array<{
    id: string;
    number: string;
    heading: string;
    sections: NormalizedProvision[];
  }>;
}

/** A node carrying optional text + subsections — section OR subsection. */
interface AssemblyNode {
  id?: string;
  number?: string;
  heading?: string;
  title?: string;
  text?: string;
  summary?: string;
  pages?: string;
  excerpts?: Array<{
    id?: string;
    kind?: string;
    hash?: string;
    pages?: string;
    caption?: string;
  }>;
  subsections?: AssemblyNode[];
  [k: string]: unknown;
}

/**
 * Fold a node's own text PLUS its subsection tree into one verbatim string, in
 * document order. This is the EXACT logic previously living as the reader
 * view's local `collectText` closure — lifted here so V1 and V2 share one copy.
 * (Subsection text is prefixed with its number, mirroring the original.)
 */
function foldNodeText(node: AssemblyNode): string {
  const parts: string[] = [];
  const body = (node.text ?? "").trim();
  if (body) parts.push(body);
  for (const ss of node.subsections ?? []) {
    const sub = foldNodeText(ss);
    if (sub) parts.push(ss.number ? `${ss.number}  ${sub}` : sub);
  }
  return parts.join("\n\n");
}

/** Does this node, or anything in its subtree, carry non-empty `text`? */
function subtreeHasText(node: AssemblyNode): boolean {
  if ((node.text ?? "").trim()) return true;
  return (node.subsections ?? []).some(subtreeHasText);
}

function normExcerpts(node: AssemblyNode): NormalizedExcerpt[] {
  return (node.excerpts ?? [])
    .filter((e): e is { id: string; kind?: string } & typeof e => typeof e.id === "string")
    .map((e) => ({
      id: e.id,
      kind: e.kind ?? "full-page",
      ...(e.hash !== undefined ? { hash: e.hash } : {}),
      ...(e.pages !== undefined ? { pages: e.pages } : {}),
      ...(e.caption !== undefined ? { caption: e.caption } : {}),
    }));
}

/** Roll the strongest non-empty completeness of any descendant up to a tier. */
function rollUpCompleteness(
  own: CompletenessTier,
  children: NormalizedProvision[],
): CompletenessTier {
  if (own !== "heading-only") return own;
  // own is heading-only: stay heading-only only if the WHOLE subtree is empty.
  const ranked: CompletenessTier[] = ["enriched", "verbatim", "summary"];
  for (const tier of ranked) {
    if (children.some((c) => c.completeness === tier)) return tier;
  }
  return "heading-only";
}

/**
 * Assemble one provision (section or subsection) under the single text rule:
 *   (1) own `text` non-empty  → verbatimText = text; source own|enriched
 *   (2) empty text + subsection text → fold; source "folded"
 *   (3) empty + no subtext + summary present → summary; source "summary"
 *   (4) nothing → "" ; source "heading"
 * Subsections recurse with the same rule; completeness rolls up.
 */
function assembleProvision(node: AssemblyNode, slug: string): NormalizedProvision {
  const subsections = (node.subsections ?? []).map((ss) => assembleProvision(ss, slug));

  const ownText = (node.text ?? "").trim();
  const subCount = node.subsections?.length ?? 0;
  const foldedSubtreeHasText = (node.subsections ?? []).some(subtreeHasText);

  let verbatimText: string;
  let textSource: TextSource;
  let completeness: CompletenessTier;
  let isComposite = false;

  if (ownText) {
    // Branch 1 — own text. BCBS docs were enriched by enrichBcbsDoc (which set
    // section.text), so here that is tagged "enriched"; everything else "own".
    verbatimText = node.text ?? "";
    textSource = slug.startsWith("bcbs-") ? "enriched" : "own";
    completeness = textSource === "enriched" ? "enriched" : "verbatim";
  } else if (foldedSubtreeHasText) {
    // Branch 2 — fold from subsections, EXACT same logic as the old V1
    // collectText (now `foldNodeText`).
    verbatimText = foldNodeText(node);
    textSource = "folded";
    completeness = "verbatim";
    isComposite = subCount > 1;
  } else if ((node.summary ?? "").trim()) {
    // Branch 3 — editorial summary fallback.
    verbatimText = node.summary ?? "";
    textSource = "summary";
    completeness = "summary";
  } else {
    // Branch 4 — heading-only.
    verbatimText = "";
    textSource = "heading";
    completeness = "heading-only";
  }

  completeness = rollUpCompleteness(completeness, subsections);

  return {
    id: node.id ?? "",
    number: (node.number ?? node.sectionNumber ?? "").toString(),
    heading: (node.heading ?? node.title ?? "").toString(),
    verbatimText,
    textSource,
    completeness,
    isComposite,
    ...(node.pages !== undefined ? { pages: node.pages } : {}),
    excerpts: normExcerpts(node),
    subsections,
  };
}

/**
 * Normalize an already-loaded (enriched + id-assigned) doc into the canonical
 * tree. Pure: never mutates the input doc, never re-keys ids/numbers.
 */
export function normalizeStructuredDoc(doc: LoaderDoc): NormalizedDoc {
  const meta = doc as LoaderDoc & {
    shortTitle?: string;
    regulator?: string;
    year?: number;
    priority?: number;
    citationPatterns?: string[];
    goldenSourceHash?: string;
  };
  return {
    slug: doc.slug,
    title: doc.title ?? "",
    ...(meta.shortTitle !== undefined ? { shortTitle: meta.shortTitle } : {}),
    ...(meta.regulator !== undefined ? { regulator: meta.regulator } : {}),
    ...(meta.year !== undefined ? { year: meta.year } : {}),
    ...(meta.priority !== undefined ? { priority: meta.priority } : {}),
    ...(meta.citationPatterns !== undefined ? { citationPatterns: meta.citationPatterns } : {}),
    goldenSourceHash: meta.goldenSourceHash ?? null,
    chapters: doc.chapters.map((chapter) => ({
      id: chapter.id ?? "",
      number: (chapter.number ?? "").toString(),
      heading: (chapter.heading ?? chapter.title ?? "").toString(),
      sections: chapter.sections.map((section) => assembleProvision(section, doc.slug)),
    })),
  };
}

/** Load, enrich, id-normalise, then text-normalise the doc for a slug. */
export function loadNormalizedDocBySlug(slug: string, repoRoot?: string): NormalizedDoc | null {
  const doc = loadStructuredDocBySlug(slug, repoRoot);
  if (!doc) return null;
  return normalizeStructuredDoc(doc);
}
