// scripts/regulatory/cleanup-guidance-note-stubs.test.ts
//
// Two layers of assertion:
//   1. Unit tests for the pure transform (`cleanupDoc`, `collapseExactRepeat`,
//      `isPrunableStub`) — prune-shape, de-dup conservatism, id-stability, and
//      the obligation-safe keep-set fail-safe.
//   2. A post-cleanup GUARD over the 8 real guidance-note docs: every one now
//      walks to ZERO heading-only / summary provisions under the Slice-1
//      normalizer. This is the standing assertion that the extraction artifacts
//      stay pruned (a regression that re-introduces a stub fails CI).
//
// Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL.

import { describe, expect, it } from "bun:test";

import {
  type LoaderDoc,
  type NormalizedProvision,
  loadNormalizedDocBySlug,
} from "../../platform/regulatory/structured-doc-loader";
import {
  TARGET_DOCS,
  cleanupDoc,
  collapseExactRepeat,
  isPrunableStub,
} from "./cleanup-guidance-note-stubs";

// ---------------------------------------------------------------------------
// collapseExactRepeat — only EXACT whole-string self-repeats collapse.
// ---------------------------------------------------------------------------

describe("collapseExactRepeat", () => {
  it("collapses a pure double/triple repeat to one unit", () => {
    expect(collapseExactRepeat("Savings products Savings products")).toBe("Savings products");
    expect(collapseExactRepeat("Other policies Other policies Other policies")).toBe(
      "Other policies",
    );
    expect(
      collapseExactRepeat(
        "Acknowledgment of receipt Acknowledgment of receipt Acknowledgment of receipt",
      ),
    ).toBe("Acknowledgment of receipt");
  });

  it("leaves a heading with leaked body text after the repeat UNCHANGED", () => {
    const s = "Corporate governance Corporate governance a) Board Statement on its values";
    expect(collapseExactRepeat(s)).toBe(s);
  });

  it("leaves a naturally-occurring repeated word UNCHANGED", () => {
    expect(collapseExactRepeat("Risk of risk transfer")).toBe("Risk of risk transfer");
    expect(collapseExactRepeat("Section 2 daily changes in value")).toBe(
      "Section 2 daily changes in value",
    );
  });

  it("is idempotent on an already-collapsed string", () => {
    expect(collapseExactRepeat("Savings products")).toBe("Savings products");
  });
});

// ---------------------------------------------------------------------------
// isPrunableStub — empty to the leaves, no text/summary anywhere.
// ---------------------------------------------------------------------------

describe("isPrunableStub", () => {
  it("is true for an empty numbered node with no descendants", () => {
    expect(isPrunableStub({ number: "2.4", text: "" })).toBe(true);
    expect(isPrunableStub({ number: "2.4", text: "   " })).toBe(true);
    expect(isPrunableStub({ number: "5.1.2", heading: "Issues outlined below", text: "" })).toBe(
      true,
    );
  });

  it("is false when the node carries text", () => {
    expect(isPrunableStub({ number: "2.4", text: "Some body." })).toBe(false);
  });

  it("is false when the node carries a summary", () => {
    expect(isPrunableStub({ number: "2.4", text: "", summary: "Editorial précis." })).toBe(false);
  });

  it("is false when a descendant carries text", () => {
    expect(
      isPrunableStub({ number: "2", text: "", subsections: [{ number: "2.1", text: "body" }] }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cleanupDoc — prune + de-dup + id-stability + obligation-safe keep.
// ---------------------------------------------------------------------------

function makeDoc(): LoaderDoc {
  return {
    slug: "test-doc",
    chapters: [
      {
        title: "Ch 1",
        sections: [
          {
            number: "1",
            heading: "Real",
            text: "real body",
            subsections: [
              { number: "1.1", text: "kept body" },
              { number: "1.2", text: "" }, // empty stub
              { number: "1.3", text: "" }, // empty stub
            ],
          },
          {
            number: "2",
            heading: "Other policies Other policies Other policies",
            text: "", // section with no own text but real child → NOT prunable
            subsections: [{ number: "2.1", text: "real" }],
          },
          { number: "3", heading: "", text: "" }, // fully empty section → prunable
        ],
      },
    ],
  };
}

describe("cleanupDoc", () => {
  it("prunes empty stubs, keeps real siblings, and collapses exact-repeat headings", () => {
    const doc = makeDoc();
    const result = cleanupDoc(doc, new Set());

    // Two subsection stubs (1.2, 1.3) + one empty section (3) pruned. Subsection
    // ids are `${sectionId}-${number}` = `test-doc-1-1.2` etc.
    expect(result.prunedIds.sort()).toEqual(
      ["test-doc-1-1.2", "test-doc-1-1.3", "test-doc-3"].sort(),
    );
    expect(result.keptReferencedIds).toEqual([]);

    // Section 2's repeated heading collapsed.
    expect(result.collapsedHeadings).toContainEqual({
      id: "test-doc-2",
      before: "Other policies Other policies Other policies",
      after: "Other policies",
    });

    // Survivors intact.
    const ch = doc.chapters[0];
    expect(ch.sections.map((s) => s.number)).toEqual(["1", "2"]);
    expect(ch.sections[0].subsections?.map((s) => s.number)).toEqual(["1.1"]);
    expect(ch.sections[1].heading).toBe("Other policies");
  });

  it("KEEPS an obligation-referenced stub rather than pruning it (fail-safe)", () => {
    const doc = makeDoc();
    // Mark 1.2's derived id as obligation-referenced.
    const result = cleanupDoc(doc, new Set(["test-doc-1-1.2"]));

    expect(result.keptReferencedIds).toEqual(["test-doc-1-1.2"]);
    expect(result.prunedIds).not.toContain("test-doc-1-1.2");

    const oneSubs = doc.chapters[0].sections[0].subsections?.map((s) => s.number);
    expect(oneSubs).toContain("1.2"); // kept
    expect(oneSubs).not.toContain("1.3"); // still pruned
  });

  it("is idempotent — a second pass prunes nothing and collapses nothing", () => {
    const doc = makeDoc();
    cleanupDoc(doc, new Set());
    const second = cleanupDoc(doc, new Set());
    expect(second.prunedIds).toEqual([]);
    expect(second.collapsedHeadings).toEqual([]);
  });

  it("does not shift any surviving sibling id (id-stability contract)", () => {
    const doc = makeDoc();
    cleanupDoc(doc, new Set());
    // 1.1 keeps its number-derived id; pruning 1.2/1.3 did not renumber it.
    expect(doc.chapters[0].sections[0].subsections?.[0].id).toBe("test-doc-1-1.1");
  });
});

// ---------------------------------------------------------------------------
// Standing guard — the 8 real docs walk to zero heading-only / summary.
// ---------------------------------------------------------------------------

function walkProvisions(p: NormalizedProvision, acc: NormalizedProvision[]): void {
  acc.push(p);
  for (const s of p.subsections) walkProvisions(s, acc);
}

describe("guidance-note docs are clean of extraction-artifact stubs", () => {
  for (const { slug } of TARGET_DOCS) {
    it(`${slug} has zero heading-only / summary provisions`, () => {
      const doc = loadNormalizedDocBySlug(slug);
      expect(doc).not.toBeNull();
      if (!doc) return;
      const all: NormalizedProvision[] = [];
      for (const ch of doc.chapters) for (const s of ch.sections) walkProvisions(s, all);
      const headingOnly = all.filter((p) => p.completeness === "heading-only");
      const summary = all.filter((p) => p.textSource === "summary");
      expect(headingOnly.map((p) => p.id)).toEqual([]);
      expect(summary.map((p) => p.id)).toEqual([]);
      expect(all.length).toBeGreaterThan(0);
    });
  }
});
