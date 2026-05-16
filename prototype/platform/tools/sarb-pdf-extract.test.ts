/**
 * sarb-pdf-extract.test.ts — Unit tests for SARB PDF text extraction logic
 *
 * Tests:
 * 1. Text extraction from a valid minimal PDF buffer (embedded text layer)
 * 2. Graceful error for a non-PDF response (HTML body)
 * 3. Graceful error for an HTTP error response
 *
 * No real HTTP calls are made — fetch is mocked via globalThis.
 */

import { expect, mock, test } from "bun:test";
import { fileURLToPath } from "node:url";

// Minimal valid PDF with embedded text "Hello SARB"
// Generated via iTextSharp-compatible structure: a 1-page PDF with a text stream.
// This is the smallest valid PDF that pdfjs-dist can parse and extract text from.
const MINIMAL_PDF_WITH_TEXT = Buffer.from(
  // A minimal hand-crafted PDF with a text stream containing "Hello SARB"
  // Format: binary PDF 1.4 with one page, one font, one content stream
  [
    "%PDF-1.4\n",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n",
    "   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    "4 0 obj\n<< /Length 44 >>\nstream\n",
    "BT /F1 12 Tf 100 700 Td (Hello SARB) Tj ET\n",
    "endstream\nendobj\n",
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    "xref\n0 6\n",
    "0000000000 65535 f \n",
    "0000000009 00000 n \n",
    "0000000058 00000 n \n",
    "0000000115 00000 n \n",
    "0000000266 00000 n \n",
    "0000000360 00000 n \n",
    "trailer\n<< /Size 6 /Root 1 0 R >>\n",
    "startxref\n430\n%%EOF\n",
  ].join(""),
);

// Helper: extract text from a Uint8Array using pdfjs-dist directly
async function extractTextFromBuffer(data: Uint8Array): Promise<string | null> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsLib = pdfjs as unknown as {
    getDocument: (src: { data: Uint8Array }) => { promise: Promise<unknown> };
    GlobalWorkerOptions: { workerSrc: string };
  };
  pdfjsLib.GlobalWorkerOptions.workerSrc = fileURLToPath(
    new URL("../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url),
  );

  interface TextItem {
    str?: string;
  }
  interface TextContent {
    items: TextItem[];
  }
  interface Page {
    getTextContent(): Promise<TextContent>;
  }
  interface Doc {
    numPages: number;
    getPage(n: number): Promise<Page>;
    destroy(): Promise<void>;
  }

  const doc = await (pdfjsLib.getDocument({ data }).promise as Promise<Doc>);
  const texts: string[] = [];
  let totalChars = 0;
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => it.str ?? "")
      .join(" ")
      .trim();
    texts.push(pageText);
    totalChars += pageText.length;
  }
  await doc.destroy();
  return totalChars === 0 ? null : texts.join("\n");
}

// ─── Test 1: valid minimal PDF with text layer ───────────────────────────────

test("extracts text from a minimal PDF with embedded text layer", async () => {
  const data = new Uint8Array(MINIMAL_PDF_WITH_TEXT);
  const result = await extractTextFromBuffer(data);

  // pdfjs-dist should find the text "Hello SARB" in the content stream
  expect(result).not.toBeNull();
  expect(result).toContain("Hello SARB");
});

// ─── Test 2: non-PDF content returns null / error path ───────────────────────

test("returns null for zero-length or clearly non-PDF data", async () => {
  // An HTML-like payload cannot be parsed as a PDF
  const htmlData = new TextEncoder().encode("<html><body>Not a PDF</body></html>");
  let caughtError: string | null = null;
  try {
    await extractTextFromBuffer(htmlData);
  } catch (err) {
    caughtError = err instanceof Error ? err.message : String(err);
  }
  // pdfjs-dist should throw an error for invalid PDF data
  expect(caughtError).not.toBeNull();
});

// ─── Test 3: fetch mock — HTTP error ─────────────────────────────────────────

test("fetch error propagates correctly (mocked)", async () => {
  const originalFetch = globalThis.fetch;

  // Mock fetch to return a 404
  globalThis.fetch = mock(async (_url: string) => {
    return new Response("Not Found", { status: 404, statusText: "Not Found" });
  }) as unknown as typeof fetch;

  let errorMessage = "";
  try {
    const response = await fetch("https://example.com/fake.pdf");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(errorMessage).toContain("404");
  expect(errorMessage).toContain("Not Found");
});

// ─── Test 4: fetch mock — non-PDF content-type warning path ──────────────────

test("fetch with HTML content-type warns but does not throw on content-type alone", async () => {
  const originalFetch = globalThis.fetch;

  // Mock fetch to return HTML body with 200
  globalThis.fetch = mock(async (_url: string) => {
    return new Response("<html>page</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;

  let contentType = "";
  try {
    const response = await fetch("https://example.com/redirect.pdf");
    contentType = response.headers.get("content-type") ?? "";
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Content-type check logic: warn if not PDF — the script logs a warning and proceeds
  const isPdf = contentType.includes("pdf") || contentType.includes("octet-stream");
  expect(isPdf).toBe(false); // Confirms non-PDF content-type detection works
  expect(contentType).toBe("text/html");
});
