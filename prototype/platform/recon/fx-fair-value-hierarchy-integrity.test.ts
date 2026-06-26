// platform/recon/fx-fair-value-hierarchy-integrity.test.ts
//
// Injection tests for recon:fx-fair-value-hierarchy-integrity (F6). The gate MUST
// derive the IFRS 13 level from the FX model's valuation inputs and FAIL closed on
// a declared level that does not match — the PR #643 level-1 mis-tag must not
// re-pass. Also unit-tests the derivation oracle directly.
//
// Author: Vera (Internal-audit engineer, third line) — WS-FX-IFRS-REVIEW-FOUNDATION.

import { describe, expect, test } from "bun:test";

import type { ObservableRef } from "../../v2-core/fil-facets/facets";
import {
  classifyObservable,
  deriveFairValueHierarchy,
  deriveFairValueHierarchyFromObservables,
} from "../../v2-core/fil-models/fx-valuation/fair-value-hierarchy";
import { assertFxFairValueHierarchy } from "./fx-fair-value-hierarchy-integrity";

function fails(r: { ok: boolean; violations: { severity: string; subject: string }[] }): boolean {
  return !r.ok && r.violations.some((v) => v.severity === "fail");
}

describe("IFRS 13 fair-value hierarchy oracle (deriveFairValueHierarchy)", () => {
  test("a spot fixing is an observable market input → Level 2 (§81)", () => {
    const ref: ObservableRef = { observableId: "USD/ZAR", kind: "fixing" };
    expect(classifyObservable(ref)).toBe("observable-market-input");
    expect(deriveFairValueHierarchyFromObservables([ref])).toBe("level-2");
  });

  test("spot fixing + forward-points curve → Level 2 (§81)", () => {
    const refs: ObservableRef[] = [
      { observableId: "USD/ZAR", kind: "fixing" },
      { observableId: "USD/ZAR:fwd-points", kind: "curve" },
    ];
    expect(deriveFairValueHierarchyFromObservables(refs)).toBe("level-2");
  });

  test("a price quoted for the IDENTICAL instrument in an active market → Level 1 (§76)", () => {
    expect(
      deriveFairValueHierarchy([
        classifyObservable({ observableId: "EQ-X", kind: "price" }, /*identical*/ true),
      ]),
    ).toBe("level-1");
  });

  test("a price NOT for the identical instrument (OTC proxy) → Level 2 (§81)", () => {
    expect(classifyObservable({ observableId: "proxy", kind: "price" })).toBe(
      "observable-market-input",
    );
  });

  test("any unobservable significant input drags the measurement to Level 3 (§86)", () => {
    expect(deriveFairValueHierarchy(["observable-market-input", "unobservable"])).toBe("level-3");
  });

  test("an empty input set fails closed (no silent default — §72)", () => {
    expect(() => deriveFairValueHierarchy([])).toThrow(/no valuation inputs/);
  });
});

describe("recon:fx-fair-value-hierarchy-integrity — declared must match derived (F6)", () => {
  test("PASSES the live declarations (FX model + treatment module both level-2)", () => {
    const r = assertFxFairValueHierarchy();
    expect(r.ok).toBe(true);
    // Derives + asserts forward, spot, model, module → ≥3 assertions.
    expect(r.asserted).toBeGreaterThanOrEqual(3);
  });

  test("FAILS a level-1 mis-tag on the FX MODEL (the PR #643 regression)", () => {
    const r = assertFxFairValueHierarchy({ modelDeclaredOverride: "level-1" });
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("model-declared-mismatch"))).toBe(true);
  });

  test("FAILS a level-1 mis-tag on the FX TREATMENT MODULE", () => {
    const r = assertFxFairValueHierarchy({ moduleDeclaredOverride: "level-1" });
    expect(fails(r)).toBe(true);
    expect(r.violations.some((v) => v.subject.includes("module-declared-mismatch"))).toBe(true);
  });

  test("FAILS a level-3 mis-tag (the inputs ARE observable, so level-3 is wrong)", () => {
    const r = assertFxFairValueHierarchy({ moduleDeclaredOverride: "level-3" });
    expect(fails(r)).toBe(true);
  });
});
