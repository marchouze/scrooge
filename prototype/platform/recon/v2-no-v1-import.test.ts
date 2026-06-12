// platform/recon/v2-no-v1-import.test.ts
//
// Regression test for the no-v1-import boundary gate (V2 S0). Constructs
// VIOLATING imports and asserts the gate flags them, plus asserts the real
// v2-core tree currently passes.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import { classifyImport, run } from "./v2-no-v1-import";

const V2_CORE_DIR = resolve(import.meta.dir, "..", "..", "v2-core");
const A_FILE = resolve(V2_CORE_DIR, "fil-core", "taxonomy.ts");

describe("no-v1-import boundary gate", () => {
  it("FLAGS a relative import that escapes into platform/ (the canonical violation)", () => {
    const problem = classifyImport(A_FILE, "../../platform/composition");
    expect(problem).not.toBeNull();
    expect(problem).toContain("platform");
  });

  it("FLAGS a relative import into runtime/", () => {
    expect(classifyImport(A_FILE, "../../runtime/decisions/record")).not.toBeNull();
  });

  it("FLAGS the @platform/ path alias", () => {
    const problem = classifyImport(A_FILE, "@platform/event-store/store");
    expect(problem).not.toBeNull();
    expect(problem).toContain("alias");
  });

  it("FLAGS the @domains/ and @simulators/ aliases", () => {
    expect(classifyImport(A_FILE, "@domains/markets")).not.toBeNull();
    expect(classifyImport(A_FILE, "@simulators/fx")).not.toBeNull();
  });

  it("FLAGS an import that escapes the package without landing in a known v1 dir", () => {
    expect(classifyImport(A_FILE, "../../some-other-root/thing")).not.toBeNull();
  });

  it("PERMITS bare npm/builtin specifiers", () => {
    expect(classifyImport(A_FILE, "zod")).toBeNull();
    expect(classifyImport(A_FILE, "node:fs")).toBeNull();
  });

  it("PERMITS intra-package relative imports", () => {
    expect(classifyImport(A_FILE, "./urn")).toBeNull();
    expect(classifyImport(A_FILE, "../fil-facets/facets")).toBeNull();
  });

  it("the real v2-core tree PASSES the gate (zero violations)", () => {
    const r = run();
    if (!r.violations.length) {
      expect(r.ok).toBe(true);
    } else {
      // Surface what tripped it, so a future boundary breach is legible in CI.
      expect(r.violations.map((v) => `${v.subject}: ${v.message}`)).toEqual([]);
    }
    expect(r.asserted).toBeGreaterThan(0);
  });
});
