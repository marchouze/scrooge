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
