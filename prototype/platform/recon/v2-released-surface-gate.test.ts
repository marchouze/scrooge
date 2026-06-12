// platform/recon/v2-released-surface-gate.test.ts
//
// Regression tests for the released-surface clean-core boundary gate (V2 S5).
//
// Test strategy (mirrors the brief requirement):
//   1. Synthetic violation — a K-internal export wrongly in the R surface → gate FAILS.
//   2. Clean synthetic manifest — no violations → gate PASSES.
//   3. Unannotated export — export with no @tier tag → gate FAILS.
//   4. The REAL v2-core/index.ts + RELEASED_SURFACE manifest → gate PASSES.
//
// Token convention: tokens are relPath with leading "./" stripped.
//   "./fil-core/primitives"  → "fil-core/primitives"
//   "./fil-facets/facets"    → "fil-facets/facets"
//
// Author: Vera (Internal Audit Engineer, governance).

import { describe, expect, it } from "bun:test";
import { type SurfaceManifest, parseIndexExports, run, runGate } from "./v2-released-surface-gate";

// ---------------------------------------------------------------------------
// Synthetic index.ts source snippets for unit tests
// ---------------------------------------------------------------------------

/** A well-formed index.ts excerpt: all exports annotated, one K-internal export. */
const CLEAN_INDEX_SRC = `
/** @tier C — FIL primitive types; available to all tiers */
export * from "./fil-core/primitives";

/** @tier C — FIL taxonomy navigation; available to all tiers */
export * from "./fil-core/taxonomy";

/** @tier C — URN utilities; available to all tiers */
export * from "./fil-core/urn";

/** @tier R — FIL composition engine; regulated-tenant surface and above */
export * from "./fil-core/composition";

/** @tier K — anchor-bank-internal only; not for R/C tenants */
export * from "./control-plane/internal";

/** @tier C — the seven facet interfaces */
export * from "./fil-facets/facets";
`;

/** A clean manifest that correctly excludes the K-internal export from R/C. */
const CLEAN_MANIFEST: SurfaceManifest = {
  K: {
    kOnlyExports: ["control-plane/internal"],
  },
  R: {
    exports: [
      "fil-core/primitives",
      "fil-core/taxonomy",
      "fil-core/urn",
      "fil-core/composition",
      "fil-facets/facets",
      // "control-plane/internal" is correctly ABSENT from R
    ],
  },
  C: {
    exports: ["fil-core/primitives", "fil-core/taxonomy", "fil-core/urn", "fil-facets/facets"],
  },
};

// ---------------------------------------------------------------------------
// parseIndexExports unit tests
// ---------------------------------------------------------------------------

describe("parseIndexExports", () => {
  it("parses @tier C annotation and token correctly", () => {
    const src = `/** @tier C — available to all tiers */\nexport * from "./fil-core/primitives";\n`;
    const entries = parseIndexExports(src);
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(entry.relPath).toBe("./fil-core/primitives");
    expect(entry.token).toBe("fil-core/primitives");
    expect(entry.tier).toBe("C");
  });

  it("parses @tier K annotation correctly", () => {
    const src = `/** @tier K — anchor-bank-internal only */\nexport * from "./control-plane/internal";\n`;
    const entries = parseIndexExports(src);
    const entry = entries[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(entry.tier).toBe("K");
    expect(entry.token).toBe("control-plane/internal");
  });

  it("parses @tier R annotation correctly", () => {
    const src = `/** @tier R — regulated-tenant surface */\nexport * from "./fil-core/composition";\n`;
    const entries = parseIndexExports(src);
    const entry = entries[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(entry.tier).toBe("R");
    expect(entry.token).toBe("fil-core/composition");
  });

  it("produces token 'fil-facets/facets' for ./fil-facets/facets export", () => {
    // Token is simply relPath with "./" stripped — no further normalisation.
    const src = `/** @tier C */\nexport * from "./fil-facets/facets";\n`;
    const entries = parseIndexExports(src);
    const entry = entries[0];
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(entry.token).toBe("fil-facets/facets");
  });

  it("returns tier=null for an unannotated export (blank line separates from prior comment)", () => {
    // The blank line between the annotated export and the unannotated one
    // ensures the backward scan does NOT pick up the previous JSDoc.
    const src = `/** @tier C */\nexport * from "./fil-core/primitives";\n\nexport * from "./fil-core/taxonomy";\n`;
    const entries = parseIndexExports(src);
    expect(entries).toHaveLength(2);
    const first = entries[0];
    const second = entries[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    expect(first.tier).toBe("C");
    expect(second.tier).toBeNull(); // no annotation on the second export
  });

  it("ignores non-export lines", () => {
    const src = "// just a comment\nconst x = 1;\n";
    const entries = parseIndexExports(src);
    expect(entries).toHaveLength(0);
  });

  it("parses multi-export index correctly", () => {
    const entries = parseIndexExports(CLEAN_INDEX_SRC);
    // CLEAN_INDEX_SRC has 6 export lines
    expect(entries).toHaveLength(6);
    const tiers = entries.map((e) => e.tier);
    expect(tiers).toContain("K");
    expect(tiers).toContain("R");
    expect(tiers).toContain("C");
    expect(tiers).not.toContain(null);
  });
});

// ---------------------------------------------------------------------------
// runGate unit tests
// ---------------------------------------------------------------------------

describe("runGate — synthetic violation: K-internal export in R surface", () => {
  it("FAILS when a @tier K export appears in the R-tier manifest (canonical violation)", () => {
    // This is the canonical violation the brief requires the test to construct:
    // "control-plane/internal" is tagged @tier K but wrongly listed in R.exports.
    const violatingManifest: SurfaceManifest = {
      K: { kOnlyExports: ["control-plane/internal"] },
      R: {
        exports: [
          "fil-core/primitives",
          "control-plane/internal", // ← K-internal leaking into R surface
        ],
      },
      C: { exports: ["fil-core/primitives"] },
    };
    const exports = parseIndexExports(CLEAN_INDEX_SRC);
    const { violations } = runGate(exports, violatingManifest);
    const tierLeak = violations.filter((v) => v.message.includes("K-internal"));
    expect(tierLeak.length).toBeGreaterThan(0);
    expect(tierLeak[0]?.severity).toBe("fail");
    expect(tierLeak[0]?.message).toContain("control-plane/internal");
    expect(tierLeak[0]?.message).toContain("R-tier surface");
  });

  it("FAILS when a @tier K export appears in the C-tier manifest", () => {
    const violatingManifest: SurfaceManifest = {
      K: { kOnlyExports: ["control-plane/internal"] },
      R: { exports: ["fil-core/primitives"] },
      C: {
        exports: [
          "fil-core/primitives",
          "control-plane/internal", // ← K-internal leaking into C surface
        ],
      },
    };
    const exports = parseIndexExports(CLEAN_INDEX_SRC);
    const { violations } = runGate(exports, violatingManifest);
    const tierLeak = violations.filter(
      (v) => v.message.includes("K-internal") && v.message.includes("C-tier"),
    );
    expect(tierLeak.length).toBeGreaterThan(0);
  });
});

describe("runGate — unannotated export", () => {
  it("FAILS when an export has no @tier annotation", () => {
    const srcWithUnannotated = `/** @tier C */\nexport * from "./fil-core/primitives";\n\nexport * from "./fil-core/taxonomy";\n`;
    const exports = parseIndexExports(srcWithUnannotated);
    const { violations } = runGate(exports, CLEAN_MANIFEST);
    const unannotated = violations.filter((v) => v.message.includes("no @tier annotation"));
    expect(unannotated.length).toBeGreaterThan(0);
    expect(unannotated[0]?.severity).toBe("fail");
    expect(unannotated[0]?.message).toContain("fil-core/taxonomy");
  });
});

describe("runGate — clean manifest", () => {
  it("PASSES when all exports are annotated and no K export leaks into R/C", () => {
    const exports = parseIndexExports(CLEAN_INDEX_SRC);
    const { violations, asserted } = runGate(exports, CLEAN_MANIFEST);
    expect(violations).toHaveLength(0);
    expect(asserted).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration test: the real v2-core/index.ts + RELEASED_SURFACE manifest
// ---------------------------------------------------------------------------

describe("real manifest integration", () => {
  it("the real RELEASED_SURFACE manifest + real v2-core/index.ts PASSES the gate", () => {
    const r = run();
    if (r.violations.length > 0) {
      // Surface violations so a future regression is legible in CI.
      expect(r.violations.map((v) => `${v.subject}: ${v.message}`)).toEqual([]);
    }
    expect(r.ok).toBe(true);
    expect(r.asserted).toBeGreaterThan(0);
  });
});
