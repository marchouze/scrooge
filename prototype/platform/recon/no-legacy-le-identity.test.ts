// platform/recon/no-legacy-le-identity.test.ts
//
// Coverage for the SOURCE-TREE scan added to recon:no-legacy-le-identity under
// D-NPA-PAGE-DE-INVENTION. Proves:
//   1. The real source trees (platform/markets/products/**, dashboard/**) are
//      clean — no legacy entity-id literal.
//   2. A planted legacy literal in a fixture source tree trips the scan.
//
// Author: Atlas (Core banking platform architect, engineering)

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { scanSourceTrees } from "./no-legacy-le-identity";

describe("recon:no-legacy-le-identity — source scan", () => {
  it("the real source trees carry no legacy entity-id literal", () => {
    const violations = scanSourceTrees();
    expect(violations).toHaveLength(0);
  });

  describe("with a fixture tree", () => {
    let root: string;

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), "le-scan-"));
    });
    afterEach(() => {
      rmSync(root, { recursive: true, force: true });
    });

    it("trips on a planted LE-BANK-SA literal under platform/markets/products", () => {
      const dir = join(root, "platform", "markets", "products");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "bad.ts"), 'export const e = "LE-BANK-SA";\n');
      const violations = scanSourceTrees(root);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.severity).toBe("fail");
      expect(violations[0]?.subject).toContain("LE-BANK-SA");
    });

    it("trips on a planted BANK-ZA-001 literal under dashboard", () => {
      const dir = join(root, "dashboard");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "bad.ts"), 'const x = "BANK-ZA-001";\n');
      const violations = scanSourceTrees(root);
      expect(violations.some((v) => v.subject.includes("BANK-ZA-001"))).toBe(true);
    });

    it("a clean fixture tree produces no violation", () => {
      const dir = join(root, "dashboard");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "ok.ts"), 'const x = "LE-ZA-HOZ-BANK";\n');
      expect(scanSourceTrees(root)).toHaveLength(0);
    });
  });
});
