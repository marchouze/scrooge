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
  hasContentLoss,
  hasHeadingInBody,
  hasProseHeadings,
  isSingleBlob,
  run,
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
