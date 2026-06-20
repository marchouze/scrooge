// scripts/regulatory/extract-structured.ts
//
// WS-REGULATORY-LIBRARY-V1 Slice 2 — structured-JSON enrichment CLI.
//
// Three modes:
//
//   Hash-stamp mode (--hash):
//     Loads an existing structured JSON for the given slug and stamps
//     goldenSourceHash onto it without touching sections, text, or subsections.
//     Use this after filing a PDF via acquire:source to link the structured
//     JSON to its content-addressed binary.
//
//     BANK_EVENT_DB="$HOME/.local/share/bank/event.db" \
//       bun run extract:structured \
//       --slug fais-act \
//       --hash "blake3:ecd52d04eaf0ad744e6454f8fd47186ac87da83450cdc5ad380e0ad11c4b73c8"
//
//   Full-extraction mode (--from):
//     Runs pdftotext -layout on the source PDF, segments by section-numbering
//     heuristics, tracks page ranges, collects footnotes, and MERGES the result
//     into any existing structured JSON (preserving hand-curated text and
//     subsections; only filling missing pages and footnotes).
//
//     bun run extract:structured \
//       --slug fais-act \
//       --from Regulations/FSCA/source-docs/fais-act-37-2002.pdf
//
//   Excerpt-generation mode (--from + --excerpts):
//     In addition to full-extraction, detects image-only pages (pdftotext ≤20
//     non-whitespace chars) and table-heuristic pages (≥3 lines with multi-space
//     alignment and a heading keyword). Rasterises each qualifying page via
//     pdftoppm -r 150 -png. Files each PNG via recordRegulatoryExcerpt(). If no
//     qualifying pages are found, force-rasterises page 1 as kind:"full-page".
//     Updates the structured JSON with excerpt records under matching sections.
//
//     BANK_EVENT_DB="$HOME/.local/share/bank/event.db" \
//       bun run extract:structured \
//       --slug fais-gcc \
//       --from Regulations/FSCA/source-docs/fais-general-code-of-conduct.pdf \
//       --excerpts
//
// Network fetches NEVER run — all extraction is from local files only.
//
// Authority: D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11).
// Author: Mira (Compliance / RegTech engineer, engineering).

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — import FIRST so the shared resolver
// mutates BANK_EVENT_DB before platform/composition resolves its dbPath.
import "../dispatch/resolve-event-db-boot";

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { clock } from "../../platform/composition";
import { recordRegulatoryExcerpt } from "../../platform/records";
import type {
  StructuredSection,
  StructuredSourceDocument,
} from "../../platform/regulatory/structured-source-schema";
import { die, emitOk, optionalString, parseArgs, requireString } from "../dispatch/args";

const PDFTOTEXT_BIN = "/opt/homebrew/bin/pdftotext";
const PDFTOPPM_BIN = "/opt/homebrew/bin/pdftoppm";

/** Keywords that mark a section as likely to contain a table or schedule. */
const TABLE_HEADING_KEYWORDS = ["schedule", "table", "annex", "formula", "appendix"];

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/** Resolve the repo root (three levels up from prototype/scripts/regulatory). */
function repoRoot(): string {
  // import.meta.dir = <worktree>/prototype/scripts/regulatory  (Bun)
  // Walk up: scripts/regulatory → scripts → prototype → repo root
  return join(import.meta.dir, "..", "..", "..");
}

/**
 * Find the existing structured JSON for a slug by scanning
 * Regulations/<regulator>/source-docs/<slug>-structured.json paths.
 */
function findStructuredJsonPath(slug: string): string | undefined {
  const root = repoRoot();
  const regsDir = join(root, "Regulations");
  if (!existsSync(regsDir)) return undefined;
  for (const sub of readdirSync(regsDir, { encoding: "utf-8" })) {
    const sourceDocsDir = join(regsDir, sub, "source-docs");
    if (!existsSync(sourceDocsDir)) continue;
    const candidate = join(sourceDocsDir, `${slug}-structured.json`);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Hash-stamp mode
// ---------------------------------------------------------------------------

function hashStampMode(slug: string, hash: string, outPath: string | undefined): void {
  const resolved = outPath ?? findStructuredJsonPath(slug);
  if (!resolved)
    die(`No structured JSON found for slug "${slug}". Pass --out <path> to create one.`);
  if (!existsSync(resolved)) die(`Structured JSON not found: ${resolved}`);

  const raw = readFileSync(resolved, "utf-8");
  let doc: StructuredSourceDocument;
  try {
    doc = JSON.parse(raw) as StructuredSourceDocument;
  } catch (e) {
    die(`Failed to parse ${resolved}: ${e instanceof Error ? e.message : String(e)}`);
  }

  doc.goldenSourceHash = hash;

  writeFileSync(resolved, `${JSON.stringify(doc, null, 2)}\n`, "utf-8");

  // Count sections for summary
  let sectionsEnriched = 0;
  for (const chapter of doc.chapters ?? []) {
    sectionsEnriched += (chapter.sections ?? []).length;
  }

  emitOk({
    slug,
    goldenSourceHash: hash,
    sectionsEnriched,
    pagesAdded: 0,
    footnotesAdded: 0,
    path: resolved,
  });
}

// ---------------------------------------------------------------------------
// Full-extraction mode (--from <pdf>)
// ---------------------------------------------------------------------------

interface ExtractedSection {
  id: string;
  number: string;
  /** Provision title (JSE profile carries the heading verbatim). */
  heading?: string;
  /** True when the body text is taken verbatim from the source (JSE profile). */
  verbatim?: boolean;
  pages?: string;
  footnotes?: Array<{ marker: string; text: string }>;
  text?: string;
}

interface ParsedPage {
  pageNum: number;
  lines: string[];
}

/** Split pdftotext output (with form-feed page breaks) into pages. */
function splitPages(raw: string): ParsedPage[] {
  // pdftotext uses \f (form feed, ASCII 12) between pages
  return raw.split("\f").map((pageText, idx) => ({
    pageNum: idx + 1,
    lines: pageText.split("\n"),
  }));
}

/**
 * IASB paragraph-id heuristic. IFRS/IAS standards number operative paragraphs
 * as `<id><2+ spaces><text>` where `<id>` is one of:
 *   - a core paragraph: `72`, `21`, `21A`, `21B`
 *   - a hierarchical sub-paragraph: `5.5.1`, `5.5.13`, `4.1.2A`
 *   - an appendix paragraph: `B2.1`, `BC10`, `C1`, `D1`, `IG2`, `IE5`
 * Sub-list markers like `(a)`/`(b)` and definition lines are continuation text,
 * NOT new paragraphs, so they fall through and accrete onto the current
 * paragraph (preserving verbatim structure).
 *
 * Returns the paragraph id + the inline text that followed it, or null.
 *
 * Calibration: requires the id to start at column 0 (no leading whitespace) and
 * be followed by >=2 spaces, which is how `pdftotext -layout` renders the
 * IASB hanging-indent paragraph style. Continuation lines are indented, so they
 * never match. This is far stricter than the generic `^\d+\.` rule and does NOT
 * latch onto stray year numbers ("2010") that appear mid-prose (those are never
 * at column 0 followed by the hanging indent).
 */
function isIasbParagraph(line: string): { number: string; heading: string } | null {
  // Must begin at column 0 (no indent) to be a paragraph id.
  if (/^\s/.test(line)) return null;
  // <id>  <text> — id is alnum with dots, 2+ spaces, then operative text.
  // id forms: 72 | 21A | 5.5.1 | 4.1.2A | B2.1 | BC10 | C1 | D1 | IG2 | IE5
  const m = line.match(/^((?:[A-Z]{1,3})?\d+(?:\.\d+)*[A-Z]?)\s{2,}(\S.*)$/);
  if (!m) return null;
  const id = m[1] ?? "";
  const text = (m[2] ?? "").trim();
  // Reject bare 4-digit years masquerading as paragraph ids (e.g. effective-date
  // and amendment-history pages: "2010   ...", "2014   ...").
  if (/^(19|20)\d{2}$/.test(id)) return null;
  // Require at least a few words of operative text to avoid table-cell noise.
  if (text.length < 3) return null;
  return { number: id, heading: text };
}

/** Detect section-heading lines: "1.", "Section 1", "(1)", etc. */
function isSectionHeading(line: string): { number: string; heading: string } | null {
  const trimmed = line.trim();
  // "1." at start
  const numDot = trimmed.match(/^(\d+)\.\s+(.*)/);
  if (numDot) return { number: numDot[1] ?? "", heading: numDot[2]?.trim() ?? "" };
  // "Section 1" / "section 1"
  const secN = trimmed.match(/^[Ss]ection\s+(\d+[A-Z]?)\s*(.*)/);
  if (secN) return { number: secN[1] ?? "", heading: secN[2]?.trim() ?? "" };
  // "(1)" standalone
  const paren = trimmed.match(/^\((\d+)\)\s+(.*)/);
  if (paren) return { number: paren[1] ?? "", heading: paren[2]?.trim() ?? "" };
  return null;
}

/** Detect footnote lines at the bottom of pages. */
function isFootnoteLine(line: string): { marker: string; text: string } | null {
  const trimmed = line.trim();
  // Numeric footnote: "1 Some footnote text."
  const numFn = trimmed.match(/^(\d+)\s+([A-Z][^.]{5,}\.?)$/);
  if (numFn) return { marker: numFn[1] ?? "", text: numFn[2] ?? "" };
  // Bracket footnote: "[1] Some footnote text."
  const brFn = trimmed.match(/^\[(\d+)\]\s+(.+)/);
  if (brFn) return { marker: `[${brFn[1]}]`, text: brFn[2] ?? "" };
  return null;
}

/**
 * Extract sections + page ranges from pdftotext output.
 * Heuristic: tracks which section each line belongs to by matching
 * section-heading patterns. Footnotes collected from the bottom ~10
 * lines of each page.
 */
function extractSectionsFromPages(pages: ParsedPage[]): ExtractedSection[] {
  const sections = new Map<
    string,
    {
      number: string;
      heading: string;
      startPage: number;
      endPage: number;
      lines: string[];
      footnotes: Array<{ marker: string; text: string }>;
    }
  >();
  let currentSectionNum: string | null = null;

  for (const page of pages) {
    const { pageNum, lines } = page;

    // Collect footnotes from the bottom of the page (last 10 non-empty lines)
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    const bottomLines = nonEmpty.slice(-10);
    const pageFootnotes: Array<{ marker: string; text: string }> = [];
    for (const line of bottomLines) {
      const fn = isFootnoteLine(line);
      if (fn) pageFootnotes.push(fn);
    }

    for (const line of lines) {
      const heading = isSectionHeading(line);
      if (heading) {
        currentSectionNum = heading.number;
        if (!sections.has(currentSectionNum)) {
          sections.set(currentSectionNum, {
            number: currentSectionNum,
            heading: heading.heading,
            startPage: pageNum,
            endPage: pageNum,
            lines: [],
            footnotes: [],
          });
        }
      } else if (currentSectionNum) {
        const sec = sections.get(currentSectionNum);
        if (sec) {
          sec.endPage = pageNum;
          sec.lines.push(line);
        }
      }
    }

    // Attach page footnotes to all sections active on this page
    if (pageFootnotes.length > 0) {
      for (const [, sec] of sections) {
        if (sec.endPage === pageNum) {
          sec.footnotes.push(...pageFootnotes);
        }
      }
    }
  }

  const result: ExtractedSection[] = [];
  for (const [, sec] of sections) {
    const bodyLines = sec.lines.filter((l) => l.trim().length > 0);
    const entry: ExtractedSection = {
      id: `s${sec.number.toLowerCase().replace(/\./g, "")}`,
      number: sec.number,
    };
    if (sec.startPage === sec.endPage) {
      entry.pages = String(sec.startPage);
    } else {
      entry.pages = `${sec.startPage}–${sec.endPage}`;
    }
    if (bodyLines.length > 0) {
      entry.text = bodyLines.join("\n").trim();
    }
    if (sec.footnotes.length > 0) {
      // Deduplicate footnotes by marker
      const seen = new Set<string>();
      entry.footnotes = sec.footnotes.filter((fn) => {
        if (seen.has(fn.marker)) return false;
        seen.add(fn.marker);
        return true;
      });
    }
    result.push(entry);
  }
  return result;
}

/**
 * IASB paragraph-profile extractor. Walks the pdftotext pages and opens a new
 * section every time a line matches an IASB paragraph id (`isIasbParagraph`).
 * Continuation lines (sub-list markers, indented prose) accrete onto the
 * current paragraph's text verbatim. Each emitted section carries the paragraph
 * id as both `number` and `id` (prefixed `p` so the id is a valid token), the
 * page range it spans, and `verbatim: true`.
 *
 * Unlike `extractSectionsFromPages`, this does NOT collapse the document into a
 * handful of `^\d+\.`-style sections — IFRS/IAS standards number every operative
 * paragraph (`5.5.1`, `72`, `21A`, `B2.1`), so this yields hundreds of
 * granular, individually-citable provisions.
 */
function extractIasbParagraphs(pages: ParsedPage[]): ExtractedSection[] {
  interface Para {
    number: string;
    startPage: number;
    endPage: number;
    lines: string[];
  }
  const paras: Para[] = [];
  let current: Para | null = null;

  for (const page of pages) {
    const { pageNum, lines } = page;
    for (const line of lines) {
      const hit = isIasbParagraph(line);
      if (hit) {
        current = {
          number: hit.number,
          startPage: pageNum,
          endPage: pageNum,
          lines: [line.trimEnd()],
        };
        paras.push(current);
      } else if (current) {
        // Continuation — keep verbatim (including indentation for sub-lists),
        // but skip pure page-number / form-feed noise lines.
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          current.endPage = pageNum;
          current.lines.push(line.replace(/\s+$/, ""));
        }
      }
    }
  }

  const result: ExtractedSection[] = [];
  const seen = new Set<string>();
  for (const p of paras) {
    // Deduplicate repeated paragraph ids (running headers can re-emit an id);
    // keep the first (richest) occurrence.
    if (seen.has(p.number)) continue;
    seen.add(p.number);
    const text = p.lines.join("\n").trim();
    if (text.length === 0) continue;
    const entry: ExtractedSection = {
      id: `p${p.number.toLowerCase().replace(/\./g, "-")}`,
      number: p.number,
      text,
      pages: p.startPage === p.endPage ? String(p.startPage) : `${p.startPage}–${p.endPage}`,
    };
    result.push(entry);
  }
  return result;
}

// ---------------------------------------------------------------------------
// JSE profile — chapter-aware rule/directive segmentation
//
// The JSE IRC Derivatives Rules and Directives use a hierarchical numbering
// scheme the generic `^\d+\.` heuristic cannot parse:
//
//   Rules:      chapters are `SECTION N: TITLE` (running header); operative
//               provisions are numbered `N.M0` at column 0 (e.g. `1.40`,
//               `1.100`, `3.35`), with `N.M0.K` subsections indented beneath.
//   Directives: chapters are `SECTION X : TITLE` (running header, X = A..E);
//               operative directives are 2-letter codes at column 0 (e.g.
//               `AA`, `AB`, `CE`), with numbered/lettered items beneath.
//
// This profile walks the `pdftotext -layout` output, drops the repeated
// running-header / footer / page-number lines (never part of any provision's
// verbatim body), tracks the current chapter, opens a new section at each
// column-0 heading, and accretes the verbatim body (including indented
// sub-items) onto the current section. The leading table-of-contents pages
// (lines carrying dot-leaders `.....N`) are skipped — they are an index, not
// regulatory text, and would otherwise produce duplicate empty headings.
//
// Verbatim discipline (Engineering Charter cmd 4, D-REGULATORY-LIBRARY-V1):
// every character of body text is taken straight from the PDF text layer — the
// profile only SPLITS and STRIPS chrome, it never rewrites or fabricates.
// ---------------------------------------------------------------------------

interface JseChapter {
  number: string;
  heading: string;
  sections: ExtractedSection[];
}

/** A column-0 line carrying dot-leaders is a table-of-contents entry, not body. */
function isTocLine(line: string): boolean {
  return /\.{5,}\s*\d+\s*$/.test(line);
}

/**
 * A per-Section "Scope of section" contents block lists each heading without
 * dot-leaders but sometimes with a trailing page number ("Reserved     79").
 * Strip a trailing run of 2+ spaces followed by a bare page number so the
 * captured heading is the clean title only. Never strips a single-space-joined
 * trailing number (those are part of a real title, e.g. "Rule 7.50.4").
 */
function stripTrailingTocPage(heading: string): string {
  return heading.replace(/\s{2,}\d{1,4}$/, "").trimEnd();
}

/**
 * Running-header / footer chrome that repeats on every page and is never part
 * of a provision's verbatim text. Matches the `SECTION ...` running header, the
 * `Interest Rate and Currency Derivatives ... Page N of M` footer, bare page
 * numbers, and the JSE copyright strip.
 */
function isJseChrome(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  if (/^SECTION\s+[0-9A-Z]+\s*:/.test(t)) return true; // running header (rules + directives)
  if (/^Interest Rate and Currency Derivatives\b.*Page\s+\d+\s+of\s+\d+/i.test(t)) return true;
  if (/^Page\s+\d+\s+of\s+\d+$/i.test(t)) return true;
  if (/^JSE Limited Reg No/i.test(t)) return true;
  if (/^©\s*JSE Limited/i.test(t)) return true;
  if (/^\d{1,4}$/.test(t)) return true; // bare page number
  return false;
}

/** Detect a chapter header `SECTION N: TITLE` / `SECTION X : TITLE`. */
function isJseChapterHeading(line: string): { number: string; heading: string } | null {
  const m = line.trim().match(/^SECTION\s+([0-9]+|[A-Z])\s*:\s*(.+?)\s*$/);
  if (!m) return null;
  const number = (m[1] ?? "").trim();
  // Normalise to title case for the visible label; keep verbatim wording.
  const rawTitle = (m[2] ?? "").trim();
  return { number, heading: rawTitle };
}

/**
 * Detect a JSE Rules provision heading: `N.M0` at column 0 followed by 2+
 * spaces and a title (never a sub-item `N.M0.K`, which is indented body text,
 * and never a TOC dot-leader line).
 */
function isJseRuleHeading(line: string): { number: string; heading: string } | null {
  if (/^\s/.test(line)) return null; // must be column 0
  if (isTocLine(line)) return null;
  // Guard: reject `N.M0.K` sub-items (they carry a second dot — they are
  // indented body text or amendment-history notes, not provision headings).
  // Checked BEFORE the heading match so a single-space `11.10.1 amended …`
  // amendment note never latches as a `11.10` heading.
  if (/^\d+\.\d+\./.test(line)) return null;
  // Guard: amendment-history notes recur at single-space column 0 but are
  // editorial annotations, not the provision heading. They always contain a
  // change verb followed by "with effect from …", optionally after a
  // sub-clause list ("9.110 and 9.110.1 to 9.110.8 deleted with effect from …",
  // "7.55 introduced with effect from …", "1.40.2 amended with effect from …").
  if (
    /^\d+\.\d+\b.*\b(amended|deleted|inserted|introduced|substituted|added|renumbered|repealed)\b.*\bwith effect from\b/i.test(
      line,
    )
  ) {
    return null;
  }
  // `1.40    Powers exercisable …` (2-space gap) OR `11.10 Default …`
  // (single-space gap — Section 11 of the Rules uses a single space). The
  // heading text must start with a letter so `11.10 (something)` numeric
  // continuations are not mistaken for a titled provision.
  const m = line.match(/^(\d+\.\d+)\s+([A-Za-z“"].*?)\s*$/);
  if (!m) return null;
  const number = m[1] ?? "";
  const heading = stripTrailingTocPage((m[2] ?? "").trim());
  return { number, heading };
}

/**
 * Detect a JSE Directives provision heading: a 2-letter code at column 0
 * followed by 2+ spaces and a title (e.g. `AA   Capital Adequacy Requirements`).
 */
function isJseDirectiveHeading(line: string): { number: string; heading: string } | null {
  if (/^\s/.test(line)) return null;
  if (isTocLine(line)) return null;
  const m = line.match(/^([A-Z]{2})\s{2,}(\S.*?)\s*$/);
  if (!m) return null;
  return { number: m[1] ?? "", heading: stripTrailingTocPage((m[2] ?? "").trim()) };
}

/**
 * Walk the pages and produce a chapter→section tree for a JSE document.
 *
 * @param kind "rules" → `N.M0` headings + `SECTION N` chapters;
 *             "directives" → 2-letter headings + `SECTION X` chapters.
 */
function extractJseChapters(pages: ParsedPage[], kind: "rules" | "directives"): JseChapter[] {
  const isHeading = kind === "rules" ? isJseRuleHeading : isJseDirectiveHeading;

  // Mutable accumulator for a single provision. Each chapter holds an ordered
  // list of these PLUS a by-number index so a heading that recurs (every JSE
  // Section opens with a "Scope of section" contents block that lists each
  // heading with NO body, then repeats each heading followed by its real body)
  // RE-ATTACHES to the same accumulator and keeps accreting body verbatim,
  // rather than creating a duplicate empty stub.
  interface SectionAcc {
    number: string;
    heading: string;
    startPage: number;
    endPage: number;
    lines: string[];
  }
  interface ChapterAcc {
    number: string;
    heading: string;
    order: SectionAcc[];
    byNumber: Map<string, SectionAcc>;
  }

  const chapterAccs: ChapterAcc[] = [];
  const chapterByNumber = new Map<string, ChapterAcc>();
  let currentChapter: ChapterAcc | null = null;
  let currentSection: SectionAcc | null = null;

  for (const page of pages) {
    const { pageNum, lines } = page;
    for (const line of lines) {
      // Chapter transition. A `SECTION N:` line is a running header repeated on
      // every page; OPEN a new chapter the first time each distinct number is
      // seen, otherwise just switch the active chapter. Never body text.
      const chap = isJseChapterHeading(line);
      if (chap) {
        const existing = chapterByNumber.get(chap.number);
        if (existing) {
          currentChapter = existing;
        } else {
          const created: ChapterAcc = {
            number: chap.number,
            heading: chap.heading,
            order: [],
            byNumber: new Map(),
          };
          chapterAccs.push(created);
          chapterByNumber.set(chap.number, created);
          currentChapter = created;
        }
        currentSection = null;
        continue;
      }

      // Drop running-header / footer / page-number chrome.
      if (isJseChrome(line)) continue;

      // The literal "Scope of section" label that precedes the contents block.
      if (/^\s*Scope of section\s*$/i.test(line)) continue;

      // Provision heading — open OR re-attach to its accumulator.
      const head = isHeading(line);
      if (head && currentChapter) {
        const existing = currentChapter.byNumber.get(head.number);
        if (existing) {
          // Recurrence (contents-block stub → body, or page-top continuation):
          // re-attach so the body that follows accretes onto the same section.
          // The body occurrence comes AFTER the per-Section contents block (which
          // can carry stale pre-amendment titles), so the latest non-empty
          // heading is authoritative — last-wins. (e.g. rule 4.80 reads "Open
          // transactions and positions" in a stale contents list but "Reserved"
          // in the current body; the body title wins.)
          if (head.heading.length > 0) existing.heading = head.heading;
          existing.endPage = pageNum;
          currentSection = existing;
        } else {
          const created: SectionAcc = {
            number: head.number,
            heading: head.heading,
            startPage: pageNum,
            endPage: pageNum,
            lines: [],
          };
          currentChapter.order.push(created);
          currentChapter.byNumber.set(head.number, created);
          currentSection = created;
        }
        continue;
      }

      // Body line — accrete onto the current section verbatim.
      if (currentSection) {
        currentSection.endPage = pageNum;
        currentSection.lines.push(line.replace(/\s+$/, ""));
      }
    }
  }

  // Finalise: build the immutable chapter tree, dropping empty chapters.
  const result: JseChapter[] = [];
  for (const chap of chapterAccs) {
    if (chap.order.length === 0) continue;
    const sections: ExtractedSection[] = chap.order.map((sec) => {
      const body = sec.lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const entry: ExtractedSection = {
        id: `s${sec.number.toLowerCase().replace(/\./g, "-")}`,
        number: sec.number,
        heading: sec.heading,
        verbatim: true,
        pages:
          sec.startPage === sec.endPage ? String(sec.startPage) : `${sec.startPage}–${sec.endPage}`,
      };
      if (body.length > 0) entry.text = body;
      return entry;
    });
    result.push({ number: chap.number, heading: chap.heading, sections });
  }
  return result;
}

/**
 * Merge extracted sections (pages + footnotes) into an existing structured
 * section tree. Preserves all existing text/subsections; only fills missing
 * pages and footnotes.
 */
function mergeExtracted(
  existing: StructuredSection[],
  extracted: Map<string, ExtractedSection>,
): StructuredSection[] {
  return existing.map((sec) => {
    const normNum = (sec.number ?? sec.sectionNumber ?? sec.id)
      .replace(/^[a-z-]+/i, "")
      .trim()
      .replace(/\./g, "");
    const ext = extracted.get(normNum);
    const updated: StructuredSection = { ...sec };
    if (ext) {
      if (!updated.pages && ext.pages) updated.pages = ext.pages;
      if (!updated.footnotes?.length && ext.footnotes?.length) {
        updated.footnotes = ext.footnotes;
      }
    }
    if (sec.subsections?.length) {
      updated.subsections = mergeExtracted(sec.subsections, extracted);
    }
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Excerpt generation helpers (--excerpts flag)
// ---------------------------------------------------------------------------

interface ExcerptRecord {
  id: string;
  kind: "table" | "diagram" | "formula" | "full-page";
  hash?: string;
  pages: string;
  caption: string;
}

/**
 * Determine the non-whitespace character count for a pdftotext page string.
 * A page with ≤20 non-whitespace chars is treated as image-only.
 */
function pageNonWsCount(pageText: string): number {
  return (pageText.match(/\S/g) ?? []).length;
}

/**
 * Table heuristic: returns true when the page text contains ≥3 lines that
 * have multiple consecutive spaces/tabs (tabular alignment signature).
 */
function looksTabular(pageText: string): boolean {
  const lines = pageText.split("\n");
  let tabularLines = 0;
  for (const line of lines) {
    if (/\S[ \t]{2,}\S/.test(line)) tabularLines++;
  }
  return tabularLines >= 3;
}

/**
 * Return the section heading nearest to a given page number, or a default
 * label, for use as excerpt caption.
 */
function captionForPage(pageNum: number, extractedSections: ExtractedSection[]): string {
  // Walk sections by start page — find the last section that starts at or
  // before this page.
  let best: ExtractedSection | null = null;
  for (const sec of extractedSections) {
    const startPage = Number(String(sec.pages ?? "0").split(/[–-]/)[0] ?? "0");
    if (startPage <= pageNum) {
      best = sec;
    }
  }
  return best ? `${best.id}: ${best.number}` : `Page ${pageNum}`;
}

/**
 * Rasterise a single PDF page to a PNG and file it via recordRegulatoryExcerpt.
 * Returns the excerpt record or null on failure.
 */
function rasterisePage(
  slug: string,
  fromPdf: string,
  pageNum: number,
  kind: "table" | "diagram" | "formula" | "full-page",
  caption: string,
  sectionId: string,
): ExcerptRecord | null {
  const excerptId = `${slug}-p${pageNum}`;
  const outPrefix = `/tmp/${excerptId}`;

  // pdftoppm -r 150 -png -f <page> -l <page> <pdf> <prefix>
  // Produces: <prefix>-000001.png (always 6-digit suffix)
  try {
    execSync(
      `${PDFTOPPM_BIN} -r 150 -png -f ${pageNum} -l ${pageNum} "${fromPdf}" "${outPrefix}"`,
      { encoding: "utf-8" },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`[warn] pdftoppm failed for page ${pageNum}: ${msg}\n`);
    return null;
  }

  // pdftoppm names the output file with the zero-padded PDF page number as
  // the suffix (e.g. page 2 → "-02.png", page 13 → "-13.png"). Fall back
  // to a glob-style search if the expected path isn't found.
  const paddedPage = String(pageNum).padStart(2, "0");
  let pngPath = `${outPrefix}-${paddedPage}.png`;
  if (!existsSync(pngPath)) {
    // Wider padding (e.g. 3-digit pages)
    const paddedPage3 = String(pageNum).padStart(3, "0");
    const alt3 = `${outPrefix}-${paddedPage3}.png`;
    if (existsSync(alt3)) {
      pngPath = alt3;
    }
  }
  if (!existsSync(pngPath)) {
    process.stderr.write(`[warn] pdftoppm output not found: ${pngPath}\n`);
    return null;
  }

  const pngBytes = new Uint8Array(readFileSync(pngPath));
  if (pngBytes.length === 0) {
    process.stderr.write(`[warn] Empty PNG for page ${pageNum}\n`);
    return null;
  }

  // File the PNG via recordRegulatoryExcerpt
  let hash: string | undefined;
  try {
    const result = recordRegulatoryExcerpt(
      {
        body: pngBytes,
        instrumentId: slug.toUpperCase(),
        slug,
        sectionId,
        excerptId,
        kind,
        pages: String(pageNum),
        caption,
        actor: { type: "service", id: "agent:mira" },
      },
      clock.now(),
    );
    hash = String(result.documentHash);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`[warn] recordRegulatoryExcerpt failed for page ${pageNum}: ${msg}\n`);
    // Continue without hash — excerpt still recorded in JSON but hash absent
  }

  return { id: excerptId, kind, hash, pages: String(pageNum), caption };
}

/**
 * Attach excerpt records to the matching section in the document's chapter
 * tree. Section matching is by page-range overlap; if no match, the excerpt
 * is attached to the first section.
 */
function attachExcerptsToSections(doc: StructuredSourceDocument, excerpts: ExcerptRecord[]): void {
  if (excerpts.length === 0) return;

  // Build a flat list of section references with page bounds for matching
  type SectionRef = { section: StructuredSection; startPage: number; endPage: number };
  const flat: SectionRef[] = [];
  for (const chapter of doc.chapters ?? []) {
    for (const sec of chapter.sections ?? []) {
      if (sec.pages) {
        const parts = String(sec.pages).split(/[–\-]/);
        const start = Number(parts[0] ?? "0") || 0;
        const end = Number(parts[1] ?? parts[0] ?? "0") || start;
        flat.push({ section: sec, startPage: start, endPage: end });
      }
    }
  }

  for (const exc of excerpts) {
    const excPage = Number(exc.pages.split(/[–\-]/)[0] ?? "0") || 0;

    // Find section whose page range contains the excerpt page
    let target = flat.find((r) => excPage >= r.startPage && excPage <= r.endPage)?.section;

    // Fall back: closest section by start page (≤ excerpt page)
    if (!target) {
      let bestDist = Number.MAX_SAFE_INTEGER;
      for (const r of flat) {
        const dist = Math.abs(r.startPage - excPage);
        if (dist < bestDist) {
          bestDist = dist;
          target = r.section;
        }
      }
    }

    // Last resort: first section of first chapter
    if (!target && (doc.chapters[0]?.sections?.length ?? 0) > 0) {
      target = doc.chapters[0]?.sections?.[0];
    }

    if (!target) continue;

    if (!target.excerpts) target.excerpts = [];
    // Avoid duplicates by id
    const alreadyPresent = target.excerpts.some((e) => e.id === exc.id);
    if (!alreadyPresent) {
      target.excerpts.push({
        id: exc.id,
        kind: exc.kind,
        ...(exc.hash ? { hash: exc.hash } : {}),
        pages: exc.pages,
        caption: exc.caption,
      });
    }
  }
}

/**
 * Get the real page count of a PDF via pdfinfo.
 * Returns undefined if pdfinfo is unavailable or fails.
 */
function getPdfPageCount(pdfPath: string): number | undefined {
  try {
    const out = execSync(`pdfinfo "${pdfPath}" 2>/dev/null | grep -i '^Pages:'`, {
      encoding: "utf-8",
    });
    const match = out.match(/Pages:\s*(\d+)/i);
    return match ? Number(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detect pages to rasterise given pdftotext output and extracted sections.
 * Returns an array of `{ pageNum, kind }` entries.
 *
 * @param pdfPageCount - real PDF page count; pages beyond this are skipped
 *   (pdftotext emits a trailing form-feed that creates a phantom extra page).
 */
function detectExcerptPages(
  pages: ParsedPage[],
  _extractedSections: ExtractedSection[],
  pdfPageCount: number | undefined,
): Array<{ pageNum: number; kind: "table" | "full-page" }> {
  // Filter to real pages only (skip pdftotext's trailing phantom page)
  const realPages = pdfPageCount ? pages.filter((p) => p.pageNum <= pdfPageCount) : pages;

  const imageOnly: Array<{ pageNum: number; kind: "table" | "full-page" }> = [];

  for (const page of realPages) {
    const pageText = page.lines.join("\n");
    const nws = pageNonWsCount(pageText);
    if (nws <= 20) {
      imageOnly.push({ pageNum: page.pageNum, kind: "full-page" });
    }
  }

  if (imageOnly.length > 0) return imageOnly;

  // Table heuristic — check for tabular pages whose section heading contains
  // a keyword like "schedule", "table", "annex", "formula".
  const tablePages: Array<{ pageNum: number; kind: "table" | "full-page" }> = [];
  for (const page of realPages) {
    const pageText = page.lines.join("\n");
    if (!looksTabular(pageText)) continue;

    // Check if the page text or the nearest section heading contains a keyword
    const textLower = pageText.toLowerCase();
    const hasKeyword = TABLE_HEADING_KEYWORDS.some((kw) => textLower.includes(kw));
    if (hasKeyword) {
      tablePages.push({ pageNum: page.pageNum, kind: "table" });
    }
  }
  if (tablePages.length > 0) return tablePages;

  // Force-rasterise page 1 as full-page fallback — always demonstrable
  return [{ pageNum: 1, kind: "full-page" }];
}

/**
 * Run excerpt generation on the given PDF. Returns the list of excerpt records
 * produced. Side-effects: files PNGs via recordRegulatoryExcerpt; mutates
 * doc.chapters to attach excerpts.
 */
function generateExcerpts(
  slug: string,
  fromPdf: string,
  pages: ParsedPage[],
  extractedSections: ExtractedSection[],
  doc: StructuredSourceDocument,
): ExcerptRecord[] {
  const pdfPageCount = getPdfPageCount(fromPdf);
  const toRasterise = detectExcerptPages(pages, extractedSections, pdfPageCount);

  const produced: ExcerptRecord[] = [];
  for (const { pageNum, kind } of toRasterise) {
    const caption = captionForPage(pageNum, extractedSections);
    const sectionId = `${slug}:s${pageNum}`;
    const rec = rasterisePage(slug, fromPdf, pageNum, kind, caption, sectionId);
    if (rec) produced.push(rec);
  }

  // Attach to document sections
  attachExcerptsToSections(doc, produced);

  return produced;
}

// ---------------------------------------------------------------------------
// Full-extraction mode (--from <pdf>)
// ---------------------------------------------------------------------------

function fullExtractionMode(
  slug: string,
  fromPdf: string,
  outPath: string | undefined,
  goldenHash: string | undefined,
  withExcerpts: boolean,
  profile: "default" | "iasb" | "jse-rules" | "jse-directives",
): void {
  if (!existsSync(fromPdf)) die(`--from path not found: ${fromPdf}`);
  if (!existsSync(PDFTOTEXT_BIN)) {
    die(`pdftotext not found at ${PDFTOTEXT_BIN}. Install poppler (brew install poppler).`);
  }

  // Extract text using pdftotext -layout
  let rawText: string;
  try {
    rawText = execSync(`${PDFTOTEXT_BIN} -layout -f 1 -l 999 "${fromPdf}" -`, {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024, // 50 MB
    });
  } catch (e) {
    die(`pdftotext failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const pages = splitPages(rawText);

  // ---- JSE profile: chapter-aware rule/directive segmentation ----
  // Builds the chapter→section tree directly from the JSE numbering scheme and
  // writes the structured JSON, then returns. (The generic merge path below is
  // only for the default/iasb single-chapter profiles.)
  if (profile === "jse-rules" || profile === "jse-directives") {
    const kind = profile === "jse-rules" ? "rules" : "directives";
    const jseChapters = extractJseChapters(pages, kind);
    if (jseChapters.length === 0) {
      die(`JSE extraction produced no chapters for slug "${slug}" — check the PDF text layer.`);
    }

    // Preserve any hand-authored doc-level metadata (slug, title, regulator,
    // citationPatterns, …) if a structured JSON already exists; only the
    // chapter tree is (re)built from the PDF.
    const jsonPathJse = outPath ?? findStructuredJsonPath(slug);
    let docJse: StructuredSourceDocument;
    if (jsonPathJse && existsSync(jsonPathJse)) {
      docJse = JSON.parse(readFileSync(jsonPathJse, "utf-8")) as StructuredSourceDocument;
    } else {
      docJse = { slug, title: slug, chapters: [] };
    }

    docJse.chapters = jseChapters.map((c) => ({
      id: `ch-${slug}-s${c.number.toLowerCase()}`,
      number: c.number,
      heading: `Section ${c.number}: ${c.heading}`,
      sections: c.sections,
    }));

    if (goldenHash) docJse.goldenSourceHash = goldenHash;

    const writePathJse = outPath ?? jsonPathJse ?? `${slug}-structured.json`;
    writeFileSync(writePathJse, `${JSON.stringify(docJse, null, 2)}\n`, "utf-8");

    let sectionsEnrichedJse = 0;
    let pagesAddedJse = 0;
    for (const chap of docJse.chapters) {
      for (const sec of chap.sections ?? []) {
        sectionsEnrichedJse++;
        if (sec.pages) pagesAddedJse++;
      }
    }

    emitOk({
      slug,
      ...(docJse.goldenSourceHash ? { goldenSourceHash: docJse.goldenSourceHash } : {}),
      chapters: docJse.chapters.length,
      sectionsEnriched: sectionsEnrichedJse,
      pagesAdded: pagesAddedJse,
      footnotesAdded: 0,
      path: writePathJse,
    });
    return;
  }

  const extractedSections =
    profile === "iasb" ? extractIasbParagraphs(pages) : extractSectionsFromPages(pages);
  const extractedMap = new Map<string, ExtractedSection>(
    extractedSections.map((s) => [s.number.replace(/\./g, ""), s]),
  );

  // Load or create the structured JSON
  const jsonPath = outPath ?? findStructuredJsonPath(slug);
  let doc: StructuredSourceDocument;
  let pagesAdded = 0;
  let footnotesAdded = 0;

  if (jsonPath && existsSync(jsonPath)) {
    doc = JSON.parse(readFileSync(jsonPath, "utf-8")) as StructuredSourceDocument;

    // Merge extracted into existing chapters
    doc.chapters = doc.chapters.map((chap) => ({
      ...chap,
      sections: mergeExtracted(chap.sections ?? [], extractedMap) as typeof chap.sections,
    }));
  } else if (profile === "iasb") {
    // Build from scratch — IASB paragraph profile. One section per operative
    // paragraph, verbatim text, with a short heading label derived from the
    // paragraph's opening clause (keeps headings short so the quality gate's
    // prose-heading / heading-in-body advisories do not fire spuriously).
    const chapters = [
      {
        id: `ch-${slug}-paragraphs`,
        heading: "Operative paragraphs",
        sections: extractedSections.map((s) => ({
          id: s.id,
          number: s.number,
          heading: `${s.number}`,
          ...(s.text ? { text: s.text } : {}),
          verbatim: true,
          ...(s.pages ? { pages: s.pages } : {}),
        })),
      },
    ];
    doc = {
      slug,
      title: slug,
      chapters,
    };
  } else {
    // Build from scratch
    const chapters = [
      {
        id: "extracted",
        heading: "Extracted Sections",
        sections: extractedSections.map((s) => ({
          id: s.id,
          number: s.number,
          heading: s.number,
          ...(s.text ? { text: s.text } : {}),
          ...(s.pages ? { pages: s.pages } : {}),
          ...(s.footnotes?.length ? { footnotes: s.footnotes } : {}),
        })),
      },
    ];
    doc = {
      slug,
      title: slug,
      chapters,
    };
  }

  if (goldenHash) doc.goldenSourceHash = goldenHash;

  // Excerpt generation — only when --excerpts is given
  let excerpts: ExcerptRecord[] = [];
  if (withExcerpts) {
    if (!existsSync(PDFTOPPM_BIN)) {
      process.stderr.write(
        `[warn] pdftoppm not found at ${PDFTOPPM_BIN} — skipping excerpt generation.\n`,
      );
    } else {
      excerpts = generateExcerpts(slug, fromPdf, pages, extractedSections, doc);
    }
  }

  // Count what was added
  for (const chap of doc.chapters) {
    for (const sec of chap.sections ?? []) {
      if (sec.pages) pagesAdded++;
      if (sec.footnotes?.length) footnotesAdded += sec.footnotes.length;
    }
  }

  const writePath = outPath ?? jsonPath ?? `${slug}-structured.json`;
  writeFileSync(writePath, `${JSON.stringify(doc, null, 2)}\n`, "utf-8");

  let sectionsEnriched = 0;
  for (const chapter of doc.chapters ?? []) {
    sectionsEnriched += (chapter.sections ?? []).length;
  }

  emitOk({
    slug,
    ...(doc.goldenSourceHash ? { goldenSourceHash: doc.goldenSourceHash } : {}),
    sectionsEnriched,
    pagesAdded,
    footnotesAdded,
    path: writePath,
    ...(withExcerpts
      ? {
          excerptCount: excerpts.length,
          hashes: excerpts.map((e) => e.hash).filter(Boolean),
        }
      : {}),
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // --excerpts is a bare boolean flag with no value; strip it before passing
  // to parseArgs (which rejects bare flags).
  const rawArgv = process.argv.slice(2);
  const withExcerpts = rawArgv.includes("--excerpts");
  const filteredArgv = rawArgv.filter((a) => a !== "--excerpts");

  const args = parseArgs(filteredArgv, new Set<string>());

  const slug = requireString(args, "slug");
  const hashFlag = optionalString(args, "hash");
  const fromPdf = optionalString(args, "from");
  const outPath = optionalString(args, "out");
  const profileFlag = optionalString(args, "profile") ?? "default";
  const VALID_PROFILES = ["default", "iasb", "jse-rules", "jse-directives"] as const;
  if (!(VALID_PROFILES as readonly string[]).includes(profileFlag)) {
    die(`Unknown --profile "${profileFlag}". Expected one of: ${VALID_PROFILES.join(", ")}.`);
  }
  const profile = profileFlag as (typeof VALID_PROFILES)[number];

  if (!hashFlag && !fromPdf) {
    die("One of --hash <blake3:...> or --from <local-pdf> is required.");
  }

  if (hashFlag && !fromPdf) {
    // Hash-stamp mode — no extraction, just stamp the goldenSourceHash
    hashStampMode(slug, hashFlag, outPath);
  } else if (fromPdf) {
    // Full-extraction mode — pdftotext + merge + optionally stamp hash + excerpts
    fullExtractionMode(slug, fromPdf, outPath, hashFlag, withExcerpts, profile);
  }
}

main();
