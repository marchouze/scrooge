// platform/recon/provenance-emit-discipline.test.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE — PR6. Regression tests for the
// explicit-provenance bypass gate:
//   (1) the live repo is green (every explicit construction site allowlisted),
//   (2) a reconstructed NEW bypass call-site in a synthetic production tree
//       FAILS the gate (the defect class the pipeline exists to catch),
//   (3) comment-only mentions and non-envelope `provenance:` metadata do not
//       false-positive,
//   (4) test files and substrate-internal paths are out of scope.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run, scanExplicitProvenance, stripComments } from "./provenance-emit-discipline";

function makeSyntheticTree(): string {
  const root = mkdtempSync(join(tmpdir(), "prov-emit-discipline-"));
  mkdirSync(join(root, "platform", "event-store"), { recursive: true });
  mkdirSync(join(root, "runtime", "agents"), { recursive: true });
  return root;
}

describe("recon:provenance-emit-discipline — live repo", () => {
  it("is green: every explicit-provenance construction site is allowlisted", () => {
    const result = run();
    expect(
      result.violations
        .filter((v) => v.severity === "fail")
        .map((v) => `${v.subject}: ${v.message}`),
    ).toEqual([]);
    expect(result.ok).toBe(true);
    // The allowlist itself is exercised (no stale entries on the live tree).
    expect(result.violations.filter((v) => v.severity === "warn")).toEqual([]);
  });
});

describe("recon:provenance-emit-discipline — bypass reconstruction", () => {
  it("a NEW productionTag(...) emitter outside the allowlist FAILS the gate", () => {
    const root = makeSyntheticTree();
    try {
      writeFileSync(
        join(root, "runtime", "agents", "rogue-emitter.ts"),
        [
          'import { productionTag } from "../../platform/event-store/provenance";',
          "export function emitRogue() {",
          '  return { provenance: productionTag({ sourceLineage: "rogue" }) };',
          "}",
          "",
        ].join("\n"),
      );
      const result = run(root);
      expect(result.ok).toBe(false);
      const fails = result.violations.filter((v) => v.severity === "fail");
      expect(fails).toHaveLength(1);
      expect(fails[0]?.subject).toBe("runtime/agents/rogue-emitter.ts");
      expect(fails[0]?.message).toContain("provenanceForEmit");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("an inline provenance literal and a typed ProvenanceTag const are both detected", () => {
    const root = makeSyntheticTree();
    try {
      writeFileSync(
        join(root, "platform", "inline-literal.ts"),
        'export const e = { provenance: { kind: "simulated", scenario: "s", sourceLineage: "x" } };\n',
      );
      writeFileSync(
        join(root, "platform", "typed-const.ts"),
        [
          'import type { ProvenanceTag } from "./event-store/provenance";',
          'const TAG: ProvenanceTag = { kind: "production", sourceLineage: "x" };',
          "export const t = TAG;",
          "",
        ].join("\n"),
      );
      const hits = scanExplicitProvenance(root);
      expect(hits.map((h) => h.file).sort()).toEqual([
        "platform/inline-literal.ts",
        "platform/typed-const.ts",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("comment-only mentions and non-envelope provenance metadata do NOT false-positive", () => {
    const root = makeSyntheticTree();
    try {
      writeFileSync(
        join(root, "platform", "comment-only.ts"),
        [
          "// Production closes use productionTag({sourceLineage: 'x'}); see",
          "/* PRODUCTION_CARVE_OUTS and PRE_SUBSTRATE_BACKFILL_TAG are documented here */",
          "export const ok = 1;",
          "",
        ].join("\n"),
      );
      writeFileSync(
        join(root, "platform", "plane-a-metadata.ts"),
        [
          "export const artefact = {",
          '  provenance: { extractionMethod: "rule-based", extractorId: "x" },',
          "};",
          "",
        ].join("\n"),
      );
      expect(scanExplicitProvenance(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("test files and event-store substrate paths are out of scope", () => {
    const root = makeSyntheticTree();
    try {
      writeFileSync(
        join(root, "platform", "some.test.ts"),
        'export const t = { provenance: { kind: "production", sourceLineage: "test" } };\n',
      );
      writeFileSync(
        join(root, "platform", "event-store", "provenance.ts"),
        'export function productionTag(args: { sourceLineage: string }) { return { kind: "production", ...args }; }\n',
      );
      expect(scanExplicitProvenance(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("stripComments", () => {
  it("removes line and block comments but keeps code", () => {
    expect(stripComments("a; // productionTag(\nb; /* simulatedTag( */ c;")).toBe("a; \nb;  c;");
  });
});
