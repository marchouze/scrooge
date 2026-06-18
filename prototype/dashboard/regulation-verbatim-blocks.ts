// dashboard/regulation-verbatim-blocks.ts
//
// Server-side, TESTABLE parser that splits a regulation section's verbatim text
// into renderable blocks. After the RRB backfill, many sections are a single
// large `text` blob with markdown PIPE-TABLES embedded (e.g. "Regulation 23" is
// ~813KB / ~2,289 pipe cells). The reader previously rendered the blob raw with
// `white-space:pre-wrap`, so the tables showed as escaped `| ... |` pipes and
// the document had no structure.
//
// This module turns the blob into a discriminated union of blocks so the reader
// can render markdown tables as real <table>s (cells escaped at render time —
// XSS-safe, NEVER interpreted as further markdown) while keeping all other text
// verbatim. Parsing here (not in the client) means it is unit-tested.
//
// Fidelity rule (the text is law): no content is dropped or reordered. A region
// that is NOT a clean, contiguous markdown table stays as paragraph text exactly
// as written (including legal inline numbering like `(1)(a)`, which must NOT be
// mangled into list items).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

/** A contiguous markdown pipe-table: a header row, an alignment/separator row,
 *  then zero+ body rows. Cell contents are kept literal (never re-parsed). */
export interface VerbatimTableBlock {
  kind: "table";
  headers: string[];
  rows: string[][];
}

/** A run of non-table lines. Internal single newlines are preserved as `\n`
 *  (the client renders them as <br>); blank lines split paragraphs. */
export interface VerbatimParagraphBlock {
  kind: "paragraph";
  text: string;
}

export type VerbatimBlock = VerbatimTableBlock | VerbatimParagraphBlock;

/** Split a markdown table row into trimmed cells, dropping the optional
 *  leading/trailing pipes. `| a | b |` and `a | b` both → ["a","b"]. */
function splitRowCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

/** True when `line` is a markdown table alignment/separator row, e.g.
 *  `| --- | :--- | ---: | :---: |`. Each cell must be dashes with optional
 *  leading/trailing colons (alignment markers) and nothing else. */
function isSeparatorRow(line: string): boolean {
  const cells = splitRowCells(line);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{1,}:?$/.test(c));
}

/** A line that participates in table syntax — it contains at least one pipe.
 *  (A separator row is also pipe-bearing.) */
function looksLikeTableRow(line: string): boolean {
  return line.includes("|");
}

/**
 * Parse a section's verbatim text into ordered render blocks.
 *
 * Table detection (conservative — a false negative leaves a faithful paragraph,
 * a false positive would corrupt legal text, so we only accept a well-formed
 * table): a header row that contains a pipe, immediately followed by a
 * separator row (`| --- | --- |`) whose column count matches the header, then
 * zero+ body rows that contain a pipe. Body rows with a different column count
 * are padded/truncated to the header width (flagged in code comments) rather
 * than dropped — no row is lost.
 *
 * Everything else is grouped into paragraphs split on blank lines. A header-only
 * candidate with no following separator is NOT a table — it stays paragraph
 * text (so a single prose line containing a stray `|` is never misdetected).
 */
export function parseVerbatimBlocks(text: string): VerbatimBlock[] {
  if (!text || !text.trim()) return [];

  // Normalize CRLF so newline handling is uniform; preserve everything else.
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  const blocks: VerbatimBlock[] = [];
  let paragraphLines: string[] = [];

  const flushParagraphs = () => {
    if (paragraphLines.length === 0) return;
    // Group the buffered non-table lines into paragraphs on blank-line
    // boundaries, preserving internal single newlines and verbatim wording.
    let current: string[] = [];
    const emit = () => {
      if (current.length === 0) return;
      const para = current.join("\n").trim();
      if (para) blocks.push({ kind: "paragraph", text: para });
      current = [];
    };
    for (const ln of paragraphLines) {
      if (ln.trim() === "") emit();
      else current.push(ln);
    }
    emit();
    paragraphLines = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    // A table candidate needs: this line has a pipe AND is not itself a
    // separator, AND the NEXT line is a matching separator row.
    const next = lines[i + 1] ?? "";
    if (
      looksLikeTableRow(line) &&
      !isSeparatorRow(line) &&
      line.trim() !== "" &&
      isSeparatorRow(next)
    ) {
      const headers = splitRowCells(line);
      const sepCells = splitRowCells(next);
      // Separator column count must match the header for a well-formed table.
      if (sepCells.length === headers.length) {
        flushParagraphs();
        const rows: string[][] = [];
        let j = i + 2;
        // Body rows: contiguous pipe-bearing, non-blank, non-separator lines.
        while (
          j < lines.length &&
          looksLikeTableRow(lines[j] ?? "") &&
          (lines[j] ?? "").trim() !== "" &&
          !isSeparatorRow(lines[j] ?? "")
        ) {
          const cells = splitRowCells(lines[j] ?? "");
          // Reconcile ragged rows to header width WITHOUT dropping content:
          // pad short rows with empty cells; a longer row keeps its extra
          // cells joined into the last column so no text is lost.
          if (cells.length < headers.length) {
            while (cells.length < headers.length) cells.push("");
          } else if (cells.length > headers.length) {
            const head = cells.slice(0, headers.length - 1);
            const tail = cells.slice(headers.length - 1).join(" | ");
            rows.push([...head, tail]);
            j += 1;
            continue;
          }
          rows.push(cells);
          j += 1;
        }
        blocks.push({ kind: "table", headers, rows });
        i = j;
        continue;
      }
    }

    paragraphLines.push(line);
    i += 1;
  }

  flushParagraphs();
  return blocks;
}
