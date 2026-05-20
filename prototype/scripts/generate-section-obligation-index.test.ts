// scripts/generate-section-obligation-index.test.ts
//
// Unit tests for the citation parser used to build the section-obligation
// index. Covers:
//
//   TC-1: Single-instrument single-section citation.
//   TC-2: Single-instrument multi-section citation (e.g. RRB s.1 and s.7).
//   TC-3: Multi-instrument multi-clause citation — FAIS Act + GCC straddle.
//   TC-4: Instrument-wide citation (no section anchor).
//   TC-5: Instrument-wide with GCC sub-section follow-on clauses.
//   TC-6: GCC pattern wins over FAIS Act when both literals appear.
//   TC-7: detectInstrumentSlug rejects unknown citations.
//   TC-8: extractSectionRefs normalises §, ss., and Schedule forms.
//
// Authority: Atlas dispatch (brief:atlas:fix-wrong-obligation-attachments-…)
//
// Author: Atlas (Core banking platform architect, engineering)

import { describe, expect, it } from "bun:test";

import {
  detectInstrumentSlug,
  extractInstrumentSectionPairs,
  extractSectionRefs,
} from "./generate-section-obligation-index";

describe("extractInstrumentSectionPairs", () => {
  // TC-1: Single-instrument single-section
  it("TC-1: pairs a single instrument with a single section", () => {
    const pairs = extractInstrumentSectionPairs("Banks Act 94 of 1990 s.60B");
    expect(pairs).toEqual([{ instrument: "banks-act", sections: ["s60b"] }]);
  });

  // TC-2: Multi-section, single instrument
  it("TC-2: pairs a single instrument with multiple sections", () => {
    const pairs = extractInstrumentSectionPairs("Banks Act s.7 + Banks Act s.60");
    // Expect exactly one banks-act pair with both sections.
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.instrument).toBe("banks-act");
    expect(pairs[0]?.sections.sort()).toEqual(["s60", "s7"].sort());
  });

  // TC-3: Multi-instrument straddle — the failing case from the bug brief.
  //   ORG-FAIS-RK-ADVICE has citation:
  //   "FAIS Act 37 of 2002 § 8 (record-keeping standard)
  //    + GCC (BN 80/2003) s.3(2) … + GCC s.7(1)(a)–(c) … + GCC s.9(1)(a)–(d) …"
  //   Expect: fais-act → [s8]; fais-gcc → [s3, s7, s9].
  it("TC-3: splits multi-instrument citation on clause boundaries", () => {
    const citation =
      "FAIS Act 37 of 2002 § 8 (record-keeping standard) + GCC (BN 80/2003) s.3(2) — five-year retention + GCC s.7(1)(a)–(c) — disclosure + GCC s.9(1)(a)–(d) — record of advice";
    const pairs = extractInstrumentSectionPairs(citation);

    const byInstrument = new Map(pairs.map((p) => [p.instrument, p.sections.sort()]));

    expect(byInstrument.get("fais-act")).toEqual(["s8"]);
    expect(byInstrument.get("fais-gcc")).toEqual(["s3", "s7", "s9"]);
    // No section refs from GCC clauses should leak into fais-act.
    expect(byInstrument.get("fais-act")).not.toContain("s3");
    expect(byInstrument.get("fais-act")).not.toContain("s7");
    expect(byInstrument.get("fais-act")).not.toContain("s9");
  });

  // TC-4: Instrument-wide (no section anchor)
  it("TC-4: marks an instrument-wide citation with empty sections", () => {
    const pairs = extractInstrumentSectionPairs("FAIS Act");
    expect(pairs).toEqual([{ instrument: "fais-act", sections: [] }]);
  });

  // TC-5: Instrument named once + clauses without instrument literal that
  // re-state section anchors — the carry-forward path.
  it("TC-5: carries the last-seen instrument across section-only clauses", () => {
    const citation = "FAIS Act 37/2002 s.18(b) (five-year complaint records) + GCC s.16(2)";
    const pairs = extractInstrumentSectionPairs(citation);
    const byInstrument = new Map(pairs.map((p) => [p.instrument, p.sections.sort()]));

    expect(byInstrument.get("fais-act")?.sort()).toEqual(["s18"]);
    expect(byInstrument.get("fais-gcc")?.sort()).toEqual(["s16"]);
  });

  // TC-6: A clause that mentions both "FAIS Act" and "GCC" literals should
  // resolve to GCC (more-specific pattern wins).
  it("TC-6: GCC pattern wins when both FAIS Act and GCC are in the same clause", () => {
    const pairs = extractInstrumentSectionPairs("FAIS Act GCC s.3(2)");
    expect(pairs).toEqual([{ instrument: "fais-gcc", sections: ["s3"] }]);
  });
});

describe("detectInstrumentSlug", () => {
  // TC-7: unknown citation returns null.
  it("TC-7: returns null for an unrecognised citation", () => {
    expect(detectInstrumentSlug("Unrelated regulation text")).toBeNull();
  });

  it("recognises all eight indexed instruments", () => {
    expect(detectInstrumentSlug("Banks Act 94 of 1990")).toBe("banks-act");
    expect(detectInstrumentSlug("FIC Act 38 of 2001")).toBe("fic-act");
    expect(detectInstrumentSlug("POPIA")).toBe("popia");
    expect(detectInstrumentSlug("FAIS Act 37 of 2002")).toBe("fais-act");
    expect(detectInstrumentSlug("Joint Standard 2 of 2024")).toBe("js2");
    expect(detectInstrumentSlug("General Code of Conduct")).toBe("fais-gcc");
    expect(detectInstrumentSlug("Exchange Control Regulations")).toBe("excon");
    expect(detectInstrumentSlug("Regulations Relating to Banks")).toBe("rrb");
  });
});

describe("extractSectionRefs", () => {
  // TC-8: §, ss., Schedule, Standard forms all normalise to s-prefixed.
  it("TC-8: normalises §, ss., and Schedule forms", () => {
    expect(extractSectionRefs("§ 8").sort()).toEqual(["s8"]);
    expect(extractSectionRefs("ss.7").sort()).toEqual(["s7"]);
    expect(extractSectionRefs("s.21A(1)(b)").sort()).toEqual(["s21a"]);
    expect(extractSectionRefs("Schedule 1").sort()).toEqual(["s1"]);
    expect(extractSectionRefs("Standard 9").sort()).toEqual(["s9"]);
  });
});
