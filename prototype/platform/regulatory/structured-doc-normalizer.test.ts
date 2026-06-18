// platform/regulatory/structured-doc-normalizer.test.ts
//
// Contract for `normalizeStructuredDoc` / `loadNormalizedDocBySlug` — the single
// canonical text-assembly path that collapses the reader view's `collectText`
// fold and the V2 view's `flattenSubsections` leaf-only extraction onto ONE
// `NormalizedProvision` tree.
//
// Covers every text-assembly branch (own / folded / summary / heading-only /
// enriched), the id-stability guard (normalizer NEVER re-keys an id), and a
// BCBS byte-stability assertion (enriched text matches the pre-refactor V1
// `enrichBcbsDocSections` output, captured below).
//
// Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL.

import { describe, expect, it } from "bun:test";

import {
  type LoaderDoc,
  ensureProvisionIds,
  loadNormalizedDocBySlug,
  loadStructuredDocBySlug,
  normalizeStructuredDoc,
} from "./structured-doc-loader";

// Collect every id in a loaded (enriched + id-assigned) LoaderDoc, in tree order.
function loaderIds(doc: LoaderDoc): string[] {
  const ids: string[] = [];
  const walkSubs = (subs: Array<{ id?: string; subsections?: unknown }> | undefined): void => {
    for (const s of subs ?? []) {
      ids.push(s.id ?? "");
      walkSubs(s.subsections as Array<{ id?: string; subsections?: unknown }> | undefined);
    }
  };
  for (const ch of doc.chapters) {
    ids.push(ch.id ?? "");
    for (const s of ch.sections) {
      ids.push(s.id ?? "");
      walkSubs(s.subsections);
    }
  }
  return ids;
}

// Collect every id in a normalized doc, in the same tree order.
function normalizedIds(doc: {
  chapters: Array<{
    id: string;
    sections: Array<{ id: string; subsections: unknown }>;
  }>;
}): string[] {
  const ids: string[] = [];
  const walk = (subs: Array<{ id: string; subsections: unknown }> | undefined): void => {
    for (const s of subs ?? []) {
      ids.push(s.id);
      walk(s.subsections as Array<{ id: string; subsections: unknown }> | undefined);
    }
  };
  for (const ch of doc.chapters) {
    ids.push(ch.id);
    for (const s of ch.sections) {
      ids.push(s.id);
      walk(s.subsections as Array<{ id: string; subsections: unknown }> | undefined);
    }
  }
  return ids;
}

describe("normalizeStructuredDoc — text-assembly branches", () => {
  it("branch 1: own non-empty text → textSource own, completeness verbatim", () => {
    const doc: LoaderDoc = {
      slug: "ex",
      title: "Example",
      chapters: [{ sections: [{ id: "ex-1", number: "1", text: "Body of section one." }] }],
    };
    ensureProvisionIds(doc);
    const n = normalizeStructuredDoc(doc);
    const s = n.chapters[0]?.sections[0];
    expect(s?.verbatimText).toBe("Body of section one.");
    expect(s?.textSource).toBe("own");
    expect(s?.completeness).toBe("verbatim");
    expect(s?.isComposite).toBe(false);
  });

  it("branch 2: empty text + subsection text → folded, composite when >1 sub", () => {
    const doc: LoaderDoc = {
      slug: "ex",
      title: "Example",
      chapters: [
        {
          sections: [
            {
              id: "ex-2",
              number: "2",
              text: "",
              subsections: [
                { id: "ex-2-1", number: "2.1", text: "First sub." },
                { id: "ex-2-2", number: "2.2", text: "Second sub." },
              ],
            },
          ],
        },
      ],
    };
    ensureProvisionIds(doc);
    const s = normalizeStructuredDoc(doc).chapters[0]?.sections[0];
    expect(s?.textSource).toBe("folded");
    expect(s?.completeness).toBe("verbatim");
    expect(s?.isComposite).toBe(true);
    // Fold uses the exact old collectText shape: "<number>  <text>" per sub.
    expect(s?.verbatimText).toBe("2.1  First sub.\n\n2.2  Second sub.");
    // Subsections themselves carry their own verbatim text.
    expect(s?.subsections[0]?.verbatimText).toBe("First sub.");
    expect(s?.subsections[0]?.textSource).toBe("own");
  });

  it("branch 2: a single sub with text is folded but NOT composite", () => {
    const doc: LoaderDoc = {
      slug: "ex",
      title: "Example",
      chapters: [
        {
          sections: [
            {
              id: "ex-3",
              number: "3",
              subsections: [{ id: "ex-3-1", number: "3.1", text: "Only sub." }],
            },
          ],
        },
      ],
    };
    ensureProvisionIds(doc);
    const s = normalizeStructuredDoc(doc).chapters[0]?.sections[0];
    expect(s?.textSource).toBe("folded");
    expect(s?.isComposite).toBe(false);
  });

  it("branch 3: empty text + no subtext + summary → summary tier", () => {
    const doc: LoaderDoc = {
      slug: "ex",
      title: "Example",
      chapters: [
        {
          sections: [
            {
              id: "ex-4",
              number: "4",
              text: "",
              summary: "A précis of section four.",
            },
          ],
        },
      ],
    };
    ensureProvisionIds(doc);
    const s = normalizeStructuredDoc(doc).chapters[0]?.sections[0];
    expect(s?.verbatimText).toBe("A précis of section four.");
    expect(s?.textSource).toBe("summary");
    expect(s?.completeness).toBe("summary");
  });

  it("branch 4: nothing → heading-only with empty text", () => {
    const doc: LoaderDoc = {
      slug: "ex",
      title: "Example",
      chapters: [{ sections: [{ id: "ex-5", number: "5", heading: "Bare heading" }] }],
    };
    ensureProvisionIds(doc);
    const s = normalizeStructuredDoc(doc).chapters[0]?.sections[0];
    expect(s?.verbatimText).toBe("");
    expect(s?.textSource).toBe("heading");
    expect(s?.completeness).toBe("heading-only");
    expect(s?.heading).toBe("Bare heading");
  });

  it("completeness rolls up: empty section over a verbatim subsection is not heading-only", () => {
    const doc: LoaderDoc = {
      slug: "ex",
      title: "Example",
      chapters: [
        {
          sections: [
            {
              id: "ex-6",
              number: "6",
              // no text, no summary at section level
              subsections: [{ id: "ex-6-1", number: "6.1", text: "Real wording." }],
            },
          ],
        },
      ],
    };
    ensureProvisionIds(doc);
    const s = normalizeStructuredDoc(doc).chapters[0]?.sections[0];
    // Folded (so it has verbatim of its own), and certainly not heading-only.
    expect(s?.completeness).toBe("verbatim");
  });
});

describe("normalizeStructuredDoc — rrb summary fallback (the production proof)", () => {
  it("surfaces text for rrb sections that were blank under the old paths", () => {
    const n = loadNormalizedDocBySlug("rrb");
    expect(n).not.toBeNull();
    if (!n) return;
    const summarySections = n.chapters
      .flatMap((c) => c.sections)
      .filter((s) => s.textSource === "summary");
    // The on-disk rrb doc carries 31 summary-only sections.
    expect(summarySections.length).toBeGreaterThan(0);
    for (const s of summarySections) {
      expect(s.verbatimText.length).toBeGreaterThan(0);
      expect(s.completeness).toBe("summary");
    }
  });
});

describe("id-stability guard", () => {
  it("every normalized id equals the ensureProvisionIds id for the same doc", () => {
    for (const slug of ["bcbs-mar", "rrb", "banks-d7-2020"]) {
      const loaded = loadStructuredDocBySlug(slug);
      expect(loaded).not.toBeNull();
      if (!loaded) continue;
      const expected = loaderIds(loaded);
      const got = normalizedIds(normalizeStructuredDoc(loaded));
      expect(got).toEqual(expected);
    }
  });
});

describe("BCBS byte-stability guard", () => {
  // Expected strings captured from the pre-refactor V1 enrichBcbsDocSections /
  // shared enrichBcbsDoc output for bcbs-mar (identical logic). The normalizer
  // must reproduce the enriched section text byte-for-byte and tag it
  // "enriched".
  it("bcbs-mar enriched section 10/11/12 text is unchanged and tagged enriched", () => {
    const n = loadNormalizedDocBySlug("bcbs-mar");
    expect(n).not.toBeNull();
    if (!n) return;
    const byNumber = new Map(
      n.chapters.flatMap((c) => c.sections).map((s) => [s.number, s] as const),
    );
    const s10 = byNumber.get("10");
    expect(s10?.textSource).toBe("enriched");
    expect(s10?.completeness).toBe("enriched");
    // Byte-stability: same head + same length as the captured baseline.
    expect(s10?.verbatimText.length).toBe(8860);
    expect(
      s10?.verbatimText.startsWith("10.1  Market risk: the risk of losses in on- and off-balance"),
    ).toBe(true);
    expect(byNumber.get("11")?.verbatimText.length).toBe(9337);
    expect(byNumber.get("12")?.verbatimText.length).toBe(7333);
  });
});
