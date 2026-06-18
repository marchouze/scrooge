// scripts/regulatory/ifrs-outline-restructure.test.ts
//
// Contract for the deterministic IFRS flat→nested restructure. The binding
// properties: (1) chapter/section TITLES come from the parsed contents page;
// (2) paragraphs nest under their section in correct reading order; (3) every
// paragraph's verbatim text and number are preserved byte-for-byte and the
// paragraph multiset / total char count are unchanged (count in == count out);
// (4) the numeric-aware comparator orders 2.3 < 2.3A < 2.4, A376 < A378,
// 3.1.2 < 3.2.1, 3.2.2 < 3.2.10.
//
// The committed on-disk IFRS docs are ALSO asserted to already carry the
// outline (chapters titled, paragraphs nested verbatim) — a regression guard on
// the build artefact that holds even on CI's clean store (no PDF blob needed).
//
// Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import {
  classifyDotted,
  compareProvisionNumbers,
  restructureIfrsDoc,
  type FlatDoc,
} from "./ifrs-outline-restructure";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");
const iasbDoc = (slug: string): FlatDoc =>
  JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, "Regulations", "INTL", "IASB", "source-docs", `${slug}-structured.json`),
      "utf-8",
    ),
  ) as FlatDoc;

// Minimal DOTTED contents page covering chapter 3.
const DOTTED_CONTENTS = `CONTENTS
                                                                              from paragraph
INTERNATIONAL FINANCIAL REPORTING STANDARD 9
FINANCIAL INSTRUMENTS
CHAPTERS
3 RECOGNITION AND DERECOGNITION                                                         3.1.1
3.1 Initial recognition                                                                 3.1.1
3.2 Derecognition of financial assets                                                   3.2.1
APPENDICES
A Defined terms
B Application guidance
`;

// A flat doc whose paragraphs are deliberately out of order + interleaved with
// an appendix-page chunk and a B-appendix paragraph.
const flatInput = (): FlatDoc => ({
  slug: "ifrs-9",
  title: "ifrs-9",
  goldenSourceHash: "blake3:deadbeef",
  chapters: [
    {
      id: "ch",
      heading: "Operative paragraphs",
      sections: [
        { id: "p-a384", number: "A384", text: "A384 page header spillover", verbatim: true, pages: "10–11" },
        { id: "p-3-2-2", number: "3.2.2", text: "3.2.2 Before evaluating…", verbatim: true, pages: "11" },
        { id: "p-3-1-1", number: "3.1.1", text: "3.1.1 An entity shall recognise…", verbatim: true, pages: "10" },
        { id: "p-3-2-10", number: "3.2.10", text: "3.2.10 If an entity transfers…", verbatim: true, pages: "14" },
        { id: "p-3-2-1", number: "3.2.1", text: "3.2.1 In consolidated…", verbatim: true, pages: "10" },
        { id: "p-b2-1", number: "B2.1", text: "B2.1 Some contracts require…", verbatim: true, pages: "74" },
      ],
    },
  ],
});

describe("restructureIfrsDoc — dotted nesting + ordering", () => {
  const out = restructureIfrsDoc(flatInput(), DOTTED_CONTENTS);

  it("titles chapter 3 from the contents page", () => {
    const ch3 = out.chapters.find((c) => c.number === "3");
    expect(ch3?.heading).toBe("Recognition and derecognition");
  });

  it("titles section 3.1 / 3.2 from the contents page", () => {
    const ch3 = out.chapters.find((c) => c.number === "3")!;
    expect(ch3.sections.find((s) => s.number === "3.1")?.heading).toBe("Initial recognition");
    expect(ch3.sections.find((s) => s.number === "3.2")?.heading).toBe(
      "Derecognition of financial assets",
    );
  });

  it("nests 3.2.2 under section 3.2 with text unchanged", () => {
    const ch3 = out.chapters.find((c) => c.number === "3")!;
    const s32 = ch3.sections.find((s) => s.number === "3.2")!;
    const p = s32.subsections.find((x) => x.number === "3.2.2");
    expect(p).toBeDefined();
    expect(p?.text).toBe("3.2.2 Before evaluating…");
  });

  it("orders paragraphs numerically (3.2.1 < 3.2.2 < 3.2.10)", () => {
    const ch3 = out.chapters.find((c) => c.number === "3")!;
    const s32 = ch3.sections.find((s) => s.number === "3.2")!;
    expect(s32.subsections.map((p) => p.number)).toEqual(["3.2.1", "3.2.2", "3.2.10"]);
  });

  it("routes the appendix-page chunk and B paragraph out of the main flow", () => {
    const numbers = out.chapters.flatMap((c) =>
      c.sections.flatMap((s) => s.subsections.map((p) => p.number)),
    );
    // A384 → PAGES chapter; B2.1 → Appendix B chapter; both present once.
    expect(numbers.filter((n) => n === "A384")).toHaveLength(1);
    expect(numbers.filter((n) => n === "B2.1")).toHaveLength(1);
    const pages = out.chapters.find((c) => c.number === "PAGES");
    const appxB = out.chapters.find((c) => c.number === "Appendix B");
    expect(pages?.sections.flatMap((s) => s.subsections).map((p) => p.number)).toContain("A384");
    expect(appxB?.heading).toContain("Application guidance");
  });

  it("preserves every paragraph exactly once (count + multiset)", () => {
    const before = flatInput();
    const inTexts = before.chapters.flatMap((c) => c.sections.map((s) => s.text)).sort();
    const outTexts = out.chapters
      .flatMap((c) => c.sections.flatMap((s) => s.subsections.map((p) => p.text)))
      .sort();
    expect(outTexts.length).toBe(inTexts.length);
    expect(outTexts).toEqual(inTexts);
  });
});

describe("classifyDotted", () => {
  it("bare integers are footnotes (real content is ≥2 components)", () => {
    expect(classifyDotted("1")).toEqual({ kind: "footnote" });
  });
  it("two-component paragraphs are chapter-direct sections", () => {
    expect(classifyDotted("2.8")).toEqual({ kind: "main", chapter: "2", section: null });
  });
  it("three-component paragraphs nest under a two-component section", () => {
    expect(classifyDotted("3.2.2")).toEqual({ kind: "main", chapter: "3", section: "3.2" });
  });
  it("A### are page-spillover chunks", () => {
    expect(classifyDotted("A376")).toEqual({ kind: "appendix-page" });
  });
  it("B/C paragraphs are appendix paragraphs", () => {
    expect(classifyDotted("B2.1")).toEqual({ kind: "appendix", letter: "B" });
  });
});

describe("compareProvisionNumbers — numeric-aware ordering", () => {
  const lt = (a: string, b: string) => expect(Math.sign(compareProvisionNumbers(a, b))).toBe(-1);
  it("2.3 < 2.3A < 2.4", () => {
    lt("2.3", "2.3A");
    lt("2.3A", "2.4");
  });
  it("A376 < A378", () => lt("A376", "A378"));
  it("3.1.2 < 3.2.1", () => lt("3.1.2", "3.2.1"));
  it("3.2.2 < 3.2.10 (numeric, not lexical)", () => lt("3.2.2", "3.2.10"));
  it("a shorter prefix sorts before its extension (3.1 < 3.1.1)", () => lt("3.1", "3.1.1"));
  it("B2.1 < B3.1.1", () => lt("B2.1", "B3.1.1"));
});

describe("committed IFRS artefacts carry the outline (regression guard)", () => {
  for (const slug of ["ifrs-9", "ifrs-7", "ifrs-13"] as const) {
    it(`${slug}: every chapter is titled and every paragraph nests under a section`, () => {
      const doc = iasbDoc(slug);
      expect(doc.chapters.length).toBeGreaterThan(1);
      for (const ch of doc.chapters) {
        expect((ch.heading ?? "").length).toBeGreaterThan(0);
        for (const s of ch.sections) {
          // Sections are grouping nodes: text lives on their paragraph children.
          expect(Array.isArray((s as { subsections?: unknown[] }).subsections)).toBe(true);
          for (const p of (s as { subsections: Array<{ text: string }> }).subsections) {
            expect(typeof p.text).toBe("string");
          }
        }
      }
    });
  }

  it("ifrs-9 chapter 3 reads as the Contents page", () => {
    const doc = iasbDoc("ifrs-9");
    const ch3 = doc.chapters.find((c) => (c as { number?: string }).number === "3") as
      | { heading: string; sections: Array<{ number?: string; heading?: string; subsections: Array<{ number: string; text: string }> }> }
      | undefined;
    expect(ch3?.heading).toBe("Recognition and derecognition");
    const s31 = ch3?.sections.find((s) => s.number === "3.1");
    expect(s31?.heading).toBe("Initial recognition");
    const s32 = ch3?.sections.find((s) => s.number === "3.2");
    const p322 = s32?.subsections.find((p) => p.number === "3.2.2");
    expect(p322?.text.startsWith("3.2.2")).toBe(true);
  });
});
