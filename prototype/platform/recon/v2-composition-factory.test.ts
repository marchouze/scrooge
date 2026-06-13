// platform/recon/v2-composition-factory.test.ts
//
// Tests for recon:v2-composition-factory — the S6 composition-factory seam gate
// (WS-V2-BBAAS). The gate asserts the alias resolves and that no v2-core module
// bypasses the seam by importing the concrete factory. These tests assert it
// passes against the real tree, and that the bypass detector actually fires on a
// synthetic bypassing module (so the gate is real, not vacuously green).
//
// Author: Atlas (Substrate Architect, engineering).

import { describe, expect, it } from "bun:test";

import { importsConcreteFactory, runAsync } from "./v2-composition-factory";

describe("recon:v2-composition-factory", () => {
  it("passes against the real v2-core tree (alias resolves; no seam bypass)", async () => {
    const r = await runAsync();
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("asserts the two invariants (alias resolution + seam-bypass scan)", async () => {
    const r = await runAsync();
    expect(r.asserted).toBe(2);
  });

  it("reports the resolved alias implId in asOf", async () => {
    const r = await runAsync();
    expect(r.asOf).toContain("fil-core/default");
    expect(r.asOf).toContain("seam-bypass");
  });

  // The detector must FIRE on a real bypass — otherwise the gate is cosmetic.
  it("flags a direct import of the concrete factory's build/default surface", () => {
    expect(
      importsConcreteFactory(`import { defaultCompositionFactory } from "./composition-factory";`),
    ).toBe(true);
    expect(
      importsConcreteFactory(`import { buildComposite } from "../fil-core/composition-factory";`),
    ).toBe(true);
  });

  it("does NOT flag the sanctioned alias import (the seam itself)", () => {
    expect(
      importsConcreteFactory(`import { buildComposite } from "./composition-factory-alias";`),
    ).toBe(false);
    expect(
      importsConcreteFactory(
        `import { resolveCompositionFactory } from "../fil-core/composition-factory-alias";`,
      ),
    ).toBe(false);
  });

  it("does NOT flag importing only TYPES from the concrete factory (no construction bypass)", () => {
    // Importing the spec/contract types is fine — it is not a construction path.
    expect(
      importsConcreteFactory(
        `import type { CompositeSpec, BuiltComposite } from "./composition-factory";`,
      ),
    ).toBe(false);
  });
});
