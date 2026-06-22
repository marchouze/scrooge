// platform/recon/store-inventory-coverage.test.ts
//
// Sabotage-proof regression for recon:store-inventory-coverage. Plants a
// synthetic un-inventoried BANK_*_DB store-path env var in a tmpdir source tree
// and asserts the gate FAILS — so the gate is load-bearing, not vacuous. Also
// asserts the gate PASSES against the real prototype tree (every store-path env
// var is inventoried today) and that a named non-store env var does not trip it.
//
// Authority: D-BANK-CONFIG-STORE; D-ENGINEERING-INTEGRITY-CHARTER (no green by
// concealment — the gate must be able to fail).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { collectStoreEnvVars, run } from "./store-inventory-coverage";

function makeTree(file: string, contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "store-inv-"));
  const platformDir = join(dir, "platform");
  mkdirSync(platformDir, { recursive: true });
  writeFileSync(join(platformDir, file), contents, "utf-8");
  return dir;
}

describe("collectStoreEnvVars", () => {
  it("discovers BANK_*_DB tokens in a corpus", () => {
    const found = collectStoreEnvVars(
      'const a = process.env.BANK_EVENT_DB; const b = "BANK_FROBNICATE_DB";',
    );
    expect(found.has("BANK_EVENT_DB")).toBe(true);
    expect(found.has("BANK_FROBNICATE_DB")).toBe(true);
  });
});

describe("recon:store-inventory-coverage", () => {
  it("FAILS when an un-inventoried BANK_*_DB env var appears in the tree", () => {
    const dir = makeTree(
      "rogue-store.ts",
      'export const p = process.env.BANK_ROGUE_STORE_DB ?? "/tmp/rogue.db";\n',
    );
    try {
      const r = run({ prototypeDir: dir });
      expect(r.ok).toBe(false);
      expect(
        r.violations.some((v) => v.severity === "fail" && v.subject === "BANK_ROGUE_STORE_DB"),
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does NOT fail on a named non-store BANK_*_DB env var", () => {
    const dir = makeTree("sync.ts", "const h = process.env.BANK_HOME_EVENT_DB;\n");
    try {
      const r = run({ prototypeDir: dir });
      // The reverse (unreferenced-inventory) check still warns since the tmpdir
      // has no real resolvers, but there must be NO fail-severity violation for
      // the explicitly-excluded BANK_HOME_EVENT_DB.
      const fails = r.violations.filter((v) => v.severity === "fail");
      expect(fails).toEqual([]);
      expect(r.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("PASSES against the real prototype tree (every store-path env var inventoried)", () => {
    // recon/ → platform/ → prototype/
    const prototypeDir = resolve(import.meta.dir, "..", "..");
    const r = run({ prototypeDir });
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
