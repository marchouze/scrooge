// platform/recon/regulatory-source-extract-quality.test.ts
//
// Unit tests for the regulatory-source-extract-quality recon gate. Rows and
// allowlist are injected via deps -- no filesystem reads.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  type AllowlistEntry,
  type ExtractQualityRow,
  type StructuralCheckRow,
  type StructuralIssueEntry,
  type SummaryCompletenessRow,
  type SummaryFormAllowlistEntry,
  bodyCharCount,
  hasContentLoss,
  hasHeadingInBody,
  hasProseHeadings,
  hasTableCellAsHeading,
  isSingleBlob,
  run,
  summaryCompletenessTally,
} from "./regulatory-source-extract-quality";

const ALLOW: Record<string, AllowlistEntry> = {
  "banks-d1-2015": { reason: "no-public-url", note: "test fixture" },
  "banks-c3-2020": { reason: "genuinely-short", note: "one-pager" },
};

const STRUCT_ALLOW: Record<string, StructuralIssueEntry> = {
  "banks-d2-2018": { reason: "annexure-or-corrupt", note: "annexure table" },
};

const POST = "2026-06-12T00:00:00.000Z";

// ---------------------------------------------------------------------------
// Existing quality-tier tests
// ---------------------------------------------------------------------------

describe("regulatory-source-extract-quality gate — quality tier", () => {
  it("passes when all poor extracts are allowlisted", () => {
    const rows: ExtractQualityRow[] = [
      { slug: "banks-d11-2025", tier: "complete" },
      { slug: "banks-d1-2015", tier: "synthetic-boilerplate" },
      { slug: "banks-c3-2020", tier: "skeleton" },
    ];
    const r = run({ rows, allowlist: ALLOW, structuralRows: [], asOfDate: POST });
    expect(r.ok).toBe(true);
    expect(r.poor).toBe(2);
    expect(r.allowlisted).toBe(2);
  });

  it("FAILS post-advisory on a non-allowlisted poor extract (regression)", () => {
    const rows: ExtractQualityRow[] = [
      { slug: "banks-d11-2025", tier: "synthetic-boilerplate" }, // was complete -> regression
      { slug: "banks-d1-2015", tier: "synthetic-boilerplate" },
    ];
    const r = run({ rows, allowlist: ALLOW, structuralRows: [], asOfDate: POST });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail" && v.subject.includes("d11-2025"))).toBe(
      true,
    );
  });

  it("only warns pre-advisory on a non-allowlisted poor extract", () => {
    const rows: ExtractQualityRow[] = [{ slug: "banks-new-2026", tier: "skeleton" }];
    const r = run({
      rows,
      allowlist: ALLOW,
      structuralRows: [],
      advisoryUntil: "2026-06-30",
      asOfDate: "2026-06-12T00:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.severity === "warn")).toBe(true);
  });

  it("flags a stale allowlist entry that no longer scores poor", () => {
    const rows: ExtractQualityRow[] = [
      { slug: "banks-d1-2015", tier: "complete" }, // recovered -- allowlist now stale
      { slug: "banks-c3-2020", tier: "skeleton" },
    ];
    const r = run({ rows, allowlist: ALLOW, structuralRows: [], asOfDate: POST });
    expect(r.ok).toBe(true); // stale is warn, not fail
    expect(r.staleAllowlist).toBe(1);
    expect(
      r.violations.some((v) => v.subject.includes("d1-2015") && v.subject.includes("allowlist")),
    ).toBe(true);
  });

  it("treats complete/partial as acceptable (not poor)", () => {
    const rows: ExtractQualityRow[] = [
      { slug: "a", tier: "complete" },
      { slug: "b", tier: "partial" },
    ];
    const r = run({ rows, allowlist: {}, structuralRows: [], asOfDate: POST });
    expect(r.ok).toBe(true);
    expect(r.poor).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Structural check helper unit tests
// ---------------------------------------------------------------------------

describe("hasContentLoss", () => {
  const makeDoc = (bodyChars: number) => ({
    slug: "test",
    title: "Test",
    chapters: [
      {
        sections: [{ id: "s1", text: "x".repeat(bodyChars), subsections: [] }],
      },
    ],
  });

  it("returns false when no raw txt (rawTxtBytes = 0)", () => {
    expect(hasContentLoss(makeDoc(100) as never, 0)).toBe(false);
  });

  it("returns true when body/txt < 0.15", () => {
    // 100 body chars / 1000 txt bytes = 0.1 < 0.15
    expect(hasContentLoss(makeDoc(100) as never, 1000)).toBe(true);
  });

  it("returns false when body/txt >= 0.15", () => {
    // 200 body chars / 1000 txt bytes = 0.2 >= 0.15
    expect(hasContentLoss(makeDoc(200) as never, 1000)).toBe(false);
  });
});

describe("isSingleBlob", () => {
  it("returns true for a single section with no subsections and body > 500", () => {
    const doc = {
      slug: "test",
      title: "Test",
      chapters: [
        {
          sections: [{ id: "s1", text: "x".repeat(600), subsections: [] }],
        },
      ],
    };
    expect(isSingleBlob(doc as never)).toBe(true);
  });

  it("returns false when the single section has subsections", () => {
    const doc = {
      slug: "test",
      title: "Test",
      chapters: [
        {
          sections: [
            {
              id: "s1",
              text: "x".repeat(600),
              subsections: [{ id: "s1-1", text: "sub", subsections: [] }],
            },
          ],
        },
      ],
    };
    expect(isSingleBlob(doc as never)).toBe(false);
  });

  it("returns false when body <= 500", () => {
    const doc = {
      slug: "test",
      title: "Test",
      chapters: [
        {
          sections: [{ id: "s1", text: "x".repeat(400), subsections: [] }],
        },
      ],
    };
    expect(isSingleBlob(doc as never)).toBe(false);
  });

  it("returns false when there are multiple sections", () => {
    const doc = {
      slug: "test",
      title: "Test",
      chapters: [
        {
          sections: [
            { id: "s1", text: "x".repeat(600), subsections: [] },
            { id: "s2", text: "y".repeat(600), subsections: [] },
          ],
        },
      ],
    };
    expect(isSingleBlob(doc as never)).toBe(false);
  });
});

describe("hasHeadingInBody", () => {
  it("returns true when section text starts with heading[:30]", () => {
    const doc = {
      slug: "test",
      title: "Test",
      chapters: [
        {
          sections: [
            {
              id: "s1",
              heading: "Introduction to capital requirements",
              text: "Introduction to capital requirements The bank shall...",
              subsections: [],
            },
          ],
        },
      ],
    };
    expect(hasHeadingInBody(doc as never)).toBe(true);
  });

  it("returns false when text does NOT start with heading", () => {
    const doc = {
      slug: "test",
      title: "Test",
      chapters: [
        {
          sections: [
            {
              id: "s1",
              heading: "Introduction",
              text: "This section describes the capital requirements...",
              subsections: [],
            },
          ],
        },
      ],
    };
    expect(hasHeadingInBody(doc as never)).toBe(false);
  });

  it("returns false when heading is too short (< 10 chars)", () => {
    const doc = {
      slug: "test",
      title: "Test",
      chapters: [
        {
          sections: [
            {
              id: "s1",
              heading: "Intro",
              text: "Intro Some more text",
              subsections: [],
            },
          ],
        },
      ],
    };
    expect(hasHeadingInBody(doc as never)).toBe(false);
  });
});

describe("hasProseHeadings", () => {
  it("returns true when average heading length > 80", () => {
    const longHeading =
      "Banks should make provision for a period of up to 18 months between submitting applications";
    const doc = {
      slug: "test",
      title: "Test",
      chapters: [
        {
          sections: [
            { id: "s1", heading: longHeading, text: "body text", subsections: [] },
            { id: "s2", heading: longHeading, text: "body text", subsections: [] },
          ],
        },
      ],
    };
    expect(hasProseHeadings(doc as never)).toBe(true);
  });

  it("returns false when average heading length <= 80", () => {
    const doc = {
      slug: "test",
      title: "Test",
      chapters: [
        {
          sections: [
            { id: "s1", heading: "Introduction", text: "body text", subsections: [] },
            { id: "s2", heading: "Application", text: "body text", subsections: [] },
          ],
        },
      ],
    };
    expect(hasProseHeadings(doc as never)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Wave-2 FAILING detector helper unit tests
// ---------------------------------------------------------------------------

const mkHeading = (heading: string) => ({
  slug: "test",
  title: "Test",
  chapters: [{ sections: [{ id: "s1", heading, text: "body", subsections: [] }] }],
});

describe("hasTableCellAsHeading", () => {
  it("returns true for a heading containing a pipe delimiter", () => {
    expect(hasTableCellAsHeading(mkHeading("Bank name | Submission date | Type") as never)).toBe(
      true,
    );
  });

  it("returns true for a short single cell label ending in a colon", () => {
    expect(hasTableCellAsHeading(mkHeading("Rating system Name:") as never)).toBe(true);
  });

  it("returns true for >= 3 short colon-terminated cell fragments", () => {
    expect(hasTableCellAsHeading(mkHeading("Name: Date: Type:") as never)).toBe(true);
  });

  it("returns false for a normal prose heading containing one colon", () => {
    expect(
      hasTableCellAsHeading(
        mkHeading("Guidance on electronic communication: new e-mail address") as never,
      ),
    ).toBe(false);
  });

  it("returns false for a plain short heading without colon or pipe", () => {
    expect(hasTableCellAsHeading(mkHeading("Acknowledgement of receipt") as never)).toBe(false);
  });
});

describe("bodyCharCount", () => {
  it("sums recursive section + subsection text length", () => {
    const doc = {
      slug: "t",
      title: "T",
      chapters: [
        {
          sections: [
            {
              id: "s1",
              text: "x".repeat(100),
              subsections: [{ id: "s1-1", text: "y".repeat(50), subsections: [] }],
            },
          ],
        },
      ],
    };
    expect(bodyCharCount(doc as never)).toBe(150);
  });
});

describe("regulatory-source-extract-quality gate — Wave-2 FAILING detectors", () => {
  const NONE = {
    contentLoss: false,
    singleBlob: false,
    headingInBody: false,
    proseHeading: false,
    tableCellHeading: false,
  };

  it("FAILS post-advisory on a table-cell-as-heading defect (no allowlist)", () => {
    const r = run({
      rows: [],
      allowlist: {},
      shortFormAllowlist: {},
      structuralAllowlist: {},
      structuralRows: [{ slug: "banks-form", ...NONE, tableCellHeading: true, bodyChars: 9000 }],
      asOfDate: POST,
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.subject.includes("banks-form (table-cell-as-heading)"),
      ),
    ).toBe(true);
  });

  it("FAILS post-advisory on a thin-form extract not allowlisted", () => {
    const r = run({
      rows: [],
      allowlist: {},
      shortFormAllowlist: {},
      structuralAllowlist: {},
      structuralRows: [{ slug: "banks-thin", ...NONE, bodyChars: 1500 }],
      asOfDate: POST,
    });
    expect(r.ok).toBe(false);
    expect(
      r.violations.some(
        (v) => v.severity === "fail" && v.subject.includes("banks-thin (thin-form)"),
      ),
    ).toBe(true);
  });

  it("does NOT fail thin-form when the slug is in the short-form allowlist", () => {
    const r = run({
      rows: [],
      allowlist: {},
      shortFormAllowlist: { "banks-gn1-2008": { reason: "genuinely-short", note: "one-pager" } },
      structuralAllowlist: {},
      structuralRows: [{ slug: "banks-gn1-2008", ...NONE, bodyChars: 1857 }],
      asOfDate: POST,
    });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("thin-form"))).toBe(false);
  });

  it("does NOT fail thin-form when the slug is a genuinely-short POOR_QUALITY entry", () => {
    const r = run({
      rows: [],
      allowlist: { "banks-c3-2020": { reason: "genuinely-short", note: "one-pager" } },
      shortFormAllowlist: {},
      structuralAllowlist: {},
      structuralRows: [{ slug: "banks-c3-2020", ...NONE, bodyChars: 908 }],
      asOfDate: POST,
    });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("thin-form"))).toBe(false);
  });

  it("only warns pre-advisory on a thin-form / table-cell defect", () => {
    const r = run({
      rows: [],
      allowlist: {},
      shortFormAllowlist: {},
      structuralAllowlist: {},
      structuralRows: [{ slug: "banks-x", ...NONE, tableCellHeading: true, bodyChars: 1000 }],
      advisoryUntil: "2026-06-30",
      asOfDate: "2026-06-12T00:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural check integration tests (via run() with injected structuralRows)
// ---------------------------------------------------------------------------

describe("regulatory-source-extract-quality gate — structural checks", () => {
  it("emits warn (not fail) for single-blob instrument not in structural allowlist", () => {
    const structuralRows: StructuralCheckRow[] = [
      {
        slug: "banks-new-instrument",
        contentLoss: false,
        singleBlob: true,
        headingInBody: false,
        proseHeading: false,
        tableCellHeading: false,
        bodyChars: 9000,
      },
    ];
    const r = run({
      rows: [],
      allowlist: {},
      structuralAllowlist: {},
      structuralRows,
      asOfDate: POST,
    });
    expect(r.ok).toBe(true); // structural checks are warn, not fail
    expect(r.structuralFindings).toBe(1);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "warn" &&
          v.subject.includes("banks-new-instrument") &&
          v.subject.includes("single-blob"),
      ),
    ).toBe(true);
  });

  it("emits allowlisted warn for single-blob instrument in structural allowlist", () => {
    const structuralRows: StructuralCheckRow[] = [
      {
        slug: "banks-d2-2018",
        contentLoss: false,
        singleBlob: true,
        headingInBody: false,
        proseHeading: false,
        tableCellHeading: false,
        bodyChars: 9000,
      },
    ];
    const r = run({
      rows: [],
      allowlist: {},
      structuralAllowlist: STRUCT_ALLOW,
      structuralRows,
      asOfDate: POST,
    });
    expect(r.ok).toBe(true);
    expect(
      r.violations.some((v) => v.subject.includes("d2-2018") && v.subject.includes("allowlisted")),
    ).toBe(true);
  });

  it("flags content-loss when body/txt < 15%", () => {
    const structuralRows: StructuralCheckRow[] = [
      {
        slug: "banks-thin-source",
        contentLoss: true,
        singleBlob: false,
        headingInBody: false,
        proseHeading: false,
        tableCellHeading: false,
        bodyChars: 9000,
      },
    ];
    const r = run({
      rows: [],
      allowlist: {},
      structuralAllowlist: {},
      structuralRows,
      asOfDate: POST,
    });
    expect(r.ok).toBe(true); // warn, not fail
    expect(r.structuralFindings).toBe(1);
    expect(
      r.violations.some(
        (v) => v.subject.includes("banks-thin-source") && v.subject.includes("content-loss"),
      ),
    ).toBe(true);
  });

  it("flags heading-in-body artefact (warn only)", () => {
    const structuralRows: StructuralCheckRow[] = [
      {
        slug: "banks-gn-new",
        contentLoss: false,
        singleBlob: false,
        headingInBody: true,
        proseHeading: false,
        tableCellHeading: false,
        bodyChars: 9000,
      },
    ];
    const r = run({
      rows: [],
      allowlist: {},
      structuralAllowlist: {},
      structuralRows,
      asOfDate: POST,
    });
    expect(r.ok).toBe(true);
    expect(r.structuralFindings).toBe(1);
    expect(
      r.violations.some(
        (v) => v.subject.includes("banks-gn-new") && v.subject.includes("heading-in-body"),
      ),
    ).toBe(true);
  });

  it("flags prose-heading artefact (warn only)", () => {
    const structuralRows: StructuralCheckRow[] = [
      {
        slug: "banks-gn-new",
        contentLoss: false,
        singleBlob: false,
        headingInBody: false,
        proseHeading: true,
        tableCellHeading: false,
        bodyChars: 9000,
      },
    ];
    const r = run({
      rows: [],
      allowlist: {},
      structuralAllowlist: {},
      structuralRows,
      asOfDate: POST,
    });
    expect(r.ok).toBe(true);
    expect(r.structuralFindings).toBe(1);
    expect(
      r.violations.some(
        (v) => v.subject.includes("banks-gn-new") && v.subject.includes("prose-heading"),
      ),
    ).toBe(true);
  });

  it("gate remains ok=true even with multiple structural findings (all warn)", () => {
    const structuralRows: StructuralCheckRow[] = [
      {
        slug: "banks-a",
        contentLoss: true,
        singleBlob: true,
        headingInBody: true,
        proseHeading: true,
        tableCellHeading: false,
        bodyChars: 9000,
      },
    ];
    const r = run({
      rows: [],
      allowlist: {},
      structuralAllowlist: {},
      structuralRows,
      asOfDate: POST,
    });
    expect(r.ok).toBe(true); // all structural checks are warn-only
    expect(r.structuralFindings).toBe(4);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Slice 3 (2026-06-18): per-section summary-only completeness detector
// ---------------------------------------------------------------------------

const SUMMARY_ALLOW: Record<string, SummaryFormAllowlistEntry> = {
  rrb: { knownGap: 31, note: "editorial summaries pending backfill" },
};

describe("summaryCompletenessTally", () => {
  it("counts summary + heading-only provisions across the normalized tree", () => {
    const doc = {
      slug: "t",
      title: "T",
      goldenSourceHash: null,
      chapters: [
        {
          id: "c1",
          number: "1",
          heading: "Ch1",
          sections: [
            // verbatim
            {
              id: "s1",
              number: "1",
              heading: "S1",
              verbatimText: "real text",
              textSource: "own" as const,
              completeness: "verbatim" as const,
              isComposite: false,
              excerpts: [],
              subsections: [
                // heading-only child
                {
                  id: "s1-1",
                  number: "1.1",
                  heading: "S1.1",
                  verbatimText: "",
                  textSource: "heading" as const,
                  completeness: "heading-only" as const,
                  isComposite: false,
                  excerpts: [],
                  subsections: [],
                },
              ],
            },
            // summary
            {
              id: "s2",
              number: "2",
              heading: "S2",
              verbatimText: "an editorial summary",
              textSource: "summary" as const,
              completeness: "summary" as const,
              isComposite: false,
              excerpts: [],
              subsections: [],
            },
          ],
        },
      ],
    };
    const t = summaryCompletenessTally(doc as never);
    expect(t.summary).toBe(1);
    expect(t.headingOnly).toBe(1);
    expect(t.total).toBe(3);
  });
});

describe("regulatory-source-extract-quality gate — summary-only-sections (advisory)", () => {
  it("(a) an allowlisted source with summary sections produces NO fail (advisory only)", () => {
    const summaryRows: SummaryCompletenessRow[] = [
      { slug: "rrb", summary: 31, headingOnly: 0, total: 143 },
    ];
    const r = run({
      rows: [],
      allowlist: {},
      shortFormAllowlist: {},
      structuralAllowlist: {},
      structuralRows: [],
      summaryFormAllowlist: SUMMARY_ALLOW,
      summaryRows,
      asOfDate: POST,
    });
    expect(r.ok).toBe(true); // advisory, never flips ok
    expect(r.summaryOnlyFindings).toBe(1);
    expect(r.summaryAllowlistStale).toBe(0);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "warn" &&
          v.subject.includes("rrb") &&
          v.subject.includes("summary-only-sections") &&
          v.subject.includes("allowlisted"),
      ),
    ).toBe(true);
    // No fail-severity violation anywhere.
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
  });

  it("(b) a non-allowlisted source with summary/heading-only sections produces an advisory finding", () => {
    const summaryRows: SummaryCompletenessRow[] = [
      { slug: "banks-new-gap", summary: 2, headingOnly: 3, total: 40 },
    ];
    const r = run({
      rows: [],
      allowlist: {},
      shortFormAllowlist: {},
      structuralAllowlist: {},
      structuralRows: [],
      summaryFormAllowlist: SUMMARY_ALLOW, // does NOT contain banks-new-gap
      summaryRows,
      asOfDate: POST,
    });
    expect(r.ok).toBe(true); // still advisory, not a hard fail
    expect(r.summaryOnlyFindings).toBe(1);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "warn" &&
          v.subject.includes("banks-new-gap") &&
          v.subject.includes("summary-only-sections") &&
          !v.subject.includes("allowlisted"),
      ),
    ).toBe(true);
    // The seeded allowlist entry (rrb) is now stale (no row), so self-check fires.
    expect(r.summaryAllowlistStale).toBe(1);
  });

  it("(c) stale-entry self-check: an allowlisted source with zero gap is flagged", () => {
    // rrb is allowlisted but no longer appears with a gap (backfilled) -> stale.
    const summaryRows: SummaryCompletenessRow[] = [];
    const r = run({
      rows: [],
      allowlist: {},
      shortFormAllowlist: {},
      structuralAllowlist: {},
      structuralRows: [],
      summaryFormAllowlist: SUMMARY_ALLOW,
      summaryRows,
      asOfDate: POST,
    });
    expect(r.ok).toBe(true); // stale is warn, not fail
    expect(r.summaryAllowlistStale).toBe(1);
    expect(r.summaryOnlyFindings).toBe(0);
    expect(
      r.violations.some(
        (v) =>
          v.severity === "warn" &&
          v.subject.includes("rrb") &&
          v.subject.includes("summary-form-allowlist") &&
          v.subject.includes("stale"),
      ),
    ).toBe(true);
  });

  it("ignores rows whose per-section gap is zero (no finding, no stale)", () => {
    const summaryRows: SummaryCompletenessRow[] = [
      { slug: "rrb", summary: 31, headingOnly: 0, total: 143 },
      { slug: "fully-verbatim", summary: 0, headingOnly: 0, total: 50 },
    ];
    const r = run({
      rows: [],
      allowlist: {},
      shortFormAllowlist: {},
      structuralAllowlist: {},
      structuralRows: [],
      summaryFormAllowlist: SUMMARY_ALLOW,
      summaryRows,
      asOfDate: POST,
    });
    expect(r.summaryOnlyFindings).toBe(1); // only rrb
    expect(r.summaryAllowlistStale).toBe(0);
    expect(r.violations.some((v) => v.subject.includes("fully-verbatim"))).toBe(false);
  });
});
