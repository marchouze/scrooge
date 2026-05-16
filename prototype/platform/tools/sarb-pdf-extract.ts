#!/usr/bin/env bun
/**
 * sarb-pdf-extract.ts — Atlas (Core banking platform architect, engineering)
 *
 * CLI tool: fetch a SARB Prudential Authority PDF URL (or local file path) and
 * extract its embedded text layer using pdfjs-dist.
 *
 * Usage:
 *   bun run platform/tools/sarb-pdf-extract.ts <url-or-path> [--output <file>]
 *   bun run platform/tools/sarb-pdf-extract.ts --help
 *
 * Strategy:
 *   Step A — pdfjs-dist text-layer extraction (handles digitally-signed PDFs
 *             with embedded text, which is the common SARB PA case).
 *   Step B — OCR via tesseract.js (substrate gap; see Owner Inbox brief).
 *   Step C — fallback error with exit code 1.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// Suppress the "Setting up fake worker" warning from pdfjs-dist in Node env
const pdfjsLib = pdfjs as unknown as {
  getDocument: (
    src: { data: Uint8Array } | { url: string }
  ) => { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
};

interface PDFDocumentProxy {
  numPages: number;
  getPage(n: number): Promise<PDFPageProxy>;
  destroy(): Promise<void>;
}

interface PDFPageProxy {
  getTextContent(): Promise<TextContent>;
}

interface TextContent {
  items: Array<{ str?: string }>;
}

function printUsage(): void {
  console.log(`sarb-pdf-extract — SARB PA PDF text extractor (Atlas, 2026-05-16)

Usage:
  bun run platform/tools/sarb-pdf-extract.ts <url-or-path> [--output <file>]
  bun run platform/tools/sarb-pdf-extract.ts --help

Arguments:
  <url-or-path>    HTTPS URL or local file path to the PDF
  --output <file>  Write extracted text to <file> instead of stdout
  --help           Print this help message

Examples:
  bun run platform/tools/sarb-pdf-extract.ts \\
    https://www.resbank.co.za/content/dam/sarb/.../directive.pdf

  bun run platform/tools/sarb-pdf-extract.ts ./local.pdf --output out.txt
`);
}

function log(msg: string): void {
  process.stderr.write(`[sarb-pdf-extract] ${msg}\n`);
}

async function fetchPdf(url: string): Promise<Uint8Array> {
  log("fetching PDF...");
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; SARB-PDF-Extract/1.0; Bank substrate tool)",
    },
  });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} — ${url}`
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
    // Warn but proceed — some servers return wrong content-type
    log(
      `WARNING: content-type is "${contentType}", expected application/pdf. Proceeding anyway.`
    );
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function readLocalPdf(filePath: string): Uint8Array {
  log(`reading local file: ${filePath}`);
  return new Uint8Array(readFileSync(filePath));
}

async function extractTextLayer(data: Uint8Array): Promise<string | null> {
  // Disable worker (not available in Bun/Node CLI context)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjsLib.getDocument({ data });
  let doc: PDFDocumentProxy;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`pdfjs-dist failed to load PDF: ${msg}`);
  }

  const numPages = doc.numPages;
  log(`PDF loaded — ${numPages} page(s)`);

  const pageTexts: string[] = [];
  let totalChars = 0;

  for (let i = 1; i <= numPages; i++) {
    log(`extracting text layer (page ${i}/${numPages})...`);
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item.str ?? "")
      .join(" ")
      .replace(/ {2,}/g, " ")
      .trim();
    pageTexts.push(`--- Page ${i} ---\n${pageText}`);
    totalChars += pageText.length;
  }

  await doc.destroy();

  if (totalChars === 0) {
    return null; // No text layer found — image-only PDF
  }

  return pageTexts.join("\n\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const inputArg = args[0];
  if (!inputArg) {
    console.error("[sarb-pdf-extract] ERROR: no input URL or path provided.");
    printUsage();
    process.exit(1);
  }

  // Parse --output flag
  let outputPath: string | undefined;
  const outputIdx = args.indexOf("--output");
  if (outputIdx !== -1) {
    outputPath = args[outputIdx + 1];
    if (!outputPath) {
      console.error("[sarb-pdf-extract] ERROR: --output requires a file path.");
      process.exit(1);
    }
  }

  // Load PDF bytes
  let pdfData: Uint8Array;
  const isUrl = inputArg.startsWith("https://") || inputArg.startsWith("http://");

  try {
    if (isUrl) {
      pdfData = await fetchPdf(inputArg);
    } else {
      const absPath = resolve(inputArg);
      pdfData = readLocalPdf(absPath);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[sarb-pdf-extract] ERROR: could not load PDF from ${inputArg}: ${msg}`
    );
    process.exit(1);
  }

  // Step A: text layer extraction
  let text: string | null = null;
  try {
    text = await extractTextLayer(pdfData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`text layer extraction failed: ${msg}`);
    // Fall through to Step C
  }

  if (text === null) {
    // Step B (not yet implemented — substrate gap)
    log(
      "no text layer found in PDF (image-only PDF). OCR path not yet implemented."
    );
    console.error(
      `[sarb-pdf-extract] ERROR: could not extract text from ${inputArg}. ` +
        `PDF appears to be image-only. OCR (tesseract.js) is a planned substrate gap — see Owner Inbox brief. ` +
        `PDF may also be encrypted or unsupported.`
    );
    process.exit(1);
  }

  // Output
  if (outputPath) {
    writeFileSync(outputPath, text, "utf-8");
    log(`text written to ${outputPath}`);
  } else {
    process.stdout.write(text + "\n");
  }

  log("done.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[sarb-pdf-extract] FATAL: ${msg}`);
  process.exit(1);
});
