// scripts/regulatory/build-source-coverage.test.ts
//
// Contract for the DERIVED coverage fields added in WS-REGULATORY unified-model
// Slice 2: `authoringPath` and `contentCompleteness`. These are computed from
// disk (structured docs) + the Slice-1 normalizer, NOT from graph.db, so they
// are stable across the launchd graph-reset cadence and assertable here.
//
// The headline assertion is the rrb false-confidence proof: rrb is a
// hand-authored source whose normalizer walk surfaces 31 summary provisions
// behind only 7+ verbatim ones — the gap Slice 2 makes visible.
//
// Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL.

import { describe, expect, it } from "bun:test";

import { buildSourceCoverage } from "./build-source-coverage";

const report = buildSourceCoverage();
const rowBySlug = (slug: string) => report.rows.find((r) => r.slug === slug);

describe("build-source-coverage derived fields", () => {
  it("rrb is hand-authored with the summary/verbatim gap surfaced", () => {
    const rrb = rowBySlug("rrb");
    expect(rrb).toBeDefined();
    if (!rrb) return;
    // rrb carries a goldenSourceHash but NO page-stamped provision — the hash is
    // provenance, not extraction lineage — so it resolves to hand-authored.
    expect(rrb.authoringPath).toBe("hand-authored");
    expect(rrb.contentCompleteness.summary).toBeGreaterThanOrEqual(31);
    expect(rrb.contentCompleteness.verbatim).toBeGreaterThanOrEqual(7);
    // total equals the sum of all tiers (every provision counted exactly once).
    const c = rrb.contentCompleteness;
    expect(c.verbatim + c.summary + c.headingOnly + c.enriched).toBe(c.total);
  });

  it("a BCBS source is bcbs-enriched", () => {
    const cre = rowBySlug("bcbs-cre");
    expect(cre).toBeDefined();
    if (!cre) return;
    expect(cre.authoringPath).toBe("bcbs-enriched");
  });

  it("a page-stamped PDF source with a hash is pdf-extract", () => {
    // fais-gcc carries both a goldenSourceHash and section-level `pages` stamps.
    const gcc = rowBySlug("fais-gcc");
    expect(gcc).toBeDefined();
    if (!gcc) return;
    expect(gcc.authoringPath).toBe("pdf-extract");
    expect(gcc.contentCompleteness.total).toBeGreaterThan(0);
  });

  it("every row carries both derived fields with a consistent total", () => {
    expect(report.rows.length).toBeGreaterThan(0);
    for (const row of report.rows) {
      expect(["pdf-extract", "bcbs-enriched", "hand-authored"]).toContain(row.authoringPath);
      const c = row.contentCompleteness;
      expect(c.verbatim + c.summary + c.headingOnly + c.enriched).toBe(c.total);
    }
  });
});
