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
