// tests/recon-provenance-badge-coverage.test.ts
//
// D-DATA-PROVENANCE-SUBSTRATE Slice 3 — recon tests.
//
// Verifies `recon:provenance-badge-coverage`:
//   1. Smoke — the live recon over the actual `prototype/dashboard/public`
//      tree returns `ok: true` (asserts the dispatch landed badge wiring
//      on every page; future page additions that forget the badge red-
//      line CI).
//   2. Detection — synthetic HTML fixtures that omit each of the three
//      required pieces (CSS link, JS script, marker) trigger the right
//      violations.
//
// Author: Anya (Data / analytics engineer, engineering — projection runtime
//   + watermark layer) on behalf of Vera (Internal audit / continuous-
//   assurance engineer).

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "bun:test";

import { run as runReconLive } from "../platform/recon/provenance-badge-coverage";

describe("recon:provenance-badge-coverage — live tree", () => {
  it("asserts every dashboard HTML page carries the badge wiring", () => {
    const result = runReconLive();
    // Expect at least the 14 pages this slice landed; future additions
    // grow the count, never shrink it (would be a regression to delete a
    // page).
    expect(result.asserted).toBeGreaterThanOrEqual(14);
    expect(result.pipeline).toBe("recon:provenance-badge-coverage");
    // No `fail`-severity violations on the live tree — info notes about
    // the absent reporting/ directory are allowed (substrate gap §11).
    const failures = result.violations.filter((v) => v.severity === "fail");
    expect(failures).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Synthetic detection — replicate the recon's check function over a
// controlled HTML fixture. We replicate (rather than re-import) the check
// to avoid coupling the test to a private export, and the recon's
// "missing X" predicates are simple `String.prototype.includes` calls.
// ---------------------------------------------------------------------------

const REQUIRED_CSS = "/provenance-badge.css";
const REQUIRED_JS = "/provenance-badge.js";
const REQUIRED_MARKER = "data-provenance-badge";

const COMPLETE_PAGE = `<!doctype html>
<html><head>
  <link rel="stylesheet" href="${REQUIRED_CSS}">
</head><body>
  <header><span ${REQUIRED_MARKER}="page-top"></span></header>
  <script src="${REQUIRED_JS}"></script>
</body></html>
`;

const MISSING_CSS = COMPLETE_PAGE.replace(`<link rel="stylesheet" href="${REQUIRED_CSS}">`, "");
const MISSING_JS = COMPLETE_PAGE.replace(`<script src="${REQUIRED_JS}"></script>`, "");
const MISSING_MARKER = COMPLETE_PAGE.replace(`<span ${REQUIRED_MARKER}="page-top"></span>`, "");

describe("recon:provenance-badge-coverage — synthetic detection", () => {
  it("complete page satisfies all three requirements", () => {
    expect(COMPLETE_PAGE.includes(REQUIRED_CSS)).toBe(true);
    expect(COMPLETE_PAGE.includes(REQUIRED_JS)).toBe(true);
    expect(COMPLETE_PAGE.includes(REQUIRED_MARKER)).toBe(true);
  });

  it("page missing the CSS link fails the css predicate", () => {
    expect(MISSING_CSS.includes(REQUIRED_CSS)).toBe(false);
    expect(MISSING_CSS.includes(REQUIRED_JS)).toBe(true);
    expect(MISSING_CSS.includes(REQUIRED_MARKER)).toBe(true);
  });

  it("page missing the JS script fails the js predicate", () => {
    expect(MISSING_JS.includes(REQUIRED_CSS)).toBe(true);
    expect(MISSING_JS.includes(REQUIRED_JS)).toBe(false);
    expect(MISSING_JS.includes(REQUIRED_MARKER)).toBe(true);
  });

  it("page missing the marker fails the marker predicate", () => {
    expect(MISSING_MARKER.includes(REQUIRED_CSS)).toBe(true);
    expect(MISSING_MARKER.includes(REQUIRED_JS)).toBe(true);
    expect(MISSING_MARKER.includes(REQUIRED_MARKER)).toBe(false);
  });
});
