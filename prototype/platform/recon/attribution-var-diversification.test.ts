// platform/recon/attribution-var-diversification.test.ts
//
// Tests for recon:attribution-var-diversification (V2 A3).
//
// The structural halves (no-sum on the real metric; additive P&L control) run
// even on a flat book; the diversification + v1-parity halves downgrade to info
// when there is nothing to diversify or reconcile. The non-vacuous
// diversification proof itself is exercised at the unit level in the model test
// (market-risk-var.test.ts) and end-to-end against the live store by the gate's
// own `import.meta.main` run.
//
// Author: Atlas (Core banking platform architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { describe, expect, test } from "bun:test";
import { MarketDataStore } from "../market-data/store";
import { run } from "./attribution-var-diversification";

// An in-memory market-data store (no DB) — a flat synthetic book never reaches a
// quote lookup, so the empty store is sufficient.
const EMPTY_MD = new MarketDataStore(":memory:");

describe("recon:attribution-var-diversification", () => {
  test("no-sum (a) + additive control (d) run on a flat book; (b)/(c) → fail when events injected", () => {
    const r = run({ events: [], marketData: EMPTY_MD });
    // With an explicit events override, a flat bench is a fail (a populated book
    // is expected when a test injects events) — mirrors fx-book-nop-parity.
    expect(r.ok).toBe(false);
    // The structural no-sum assertions ran (a) — at least 2 (assertNoSum +
    // sumChildren) + the additive control (d).
    expect(r.asserted).toBeGreaterThanOrEqual(3);
    // No no-sum violation: the VaR metric IS joint-recompute (the guard holds).
    expect(r.violations.some((v) => v.severity === "fail" && v.subject === "market-risk-var")).toBe(
      false,
    );
  });

  test("default (live store) run never throws and produces a structured result", () => {
    // No events override → reads whatever store composition resolved (often a
    // flat/local store in unit-test context; the populated-book path is exercised
    // by the gate's CLI run against the shared store). The gate must not throw
    // and must report a structured result with the pipeline asOf string.
    const r = run({});
    expect(typeof r.ok).toBe("boolean");
    expect(r.asOf).toContain("attribution-var-diversification");
    // The no-sum guard must hold regardless of book state.
    expect(r.violations.some((v) => v.severity === "fail" && v.subject === "market-risk-var")).toBe(
      false,
    );
  });
});
