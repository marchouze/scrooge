// platform/recon/fx-pair-canonical-aggregation.test.ts
//
// Unit tests for the `fx-pair-canonical-aggregation` recon — driven by
// injected sources so no live event-store dependency.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { describe, expect, it } from "bun:test";

import type { PnLByPair } from "../event-store/event-types/product-control";
import { assertNoCanonicalInverse, run } from "./fx-pair-canonical-aggregation";

function row(pair: string, n = 1): PnLByPair {
  return {
    pair,
    tradeCount: n,
    unrealisedPnlZarMinor: 0,
    realisedPnlZarMinor: 0,
  };
}

describe("assertNoCanonicalInverse", () => {
  it("empty array: no violations", () => {
    expect(assertNoCanonicalInverse([], "test")).toHaveLength(0);
  });

  it("single bucket: no violations", () => {
    expect(assertNoCanonicalInverse([row("USD/ZAR")], "test")).toHaveLength(0);
  });

  it("distinct pairs (no inverses): no violations", () => {
    expect(
      assertNoCanonicalInverse([row("USD/ZAR"), row("EUR/USD"), row("GBP/USD")], "test"),
    ).toHaveLength(0);
  });

  it("flags USD/ZAR + ZAR/USD coexistence (default severity: fail)", () => {
    const violations = assertNoCanonicalInverse([row("USD/ZAR"), row("ZAR/USD")], "test");
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe("fail");
    expect(violations[0]?.message).toContain("USD/ZAR");
    expect(violations[0]?.message).toContain("ZAR/USD");
  });

  it("respects explicit severity: info (used for immutable historical events)", () => {
    const violations = assertNoCanonicalInverse([row("USD/ZAR"), row("ZAR/USD")], "test", "info");
    expect(violations).toHaveLength(1);
    expect(violations[0]?.severity).toBe("info");
  });

  it("dedupes a single inverse-pair to one violation", () => {
    // Same coexistence reported only once even though both orientations exist.
    const violations = assertNoCanonicalInverse([row("EUR/USD"), row("USD/EUR")], "test");
    expect(violations).toHaveLength(1);
  });

  it("flags multiple independent inverse pairs separately", () => {
    const violations = assertNoCanonicalInverse(
      [row("USD/ZAR"), row("ZAR/USD"), row("EUR/USD"), row("USD/EUR")],
      "test",
    );
    expect(violations).toHaveLength(2);
  });

  it("does not flag a pair that has no inverse in the bucket", () => {
    // ZAR/USD exists, USD/ZAR does not → no coexistence, no violation.
    // (This is a clean canonical bucket; might fail the wire-convention
    // advisory recon but not this one.)
    expect(assertNoCanonicalInverse([row("ZAR/USD")], "test")).toHaveLength(0);
  });

  it("does not flag self-inverse pseudo-pairs (malformed input)", () => {
    // Degenerate "X/X" — invertPair() returns the same string; we must
    // not flag this as inverse-coexistence (the bug here is different).
    expect(assertNoCanonicalInverse([row("USD/USD")], "test")).toHaveLength(0);
  });
});

describe("run() — pipeline assertions", () => {
  it("empty state: no events and no live bucket → asserted=0, ok=true", () => {
    // Both injections undefined + skipLiveRecompute true → nothing to assert.
    const r = run({
      pnlReportEvents: [],
      skipLiveRecompute: true,
    });
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("empty live bucket (explicit injection): asserts the empty array → ok=true", () => {
    const r = run({
      pnlReportEvents: [],
      liveByPair: [],
      skipLiveRecompute: true,
    });
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("clean live bucket: ok=true", () => {
    const r = run({
      pnlReportEvents: [],
      liveByPair: [row("USD/ZAR"), row("EUR/USD")],
      skipLiveRecompute: true,
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(1);
    expect(r.violations).toHaveLength(0);
  });

  it("dirty live bucket: fails", () => {
    const r = run({
      pnlReportEvents: [],
      liveByPair: [row("USD/ZAR"), row("ZAR/USD")],
      skipLiveRecompute: true,
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  it("dirty historical report: surfaces as info (Principle 1 — events immutable), ok stays true", () => {
    const r = run({
      pnlReportEvents: [
        {
          event_id: "evt:test:1",
          as_of: "2026-05-21",
          payload: {
            reportId: "pnl:2026-05-21:abc",
            reportDate: "2026-05-21",
            byPair: [row("USD/ZAR"), row("ZAR/USD")],
          },
        },
      ],
      liveByPair: [],
      skipLiveRecompute: true,
    });
    expect(r.ok).toBe(true); // info findings don't fail the gate
    expect(r.asserted).toBe(2); // 1 live (empty) + 1 historical
    expect(r.violations.some((v) => v.message.includes("USD/ZAR"))).toBe(true);
    expect(r.violations.every((v) => v.severity === "info")).toBe(true);
  });

  it("multiple historical reports each asserted independently as info", () => {
    const r = run({
      pnlReportEvents: [
        {
          event_id: "evt:test:1",
          as_of: "2026-05-20",
          payload: { reportId: "pnl:1", byPair: [row("USD/ZAR")] }, // clean
        },
        {
          event_id: "evt:test:2",
          as_of: "2026-05-21",
          payload: { reportId: "pnl:2", byPair: [row("USD/ZAR"), row("ZAR/USD")] }, // dirty
        },
      ],
      liveByPair: [],
      skipLiveRecompute: true,
    });
    expect(r.asserted).toBe(3); // 1 live (empty) + 2 historical
    expect(r.ok).toBe(true); // historical findings are info, not fail
    expect(r.violations.filter((v) => v.severity === "info")).toHaveLength(1);
    expect(r.violations[0]?.subject).toContain("pnl:2");
  });
});
