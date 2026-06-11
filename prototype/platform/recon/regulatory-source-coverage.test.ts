// platform/recon/regulatory-source-coverage.test.ts
//
// Unit tests for the regulatory-source-coverage advisory recon gate.
//
// All tests inject mock rows via the `deps.rows` parameter — no filesystem
// or event-store reads occur. The gate is advisory (all violations are
// severity:"warn") so every test expects ok:true.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import type { SourceCoverageRow } from "../../scripts/regulatory/build-source-coverage";
import { ADVISORY_UNTIL, run } from "./regulatory-source-coverage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADVISORY_DATE = ADVISORY_UNTIL;
const PRE_ADVISORY_NOW = "2026-06-11T10:00:00.000Z";

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

  it("emits 1 warn violation (still ok=true) when sourceAcquired is false", () => {
    const r = run({
      rows: [makeRow({ sourceAcquired: false, goldenSourceHash: null })],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true); // advisory — warn never flips ok
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]?.severity).toBe("warn");
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

  it("includes transposed instruments in scope", () => {
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
    expect(r.ok).toBe(true); // advisory
    expect(r.active).toBe(1);
    // Two violations: sourceAcquired:false + obligationsLinked:0
    expect(r.violations).toHaveLength(2);
    expect(r.violations.every((v) => v.severity === "warn")).toBe(true);
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

  it("exposes correct summary counters across a mixed population", () => {
    const r = run({
      rows: [
        makeRow({ slug: "fais-act", applicabilityStatus: "direct" }),             // fully-linked
        makeRow({ slug: "fic-act", applicabilityStatus: "direct", obligationsLinked: 0 }), // no links
        makeRow({ slug: "bcbs-cre", applicabilityStatus: "transposed", sourceAcquired: false, goldenSourceHash: null }), // no source
        makeRow({ slug: "eu-crd", applicabilityStatus: "reference" }),              // out of scope
      ],
      advisoryUntil: ADVISORY_DATE,
      asOfDate: PRE_ADVISORY_NOW,
    });
    expect(r.ok).toBe(true);
    expect(r.active).toBe(3);     // direct×2 + transposed×1
    expect(r.acquired).toBe(2);   // fais-act + fic-act
    expect(r.fullyLinked).toBe(1); // only fais-act
    expect(r.violations).toHaveLength(2); // fic-act: 1 (no links) + bcbs-cre: 1 (no source)
  });
});
