// scripts/regulatory/ifrs-outline-restructure.ts
//
// Deterministic restructure: turn a FLAT IFRS structured doc (one chapter
// holding a flat, partly-misordered list of single-paragraph "sections") into a
// NESTED chapter → section → paragraph tree the reader renders as a real
// Contents outline — WITHOUT altering one byte of any paragraph's verbatim text.
//
// The chapter/section TITLES come from the parsed golden-source CONTENTS page
// (see ifrs-contents-parser.ts). Paragraph text and number are preserved
// byte-for-byte; only the GROUPING and ORDER change.
//
// Two shapes (mirroring the parser):
//
//   DOTTED (IFRS 9): a main paragraph "3.2.2" → chapter "3" / section "3.2" /
//   paragraph "3.2.2", derived from its OWN number components. The title map
//   supplies the chapter ("3" → "Recognition and derecognition") and section
//   ("3.1" → "Initial recognition") headings. Two-component paragraphs ("2.8")
//   sit directly under the chapter as sections (no sub-section level). Bare
//   single-integer paragraphs ("1".."6") are FOOTNOTES (real content lives at
//   depth ≥ 2 in this shape) → routed to a "Footnotes" chapter, ordered by page.
//
//   FLAT (IFRS 7 / 13): paragraphs are flat ("8", "42A"). Each contents heading
//   owns the paragraph RANGE from its first-paragraph ref up to the next
//   heading's first ref. UPPERCASE heading → chapter; title-case → section under
//   the current chapter.
//
// In BOTH: appendix paragraphs (A### page-spillover chunks, B/C/D appendix
// paragraphs) are routed to dedicated appendix chapters and ordered correctly,
// fixing the current interleaving. Nothing is dropped; every leaf paragraph
// appears exactly once.
//
// Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { type ParsedContents, dottedTitleMap, parseIfrsContents } from "./ifrs-contents-parser";

// ---------------------------------------------------------------------------
// Input / output shapes (intentionally loose pass-through of unknown fields)
// ---------------------------------------------------------------------------

export interface FlatParagraph {
  id?: string;
  number: string;
  heading?: string;
  text: string;
  verbatim?: boolean;
  pages?: string;
  [k: string]: unknown;
}

export interface FlatSection extends FlatParagraph {
  subsections?: FlatParagraph[];
}

export interface OutlineSection {
  id?: string;
  number: string;
  heading: string;
  /** Sections that are pure grouping nodes carry no own text. */
  text?: string;
  verbatim?: boolean;
  pages?: string;
  subsections: FlatParagraph[];
  [k: string]: unknown;
}

export interface OutlineChapter {
  id?: string;
  number: string;
  heading: string;
  sections: OutlineSection[];
}

export interface FlatDoc {
  slug: string;
  title?: string;
  goldenSourceHash?: string;
  chapters: Array<{ id?: string; heading?: string; sections: FlatSection[] }>;
  [k: string]: unknown;
}

export interface OutlineDoc {
  slug: string;
  title?: string;
  goldenSourceHash?: string;
  chapters: OutlineChapter[];
  [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// Numeric-aware comparator: "2.3" < "2.3A" < "2.4"; "A376" < "A378";
// "3.1.2" < "3.2.1"; "B2.1" < "B3.1.1". Split on "." then compare each
// component: pure-digit components numerically, letter-suffixed components by
// (digits, then letters), pure-alpha lexically.
// ---------------------------------------------------------------------------

interface Comp {
  num: number | null;
  alpha: string;
}

function parseComponent(c: string): Comp {
  const m = c.match(/^(\d+)([A-Za-z]*)$/);
  if (m) return { num: Number(m[1]), alpha: (m[2] ?? "").toLowerCase() };
  // Leading-letter component (e.g. "A376", "B2") — split letters then digits.
  const m2 = c.match(/^([A-Za-z]+)(\d*)([A-Za-z]*)$/);
  if (m2) {
    return {
      num: m2[2] ? Number(m2[2]) : null,
      alpha: ((m2[1] ?? "") + (m2[3] ?? "")).toLowerCase(),
    };
  }
  return { num: null, alpha: c.toLowerCase() };
}

export function compareProvisionNumbers(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const ca = pa[i];
    const cb = pb[i];
    if (ca === undefined) return -1; // shorter sorts first ("3.1" < "3.1.1")
    if (cb === undefined) return 1;
    const xa = parseComponent(ca);
    const xb = parseComponent(cb);
    // Leading-letter (appendix) components: compare alpha-prefix first.
    const aprefA = xa.alpha.replace(/[0-9]/g, "");
    const aprefB = xb.alpha.replace(/[0-9]/g, "");
    // Compare the pure-alpha PREFIX (e.g. the "a"/"b" of "A376"/"B2") when both
    // components are letter-led; otherwise numeric components sort before alpha.
    const aIsAlphaLed = /^[A-Za-z]/.test(ca);
    const bIsAlphaLed = /^[A-Za-z]/.test(cb);
    if (aIsAlphaLed !== bIsAlphaLed) return aIsAlphaLed ? 1 : -1;
    if (aIsAlphaLed && bIsAlphaLed && aprefA !== aprefB) {
      return aprefA < aprefB ? -1 : 1;
    }
    if (xa.num !== null && xb.num !== null && xa.num !== xb.num) {
      return xa.num - xb.num;
    }
    if (xa.num === null && xb.num !== null) return 1;
    if (xa.num !== null && xb.num === null) return -1;
    if (xa.alpha !== xb.alpha) return xa.alpha < xb.alpha ? -1 : 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Paragraph classification
// ---------------------------------------------------------------------------

export type ParaClass =
  | { kind: "main"; chapter: string; section: string | null }
  | { kind: "footnote" }
  | { kind: "appendix-page" } // A### page-spillover chunk
  | { kind: "appendix"; letter: string };

/** Number patterns. */
const MAIN_DOTTED = /^\d+\.\d/; // at least two components: "3.1", "3.2.2"
const BARE_INT = /^\d+[A-Za-z]?$/; // "1", "42A"
const APPENDIX_PAGE = /^A\d+$/; // "A376" page-spillover chunk
const APPENDIX_PARA = /^([A-D])\d/; // "B2.1", "C1", "D4"

/**
 * Classify a paragraph number for the DOTTED shape (IFRS 9). Bare integers are
 * footnotes (real content is always ≥2 components here).
 */
export function classifyDotted(number: string): ParaClass {
  if (APPENDIX_PAGE.test(number)) return { kind: "appendix-page" };
  const appx = number.match(APPENDIX_PARA);
  if (appx?.[1]) return { kind: "appendix", letter: appx[1] };
  if (MAIN_DOTTED.test(number)) {
    const comps = number.split(".");
    const chapter = comps[0] ?? "";
    // section = first two components when ≥3 deep ("3.2.2" → "3.2"); a
    // two-component paragraph ("2.8") is itself a section under the chapter.
    const section = comps.length >= 3 ? `${comps[0]}.${comps[1]}` : null;
    return { kind: "main", chapter, section };
  }
  if (BARE_INT.test(number)) return { kind: "footnote" };
  return { kind: "footnote" };
}

/**
 * Classify a paragraph number for the FLAT shape (IFRS 7 / 13). Main paragraphs
 * are bare integers (with optional letter suffix). Chapter/section assignment is
 * by RANGE and handled by the caller; this only separates main vs appendix.
 */
export function classifyFlat(number: string): "main" | "appendix-page" | { appendix: string } {
  if (APPENDIX_PAGE.test(number)) return "appendix-page";
  const appx = number.match(APPENDIX_PARA);
  if (appx?.[1]) return { appendix: appx[1] };
  return "main";
}

// ---------------------------------------------------------------------------
// Restructure
// ---------------------------------------------------------------------------

function appendixHeading(letter: string, parsed: ParsedContents): string {
  const found = parsed.appendices.find((a) => a.letter === letter);
  return found ? `Appendix ${letter} — ${found.title}` : `Appendix ${letter}`;
}

/** A grouping bucket while building the tree (ordered sections). */
interface SectionBucket {
  /** Outline label number ("3.1" dotted; "" flat → heading-only label). */
  number: string;
  heading: string;
  paras: FlatParagraph[];
}
interface ChapterBucket {
  number: string;
  heading: string;
  sortKey: string;
  /** Ordered sections, keyed for grouping while preserving first-seen order. */
  sectionOrder: string[];
  sections: Map<string, SectionBucket>;
}

/** Strip a flat "section" node to a bare paragraph (pass through extras). */
function toParagraph(s: FlatSection): FlatParagraph {
  const { subsections: _drop, ...rest } = s;
  void _drop;
  return rest as FlatParagraph;
}

// Sort keys for the trailing non-main chapters (footnotes, page chunks,
// appendices) — they sort AFTER all main chapters ("~" > digits).
const FOOTNOTE_SORTKEY = "~1";
const PAGES_SORTKEY = "~2";
const appendixSortKey = (letter: string): string => `~3${letter}`;
const FOOTNOTE_HEADING = "Footnotes";
const PAGES_HEADING = "Source pages — front matter, defined terms & continuation text";

/**
 * Restructure a flat IFRS doc into the nested outline using the parsed contents
 * page. Pure: returns a new doc; never mutates the input. Every leaf paragraph
 * appears exactly once with byte-identical text; only grouping + order change.
 */
export function restructureIfrsDoc(doc: FlatDoc, contentsPdfText: string): OutlineDoc {
  const parsed = parseIfrsContents(contentsPdfText);

  // Gather every leaf paragraph (flat list + any defensive nested subsections).
  const leaves: FlatParagraph[] = [];
  for (const ch of doc.chapters) {
    for (const s of ch.sections) {
      leaves.push(toParagraph(s));
      for (const ss of s.subsections ?? []) leaves.push(ss);
    }
  }

  const chapters = new Map<string, ChapterBucket>();
  const chapterOrder: string[] = [];
  const ensureChapter = (number: string, heading: string, sortKey: string): ChapterBucket => {
    let b = chapters.get(number);
    if (!b) {
      b = { number, heading, sortKey, sectionOrder: [], sections: new Map() };
      chapters.set(number, b);
      chapterOrder.push(number);
    } else if (!b.heading && heading) {
      b.heading = heading; // backfill a title learned later
    }
    return b;
  };
  const addToSection = (
    ch: ChapterBucket,
    sectionKey: string,
    number: string,
    heading: string,
    p: FlatParagraph,
  ): void => {
    let sec = ch.sections.get(sectionKey);
    if (!sec) {
      sec = { number, heading, paras: [] };
      ch.sections.set(sectionKey, sec);
      ch.sectionOrder.push(sectionKey);
    }
    sec.paras.push(p);
  };

  if (parsed.shape === "dotted") {
    const titles = dottedTitleMap(parsed);
    for (const p of leaves) {
      const cls = classifyDotted(p.number);
      if (cls.kind === "main") {
        const ch = ensureChapter(
          cls.chapter,
          titles.get(cls.chapter) ?? "",
          cls.chapter.padStart(3, "0"),
        );
        if (cls.section) {
          addToSection(ch, cls.section, cls.section, titles.get(cls.section) ?? "", p);
        } else {
          // Two-component paragraph ("2.8") — its own section labelled by number.
          addToSection(ch, `direct:${p.number}`, p.number, "", p);
        }
      } else if (cls.kind === "footnote") {
        const ch = ensureChapter("FN", FOOTNOTE_HEADING, FOOTNOTE_SORTKEY);
        addToSection(ch, `direct:${p.number}`, p.number, "", p);
      } else if (cls.kind === "appendix-page") {
        const ch = ensureChapter("PAGES", PAGES_HEADING, PAGES_SORTKEY);
        addToSection(ch, `direct:${p.number}`, p.number, "", p);
      } else {
        const ch = ensureChapter(
          `Appendix ${cls.letter}`,
          appendixHeading(cls.letter, parsed),
          appendixSortKey(cls.letter),
        );
        // Appendix B paras may be dotted ("B3.1.1") — group by their 2-comp
        // prefix into sections; flat appendix paras ("C1") sit as own sections.
        const comps = p.number.split(".");
        if (comps.length >= 3)
          addToSection(ch, `${comps[0]}.${comps[1]}`, `${comps[0]}.${comps[1]}`, "", p);
        else addToSection(ch, `direct:${p.number}`, p.number, "", p);
      }
    }
  } else {
    // FLAT shape (IFRS 7 / 13). Build ordered range-starts from contents, then
    // assign each main paragraph to the deepest range whose first-ref ≤ it.
    interface RangeStart {
      first: string;
      chapterNum: string;
      chapterTitle: string;
      sectionKey: string | null;
      sectionTitle: string;
    }
    const ranges: RangeStart[] = [];
    let chOrd = 0;
    let chNum = "";
    let chTitle = "";
    for (const e of parsed.entries) {
      if (e.level === 1) {
        chOrd++;
        chNum = `C${chOrd}`;
        chTitle = e.title;
        ranges.push({
          first: e.firstParagraph,
          chapterNum: chNum,
          chapterTitle: chTitle,
          sectionKey: null,
          sectionTitle: "",
        });
      } else {
        if (!chNum) {
          chOrd++;
          chNum = `C${chOrd}`;
          chTitle = "";
        }
        ranges.push({
          first: e.firstParagraph,
          chapterNum: chNum,
          chapterTitle: chTitle,
          sectionKey: `${chNum}:${e.title}`,
          sectionTitle: e.title,
        });
      }
    }
    const sortedRanges = [...ranges].sort((a, b) => compareProvisionNumbers(a.first, b.first));

    for (const p of leaves) {
      const c = classifyFlat(p.number);
      if (c !== "main") continue;
      let owner: RangeStart | null = null;
      for (const r of sortedRanges) {
        if (compareProvisionNumbers(r.first, p.number) <= 0) owner = r;
        else break;
      }
      owner = owner ?? sortedRanges[0] ?? null;
      if (!owner) {
        const ch = ensureChapter("C1", "Operative paragraphs", "001");
        addToSection(ch, `direct:${p.number}`, p.number, "", p);
        continue;
      }
      const ch = ensureChapter(
        owner.chapterNum,
        owner.chapterTitle,
        owner.chapterNum.replace("C", "").padStart(3, "0"),
      );
      if (owner.sectionKey) {
        addToSection(ch, owner.sectionKey, "", owner.sectionTitle, p);
      } else {
        // Chapter-direct paragraph (no sub-heading): one implicit section that
        // carries the chapter's own paragraphs together.
        addToSection(ch, `${owner.chapterNum}:__direct`, "", "", p);
      }
    }
    // Appendix paragraphs + page chunks.
    for (const p of leaves) {
      const c = classifyFlat(p.number);
      if (c === "main") continue;
      if (c === "appendix-page") {
        const ch = ensureChapter("PAGES", PAGES_HEADING, PAGES_SORTKEY);
        addToSection(ch, `direct:${p.number}`, p.number, "", p);
      } else {
        const ch = ensureChapter(
          `Appendix ${c.appendix}`,
          appendixHeading(c.appendix, parsed),
          appendixSortKey(c.appendix),
        );
        const comps = p.number.split(".");
        if (comps.length >= 3)
          addToSection(ch, `${comps[0]}.${comps[1]}`, `${comps[0]}.${comps[1]}`, "", p);
        else addToSection(ch, `direct:${p.number}`, p.number, "", p);
      }
    }
  }

  // Emit ordered chapters → sections → paragraphs.
  const outChapters: OutlineChapter[] = [...chapters.values()]
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
    .map((b) => {
      const sections: OutlineSection[] = [...b.sections.values()]
        .sort((x, y) => {
          // Sort sections by their first paragraph's number (numeric-aware), so
          // "3.1" precedes "3.2" and direct paras interleave correctly.
          const fx = x.paras[0]?.number ?? "";
          const fy = y.paras[0]?.number ?? "";
          return compareProvisionNumbers(fx, fy);
        })
        .map((sec) => ({
          number: sec.number,
          heading: sec.heading,
          subsections: [...sec.paras].sort((p, q) => compareProvisionNumbers(p.number, q.number)),
        }));
      return { number: b.number, heading: b.heading, sections };
    });

  return { ...doc, chapters: outChapters };
}
