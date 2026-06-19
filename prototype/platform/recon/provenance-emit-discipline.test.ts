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

  // Regression: a naive lexer ran the block-comment regex over the whole source
  // first, so a `/*`-forming byte sequence inside a `//` comment OR inside a
  // string literal opened a phantom block comment that the next `*/` closed —
  // silently deleting the real code (e.g. a `buildPhaseFixtureTag(` call) in
  // between. This false-deleted a construction site and produced a phantom
  // "stale allowlist entry" failure (worked around in PR #1445, root-caused
  // here). The proper state-tracking lexer must NOT treat `/*` inside strings
  // or line comments as a block-comment opener.
  it("does not let `/*` inside a line comment or string swallow real code", () => {
    const source = [
      "// route is /api/v2/markets/fx/* — unbalanced, no closing star-slash here",
      'const path = "/api/v2/markets/fx/* and a */ closer inside a string";',
      'export const e = { provenance: buildPhaseFixtureTag({ sourceLineage: "x" }) };',
    ].join("\n");
    const stripped = stripComments(source);
    // The real construction call survives both the line comment and the string.
    expect(stripped).toContain("buildPhaseFixtureTag(");
    // The line comment itself is gone.
    expect(stripped).not.toContain("unbalanced");
    // The scanner still detects the construction site over such a source.
    const root = makeSyntheticTree();
    try {
      writeFileSync(join(root, "platform", "tricky-comments.ts"), `${source}\n`);
      const hits = scanExplicitProvenance(root);
      expect(hits.map((h) => h.file)).toEqual(["platform/tricky-comments.ts"]);
      expect(hits[0]?.patterns).toContain("buildPhaseFixtureTag(...)");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // NON-BLINDABILITY proof (FU4, task_3b24b7dd, D-FX-OTC-CLOSURE-BACKLOG).
  //
  // The prior regression test above positions the phantom `/*…*/` span ENTIRELY
  // BEFORE the construction call, so even the buggy naive-regex lexer leaves the
  // call intact — the test passes whether or not the lexer is fixed. That made
  // it vacuous for the exact defect class the brief names: a phantom block
  // comment that swallows real code SITTING BETWEEN the phantom open and close.
  //
  // This case encodes the genuine fail-OPEN scenario: an opening `/*` byte
  // sequence inside a path STRING, the `buildPhaseFixtureTag(` construction call
  // on the NEXT line, then a closing `*/` byte sequence inside a LATER string.
  // The naive lexer's block-comment regex matches `/*` … `*/` across all three
  // lines and deletes the construction call in between, blinding the scanner.
  // The correct string-aware lexer treats both `/*` and `*/` as ordinary bytes
  // inside the string literals, so the call survives and the scanner catches it.
  //
  // Revert the lexer to the naive regex and THIS test fails (the hit disappears);
  // that is the non-vacuity the Engineering Charter command 3 requires.
  it("is non-blindable: a `/*`/`*/` pair across string literals must NOT swallow the call between them", () => {
    const source = [
      'const route = "/api/v2/markets/fx/*"; // path string contains a /* sequence',
      'export const e = { provenance: buildPhaseFixtureTag({ sourceLineage: "x" }) };',
      'const closer = "trailing */ inside another string";',
    ].join("\n");

    // Direct lexer assertions: every brief-named byte pattern is handled.
    const stripped = stripComments(source);
    // `/*` inside a string AND the call between the phantom open/close survive.
    expect(stripped).toContain("buildPhaseFixtureTag(");
    // The path string is preserved verbatim (its `/*` is not a comment opener).
    expect(stripped).toContain('"/api/v2/markets/fx/*"');
    // The `*/` inside the trailing string is preserved (not a comment closer).
    expect(stripped).toContain("trailing */ inside another string");
    // The `// path string contains a /* sequence` line comment is still stripped,
    // and its `/*` did not open a block comment either.
    expect(stripped).not.toContain("path string contains a");

    // End-to-end: the scanner CATCHES the construction site over this source.
    // Under the buggy lexer the call is deleted and this expectation fails.
    const root = makeSyntheticTree();
    try {
      writeFileSync(join(root, "platform", "swallow-between.ts"), `${source}\n`);
      const hits = scanExplicitProvenance(root);
      expect(hits.map((h) => h.file)).toEqual(["platform/swallow-between.ts"]);
      expect(hits[0]?.patterns).toContain("buildPhaseFixtureTag(...)");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("strips a normal multi-line block comment while keeping surrounding code", () => {
    const source = [
      "const a = 1;",
      "/* a normal block comment",
      "   spanning multiple lines, mentioning buildPhaseFixtureTag( harmlessly */",
      "const b = 2;",
    ].join("\n");
    const stripped = stripComments(source);
    expect(stripped).toContain("const a = 1;");
    expect(stripped).toContain("const b = 2;");
    // The block comment content (including the bait call) is gone.
    expect(stripped).not.toContain("buildPhaseFixtureTag(");
    expect(stripped).not.toContain("normal block comment");
  });
});
