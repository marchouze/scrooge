// platform/regulatory/extract-quality.test.ts
//
// Unit tests for the deterministic extract-quality scorer. All fixtures are
// inline structured-source documents modelled on the real corpus shapes:
//   - a substantive multi-section directive (complete);
//   - the synthetic skeleton shape (Introduction / Application /
//     Acknowledgement-of-receipt + fabricated filler) → synthetic-boilerplate;
//   - a thin no-substantive-heading extract → skeleton;
//   - a thin JSON with a materially richer sibling raw .txt → raw-richer-than-json;
//   - a genuinely-short instrument that still carries a substantive heading →
//     NOT flagged as skeleton (false-positive guard).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import { scoreExtractQuality } from "./extract-quality";
import type { StructuredSourceDocument } from "./structured-source-schema";

function lorem(chars: number): string {
  return "x".repeat(chars);
}

function doc(
  slug: string,
  sections: StructuredSourceDocument["chapters"][number]["sections"],
): StructuredSourceDocument {
  return {
    slug,
    title: slug,
    chapters: [{ id: `ch-${slug}-main`, heading: slug, sections }],
  };
}

describe("scoreExtractQuality", () => {
  it("rates a substantive multi-section directive as complete", () => {
    const d = doc("banks-d11-2025", [
      { id: "s1", number: "1", heading: "Introduction", text: lorem(1500) },
      {
        id: "s2",
        number: "2",
        heading: "Prudential treatment of distressed restructured credit",
        text: lorem(4000),
        subsections: [
          { id: "s2-1", number: "2.1", text: lorem(800) },
          { id: "s2-2", number: "2.2", text: lorem(900) },
        ],
      },
      { id: "s3", number: "3", heading: "Reporting", text: lorem(2000) },
    ]);
    const r = scoreExtractQuality(d);
    expect(r.tier).toBe("complete");
    expect(r.signals.totalTextChars).toBeGreaterThan(4_000);
  });

  it("flags the synthetic skeleton shape as synthetic-boilerplate", () => {
    const d = doc("banks-c2-2014", [
      {
        id: "s1",
        number: "1",
        heading: "Introduction",
        text: "1.1 This circular is issued by the Prudential Authority in terms of Section 6(4) of the Banks Act, 1990.",
        subsections: [
          {
            id: "s1-3",
            number: "1.3",
            text: "This circular remains effective as confirmed in Banks Act Circular 1 of the relevant year.",
          },
        ],
      },
      {
        id: "s2",
        number: "2",
        heading: "Application",
        text: "Application",
        subsections: [
          {
            id: "s2-2",
            number: "2.2",
            text: "Institutions are required to ensure compliance with the requirements set out herein.",
          },
        ],
      },
      {
        id: "s3",
        number: "3",
        heading: "Acknowledgement of receipt",
        text: "Kindly ensure that a copy of this circular is made available to your institution's auditors.",
      },
    ]);
    const r = scoreExtractQuality(d);
    expect(r.tier).toBe("synthetic-boilerplate");
    expect(r.signals.skeletonSignature).toBe(true);
    expect(r.signals.syntheticFillerHits).toBeGreaterThanOrEqual(1);
  });

  it("flags a thin no-substantive-heading extract as skeleton", () => {
    const d = doc("banks-c3-2020", [
      { id: "s1", number: "1", heading: "Body", text: "Body 1. Introduction" },
    ]);
    const r = scoreExtractQuality(d);
    expect(r.tier).toBe("skeleton");
  });

  it("flags a thin JSON with a materially richer raw .txt as raw-richer-than-json", () => {
    const d = doc("banks-gn3-2017", [
      { id: "s1", number: "1", heading: "Acknowledgement of receipt", text: lorem(600) },
    ]);
    const r = scoreExtractQuality(d, { rawTxtBytes: 6800 });
    expect(r.tier).toBe("raw-richer-than-json");
    expect(r.signals.rawRicherRatio).toBeGreaterThan(1.5);
  });

  it("does NOT flag a genuinely short instrument that carries a substantive heading", () => {
    const d = doc("banks-c1-2026", [
      {
        id: "s1",
        number: "1",
        heading: "Status of previously issued circulars",
        text: lorem(1800),
      },
    ]);
    const r = scoreExtractQuality(d);
    // Thin but has a real heading → partial, NOT skeleton/synthetic.
    expect(r.tier).toBe("partial");
    expect(r.signals.skeletonSignature).toBe(false);
  });

  it("treats a substantive extract as complete even when raw .txt is larger", () => {
    // Full directive whose raw .txt is bigger (page markers/letterhead) must
    // not be mis-tiered as raw-richer-than-json.
    const d = doc("banks-d4-2015", [
      { id: "s1", number: "1", heading: "Amendments to the capital framework", text: lorem(20000) },
    ]);
    const r = scoreExtractQuality(d, { rawTxtBytes: 40000 });
    expect(r.tier).toBe("complete");
  });
});
