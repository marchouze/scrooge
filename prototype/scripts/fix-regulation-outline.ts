// scripts/fix-regulation-outline.ts
//
// Local agent: scan Regulations/**/*-structured.json, fix broken outline
// numbering, and rebuild the `subsections[]` hierarchy that was lost when
// PDF-extracted text was split at page boundaries instead of section boundaries.
//
// Problem fixed:
//   - `heading` fields contain all sub-paragraphs merged in (e.g. s1.heading
//     = "Introduction 1.1. In 2021, the PA issued..." instead of "Introduction")
//   - `subsections[]` arrays are empty even though subsections exist in the blob
//   - `text` fields start with bare page numbers from the PDF ("2 breakdown...")
//
// Only processes guidance notes (instrumentType="guidance" or <200-line .txt
// counterpart). Legislation texts (FAIS Act, etc.) are already line-broken.
//
// Zero API calls. Writes .bak backups before overwriting.
// Also produces *-reformatted.txt for compact PDF-extracted source files.
//
// Usage:
//   bun run scripts/fix-regulation-outline.ts
//   bun run scripts/fix-regulation-outline.ts --dry-run
//   bun run scripts/fix-regulation-outline.ts --instrument banks-gn9-2022
//

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const INSTRUMENT_FILTER = (() => {
  const idx = args.indexOf("--instrument");
  return idx >= 0 ? args[idx + 1] : null;
})();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Subsection {
  id: string;
  number: string;
  heading?: string;
  text: string;
  verbatim?: boolean;
  subsections?: Subsection[];
}

interface Section {
  id: string;
  number: string;
  heading: string;
  text: string;
  verbatim?: boolean;
  subsections: Subsection[];
}

interface Chapter {
  id: string;
  title: string;
  sections: Section[];
}

interface StructuredDoc {
  slug: string;
  instrumentType?: string;
  chapters: Chapter[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "../..");
const REGS_ROOT = join(REPO_ROOT, "Regulations");

function* findStructuredJsonFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* findStructuredJsonFiles(full);
    } else if (entry.isFile() && entry.name.endsWith("-structured.json")) {
      yield full;
    }
  }
}

// ---------------------------------------------------------------------------
// Detect whether a file needs decimal-outline fixing
// ---------------------------------------------------------------------------

function needsDecimalFix(doc: StructuredDoc, jsonPath: string): boolean {
  if (doc.instrumentType === "guidance" || doc.instrumentType === "circular") return true;

  // Fall back: check if the .txt counterpart is compact (PDF-extracted)
  const txtPath = jsonPath.replace(/-structured\.json$/, ".txt");
  if (!existsSync(txtPath)) return false;
  const content = readFileSync(txtPath, "utf8");
  const lines = content.split("\n").length;
  return lines < 200;
}

// ---------------------------------------------------------------------------
// Core: strip stray page numbers
//
// PDF extraction artifacts like "2 breakdown..." at segment starts,
// or "\n\n3 breakdown..." between pages.
// Pattern: a bare 1-2 digit integer at the start of a string or after double
// newline, followed by a space and a capital letter (not a decimal like "2.5").
// ---------------------------------------------------------------------------

function stripPageNumbers(text: string): string {
  // Remove page markers from txt join
  let t = text.replace(/--- Page \d+ ---\s*/g, "");
  // Strip bare page numbers: start-of-string or after >=2 newlines
  t = t.replace(/(?:^|\n{2,})\s*\d{1,3}\s+(?=[A-Z])/g, " ");
  // Collapse multiple spaces/newlines into single space
  t = t
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t;
}

// ---------------------------------------------------------------------------
// Core: extract subsections for a given parent number
//
// Uses the section number as anchor to avoid false positives from cross-refs
// like "regulation 23(11)(d)". For section "2", the pattern matches:
//   2.1   2.1.   2.1.2   2.5.1.1   (but NOT 23.11 or 2/2024)
// ---------------------------------------------------------------------------

function buildSubsecPattern(parentNum: string): RegExp {
  // Escape dots in the parent number
  const esc = parentNum.replace(/\./g, "\\.");
  // Match: parent.child[.child[.child]][.]  followed by whitespace
  // Require word boundary before parent number to avoid matching "23.11" for parent "3"
  return new RegExp(`(?<![.\\d])(${esc}\\.\\d+(?:\\.\\d+(?:\\.\\d+)?)?)\\.?\\s+`, "g");
}

// ---------------------------------------------------------------------------
// Core: parse flat list of (number, text) pairs into nested tree
// ---------------------------------------------------------------------------

function buildTree(flat: Array<{ number: string; text: string }>): Subsection[] {
  if (flat.length === 0) return [];

  // Sort by numeric dotted order (e.g. 2.5.1 before 2.5.1.1)
  const sorted = [...flat].sort((a, b) => {
    const aParts = a.number.split(".").map(Number);
    const bParts = b.number.split(".").map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });

  // Build tree: a node is a child of another if the parent's number is a prefix
  function isChildOf(childNum: string, parentNum: string): boolean {
    return childNum.startsWith(`${parentNum}.`);
  }

  function makeSubsection(entry: { number: string; text: string }): Subsection {
    const idSafe = entry.number.replace(/\./g, "-");
    return {
      id: `s${idSafe}`,
      number: entry.number,
      text: entry.text.trim(),
      verbatim: true,
      subsections: [],
    };
  }

  // Insert into tree recursively — find the deepest ancestor that is a prefix
  function insert(roots: Subsection[], entry: { number: string; text: string }): void {
    const node = makeSubsection(entry);

    // Find the last root that is an ancestor
    for (let i = roots.length - 1; i >= 0; i--) {
      const candidate = roots[i];
      if (isChildOf(entry.number, candidate.number)) {
        // Recurse into this candidate's children
        const children = candidate.subsections ?? [];
        insert(children, entry);
        candidate.subsections = children;
        return;
      }
    }
    // No ancestor found — add as root-level sibling
    roots.push(node);
  }

  const roots: Subsection[] = [];
  for (const entry of sorted) {
    insert(roots, entry);
  }
  return roots;
}

// ---------------------------------------------------------------------------
// Core: fix one section
// ---------------------------------------------------------------------------

interface FixResult {
  heading: string;
  text: string;
  subsections: Subsection[];
  subsectionsFound: number;
}

function fixSection(section: Section): FixResult {
  // Guard: no number field — return heading as-is
  if (!section.number) {
    return { heading: section.heading, text: section.text, subsections: [], subsectionsFound: 0 };
  }

  // Merge heading + text (split was arbitrary at PDF page boundary)
  const raw = stripPageNumbers(`${section.heading} ${section.text}`);

  // Build pattern anchored to this section's number
  const pattern = buildSubsecPattern(section.number);

  // Find all subsection starts
  const matches: Array<{ number: string; index: number }> = [];
  pattern.lastIndex = 0;
  let m = pattern.exec(raw);
  while (m !== null) {
    matches.push({ number: m[1], index: m.index });
    m = pattern.exec(raw);
  }

  if (matches.length === 0) {
    // No subsections — just clean up the heading
    const dot = raw.indexOf(".");
    const heading = dot > 0 && dot < 80 ? raw.slice(0, dot + 1).trim() : raw.slice(0, 120).trim();
    return {
      heading: cleanHeading(heading, section.number),
      text: raw,
      subsections: [],
      subsectionsFound: 0,
    };
  }

  // Extract true heading: text before the first subsection number
  const firstMatch = matches[0];
  const headingBlob = raw.slice(0, firstMatch.index).trim();
  const heading = cleanHeading(headingBlob, section.number);

  // Extract subsection texts
  const flat: Array<{ number: string; text: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].number.length + 1; // skip the number itself
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const text = raw.slice(start, end).trim();
    flat.push({ number: matches[i].number, text });
  }

  const subsections = buildTree(flat);

  return {
    heading,
    text: headingBlob, // keep section intro text (same as heading for GN style)
    subsections,
    subsectionsFound: flat.length,
  };
}

// ---------------------------------------------------------------------------
// Core: clean a heading blob
//
// The heading blob is the text before the first subsection number.
// For "Introduction 1.1. In 2021..." → "Introduction"
// The actual section title is typically the first sentence / noun phrase.
// ---------------------------------------------------------------------------

function cleanHeading(blob: string, _sectionNumber: string): string {
  if (!blob) return "";
  // If the blob is short (<120 chars) it's already just the heading
  if (blob.length < 120) return blob.trim();
  // Try splitting on first sentence break
  const firstSentence = blob.match(/^[^.!?]+[.!?]/);
  if (firstSentence && firstSentence[0].length < 120) {
    return firstSentence[0].trim();
  }
  // Otherwise take up to 120 chars at a word boundary
  const truncated = blob.slice(0, 120);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).trim();
}

// ---------------------------------------------------------------------------
// Reformat .txt file: insert newlines at section boundaries
// ---------------------------------------------------------------------------

function reformatTxt(txtPath: string, _topSections: string[]): string {
  const raw = readFileSync(txtPath, "utf8");
  const text = raw
    .replace(/--- Page \d+ ---\s*/g, " ")
    .replace(/\n+/g, " ")
    .trim();

  // Insert \n before each top-level section and each known decimal subsection
  // Pattern: a number like "1.", "2.5.", "2.5.1." followed by space + capital
  const SECTION_RE = /(?<![.\d])(\d+(?:\.\d+)*\.?)\s+(?=[A-Z])/g;

  const result: string[] = [];
  let last = 0;
  SECTION_RE.lastIndex = 0;
  let sm = SECTION_RE.exec(text);
  while (sm !== null) {
    const num = sm[1];
    const parts = num.replace(/\.$/, "").split(".");
    const isAllDigits = parts.every((p) => /^\d+$/.test(p));
    const isBareNoTrailingDot = parts.length === 1 && !num.endsWith(".");
    const before = text.slice(Math.max(0, sm.index - 20), sm.index).toLowerCase();
    const isPrecededByKeyword = /regulation\s*$/.test(before) || /\bsection\s*$/.test(before);

    if (isAllDigits && !isBareNoTrailingDot && !isPrecededByKeyword) {
      result.push(text.slice(last, sm.index));
      result.push("\n");
      last = sm.index;
    }

    sm = SECTION_RE.exec(text);
  }
  result.push(text.slice(last));

  return result
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Process one structured JSON file
// ---------------------------------------------------------------------------

interface FileReport {
  slug: string;
  sections: number;
  subsectionsExtracted: number;
  skipped: boolean;
  reason?: string;
}

function processFile(jsonPath: string): FileReport {
  const raw = readFileSync(jsonPath, "utf8");
  const doc: StructuredDoc = JSON.parse(raw);
  const slug = doc.slug ?? basename(jsonPath, "-structured.json");

  if (INSTRUMENT_FILTER && slug !== INSTRUMENT_FILTER) {
    return { slug, sections: 0, subsectionsExtracted: 0, skipped: true, reason: "filtered" };
  }

  if (!needsDecimalFix(doc, jsonPath)) {
    return {
      slug,
      sections: 0,
      subsectionsExtracted: 0,
      skipped: true,
      reason: "legislation (already well-structured)",
    };
  }

  let totalSubsections = 0;
  let totalSections = 0;

  for (const chapter of doc.chapters) {
    for (const section of chapter.sections) {
      totalSections++;

      // Skip if subsections already populated (idempotent)
      if (section.subsections && section.subsections.length > 0) {
        totalSubsections += section.subsections.length;
        continue;
      }

      const result = fixSection(section);
      section.heading = result.heading;
      section.text = result.text;
      section.subsections = result.subsections;
      totalSubsections += result.subsectionsFound;
    }
  }

  if (!DRY_RUN) {
    // Write .bak before overwriting
    writeFileSync(`${jsonPath}.bak`, raw, "utf8");
    writeFileSync(jsonPath, JSON.stringify(doc, null, 2), "utf8");

    // Reformat the companion .txt if it exists and is compact
    const txtPath = jsonPath.replace(/-structured\.json$/, ".txt");
    if (existsSync(txtPath)) {
      const lines = readFileSync(txtPath, "utf8").split("\n").length;
      if (lines < 200) {
        const topNums = doc.chapters.flatMap((ch) => ch.sections.map((s) => s.number));
        const reformatted = reformatTxt(txtPath, topNums);
        const outPath = txtPath.replace(/\.txt$/, "-reformatted.txt");
        writeFileSync(outPath, reformatted, "utf8");
      }
    }
  }

  return { slug, sections: totalSections, subsectionsExtracted: totalSubsections, skipped: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(
  `fix-regulation-outline — ${DRY_RUN ? "DRY RUN" : "live"} — ${new Date().toISOString()}\n`,
);

const reports: FileReport[] = [];
for (const jsonPath of findStructuredJsonFiles(REGS_ROOT)) {
  try {
    const report = processFile(jsonPath);
    reports.push(report);
  } catch (err) {
    const slug = basename(jsonPath, "-structured.json");
    console.error(`  ERROR [${slug}]: ${(err as Error).message}`);
    reports.push({ slug, sections: 0, subsectionsExtracted: 0, skipped: true, reason: "error" });
  }
}

// Print summary
const processed = reports.filter((r) => !r.skipped);
const skipped = reports.filter((r) => r.skipped);

console.log("Results:");
for (const r of processed) {
  console.log(
    `  [${r.slug}] sections=${r.sections} subsections_extracted=${r.subsectionsExtracted}`,
  );
}

if (skipped.length > 0) {
  console.log(`\nSkipped (${skipped.length}):`);
  for (const r of skipped) {
    console.log(`  [${r.slug}] — ${r.reason}`);
  }
}

const totalSub = processed.reduce((s, r) => s + r.subsectionsExtracted, 0);
console.log(
  `\nTotal: ${processed.length} files fixed, ${totalSub} subsections extracted, ${skipped.length} skipped.`,
);
if (DRY_RUN) {
  console.log("(dry run — no files written)");
}
