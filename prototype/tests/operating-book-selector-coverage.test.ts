// tests/operating-book-selector-coverage.test.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR5 — the regression guard that keeps
// projections on the canonical operating-book selector.
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import { describe, expect, it } from "bun:test";

import { lineHasBespokeFilter, run } from "../platform/recon/operating-book-selector-coverage";

describe("recon:operating-book-selector-coverage", () => {
  it("passes on the live tree — no bespoke provenance filters outside the allowlist", () => {
    const r = run();
    expect(r.pipeline).toBe("recon:operating-book-selector-coverage");
    expect(r.violations.filter((v) => v.severity === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThan(0);
  });

  it("detects an inline build-phase-fixture check", () => {
    expect(
      lineHasBespokeFilter('    if (e.provenance?.kind === "build-phase-fixture") continue;'),
    ).toBe(true);
  });

  it("detects a local isFixture helper", () => {
    expect(lineHasBespokeFilter("  const isFixture = (e) => e.provenance?.kind === 'x';")).toBe(
      true,
    );
  });

  it("ignores comments and the canonical selector call", () => {
    expect(lineHasBespokeFilter("// excludes build-phase-fixture seed scaffolding")).toBe(false);
    expect(lineHasBespokeFilter("    if (!eventInOperatingBook(e)) continue;")).toBe(false);
  });
});
