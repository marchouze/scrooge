// platform/regulatory/structured-doc-loader.test.ts
//
// Loader contract: slug-field resolution (BCBS filename ≠ slug), BCBS
// chapter-text enrichment, deterministic id assignment, and provision-tree
// compatibility. Runs against the REAL Regulations/ corpus — the bcbs-mar
// case is exactly the production failure this loader fixes.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import { buildProvisionTree, getLeafDescendants } from "./graph/provision-tree";
import { ensureProvisionIds, loadStructuredDocBySlug } from "./structured-doc-loader";

describe("loadStructuredDocBySlug", () => {
  it("resolves bcbs-mar (file mar-structured.json) by internal slug field", () => {
    const doc = loadStructuredDocBySlug("bcbs-mar");
    expect(doc).not.toBeNull();
    expect(doc?.slug).toBe("bcbs-mar");
  });

  it("enriches BCBS section text from chapter-text.json", () => {
    const doc = loadStructuredDocBySlug("bcbs-mar");
    const withText = (doc?.chapters ?? [])
      .flatMap((ch) => ch.sections)
      .filter((s) => (s.text ?? "").length > 0);
    expect(withText.length).toBeGreaterThan(0);
  });

  it("assigns ids to every chapter, section and subsection", () => {
    const doc = loadStructuredDocBySlug("bcbs-mar");
    for (const ch of doc?.chapters ?? []) {
      expect(ch.id).toBeTruthy();
      for (const s of ch.sections) {
        expect(s.id).toBeTruthy();
        for (const sub of s.subsections ?? []) {
          expect(sub.id).toBeTruthy();
        }
      }
    }
  });

  it("produces a tree the provision-tree utilities can traverse", () => {
    const doc = loadStructuredDocBySlug("bcbs-mar");
    expect(doc).not.toBeNull();
    if (!doc) return;
    const tree = buildProvisionTree(doc as unknown as Parameters<typeof buildProvisionTree>[0]);
    const leaves = getLeafDescendants(tree, "bcbs-mar");
    expect(leaves.length).toBeGreaterThan(10);
    // Every leaf id must exist as a node (the tickability contract)
    for (const leaf of leaves) expect(tree.has(leaf)).toBe(true);
  });

  it("still resolves filename-keyed SA instruments (banks-d7-2020)", () => {
    const doc = loadStructuredDocBySlug("banks-d7-2020");
    expect(doc?.slug).toBe("banks-d7-2020");
  });

  it("returns null for unknown slugs", () => {
    expect(loadStructuredDocBySlug("no-such-instrument")).toBeNull();
  });
});

describe("ensureProvisionIds", () => {
  it("is number-derived and idempotent; existing ids are untouched", () => {
    const doc = {
      slug: "x",
      chapters: [
        {
          sections: [
            { number: "10", subsections: [{ number: "10.1" }, {}] },
            { id: "keep-me", subsections: [] },
          ],
        },
      ],
    };
    ensureProvisionIds(doc);
    const ch = doc.chapters[0] as { id?: string; sections: Array<Record<string, unknown>> };
    expect(ch.id).toBe("ch-x-1");
    const s0 = ch.sections[0] as { id?: string; subsections: Array<{ id?: string }> };
    expect(s0.id).toBe("x-10");
    expect(s0.subsections[0]?.id).toBe("x-10-10.1");
    expect(s0.subsections[1]?.id).toBe("x-10-2"); // ordinal fallback
    expect((ch.sections[1] as { id?: string }).id).toBe("keep-me");
    const before = JSON.stringify(doc);
    ensureProvisionIds(doc);
    expect(JSON.stringify(doc)).toBe(before); // idempotent
  });
});
