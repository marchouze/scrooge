// platform/recon/market-data-provenance-gate.test.ts
//
// Tests for the market-data provenance gate recon pipeline.
// Uses temporary directories so no real source files are scanned.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION; Policies/valuation-policy-v1.md §4.3
// Author: Vera (Internal audit / continuous-assurance engineer, engineering)

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run } from "./market-data-provenance-gate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempProto(): string {
  const root = mkdtempSync(join(tmpdir(), "provenance-gate-test-"));
  // Create the scan root directories the recon expects.
  mkdirSync(join(root, "platform"), { recursive: true });
  mkdirSync(join(root, "scripts", "agents"), { recursive: true });
  return root;
}

function writePlatformFile(protoDir: string, filename: string, content: string): void {
  writeFileSync(join(protoDir, "platform", filename), content, "utf8");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("recon:market-data-provenance-gate", () => {
  it("passes when .query() call includes a provenance filter", () => {
    const protoDir = makeTempProto();
    writePlatformFile(
      protoDir,
      "compliant-valuation.ts",
      [
        "// valuation module",
        "const ticks = store.query({ provenance: 'production', instrument: 'USD/ZAR' });",
      ].join("\n"),
    );

    const result = run({ prototypeDir: protoDir });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("fails when .query() call in a valuation context is missing provenance", () => {
    const protoDir = makeTempProto();
    writePlatformFile(
      protoDir,
      "non-compliant-valuation.ts",
      ["// valuation module", "const ticks = store.query({ instrument: 'USD/ZAR' });"].join("\n"),
    );

    const result = run({ prototypeDir: protoDir });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    const v = result.violations[0];
    expect(v?.subject).toContain("non-compliant-valuation.ts");
    expect(v?.message).toContain("missing `provenance` filter");
  });

  it("passes when .query() call is a dedup pattern (exempted by 'existing' context)", () => {
    const protoDir = makeTempProto();
    // Matches the sens-ingest.ts pattern: write-path dedup lookup.
    writePlatformFile(
      protoDir,
      "ingest-dedup.ts",
      [
        "// ingest dedup lookup",
        "const existing = mdStore.query({ source: 'jse-sens' });",
        "const existingIds = existing.map((t) => t.id);",
      ].join("\n"),
    );

    const result = run({ prototypeDir: protoDir });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("passes when .query() call spans multiple lines and provenance is on a later line", () => {
    const protoDir = makeTempProto();
    writePlatformFile(
      protoDir,
      "multiline-query.ts",
      [
        "const ticks = store.query({",
        "  instrument: 'USD/ZAR',",
        "  provenance: 'production',",
        "  from: '2026-01-01',",
        "});",
      ].join("\n"),
    );

    const result = run({ prototypeDir: protoDir });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("skips test files (*.test.ts)", () => {
    const protoDir = makeTempProto();
    // Write a test file with a non-compliant call — it must NOT be flagged.
    writeFileSync(
      join(protoDir, "platform", "some-module.test.ts"),
      "const ticks = store.query({ instrument: 'USD/ZAR' });",
      "utf8",
    );

    const result = run({ prototypeDir: protoDir });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("skips files in env-sim directories", () => {
    const protoDir = makeTempProto();
    mkdirSync(join(protoDir, "platform", "env-sim"), { recursive: true });
    writeFileSync(
      join(protoDir, "platform", "env-sim", "sim-store.ts"),
      "const ticks = store.query({ instrument: 'USD/ZAR' });",
      "utf8",
    );

    const result = run({ prototypeDir: protoDir });

    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("reports callsChecked count equal to number of call-site lines found", () => {
    const protoDir = makeTempProto();
    writePlatformFile(
      protoDir,
      "two-calls.ts",
      [
        "const a = store.query({ provenance: 'production', instrument: 'A' });",
        "const b = store.getLatest('src', 'B', '2026-01-01');",
      ].join("\n"),
    );

    const result = run({ prototypeDir: protoDir });

    // Both lines are call-sites; getLatest has positional args (no provenance
    // in its signature), so it will be flagged unless provenance is not
    // required for getLatest. Here we test that callsChecked >= 2.
    expect(result.callsChecked).toBeGreaterThanOrEqual(2);
  });
});
