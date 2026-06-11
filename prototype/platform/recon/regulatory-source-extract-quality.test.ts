// platform/recon/regulatory-source-extract-quality.test.ts
//
// Unit tests for the regulatory-source-extract-quality recon gate. Rows and
// allowlist are injected via deps — no filesystem reads.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import {
  type AllowlistEntry,
  type ExtractQualityRow,
  run,
} from "./regulatory-source-extract-quality";

const ALLOW: Record<string, AllowlistEntry> = {
  "banks-d1-2015": { reason: "image-only-ocr-blocked", note: "scanned" },
  "banks-c3-2020": { reason: "genuinely-short", note: "one-pager" },
};

const POST = "2026-06-12T00:00:00.000Z";

describe("regulatory-source-extract-quality gate", () => {
  it("passes when all poor extracts are allowlisted", () => {
    const rows: ExtractQualityRow[] = [
      { slug: "banks-d11-2025", tier: "complete" },
      { slug: "banks-d1-2015", tier: "synthetic-boilerplate" },
      { slug: "banks-c3-2020", tier: "skeleton" },
    ];
    const r = run({ rows, allowlist: ALLOW, asOfDate: POST });
    expect(r.ok).toBe(true);
    expect(r.poor).toBe(2);
    expect(r.allowlisted).toBe(2);
  });

  it("FAILS post-advisory on a non-allowlisted poor extract (regression)", () => {
    const rows: ExtractQualityRow[] = [
      { slug: "banks-d11-2025", tier: "synthetic-boilerplate" }, // was complete → regression
      { slug: "banks-d1-2015", tier: "synthetic-boilerplate" },
    ];
    const r = run({ rows, allowlist: ALLOW, asOfDate: POST });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail" && v.subject.includes("d11-2025"))).toBe(
      true,
    );
  });

  it("only warns pre-advisory on a non-allowlisted poor extract", () => {
    const rows: ExtractQualityRow[] = [{ slug: "banks-new-2026", tier: "skeleton" }];
    const r = run({
      rows,
      allowlist: ALLOW,
      advisoryUntil: "2026-06-30",
      asOfDate: "2026-06-12T00:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    expect(r.violations.some((v) => v.severity === "warn")).toBe(true);
  });

  it("flags a stale allowlist entry that no longer scores poor", () => {
    const rows: ExtractQualityRow[] = [
      { slug: "banks-d1-2015", tier: "complete" }, // recovered — allowlist now stale
      { slug: "banks-c3-2020", tier: "skeleton" },
    ];
    const r = run({ rows, allowlist: ALLOW, asOfDate: POST });
    expect(r.ok).toBe(true); // stale is warn, not fail
    expect(r.staleAllowlist).toBe(1);
    expect(
      r.violations.some((v) => v.subject.includes("d1-2015") && v.subject.includes("allowlist")),
    ).toBe(true);
  });

  it("treats complete/partial as acceptable (not poor)", () => {
    const rows: ExtractQualityRow[] = [
      { slug: "a", tier: "complete" },
      { slug: "b", tier: "partial" },
    ];
    const r = run({ rows, allowlist: {}, asOfDate: POST });
    expect(r.ok).toBe(true);
    expect(r.poor).toBe(0);
  });
});
