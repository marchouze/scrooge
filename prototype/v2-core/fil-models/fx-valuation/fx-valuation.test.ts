// v2-core/fil-models/fx-valuation/fx-valuation.test.ts
//
// Unit tests for the FX Valuable + FCY-cash FIL-Models + the fx-pnl metric (A2).
//
// THE LOAD-BEARING TEST is `settlement-continuity` — value_pre == value_post on
// the settlement date at the settlement-date closing rate, shown to be
// STRUCTURAL (value() takes no lifecycle input). The recon gate
// `recon:fx-settlement-continuity` asserts the same property over the full
// anchor history; this unit test pins it at the model level.
//
// Author: Atlas (Core banking platform architect, engineering) ·
//         Bea (Accounting & financial reporting engineer, engineering).

import { describe, expect, test } from "bun:test";
import { MetricRegistry, type SliceMember } from "../../fil-attribution";
import type { Instant } from "../../fil-core/primitives";
import type { FilInstanceUrn } from "../../fil-core/urn";
import type { MarketDataSlice } from "../../fil-facets/facets";
import {
  FCY_CASH_MODEL_DECLARATION,
  FX_MODEL_DECLARATION,
  FX_PNL_METRIC_ID,
  FX_TRADING_SLICE_ID,
  fcyCashFromSettledReceivable,
  fcyCashValuable,
  fxPnlMetric,
  fxResolvesForScope,
  fxScopePatternsValid,
  fxTradingSliceDefinition,
  fxValuable,
  registerFxPnlMetric,
} from "./index";

function marks(
  observables: Record<string, number>,
  asOf = "2026-06-13T00:00:00.000Z",
): MarketDataSlice {
  return { asOf: asOf as Instant, observables };
}

const ASOF = "2026-06-13T00:00:00.000Z" as Instant;

describe("FX Valuable FIL-Model", () => {
  test("declares Valuable + Accountable over fil:type:fx:*", () => {
    expect(FX_MODEL_DECLARATION.implementsFacets).toContain("Valuable");
    expect(FX_MODEL_DECLARATION.implementsFacets).toContain("Accountable");
    expect(FX_MODEL_DECLARATION.scope as readonly string[]).toContain("fil:type:fx:*");
    expect(fxScopePatternsValid()).toBe(true);
    expect(fxResolvesForScope("fil:type:fx:spot:otc-vanilla@1.0")).toBe(true);
    expect(fxResolvesForScope("fil:type:ir:swap:vanilla@1.0")).toBe(false);
  });

  test("valuationMethod is mark-to-market", () => {
    const v = fxValuable({ currency: "USD", signedNotionalMinor: 100_00n, isForward: false });
    expect(v.valuationMethod()).toBe("mark-to-market");
  });

  test("spot value = notional × spot rate, in reporting minor units", () => {
    // 1,000.00 USD long, USD/ZAR = 18.50 → 18,500.00 ZAR.
    const v = fxValuable({ currency: "USD", signedNotionalMinor: 100_000n, isForward: false });
    const rec = v.value(marks({ "USD/ZAR": 18.5 }), ASOF);
    expect(rec.value.currency).toBe("ZAR");
    expect(rec.value.minorUnits).toBe(1_850_000n);
    expect(rec.observablesUsed.map((o) => o.observableId)).toEqual(["USD/ZAR"]);
  });

  test("short position values negative", () => {
    const v = fxValuable({ currency: "USD", signedNotionalMinor: -100_000n, isForward: false });
    const rec = v.value(marks({ "USD/ZAR": 18.5 }), ASOF);
    expect(rec.value.minorUnits).toBe(-1_850_000n);
  });

  test("forward adds forward points to the spot rate", () => {
    // spot 18.50 + 0.25 points = 18.75 all-in.
    const v = fxValuable({ currency: "USD", signedNotionalMinor: 100_000n, isForward: true });
    const rec = v.value(marks({ "USD/ZAR": 18.5, "USD/ZAR:fwd-points": 0.25 }), ASOF);
    expect(rec.value.minorUnits).toBe(1_875_000n);
    expect(rec.observablesUsed.map((o) => o.observableId)).toEqual([
      "USD/ZAR",
      "USD/ZAR:fwd-points",
    ]);
  });

  test("missing spot observable is a hard error", () => {
    const v = fxValuable({ currency: "USD", signedNotionalMinor: 100_000n, isForward: false });
    expect(() => v.value(marks({}), ASOF)).toThrow(/missing required spot observable/);
  });
});

describe("FCY-cash monetary Valuable FIL-Model", () => {
  test("declares Valuable + Accountable; recognised at settlement-date carrying amount", () => {
    expect(FCY_CASH_MODEL_DECLARATION.implementsFacets).toContain("Valuable");
    const pos = fcyCashFromSettledReceivable({ currency: "USD", signedNotionalMinor: 100_000n });
    // The FCY balance is the receivable's OWN notional (not a pre-converted cost).
    expect(pos.balanceMinor).toBe(100_000n);
    const rec = fcyCashValuable(pos).value(marks({ "USD/ZAR": 18.5 }), ASOF);
    expect(rec.value.minorUnits).toBe(1_850_000n);
  });
});

describe("settlement-continuity invariant (THE A2 proof)", () => {
  test("value_pre (FX position) == value_post (FCY cash) at the settlement-date rate", () => {
    // An FX position: long 1,000.00 USD. Settlement-date closing rate USD/ZAR = 19.10.
    const settlementRate = 19.1;
    const notional = 100_000n;

    const positionPre = fxValuable({
      currency: "USD",
      signedNotionalMinor: notional,
      isForward: false,
    });
    const valuePre = positionPre.value(marks({ "USD/ZAR": settlementRate }), ASOF).value;

    // On settlement the receivable is derecognised → FCY cash at the settlement-
    // date carrying amount (the same notional).
    const cash = fcyCashFromSettledReceivable({ currency: "USD", signedNotionalMinor: notional });
    const valuePost = fcyCashValuable(cash).value(marks({ "USD/ZAR": settlementRate }), ASOF).value;

    expect(valuePost.currency).toBe(valuePre.currency);
    expect(valuePost.minorUnits).toBe(valuePre.minorUnits);
  });

  test("the invariant is STRUCTURAL — value() exposes no lifecycle input", () => {
    // The Valuable.value signature is (marks, asOf) — there is no lifecycle/stage
    // argument. The pre/post equality therefore cannot depend on a lifecycle
    // branch; it is a property of the type. We assert it across a sweep of rates.
    const notional = 250_000n;
    for (const rate of [0.0001, 1, 13.37, 18.5, 19.1, 100]) {
      const pre = fxValuable({
        currency: "USD",
        signedNotionalMinor: notional,
        isForward: false,
      }).value(marks({ "USD/ZAR": rate }), ASOF).value;
      const post = fcyCashValuable(
        fcyCashFromSettledReceivable({ currency: "USD", signedNotionalMinor: notional }),
      ).value(marks({ "USD/ZAR": rate }), ASOF).value;
      expect(post.minorUnits).toBe(pre.minorUnits);
    }
  });
});

describe("fx-pnl additive AttributionMetric + book:fx-trading slice", () => {
  function mkMember(
    urn: string,
    stage: "active" | "settled",
    valuable: ReturnType<typeof fxValuable>,
  ): SliceMember {
    return {
      instanceUrn: urn as FilInstanceUrn,
      stage,
      facets: { Valuable: valuable },
    };
  }

  test("metric is additive and reads only the Valuable facet", () => {
    expect(fxPnlMetric.metricId).toBe(FX_PNL_METRIC_ID);
    expect(fxPnlMetric.aggregation.mode).toBe("additive");
    expect(fxPnlMetric.readsFacets).toEqual(["Valuable"]);
    expect(fxPnlMetric.stageScope("active")).toBe(true);
    expect(fxPnlMetric.stageScope("settled")).toBe(true);
    expect(fxPnlMetric.stageScope("cancelled")).toBe(false);
  });

  test("book P&L = Σ member value over active + settled members", () => {
    const k = marks({ "USD/ZAR": 18.5, "EUR/ZAR": 20.0 });
    const members: SliceMember[] = [
      // active FX position: +1,000.00 USD → +18,500.00 ZAR
      mkMember(
        "fil:inst:tenant-za:p1",
        "active",
        fxValuable({ currency: "USD", signedNotionalMinor: 100_000n, isForward: false }),
      ),
      // settled FCY cash: +500.00 EUR → +10,000.00 ZAR
      mkMember(
        "fil:inst:tenant-za:c1",
        "settled",
        fcyCashValuable(
          fcyCashFromSettledReceivable({ currency: "EUR", signedNotionalMinor: 50_000n }),
        ) as ReturnType<typeof fxValuable>,
      ),
    ];
    const pnl = fxPnlMetric.evaluate(members, k, ASOF);
    expect(pnl.currency).toBe("ZAR");
    expect(pnl.minorUnits).toBe(1_850_000n + 1_000_000n);
  });

  test("children-sum == joint recompute (additivity)", () => {
    const k = marks({ "USD/ZAR": 18.5, "EUR/ZAR": 20.0, "GBP/ZAR": 23.0 });
    const a = mkMember(
      "fil:inst:t:a",
      "active",
      fxValuable({ currency: "USD", signedNotionalMinor: 100_000n, isForward: false }),
    );
    const b = mkMember(
      "fil:inst:t:b",
      "active",
      fxValuable({ currency: "EUR", signedNotionalMinor: 50_000n, isForward: false }),
    );
    const c = mkMember(
      "fil:inst:t:c",
      "active",
      fxValuable({ currency: "GBP", signedNotionalMinor: -30_000n, isForward: false }),
    );
    const joint = fxPnlMetric.evaluate([a, b, c], k, ASOF);
    const left = fxPnlMetric.evaluate([a, b], k, ASOF);
    const right = fxPnlMetric.evaluate([c], k, ASOF);
    const summed = fxPnlMetric.aggregation.add(left, right);
    expect(summed.minorUnits).toBe(joint.minorUnits);
  });

  test("registers into a metric registry idempotently", () => {
    const reg = new MetricRegistry();
    registerFxPnlMetric(reg);
    registerFxPnlMetric(reg); // idempotent — no throw
    expect(reg.has(FX_PNL_METRIC_ID)).toBe(true);
  });

  test("slice definition is the book:fx-trading stored predicate", () => {
    const def = fxTradingSliceDefinition("tenant:za-bank");
    expect(def.kind).toBe("SliceDefined");
    expect(def.sliceId).toBe(FX_TRADING_SLICE_ID);
    expect(def.where).toEqual([{ dim: "book", op: "eq", value: "fx-trading" }]);
    expect(def.level).toBe("leaf");
  });
});
