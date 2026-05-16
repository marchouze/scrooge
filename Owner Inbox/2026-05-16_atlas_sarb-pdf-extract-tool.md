---
agent: Atlas
trigger: sarb-pdf-extract-substrate
asOf: 2026-05-16T00:00:00.000Z
decision-required: false
tags: [substrate, sarb, pdf-extract, ws-instrument-analyses]
---

# SARB PDF Text-Extraction Tool

**Delivered by:** Atlas (Core banking platform architect, engineering)
**Requested by:** WS-INSTRUMENT-ANALYSES — Mira (Compliance / RegTech engineer) has 54 `[citation: TBC]` markers in `Regulations/_obligations-register.md` that cannot be resolved because SARB Prudential Authority PDFs return binary content when fetched via HTTP.

---

## What was built

### `prototype/platform/tools/sarb-pdf-extract.ts`

A CLI tool that accepts a SARB PDF URL (or a local file path) and extracts the embedded text layer using `pdfjs-dist` (legacy Node-compatible build).

**Interface:**

```bash
bun run sarb:pdf-extract <url-or-path> [--output <file>]
bun run sarb:pdf-extract --help
```

**Example — resolve a SARB Directive citation:**

```bash
bun run sarb:pdf-extract \
  https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2022/D3-2022/D3-2022.pdf \
  --output /tmp/D3-2022.txt
```

Then search the output for the exact §-reference needed to replace a `[citation: TBC]` marker.

### `prototype/platform/tools/sarb-pdf-extract.test.ts`

Unit tests covering:
1. Successful text extraction from a minimal synthetic PDF buffer
2. Graceful error for invalid/non-PDF data
3. HTTP error response propagation (mocked fetch)
4. Non-PDF content-type detection

### `prototype/package.json` script addition

```json
"sarb:pdf-extract": "bun run platform/tools/sarb-pdf-extract.ts"
```

---

## How Mira should use this tool to resolve `[citation: TBC]` markers

1. Open `Regulations/_obligations-register.md` and find a `[citation: TBC]` row.
2. Identify the SARB PA document (Directive, Guidance Note, etc.) that is the source for that obligation.
3. Find the PDF URL from the SARB website (e.g. https://www.resbank.co.za/en/home/publications/prudential-authority).
4. Run:
   ```bash
   cd prototype/
   bun run sarb:pdf-extract <pdf-url> --output /tmp/sarb-extract.txt
   ```
5. Search the output for the relevant §-number or section heading.
6. Replace `[citation: TBC]` with the precise citation (e.g. `§ 4(1)(b) of Directive D3/2022`).

---

## Implementation strategy

**Step A (implemented):** `pdfjs-dist` text-layer extraction. Most SARB PA PDFs are digitally signed but contain an embedded text layer. The tool iterates all pages, calls `page.getTextContent()`, and joins the text items. Progress is emitted to stderr.

**Step B (substrate gap — not yet implemented):** OCR via `tesseract.js` for image-only PDFs. Required only for scanned documents with no embedded text. Planned as a follow-on substrate item.

**Step C (implemented):** Fallback error with exit code 1 if Step A finds no text and Step B is not available.

---

## Known limitations

1. **Image-only PDFs:** If a SARB PDF is a scanned image without an embedded text layer, Step A returns no text and Step B (OCR) is not yet implemented. The tool exits with code 1 and a clear error message. Workaround: open the PDF in a browser and manually copy the text.

2. **Encrypted PDFs:** Password-protected PDFs will cause `pdfjs-dist` to throw. The tool catches the error and exits with code 1 with an explanatory message.

3. **DOMMatrix / browser globals:** The `pdfjs-dist` main build requires browser globals. The tool uses the `legacy/build/pdf.mjs` variant, which is compatible with Bun and Node without a DOM polyfill.

4. **Rendering for OCR:** The canvas-based page-rendering path (Step B) requires the `canvas` npm package, which has native bindings. Installation is straightforward (`bun add canvas tesseract.js`) but not included in this delivery to keep the substrate simple and avoid native dependency breakage in CI. Step B is the primary substrate gap.

---

## Substrate gaps remaining

| ID | Gap | Owner |
|----|-----|-------|
| GAP-SARB-PDF-OCR | Step B OCR path (tesseract.js + canvas) for image-only SARB PDFs | Atlas |
| GAP-SARB-PDF-CACHE | Local caching of fetched PDFs to avoid repeated downloads | Atlas |
| GAP-SARB-PDF-CITATION-LINKER | Automated `[citation: TBC]` → URN resolution pipeline using extracted text | Mira |
