// scripts/regulatory/ifrs-contents-parser.test.ts
//
// Contract for the IFRS golden-source CONTENTS-page parser. The parser must
// turn the `pdftotext -layout` rendering of an IFRS contents page into a TITLE
// MAP (dotted shape) or an ordered heading list (flat shape) — titles sourced
// verbatim from the PDF, never invented.
//
// Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL.

import { describe, expect, it } from "bun:test";

import { dottedTitleMap, normaliseHeadingCase, parseIfrsContents } from "./ifrs-contents-parser";

// A representative IFRS-9 (DOTTED) contents snippet, including a WRAPPED title
// (6.7 spans two lines) and the appendix block.
const IFRS9_SNIPPET = `CONTENTS
                                                                              from paragraph

INTERNATIONAL FINANCIAL REPORTING STANDARD 9
FINANCIAL INSTRUMENTS
CHAPTERS
1 OBJECTIVE                                                                               1.1
2 SCOPE                                                                                   2.1
3 RECOGNITION AND DERECOGNITION                                                         3.1.1
3.1 Initial recognition                                                                 3.1.1
3.2 Derecognition of financial assets                                                   3.2.1
6.7 Option to designate a credit exposure as measured at fair value through
profit or loss                                                                          6.7.1
APPENDICES
A Defined terms
B Application guidance
C Amendments to other Standards
APPROVAL BY THE BOARD OF IFRS 9 ISSUED IN NOVEMBER 2009
`;

// A representative IFRS-13 (FLAT) contents snippet with a wrapped sub-heading.
const IFRS13_SNIPPET = `CONTENTS
                                                                            from paragraph

INTERNATIONAL FINANCIAL REPORTING STANDARD 13
FAIR VALUE MEASUREMENT
OBJECTIVE                                                                               1
SCOPE                                                                                   5
MEASUREMENT                                                                             9
Definition of fair value                                                                9
Application to financial assets and financial liabilities with offsetting
positions in market risks or counterparty credit risk                                  48
DISCLOSURE                                                                             91
APPENDICES
A Defined terms
B Application guidance
C Effective date and transition
D Amendments to other IFRSs
APPROVAL BY THE BOARD OF IFRS 13 ISSUED IN MAY 2011
`;

describe("parseIfrsContents — dotted (IFRS 9)", () => {
  const parsed = parseIfrsContents(IFRS9_SNIPPET);

  it("detects the dotted shape", () => {
    expect(parsed.shape).toBe("dotted");
  });

  it("yields the expected title map", () => {
    const map = dottedTitleMap(parsed);
    expect(map.get("3")).toBe("Recognition and derecognition");
    expect(map.get("3.1")).toBe("Initial recognition");
    expect(map.get("3.2")).toBe("Derecognition of financial assets");
    expect(map.get("1")).toBe("Objective");
    expect(map.get("2")).toBe("Scope");
  });

  it("joins a WRAPPED section title across lines", () => {
    const map = dottedTitleMap(parsed);
    expect(map.get("6.7")).toBe(
      "Option to designate a credit exposure as measured at fair value through profit or loss",
    );
  });

  it("classifies chapter vs section by number depth", () => {
    const ch3 = parsed.entries.find((e) => e.number === "3");
    const s31 = parsed.entries.find((e) => e.number === "3.1");
    expect(ch3?.level).toBe(1);
    expect(s31?.level).toBe(2);
  });

  it("captures the appendix titles verbatim", () => {
    expect(parsed.appendices).toEqual([
      { letter: "A", title: "Defined terms" },
      { letter: "B", title: "Application guidance" },
      { letter: "C", title: "Amendments to other Standards" },
    ]);
  });

  it("does not leak the standard-title preamble into entries", () => {
    const titles = parsed.entries.map((e) => e.title.toLowerCase());
    expect(titles.some((t) => t.includes("international financial reporting"))).toBe(false);
    expect(titles.some((t) => t === "financial instruments")).toBe(false);
  });
});

describe("parseIfrsContents — flat (IFRS 13)", () => {
  const parsed = parseIfrsContents(IFRS13_SNIPPET);

  it("detects the flat shape", () => {
    expect(parsed.shape).toBe("flat");
  });

  it("maps UPPERCASE headings to chapters and title-case to sections, with first-paragraph refs", () => {
    const measurement = parsed.entries.find((e) => e.title === "Measurement");
    expect(measurement?.level).toBe(1);
    expect(measurement?.firstParagraph).toBe("9");

    const defn = parsed.entries.find((e) => e.title === "Definition of fair value");
    expect(defn?.level).toBe(2);
    expect(defn?.firstParagraph).toBe("9");
  });

  it("joins a WRAPPED sub-heading title and keeps its ref", () => {
    const wrapped = parsed.entries.find((e) => e.firstParagraph === "48");
    expect(wrapped?.title).toBe(
      "Application to financial assets and financial liabilities with offsetting positions in market risks or counterparty credit risk",
    );
    expect(wrapped?.level).toBe(2);
  });

  it("captures the four appendices A–D", () => {
    expect(parsed.appendices.map((a) => a.letter)).toEqual(["A", "B", "C", "D"]);
    expect(parsed.appendices.find((a) => a.letter === "C")?.title).toBe(
      "Effective date and transition",
    );
  });
});

describe("normaliseHeadingCase", () => {
  it("sentence-cases an all-caps source heading", () => {
    expect(normaliseHeadingCase("RECOGNITION AND DERECOGNITION")).toBe(
      "Recognition and derecognition",
    );
  });

  it("leaves a mixed-case title untouched", () => {
    expect(normaliseHeadingCase("Initial recognition")).toBe("Initial recognition");
  });

  it("keeps standard references upper-cased", () => {
    expect(normaliseHeadingCase("INITIAL APPLICATION OF IFRS 9")).toBe(
      "Initial application of IFRS 9",
    );
  });
});
