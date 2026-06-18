// platform/regulatory/structured-doc-loader.test.ts
//
// Loader contract: slug-field resolution (BCBS filename ≠ slug), BCBS
// chapter-text enrichment, deterministic id assignment, and provision-tree
// compatibility. Runs against the REAL Regulations/ corpus — the bcbs-mar
// case is exactly the production failure this loader fixes.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { buildProvisionTree, getLeafDescendants } from "./graph/provision-tree";
import { normaliseSectionRef } from "./obligation-linker";
import {
  discoverStructuredDocPaths,
  ensureProvisionIds,
  loadNormalizedDocBySlug,
  loadStructuredDocBySlug,
  normSectionRef,
} from "./structured-doc-loader";

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

describe("discoverStructuredDocPaths — nested regulator dirs", () => {
  // Reproduce the OLD direct-children-only scan so the nested-recursion fix can
  // be asserted as a strict superset (only ADDS nested slugs, never drops one).
  const directChildrenOnlySlugs = (): Set<string> => {
    // import.meta.dir = <worktree>/prototype/platform/regulatory
    const regsDir = resolve(import.meta.dir, "..", "..", "..", "Regulations");
    const slugs = new Set<string>();
    for (const d of readdirSync(regsDir, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith("_")) continue;
      const dir = resolve(regsDir, d.name, "source-docs");
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((x) => x.endsWith("-structured.json"))) {
        let slug = f.replace(/-structured\.json$/, "");
        try {
          const raw = JSON.parse(readFileSync(resolve(dir, f), "utf-8")) as { slug?: string };
          if (raw.slug) slug = raw.slug;
        } catch {
          // fall back to filename-derived slug
        }
        slugs.add(slug);
      }
    }
    return slugs;
  };

  it("discovers nested-dir IFRS slugs (Regulations/INTL/IASB/source-docs)", () => {
    const paths = discoverStructuredDocPaths();
    for (const slug of ["ifrs-9", "ifrs-7", "ifrs-13"]) {
      expect(paths.has(slug)).toBe(true);
      expect(paths.get(slug)).toContain("INTL/IASB/source-docs");
    }
  });

  it("still discovers direct-child slugs (rrb, banks-act)", () => {
    const paths = discoverStructuredDocPaths();
    expect(paths.has("rrb")).toBe(true);
    expect(paths.has("banks-act")).toBe(true);
  });

  it("is a strict superset of the direct-children-only scan", () => {
    const direct = directChildrenOnlySlugs();
    const discovered = new Set(discoverStructuredDocPaths().keys());
    // No previously-discovered slug was dropped.
    for (const slug of direct) expect(discovered.has(slug)).toBe(true);
    // The nested IFRS slugs are genuinely NEW (proves the recursion adds value).
    expect(direct.has("ifrs-9")).toBe(false);
    expect(discovered.has("ifrs-9")).toBe(true);
    expect(discovered.size).toBeGreaterThan(direct.size);
  });
});

describe("loadNormalizedDocBySlug — nested IFRS verbatim", () => {
  const countProvisions = (slug: string): number => {
    const doc = loadNormalizedDocBySlug(slug);
    if (!doc) return 0;
    let n = 0;
    const walk = (p: { subsections: unknown[] }): void => {
      n++;
      for (const ss of p.subsections) walk(ss as { subsections: unknown[] });
    };
    for (const ch of doc.chapters) for (const s of ch.sections) walk(s);
    return n;
  };

  it("returns >100 verbatim provisions for ifrs-9 (nested-dir doc)", () => {
    const doc = loadNormalizedDocBySlug("ifrs-9");
    expect(doc).not.toBeNull();
    expect(countProvisions("ifrs-9")).toBeGreaterThan(100);
    // The top-level sections carry real verbatim text (not heading-only stubs).
    const verbatim = (doc?.chapters ?? [])
      .flatMap((ch) => ch.sections)
      .filter((s) => s.verbatimText.trim().length > 0);
    expect(verbatim.length).toBeGreaterThan(0);
  });

  it("returns provisions for ifrs-7 and ifrs-13 too", () => {
    expect(countProvisions("ifrs-7")).toBeGreaterThan(100);
    expect(countProvisions("ifrs-13")).toBeGreaterThan(100);
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

describe("normSectionRef (shared doc/graph normaliser)", () => {
  // The core bug this fix closes: a citation token `§4` must canonicalise to
  // the SAME provision-number form as a structured doc that numbers the same
  // section `(4)` (or `4`, or `s.4`). Provision ids are minted
  // `PROV-<SLUG>-s${normSectionRef(...)}`, so divergence here drops the
  // obligation→provision link to PARTIAL.
  it("converges §4 / (4) / 4 / s.4 / s4 onto the same number", () => {
    expect(normSectionRef("4")).toBe("4");
    expect(normSectionRef("(4)")).toBe("4");
    expect(normSectionRef("§4")).toBe("4");
    expect(normSectionRef("§ 4")).toBe("4");
    expect(normSectionRef("s.4")).toBe("4");
    expect(normSectionRef("s4")).toBe("4");
    // All five wrapper forms must produce one id.
    const forms = ["4", "(4)", "§4", "§ 4", "s.4", "s4"].map(normSectionRef);
    expect(new Set(forms).size).toBe(1);
  });

  it("preserves a trailing letter suffix (s7 ≠ s7A)", () => {
    expect(normSectionRef("7")).toBe("7");
    expect(normSectionRef("7A")).toBe("7a");
    expect(normSectionRef("(13A)")).toBe("13a");
    expect(normSectionRef("§13A")).toBe("13a");
    // distinctness preserved
    expect(normSectionRef("7")).not.toBe(normSectionRef("7A"));
  });

  it("keeps the existing dot-stripped convention but distinguishes depth", () => {
    // 5.5 → 55, 5.5.1 → 551 — different ids (NOT collapsed together)
    expect(normSectionRef("5.5")).toBe("55");
    expect(normSectionRef("5.5.1")).toBe("551");
    expect(normSectionRef("5.5")).not.toBe(normSectionRef("5.5.1"));
  });

  it("drops a trailing subsection paren to the top-level section", () => {
    // POPIA/FAIS structured docs number sections "22(1)", "1(6)", "18(b)";
    // citations cite the top-level section "s.22" / "§22". Both must converge.
    expect(normSectionRef("22(1)")).toBe("22");
    expect(normSectionRef("1(6)")).toBe("1");
    expect(normSectionRef("18(b)")).toBe("18");
    expect(normSectionRef("11(3)")).toBe("11");
    // letter-suffixed section with a subsection: "13A(2)" → "13a"
    expect(normSectionRef("13A(2)")).toBe("13a");
  });

  it("does not eat a bare letter-led token", () => {
    // a leading `s` is only stripped when a digit follows; do not corrupt
    // genuine alpha section ids.
    expect(normSectionRef("schedule")).toBe("schedule");
  });

  it("is idempotent (safe to apply twice)", () => {
    for (const raw of ["4", "(4)", "§4", "s.4", "13A", "5.5.1"]) {
      const once = normSectionRef(raw);
      expect(normSectionRef(once)).toBe(once);
    }
  });
});

describe("doc-side ↔ citation-side convergence", () => {
  // The citation side (`normaliseSectionRef`) emits `s<num>`; the doc side
  // (`normSectionRef`) emits the bare `<num>` that callers prepend `s` to.
  // Stitching them: `s${normSectionRef(docNumber)}` must equal
  // `normaliseSectionRef(citationToken)` for the same logical section.
  it("§4 citation token matches a (4) / 4 doc section", () => {
    const fromCitation = normaliseSectionRef("§ 4"); // "s4"
    expect(fromCitation).toBe("s4");
    if (fromCitation === null) throw new Error("citation normaliser returned null");
    for (const docNumber of ["4", "(4)", "§4", "s.4"]) {
      expect(`s${normSectionRef(docNumber)}`).toBe(fromCitation);
    }
  });

  it("POPIA s.11 citation matches a doc section numbered 11(1) / 11(3)", () => {
    // Real corpus case: POPIA structured doc numbers sections "11(1)", "11(3)";
    // the obligations register cites "POPIA s.11". Before the fix the doc side
    // minted PROV-POPIA-s11(1) and the link stayed PARTIAL.
    const fromCitation = normaliseSectionRef("s.11"); // "s11"
    expect(fromCitation).toBe("s11");
    if (fromCitation === null) throw new Error("citation normaliser returned null");
    expect(`s${normSectionRef("11(1)")}`).toBe(fromCitation);
    expect(`s${normSectionRef("11(3)")}`).toBe(fromCitation);
  });

  it("letter-suffixed sections stay distinct across both sides", () => {
    // citation side preserves case ("s13A"); doc side lowercases ("s13a").
    // They are not byte-identical for letter suffixes, but each side is
    // internally consistent — the important property is that 7 and 7A never
    // collide on EITHER side.
    expect(normaliseSectionRef("s.7")).not.toBe(normaliseSectionRef("s.7A"));
    expect(normSectionRef("7")).not.toBe(normSectionRef("7A"));
  });
});
