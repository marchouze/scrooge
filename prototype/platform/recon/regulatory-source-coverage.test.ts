// platform/recon/regulatory-source-coverage.test.ts
//
// Unit tests for the regulatory-source-coverage recon gate.
//
// Slice 6 enforcement model:
//   - sourceAcquired:false post-advisoryUntil → "fail" (ok=false)
//   - obligationsLinked=0 always → "warn" (ok=true)
//
// All tests inject mock rows via the `deps.rows` parameter — no filesystem
// or event-store reads occur.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { SourceCoverageRow } from "../../scripts/regulatory/build-source-coverage";
import { ADVISORY_UNTIL, run } from "./regulatory-source-coverage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADVISORY_DATE = ADVISORY_UNTIL; // "2026-06-11" post-Slice-6 flip
const PRE_ADVISORY_NOW = "2026-06-10T10:00:00.000Z"; // one day before enforcement
const POST_ADVISORY_NOW = "2026-06-11T10:00:00.000Z"; // at or after enforcement

function makeRow(overrides: Partial<SourceCoverageRow> = {}): SourceCoverageRow {
  return {
    instrumentId: "FAIS-ACT-37-2002",
    slug: "fais-act",
    title: "Financial Advisory and Intermediary Services Act 37 of 2002",
    regulator: "FSCA",
    applicabilityStatus: "direct",
    sourceAcquired: true,
    goldenSourceHash: "blake3:abc123",
    extracted: true,
    obligationsLinked: 42,
    structuredJsonPath: "Regulations/FSCA/source-docs/fais-act-structured.json",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("recon:regulatory-source-coverage", () => {
  it("passes (0 violations) when all assertions are satisfied for a direct instrument", () => {
    const r = run({
      rows: [makeRow()],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(3); // three assertions per in-scope row
    expect(r.violations).toHaveLength(0);
    expect(r.active).toBe(1);
    expect(r.acquired).toBe(1);
    expect(r.fullyLinked).toBe(1);
  });

  it("emits 1 warn violation (ok=true) when sourceAcquired is false and pre-advisory", () => {
    const r = run({
      rows: [makeRow({ sourceAcquired: false, goldenSourceHash: null })],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true); // pre-advisory — warn only
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("acquire:source");
    expect(r.acquired).toBe(0);
    expect(r.fullyLinked).toBe(0);
  });

  it("emits 1 FAIL violation (ok=false) when sourceAcquired is false and post-advisory", () => {
    const r = run({
      rows: [makeRow({ sourceAcquired: false, goldenSourceHash: null })],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: POST_ADVISORY_NOW,
    });
    expect(r.ok).toBe(false); // post-advisory — fail
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("fail");
    expect(r.violations[0]?.message).toContain("acquire:source");
    expect(r.acquired).toBe(0);
    expect(r.fullyLinked).toBe(0);
  });

  it("emits 1 warn violation (still ok=true) when obligationsLinked is 0", () => {
    const r = run({
      rows: [makeRow({ obligationsLinked: 0 })],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.message).toContain("EXPRESSES");
    expect(r.fullyLinked).toBe(0);
  });

  it("skips rows with applicabilityStatus 'reference' (out of scope)", () => {
    const r = run({
      rows: [makeRow({ applicabilityStatus: "reference", sourceAcquired: false })],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
    expect(r.active).toBe(0);
  });

  it("skips rows with applicabilityStatus 'unknown'", () => {
    const r = run({
      rows: [makeRow({ applicabilityStatus: "unknown", sourceAcquired: false })],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
  });

  it("includes transposed instruments in scope (pre-advisory → all warn)", () => {
    const r = run({
      rows: [
        makeRow({
          slug: "bcbs-cre",
          applicabilityStatus: "transposed",
          sourceAcquired: false,
          obligationsLinked: 0,
        }),
      ],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true); // pre-advisory — warn only
    expect(r.active).toBe(1);
    // Two violations: sourceAcquired:false + obligationsLinked:0
    expect(r.violations).toHaveLength(2);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
  });

  it("includes transposed instruments in scope (post-advisory → fail on no source)", () => {
    const r = run({
      rows: [
        makeRow({
          slug: "bcbs-cre",
          applicabilityStatus: "transposed",
          sourceAcquired: false,
          obligationsLinked: 0,
        }),
      ],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: POST_ADVISORY_NOW,
    });
    expect(r.ok).toBe(false); // sourceAcquired:false → fail post-advisory
    expect(r.active).toBe(1);
    // Two violations: sourceAcquired:false (fail) + obligationsLinked:0 (warn)
    expect(r.violations).toHaveLength(2);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
    expect(r.violations.some((v) => v.severity === "warn")).toBe(true);
  });

  it("returns ok=true with 0 rows (empty report — clean CI checkout)", () => {
    const r = run({
      rows: [],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
    expect(r.active).toBe(0);
  });

  it("exposes correct summary counters across a mixed population (pre-advisory, all warn)", () => {
    const r = run({
      rows: [
        makeRow({ slug: "fais-act", applicabilityStatus: "direct" }), // fully-linked
        makeRow({ slug: "fic-act", applicabilityStatus: "direct", obligationsLinked: 0 }), // no links
        makeRow({
          slug: "bcbs-cre",
          applicabilityStatus: "transposed",
          sourceAcquired: false,
          goldenSourceHash: null,
        }), // no source
        makeRow({ slug: "eu-crd", applicabilityStatus: "reference" }), // out of scope
      ],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true); // pre-advisory — all warn
    expect(r.active).toBe(3); // direct×2 + transposed×1
    expect(r.acquired).toBe(2); // fais-act + fic-act
    expect(r.fullyLinked).toBe(1); // only fais-act
    expect(r.violations).toHaveLength(2); // fic-act: 1 (no links) + bcbs-cre: 1 (no source)
  });

  it("exposes correct summary counters across a mixed population (post-advisory → fail on no source)", () => {
    const r = run({
      rows: [
        makeRow({ slug: "fais-act", applicabilityStatus: "direct" }), // fully-linked
        makeRow({ slug: "fic-act", applicabilityStatus: "direct", obligationsLinked: 0 }), // no links
        makeRow({
          slug: "bcbs-cre",
          applicabilityStatus: "transposed",
          sourceAcquired: false,
          goldenSourceHash: null,
        }), // no source → fail
        makeRow({ slug: "eu-crd", applicabilityStatus: "reference" }), // out of scope
      ],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: POST_ADVISORY_NOW,
    });
    expect(r.ok).toBe(false); // bcbs-cre sourceAcquired:false → fail
    expect(r.active).toBe(3);
    expect(r.acquired).toBe(2);
    expect(r.fullyLinked).toBe(1);
    // 2 violations: fic-act: no links (warn) + bcbs-cre: no source (fail)
    expect(r.violations).toHaveLength(2);
    const sevs = r.violations.map((v) => v.severity).sort();
    expect(sevs).toEqual(["fail", "warn"]);
  });
});
