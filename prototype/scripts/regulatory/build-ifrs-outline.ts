// scripts/regulatory/build-ifrs-outline.ts
//
// Give the three IFRS structured docs (ifrs-9, ifrs-7, ifrs-13) a real CONTENTS
// outline with descriptive chapter/section titles SOURCED from the golden-source
// PDF, then nest the flat paragraph list under that outline — without altering
// one byte of any paragraph's verbatim text.
//
// Pipeline per doc:
//   1. Resolve the goldenSourceHash → PDF bytes from the content-addressed
//      document store (NEVER a hardcoded path).
//   2. `pdftotext -layout` the PDF; parse its CONTENTS page → title map
//      (ifrs-contents-parser.ts).
//   3. Restructure the flat doc into chapter → section → paragraph nesting,
//      titles from the contents map (ifrs-outline-restructure.ts).
//   4. ASSERT verbatim preservation (multiset + total char count unchanged) and
//      paragraph coverage (count in == count out). Fail closed on any drift.
//   5. Rewrite the *-structured.json file (metadata + slug + goldenSourceHash
//      preserved).
//
// Source, don't hardcode; fail-closed; replay-safe (pure rewrite of a committed
// artefact). Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { defaultDocumentStore } from "../../platform/document-store";
import type { DocumentHash } from "../../platform/document-store";
import { loadNormalizedDocBySlug } from "../../platform/regulatory/structured-doc-loader";
import { restructureIfrsDoc, type FlatDoc } from "./ifrs-outline-restructure";

const SLUGS = ["ifrs-9", "ifrs-7", "ifrs-13"] as const;

function repoRoot(): string {
  // import.meta.dir = <root>/prototype/scripts/regulatory
  return resolve(import.meta.dir, "..", "..", "..");
}

function docPath(root: string, slug: string): string {
  return resolve(root, "Regulations", "INTL", "IASB", "source-docs", `${slug}-structured.json`);
}

/** Resolve the golden-source PDF bytes for a slug via the document store. */
function resolveGoldenPdf(slug: string, root: string): Uint8Array {
  const norm = loadNormalizedDocBySlug(slug, root);
  if (!norm) throw new Error(`[${slug}] structured doc did not load`);
  const hash = norm.goldenSourceHash;
  if (!hash) throw new Error(`[${slug}] no goldenSourceHash on the structured doc`);
  try {
    return defaultDocumentStore.get(hash as DocumentHash);
  } catch (e) {
    throw new Error(
      `[${slug}] golden-source blob ${hash} not in document store ` +
        `(${(e as Error).message}); set BANK_DOCUMENT_STORE to the store holding it`,
    );
  }
}

/** Run `pdftotext -layout` over the PDF bytes; returns the text. STOPS if pdftotext is missing. */
function pdfToText(pdfBytes: Uint8Array, slug: string): string {
  const dir = mkdtempSync(join(tmpdir(), `ifrs-outline-${slug}-`));
  const pdfFile = join(dir, "src.pdf");
  const txtFile = join(dir, "src.txt");
  try {
    writeFileSync(pdfFile, pdfBytes);
    try {
      execFileSync("pdftotext", ["-layout", pdfFile, txtFile], { stdio: "pipe" });
    } catch (e) {
      throw new Error(
        `pdftotext is unavailable or failed for ${slug} — STOPPING (titles must come ` +
          `from the source PDF, never invented). Install poppler/pdftotext. ` +
          `Underlying: ${(e as Error).message}`,
      );
    }
    return readFileSync(txtFile, "utf-8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

interface SafetyResult {
  slug: string;
  paragraphsIn: number;
  paragraphsOut: number;
  charsIn: number;
  charsOut: number;
  multisetEqual: boolean;
  chapters: number;
}

/** Assert verbatim preservation + paragraph coverage; throw on any drift. */
function assertSafety(before: FlatDoc, after: ReturnType<typeof restructureIfrsDoc>, slug: string): SafetyResult {
  const inTexts: string[] = [];
  for (const ch of before.chapters) {
    for (const s of ch.sections) {
      inTexts.push(s.text);
      for (const ss of s.subsections ?? []) inTexts.push(ss.text);
    }
  }
  const outTexts: string[] = [];
  for (const ch of after.chapters) {
    for (const s of ch.sections) {
      for (const p of s.subsections) outTexts.push(p.text);
    }
  }
  const charsIn = inTexts.reduce((a, t) => a + t.length, 0);
  const charsOut = outTexts.reduce((a, t) => a + t.length, 0);
  const inSorted = [...inTexts].sort();
  const outSorted = [...outTexts].sort();
  const multisetEqual =
    inSorted.length === outSorted.length && inSorted.every((t, i) => t === outSorted[i]);

  if (inTexts.length !== outTexts.length) {
    throw new Error(
      `[${slug}] paragraph COUNT drift: in=${inTexts.length} out=${outTexts.length} — restructure dropped or duplicated a paragraph`,
    );
  }
  if (charsIn !== charsOut) {
    throw new Error(`[${slug}] total paragraph CHAR count changed: in=${charsIn} out=${charsOut} — text was altered`);
  }
  if (!multisetEqual) {
    throw new Error(`[${slug}] paragraph-text MULTISET changed — a paragraph's verbatim text was altered`);
  }
  return {
    slug,
    paragraphsIn: inTexts.length,
    paragraphsOut: outTexts.length,
    charsIn,
    charsOut,
    multisetEqual,
    chapters: after.chapters.length,
  };
}

export function buildIfrsOutlines(root = repoRoot()): SafetyResult[] {
  const results: SafetyResult[] = [];
  for (const slug of SLUGS) {
    const path = docPath(root, slug);
    if (!existsSync(path)) throw new Error(`[${slug}] structured file missing: ${path}`);
    const before = JSON.parse(readFileSync(path, "utf-8")) as FlatDoc;

    const pdfBytes = resolveGoldenPdf(slug, root);
    const pdfText = pdfToText(pdfBytes, slug);

    const after = restructureIfrsDoc(before, pdfText);
    const safety = assertSafety(before, after, slug);

    // Rewrite the file (slug, title, goldenSourceHash preserved by spread).
    writeFileSync(path, `${JSON.stringify(after, null, 2)}\n`, "utf-8");
    results.push(safety);
  }
  return results;
}

if (import.meta.main) {
  const results = buildIfrsOutlines();
  for (const r of results) {
    console.log(
      `✔ ${r.slug}: ${r.chapters} chapters, paragraphs ${r.paragraphsIn}→${r.paragraphsOut}, ` +
        `chars ${r.charsIn}==${r.charsOut}, verbatim-multiset ${r.multisetEqual ? "EQUAL" : "DRIFT"}`,
    );
  }
  console.log("IFRS outlines rebuilt (verbatim-preserving).");
}
