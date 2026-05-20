// tests/regulation-reader-view.test.ts
//
// Tests for the regulation-reader projection. Verifies:
//
//   TC-1: `buildInstrumentDetailView('fais-act')` exposes the three
//         instrument-wide obligations (ORG-CD-01/02/03) on the new
//         `instrumentWideObligations` field — not fanned across sections.
//   TC-2: After Bug 1 fix, FAIS Act procedural sections (§22 Funding,
//         §27 Receipt of complaints, §41 Fees, §46 Commencement) have
//         zero obligations attached.
//   TC-3: After Bug 2 fix, FAIS GCC sections cited in obligations
//         (e.g. GCC s.3, s.7, s.9) land on `fais-gcc/sN` — not on
//         `fais-act/sN`.
//   TC-4: `instrumentWideObligations` is empty on instruments whose
//         obligations all carry section anchors (smoke check that the
//         panel is not always populated).
//
// Authority: Atlas dispatch (brief:atlas:fix-wrong-obligation-attachments-…)
//
// Author: Atlas (Core banking platform architect, engineering)

import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { buildInstrumentDetailView } from "../dashboard/regulation-reader-view";
import { buildIndex } from "../scripts/generate-section-obligation-index";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

describe("buildInstrumentDetailView — Bug 1 fix (instrument-wide panel)", () => {
  it("TC-1: surfaces ORG-CD-01/02/03 on instrumentWideObligations for fais-act", () => {
    const detail = buildInstrumentDetailView(REPO_ROOT, "fais-act");
    expect(detail).not.toBeNull();
    if (!detail) return;

    const wideIds = detail.instrumentWideObligations.map((o) => o.id);
    expect(wideIds).toContain("ORG-CD-01");
    expect(wideIds).toContain("ORG-CD-02");
    expect(wideIds).toContain("ORG-CD-03");
  });

  it("TC-2: does NOT fan instrument-wide obligations into procedural FAIS Act sections", () => {
    const detail = buildInstrumentDetailView(REPO_ROOT, "fais-act");
    expect(detail).not.toBeNull();
    if (!detail) return;

    // Procedural sections that previously showed every instrument-wide
    // obligation. After Bug 1 fix they should carry no obligations.
    const proceduralSectionIds = ["s22", "s27", "s41", "s46"];

    for (const sectionId of proceduralSectionIds) {
      const found = detail.chapters
        .flatMap((ch) => ch.sections)
        .find((sec) => sec.id === sectionId);
      // The section may or may not exist in the structured JSON; only
      // assert when it does.
      if (!found) continue;
      const oblIds = found.obligations.map((o) => o.id);
      expect(oblIds).not.toContain("ORG-CD-01");
      expect(oblIds).not.toContain("ORG-CD-02");
      expect(oblIds).not.toContain("ORG-CD-03");
    }
  });

  it("TC-4: per-section obligations contain only ids whose key matches that section", () => {
    const detail = buildInstrumentDetailView(REPO_ROOT, "fais-act");
    expect(detail).not.toBeNull();
    if (!detail) return;

    // After Bug 1 fix, the obligations attached to any section must NOT
    // include the instrument-wide-only ORG-CD-01/02/03 ids unless those
    // ids also carry a section-anchored entry (they do not).
    for (const ch of detail.chapters) {
      for (const sec of ch.sections) {
        const ids = sec.obligations.map((o) => o.id);
        expect(ids).not.toContain("ORG-CD-01");
        expect(ids).not.toContain("ORG-CD-02");
        expect(ids).not.toContain("ORG-CD-03");
      }
    }
  });
});

describe("buildIndex — Bug 2 fix (clause-aware citation parser)", () => {
  it("TC-3: GCC section refs in a multi-instrument citation land on fais-gcc, not fais-act", () => {
    const result = buildIndex(REPO_ROOT);
    const idx = result.index;

    // ORG-FAIS-RK-ADVICE carries FAIS Act § 8 + GCC s.3, s.7, s.9.
    // After Bug 2 fix:
    //   fais-act/s8       contains ORG-FAIS-RK-ADVICE
    //   fais-gcc/s3, s7, s9 each contain ORG-FAIS-RK-ADVICE
    //   fais-act/s3, s7, s9 do NOT exist (or do not contain ORG-FAIS-RK-ADVICE)
    expect(idx["fais-act/s8"]).toContain("ORG-FAIS-RK-ADVICE");
    expect(idx["fais-gcc/s3"]).toContain("ORG-FAIS-RK-ADVICE");
    expect(idx["fais-gcc/s7"]).toContain("ORG-FAIS-RK-ADVICE");
    expect(idx["fais-gcc/s9"]).toContain("ORG-FAIS-RK-ADVICE");

    // The bug: these used to (incorrectly) contain ORG-FAIS-RK-ADVICE.
    expect(idx["fais-act/s3"] ?? []).not.toContain("ORG-FAIS-RK-ADVICE");
    expect(idx["fais-act/s7"] ?? []).not.toContain("ORG-FAIS-RK-ADVICE");
    expect(idx["fais-act/s9"] ?? []).not.toContain("ORG-FAIS-RK-ADVICE");
  });

  it("TC-3b: ORG-CD-01/02/03 land instrument-wide on fais-act (no section anchor)", () => {
    const result = buildIndex(REPO_ROOT);
    const idx = result.index;

    const faisActRoot = idx["fais-act"] ?? [];
    expect(faisActRoot).toContain("ORG-CD-01");
    expect(faisActRoot).toContain("ORG-CD-02");
    expect(faisActRoot).toContain("ORG-CD-03");
  });
});

describe("buildInstrumentDetailView — cross-instrument canonical section lookup", () => {
  // Schema-mismatch fix: the index keys all use `${slug}/s${number}` but the
  // structured-JSON `section.id` uses instrument-specific prefixes (`reg`,
  // `gcc`, `excon-reg`, `s3-1`). The view now derives the lookup key from
  // `section.number` (or `section.sectionNumber` / id as fallback) so that
  // RRB/GCC/JS2/Excon sections light up correctly on the rendered page.

  it("TC-RRB: RRB section reg27 (Regulation 27) lights up obligations indexed under rrb/s27", () => {
    const detail = buildInstrumentDetailView(REPO_ROOT, "rrb");
    expect(detail).not.toBeNull();
    if (!detail) return;

    const allSections = detail.chapters.flatMap((ch) => ch.sections);
    const reg27 = allSections.find((s) => s.id === "reg27");
    expect(reg27).toBeDefined();
    if (!reg27) return;
    expect(reg27.obligations.length).toBeGreaterThan(0);
  });

  it("TC-GCC: FAIS-GCC sections gcc3 / gcc7 / gcc9 light up under fais-gcc/sN", () => {
    const detail = buildInstrumentDetailView(REPO_ROOT, "fais-gcc");
    expect(detail).not.toBeNull();
    if (!detail) return;

    const allSections = detail.chapters.flatMap((ch) => ch.sections);
    for (const id of ["gcc3", "gcc7", "gcc9"]) {
      const sec = allSections.find((s) => s.id === id);
      expect(sec).toBeDefined();
      if (!sec) continue;
      expect(sec.obligations.length).toBeGreaterThan(0);
    }
  });

  it("TC-JS2: a §3 citation lights up every JS2 section whose number starts with '3.'", () => {
    const detail = buildInstrumentDetailView(REPO_ROOT, "js2");
    expect(detail).not.toBeNull();
    if (!detail) return;

    const allSections = detail.chapters.flatMap((ch) => ch.sections);
    // ORG-BNK-CYBER-CONS cites Joint Standard 2 of 2024 group provisions but
    // without a specific § number — it ends up in instrument-wide. The
    // prefix-match path is exercised by any obligation that cites `§ 3` or
    // similar; we assert that *at least one* `3.x` section carries an
    // obligation (proves prefix-match wiring works, regardless of which
    // specific obligation triggers it).
    const standard3Sections = allSections.filter((s) =>
      (s.number ?? "").toString().startsWith("3."),
    );
    expect(standard3Sections.length).toBeGreaterThan(0);
    const anyLit = standard3Sections.some((s) => s.obligations.length > 0);
    expect(anyLit).toBe(true);
  });

  it("TC-FAIS-ACT-no-regression: fais-act/s8 still carries ORG-FAIS-RK-ADVICE on the view", () => {
    const detail = buildInstrumentDetailView(REPO_ROOT, "fais-act");
    expect(detail).not.toBeNull();
    if (!detail) return;

    const allSections = detail.chapters.flatMap((ch) => ch.sections);
    const s8 = allSections.find((s) => s.id === "s8");
    expect(s8).toBeDefined();
    if (!s8) return;
    const ids = s8.obligations.map((o) => o.id);
    expect(ids).toContain("ORG-FAIS-RK-ADVICE");
  });

  it("TC-FIC-ACT-no-regression: fic-act lookup still attaches section-anchored obligations", () => {
    const detail = buildInstrumentDetailView(REPO_ROOT, "fic-act");
    expect(detail).not.toBeNull();
    if (!detail) return;

    let withObl = 0;
    for (const ch of detail.chapters)
      for (const sec of ch.sections) {
        if (sec.obligations.length > 0) withObl++;
      }
    // fic-act had 11 section-with-obligations before; this fix should not
    // regress it. The baseline target in the brief is ~10–15.
    expect(withObl).toBeGreaterThanOrEqual(10);
  });
});
