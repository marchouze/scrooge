// scripts/regulatory/ifrs-contents-parser.ts
//
// Deterministic parser for the CONTENTS page of an IFRS golden-source PDF
// (rendered by `pdftotext -layout`), producing a TITLE MAP and an ordered list
// of contents entries used to give the structured doc a real chapter/section
// outline.
//
// Two contents shapes occur across the three filed IFRS standards:
//
//   (A) DOTTED hierarchy (IFRS 9). Each contents line is
//         "<number> <Title>            <first-paragraph-ref>"
//       where <number> is `1`, `3`, `3.1`, `6.10` (chapter = single component,
//       UPPERCASE title; section = two components, title-case). Paragraphs in
//       the body are numbered `3.1.1`, `3.2.2`, so chapter/section grouping is
//       derived from the paragraph's OWN number components — the contents map
//       only supplies the descriptive TITLE for `"3"` and `"3.1"`.
//
//   (B) FLAT hierarchy (IFRS 7, IFRS 13). Contents lines are
//         "<TITLE>                      <first-paragraph-ref>"
//       with NO leading number. Body paragraphs are flat (`1`, `8`, `42A`).
//       UPPERCASE title = top-level heading (chapter); title-case = sub-heading
//       (section). Each heading owns the paragraph RANGE from its first-ref up
//       to the next heading's first-ref. Appendices A–D follow.
//
// In BOTH shapes the title may WRAP across lines: the continuation line(s)
// carry the rest of the title, and the right-aligned paragraph-ref appears at
// the end of the LAST continuation line. The parser accumulates wrapped title
// lines until it sees the trailing ref.
//
// Titles are taken VERBATIM from the source (only the leading number, in shape
// A, and surrounding whitespace are stripped); chapter titles rendered all-caps
// in the source are normalised to sentence-case for display, faithfully (the
// upper-casing is a typesetting choice, not part of the title text).
//
// Source, don't hardcode: every title returned here comes from the parsed PDF
// text. Nothing is invented. Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

/** A single parsed contents entry. */
export interface ContentsEntry {
  /** Hierarchy depth: 1 = chapter / top-level heading, 2 = section / sub-heading. */
  level: 1 | 2;
  /** For shape A: the dotted number ("3", "3.1"). For shape B: "" (no number). */
  number: string;
  /** The descriptive title, verbatim from source (leading number stripped). */
  title: string;
  /** The first-paragraph ref on the RHS ("3.1.1", "8", "42A"). */
  firstParagraph: string;
  /** True when the source rendered the title in all-caps (a top-level heading). */
  wasUpperCase: boolean;
}

/** Result of parsing an IFRS contents page. */
export interface ParsedContents {
  /** Ordered contents entries, in source order. */
  entries: ContentsEntry[];
  /** Appendix entries: { letter, title } e.g. { letter:"A", title:"Defined terms" }. */
  appendices: Array<{ letter: string; title: string }>;
  /** Shape of this contents page. */
  shape: "dotted" | "flat";
}

// A paragraph-ref token on the RHS of a contents line: `1`, `3.1.1`, `42A`,
// `42H`. (Digits, optional dotted components, optional single trailing letter.)
const PARA_REF = /^\d+(?:\.\d+)*[A-Z]?$/;

// A leading dotted number that opens a shape-A contents line: `1`, `3.1`, `6.10`.
const LEADING_NUMBER = /^(\d+(?:\.\d+)*)\s+(.*)$/;

/** Is `s` a single-component number ("3") vs a dotted one ("3.1")? */
function isChapterNumber(num: string): boolean {
  return !num.includes(".");
}

/** Normalise an all-caps source heading to sentence case, preserving the rest. */
export function normaliseHeadingCase(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  // Only re-case when the source token is ENTIRELY upper-case letters (a
  // typeset heading). Mixed-case titles are left exactly as the source gives
  // them ("Initial recognition", "Statement of financial position").
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return trimmed;
  // Sentence-case: first letter upper, rest lower — but keep an embedded
  // standard reference like "IFRS 9" upper. Faithful, deterministic.
  const lower = trimmed.toLowerCase();
  const sentence = lower.charAt(0).toUpperCase() + lower.slice(1);
  // Re-upper any standalone "ifrs N" / "ias N" tokens.
  return sentence.replace(/\b(ifrs|ias|ifric|sic)\b/gi, (m) => m.toUpperCase());
}

/** Does a line look like an all-caps heading (no leading number, no ref)? */
function looksUpperCaseHeading(line: string): boolean {
  const letters = line.replace(/[^A-Za-z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

/**
 * Slice the body of a contents page: from the line after `CONTENTS` up to (but
 * not including) the `APPENDICES` / `APPROVAL` terminator. The contents may run
 * across a "continued..." page break, so we join the raw text first and re-split.
 */
function contentsBodyLines(pdfText: string): { body: string[]; appendixBlock: string[] } {
  const lines = pdfText.split("\n");
  // Find the FIRST standalone "CONTENTS" line.
  const start = lines.findIndex((l) => l.trim() === "CONTENTS");
  if (start < 0) return { body: [], appendixBlock: [] };

  // Collect lines until APPENDICES / APPROVAL (the contents proper ends there);
  // drop page-furniture lines (© IFRS Foundation, running standard header,
  // "from paragraph", "continued...", "...continued", bare page numbers).
  const isFurniture = (l: string): boolean => {
    const t = l.trim();
    if (!t) return true;
    if (/^©\s*IFRS Foundation/i.test(t)) return true;
    if (/^IFRS\s+\d+$/i.test(t)) return true;
    if (/^A\d+\b/.test(t) && /IFRS Foundation/i.test(t)) return true;
    if (/^(\.\.\.)?continued(\.\.\.)?$/i.test(t)) return true;
    if (/^from paragraph$/i.test(t)) return true;
    if (/^[A-Z]\d{2,}$/.test(t)) return true; // bare page id like "A377"
    // Standard-title preamble lines that sit between CONTENTS and the first
    // real entry: "INTERNATIONAL FINANCIAL REPORTING STANDARD 7" (its trailing
    // digit is the STANDARD number, not a paragraph ref) and the standard's
    // subtitle ("FINANCIAL INSTRUMENTS: DISCLOSURES", "FAIR VALUE MEASUREMENT",
    // "FINANCIAL INSTRUMENTS"). Also the "CHAPTERS" sub-header in IFRS 9. These
    // are not contents entries and must not be parsed as titles.
    if (/^INTERNATIONAL FINANCIAL REPORTING STANDARD\b/i.test(t)) return true;
    if (/^CHAPTERS?$/i.test(t)) return true;
    if (/^FINANCIAL INSTRUMENTS\b/i.test(t)) return true;
    if (/^FAIR VALUE MEASUREMENT$/i.test(t)) return true;
    return false;
  };

  const body: string[] = [];
  const appendixBlock: string[] = [];
  let inAppendix = false;
  let stopped = false;
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const t = raw.trim();
    if (/^APPENDICES?$/i.test(t)) {
      inAppendix = true;
      continue;
    }
    if (/^APPROVAL BY THE BOARD/i.test(t) || /^FOR THE (ACCOMPANYING|BASIS)/i.test(t)) {
      stopped = true;
      break;
    }
    if (isFurniture(raw)) continue;
    if (inAppendix) appendixBlock.push(t);
    else body.push(t);
  }
  void stopped;
  return { body, appendixBlock };
}

/** Parse the appendix block ("A Defined terms" / "B Application guidance" / …). */
function parseAppendices(lines: string[]): Array<{ letter: string; title: string }> {
  const out: Array<{ letter: string; title: string }> = [];
  for (const l of lines) {
    const m = l.match(/^([A-D])\s+(.+)$/);
    if (m?.[1] && m[2]) out.push({ letter: m[1], title: m[2].trim() });
  }
  return out;
}

/**
 * Strip the trailing paragraph-ref token from a line. Returns the ref and the
 * remaining left text, or null when the line carries no trailing ref (a wrapped
 * title line whose ref is on a later line).
 */
function splitTrailingRef(line: string): { left: string; ref: string } | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 2) return null;
  const last = tokens[tokens.length - 1] ?? "";
  if (!PARA_REF.test(last)) return null;
  return { left: tokens.slice(0, -1).join(" "), ref: last };
}

/**
 * Parse an IFRS CONTENTS page (already `pdftotext -layout` rendered).
 *
 * Deterministic: same input → same output. Wrapped titles are joined; trailing
 * refs detected positionally; chapter vs section from number-depth (dotted) or
 * letter-case (flat).
 */
export function parseIfrsContents(pdfText: string): ParsedContents {
  const { body, appendixBlock } = contentsBodyLines(pdfText);
  const appendices = parseAppendices(appendixBlock);

  // Decide shape: dotted iff any body line opens with a dotted number AND a ref.
  const shape: "dotted" | "flat" = body.some((l) => {
    const m = l.match(LEADING_NUMBER);
    return Boolean(m?.[1]?.includes("."));
  })
    ? "dotted"
    : "flat";

  const entries: ContentsEntry[] = [];
  // Accumulator for a wrapped title spanning multiple lines.
  let pending: { number: string; titleParts: string[]; wasUpperCase: boolean } | null = null;

  const flush = (ref: string, lastLeft: string): void => {
    if (!pending) {
      // A title that began AND ended on the ref line with no leading marker
      // (shape B single-line heading). lastLeft is the whole title.
      const wasUpper = looksUpperCaseHeading(lastLeft);
      entries.push({
        level: wasUpper ? 1 : 2,
        number: "",
        title: normaliseHeadingCase(lastLeft),
        firstParagraph: ref,
        wasUpperCase: wasUpper,
      });
      return;
    }
    const parts = [...pending.titleParts];
    if (lastLeft) parts.push(lastLeft);
    const titleRaw = parts.join(" ").trim();
    if (shape === "dotted") {
      const level: 1 | 2 = isChapterNumber(pending.number) ? 1 : 2;
      entries.push({
        level,
        number: pending.number,
        title: normaliseHeadingCase(titleRaw),
        firstParagraph: ref,
        wasUpperCase: pending.wasUpperCase,
      });
    } else {
      const level: 1 | 2 = pending.wasUpperCase ? 1 : 2;
      entries.push({
        level,
        number: "",
        title: normaliseHeadingCase(titleRaw),
        firstParagraph: ref,
        wasUpperCase: pending.wasUpperCase,
      });
    }
    pending = null;
  };

  for (const line of body) {
    const split = splitTrailingRef(line);

    if (shape === "dotted") {
      const lead = line.match(LEADING_NUMBER);
      if (lead?.[1]) {
        // Opens a new numbered entry.
        const number = lead[1];
        const rest = lead[2] ?? "";
        if (pending) {
          // A previous entry was waiting for its ref but a new number started:
          // the previous title had no detectable ref — skip safely (shouldn't
          // happen on well-formed IFRS contents; we never invent a ref).
          pending = null;
        }
        if (split?.left.match(LEADING_NUMBER)) {
          // Single line: "<num> <title> <ref>" — strip number from left text.
          const leftNoNum = (split.left.match(LEADING_NUMBER)?.[2] ?? "").trim();
          pending = {
            number,
            titleParts: [],
            wasUpperCase: looksUpperCaseHeading(leftNoNum),
          };
          flush(split.ref, leftNoNum);
        } else {
          // Wrapped: title starts here, ref on a later line.
          pending = {
            number,
            titleParts: [rest.trim()],
            wasUpperCase: looksUpperCaseHeading(rest),
          };
        }
      } else if (pending) {
        // Continuation of a wrapped title.
        if (split) flush(split.ref, split.left);
        else pending.titleParts.push(line.trim());
      }
      // else: a stray line with no number and no pending — ignore.
    } else {
      // FLAT shape.
      if (split) {
        if (pending) flush(split.ref, split.left);
        else flush(split.ref, split.left);
      } else {
        // Wrapped title line (no ref yet).
        if (pending) pending.titleParts.push(line.trim());
        else
          pending = {
            number: "",
            titleParts: [line.trim()],
            wasUpperCase: looksUpperCaseHeading(line),
          };
      }
    }
  }

  return { entries, appendices, shape };
}

/**
 * Build a TITLE MAP for the DOTTED shape: number → title, e.g.
 *   { "3": "Recognition and derecognition", "3.1": "Initial recognition" }
 */
export function dottedTitleMap(parsed: ParsedContents): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of parsed.entries) {
    if (e.number) map.set(e.number, e.title);
  }
  return map;
}
