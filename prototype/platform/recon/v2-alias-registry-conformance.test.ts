// platform/recon/v2-alias-registry-conformance.test.ts
//
// Tests for recon:v2-alias-registry-conformance — the shared FIL alias-registry
// conformance gate (WS-V2-BBAAS). Asserts the gate passes against the real tree
// (both seams resolve; no ad-hoc singleton), and that the ad-hoc-singleton
// detector actually FIRES on a synthetic offender (so the gate is real, not
// vacuously green). Authority: D-FIL-SHARED-ALIAS-REGISTRY.
//
// Author: Atlas (Substrate Architect, engineering).

import { describe, expect, it } from "bun:test";

import {
  importsSharedRegistry,
  mintsAdHocAliasSingleton,
  runAsync,
} from "./v2-alias-registry-conformance";

describe("recon:v2-alias-registry-conformance", () => {
  it("passes against the real v2-core tree (both seams resolve; no ad-hoc singleton)", async () => {
    const r = await runAsync();
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("asserts the three invariants (composition-factory + sa-ccr resolution + singleton scan)", async () => {
    const r = await runAsync();
    expect(r.asserted).toBe(3);
  });

  it("reports both resolved seams in asOf", async () => {
    const r = await runAsync();
    expect(r.asOf).toContain("fil-core:composition-factory=");
    expect(r.asOf).toContain("fil-models:sa-ccr=");
  });

  it("recognises an import from the shared alias-registry", () => {
    expect(importsSharedRegistry(`import { resolveAlias } from "./alias-registry";`)).toBe(true);
    expect(
      importsSharedRegistry(
        `import { registerAlias, swapAlias } from "../../fil-core/alias-registry";`,
      ),
    ).toBe(true);
    expect(importsSharedRegistry(`import { foo } from "./something-else";`)).toBe(false);
  });

  // The detector must FIRE on a real ad-hoc singleton — otherwise the gate is cosmetic.
  // Fixtures use column-0 (module-scope) declarations, exactly as a real
  // v2-core module would — the detector keys on a top-level mutable.
  it("flags a module that mints its own swap singleton without the shared registry", () => {
    const adHoc = [
      "let registered = defaultImpl;",
      "export function registerThing(impl) {",
      "  const previous = registered;",
      "  registered = impl;",
      "  return { restore() { registered = previous; } };",
      "}",
      "export function resolveThing() { return registered; }",
    ].join("\n");
    expect(mintsAdHocAliasSingleton(adHoc)).toBe(true);
  });

  it("does NOT flag a conformant seam that delegates to the shared registry", () => {
    const conformant = [
      'import { swapAlias, resolveAlias } from "../../fil-core/alias-registry";',
      "export function registerThing(impl) {",
      '  return swapAlias("x:y", impl); // returns a restore() handle from the registry',
      "}",
      'export function resolveThing() { return resolveAlias("x:y"); }',
    ].join("\n");
    // Imports the shared registry → conformant by construction, even though the
    // swapAlias contract surfaces a restore() handle.
    expect(mintsAdHocAliasSingleton(conformant)).toBe(false);
  });

  it("does NOT flag a module with a mutable but no swap/restore surface", () => {
    const benign = [
      "let counter = 0;",
      "export function tick() { counter += 1; return counter; }",
    ].join("\n");
    expect(mintsAdHocAliasSingleton(benign)).toBe(false);
  });
});
