// scripts/regulatory/extract-structured.ts
//
// WS-REGULATORY-LIBRARY-V1 Slice 2 — structured-JSON enrichment CLI.
//
// Two modes:
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
// Network fetches NEVER run — all extraction is from local files only.
//
// Authority: D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
// node:fs already covers readdirSync for scanning /tmp
import { join } from "node:path";
import { recordRegulatoryExcerpt } from "../../platform/records";
import type {
  StructuredSection,
  StructuredSourceDocument,
} from "../../platform/regulatory/structured-source-schema";
import { die, emitOk, optionalString, parseArgs, requireString } from "../dispatch/args";

const PDFTOTEXT_BIN = "/opt/homebrew/bin/pdftotext";
const PDFTOPPM_BIN = "/opt/homebrew/bin/pdftoppm";

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
// Excerpt generation (--excerpts flag)
// ---------------------------------------------------------------------------

export interface GeneratedExcerpt {
  id: string;
  kind: "table" | "full-page";
  hash: string;
  pages: string;
  caption?: string;
}

/**
 * Detect pages to rasterise as excerpts:
 *  1. Image-only pages: pdftotext output ≤20 non-whitespace chars.
 *  2. Table-heuristic pages: ≥3 lines with ≥3 consecutive-space runs AND
 *     a schedule/table/annex keyword anywhere on the page.
 * If neither is found, force-rasterises page 1 as kind:"full-page" to
 * demonstrate the pipeline end-to-end.
 */
function detectExcerptPages(
  pages: ParsedPage[],
): Array<{ pageNum: number; kind: "table" | "full-page"; caption: string }> {
  // Exclude the trailing empty "page" that pdftotext adds after the last \f.
  // Heuristic: if the last entry has 0 non-whitespace chars AND the second-to-last
  // has content, treat the last as an artefact of the \f-split and drop it.
  const significantPages = pages.filter((p) => {
    const nonWs = p.lines.join("").replace(/\s/g, "").length;
    return nonWs > 0 || p.pageNum === 1; // always keep page 1
  });

  const results: Array<{ pageNum: number; kind: "table" | "full-page"; caption: string }> = [];

  // Pass 1 — image-only (≤20 non-ws chars, but must be a real page)
  for (const page of significantPages) {
    const nonWs = page.lines.join("").replace(/\s/g, "").length;
    if (nonWs <= 20) {
      results.push({ pageNum: page.pageNum, kind: "full-page", caption: `Page ${page.pageNum}` });
    }
  }

  // Pass 2 — table heuristic (only if we haven't already captured this page)
  const capturedPages = new Set(results.map((r) => r.pageNum));
  for (const page of significantPages) {
    if (capturedPages.has(page.pageNum)) continue;
    const pageText = page.lines.join("\n").toLowerCase();
    const hasKeyword = ["schedule", "table", "annex", "formula"].some((kw) =>
      pageText.includes(kw),
    );
    if (!hasKeyword) continue;
    const tableLineCount = page.lines.filter((l) => {
      const spaceMults = l.match(/\s{2,}/g);
      return spaceMults && spaceMults.length >= 3;
    }).length;
    if (tableLineCount >= 3) {
      results.push({
        pageNum: page.pageNum,
        kind: "table",
        caption: `Table/Schedule — Page ${page.pageNum}`,
      });
    }
  }

  // Force-rasterise page 1 if nothing found (demonstrates end-to-end pipeline)
  if (results.length === 0 && significantPages.length > 0) {
    results.push({ pageNum: 1, kind: "full-page", caption: "Cover page" });
  }

  return results;
}

/**
 * Rasterise one page of a PDF to PNG using pdftoppm, then file it via
 * `recordRegulatoryExcerpt`. Returns a `GeneratedExcerpt` with the
 * document hash and excerpt metadata.
 */
function rasteriseAndFileExcerpt(
  slug: string,
  fromPdf: string,
  pageNum: number,
  kind: "table" | "full-page",
  caption: string,
  instrumentId: string,
  sourceUrl: string | undefined,
  asOf: string,
): GeneratedExcerpt | null {
  const prefix = `/tmp/${slug}-p${pageNum}`;
  try {
    execSync(`${PDFTOPPM_BIN} -r 150 -png -f ${pageNum} -l ${pageNum} "${fromPdf}" "${prefix}"`, {
      encoding: "utf-8",
    });
  } catch (e) {
    console.error(
      `pdftoppm failed for page ${pageNum}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }

  // pdftoppm produces <prefix>-<N>.png where <N> is zero-padded based on
  // total page count (e.g. "-01.png" for 1–99 pages, "-001.png" for 100–999).
  // Scan /tmp for files matching the prefix to handle any padding width.
  const prefixBasename = prefix.replace("/tmp/", "");
  const tmpFiles = readdirSync("/tmp").filter(
    (f) => f.startsWith(`${prefixBasename}-`) && f.endsWith(".png"),
  );
  if (tmpFiles.length === 0) {
    console.error(`PNG not found with prefix ${prefix}`);
    return null;
  }
  const actualPngPath = `/tmp/${tmpFiles[0]}`;
  const pngBytes = new Uint8Array(readFileSync(actualPngPath));

  const excerptId = `${slug}-p${pageNum}`;
  const sectionId = `${slug}:p${pageNum}`;

  const result = recordRegulatoryExcerpt(
    {
      body: pngBytes,
      instrumentId,
      slug,
      sectionId,
      excerptId,
      kind,
      pages: String(pageNum),
      caption,
      ...(sourceUrl ? { sourceUrl } : {}),
    },
    asOf,
  );

  return {
    id: excerptId,
    kind,
    hash: result.documentHash as string,
    pages: String(pageNum),
    caption,
  };
}

/**
 * Attach generated excerpts to the matching section in the doc's chapters.
 * Match by page-range overlap (section.pages contains the page number), or
 * fall back to the first section in the document.
 */
function attachExcerptsToSections(
  doc: StructuredSourceDocument,
  excerpts: GeneratedExcerpt[],
): void {
  if (excerpts.length === 0) return;

  for (const excerpt of excerpts) {
    const excerptPage = Number(excerpt.pages);
    let attached = false;

    for (const chapter of doc.chapters) {
      for (const section of chapter.sections ?? []) {
        const secPages = section.pages;
        if (secPages) {
          // Parse page range "12" or "12–14" (em-dash) or "12-14" (hyphen)
          const parts = secPages.split(/[–-]/);
          const start = Number(parts[0]);
          const end = parts[1] ? Number(parts[1]) : start;
          if (
            !Number.isNaN(start) &&
            !Number.isNaN(end) &&
            excerptPage >= start &&
            excerptPage <= end
          ) {
            if (!section.excerpts) section.excerpts = [];
            section.excerpts.push(excerpt);
            attached = true;
            break;
          }
        }
      }
      if (attached) break;
    }

    // Fallback: attach to the first section
    if (!attached && doc.chapters.length > 0) {
      const firstChapter = doc.chapters[0];
      if (firstChapter?.sections?.length) {
        const firstSection = firstChapter.sections[0];
        if (!firstSection.excerpts) firstSection.excerpts = [];
        firstSection.excerpts.push(excerpt);
      }
    }
  }
}

function fullExtractionMode(
  slug: string,
  fromPdf: string,
  outPath: string | undefined,
  goldenHash: string | undefined,
  excerpts: boolean,
  instrumentId: string | undefined,
  sourceUrl: string | undefined,
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

  // Count what was added
  for (const chap of doc.chapters) {
    for (const sec of chap.sections ?? []) {
      if (sec.pages) pagesAdded++;
      if (sec.footnotes?.length) footnotesAdded += sec.footnotes.length;
    }
  }

  // ── Excerpt generation (--excerpts flag) ──────────────────────────────────
  const generatedExcerpts: GeneratedExcerpt[] = [];
  if (excerpts) {
    if (!existsSync(PDFTOPPM_BIN)) {
      console.error(`pdftoppm not found at ${PDFTOPPM_BIN}; skipping excerpt generation.`);
    } else {
      const asOf = new Date().toISOString();
      const effectiveInstrumentId = instrumentId ?? slug.toUpperCase();
      const excerptPages = detectExcerptPages(pages);

      for (const ep of excerptPages) {
        const generated = rasteriseAndFileExcerpt(
          slug,
          fromPdf,
          ep.pageNum,
          ep.kind,
          ep.caption,
          effectiveInstrumentId,
          sourceUrl,
          asOf,
        );
        if (generated) generatedExcerpts.push(generated);
      }

      // Attach excerpts to section nodes in the structured doc
      attachExcerptsToSections(doc, generatedExcerpts);
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
    excerptCount: generatedExcerpts.length,
    ...(generatedExcerpts.length > 0 ? { hashes: generatedExcerpts.map((e) => e.hash) } : {}),
    path: writePath,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // Check for bare --excerpts flag before parseArgs (which rejects bare flags).
  const rawArgv = process.argv.slice(2);
  const excerpts = rawArgv.includes("--excerpts");
  const filteredArgv = rawArgv.filter((a) => a !== "--excerpts");

  const args = parseArgs(filteredArgv, new Set<string>());

  const slug = requireString(args, "slug");
  const hashFlag = optionalString(args, "hash");
  const fromPdf = optionalString(args, "from");
  const outPath = optionalString(args, "out");
  const instrumentId = optionalString(args, "instrument-id");
  const sourceUrl = optionalString(args, "source-url");

  if (!hashFlag && !fromPdf) {
    die("One of --hash <blake3:...> or --from <local-pdf> is required.");
  }

  if (hashFlag && !fromPdf) {
    // Hash-stamp mode — no extraction, just stamp the goldenSourceHash
    hashStampMode(slug, hashFlag, outPath);
  } else if (fromPdf) {
    // Full-extraction mode — pdftotext + merge + optionally stamp hash + optional excerpts
    fullExtractionMode(slug, fromPdf, outPath, hashFlag, excerpts, instrumentId, sourceUrl);
  }
}

main();
