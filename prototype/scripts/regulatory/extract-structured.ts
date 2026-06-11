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
  const extractedSections = extractSectionsFromPages(pages);
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

  if (!hashFlag && !fromPdf) {
    die("One of --hash <blake3:...> or --from <local-pdf> is required.");
  }

  if (hashFlag && !fromPdf) {
    // Hash-stamp mode — no extraction, just stamp the goldenSourceHash
    hashStampMode(slug, hashFlag, outPath);
  } else if (fromPdf) {
    // Full-extraction mode — pdftotext + merge + optionally stamp hash + excerpts
    fullExtractionMode(slug, fromPdf, outPath, hashFlag, withExcerpts);
  }
}

main();
