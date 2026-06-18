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
//   - lowercase
//   - strip dots (existing doc-side convention: `2.1.3` → `213`, matching the
//     graph seed's Step-5 `normSectionRef` over `RegulatoryConceptExtracted`)
//
// Deliberately NON-collapsing: a trailing letter suffix is preserved, so
// `s7` ≠ `s7A`. Only the dot-stripping collapses `5.5` vs `5.5.1` — that is the
// pre-existing convention on BOTH the citation side (the graph seed strips `s`
// then dots) and the doc side, so it is not changed here.
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
 *   "3.1"      → "31"    (existing dot-stripped convention)
 *
 * Inverse-of-prefix note: callers prepend the literal `s`, so this returns the
 * number WITHOUT the `s` marker.
 */
export function normSectionRef(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    // strip a leading section sign and any following whitespace: "§ 4" → "4"
    .replace(/^§\s*/, "")
    // strip surrounding parentheses: "(4)" → "4", "(13a)" → "13a"
    .replace(/^\(([^)]*)\)$/, "$1")
    // strip a leading section marker so "s.4" / "s4" → "4" (but never eat a
    // bare letter-led token — only strip `s` when a digit immediately follows,
    // optionally after a dot, e.g. "s.4" or "s4")
    .replace(/^s\.?(?=\d)/, "")
    // existing convention: drop dots ("3.1" → "31")
    .replace(/\./g, "");
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
