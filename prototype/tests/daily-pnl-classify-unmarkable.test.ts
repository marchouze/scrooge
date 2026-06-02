// tests/daily-pnl-classify-unmarkable.test.ts
//
// Tests for `classifyUnmarkable` — splits unmarkable live FX positions into
// "awaiting revaluation" (a production mark exists for the pair) vs "feed
// missing" (no production tick at all), so the product-control banner can show
// an honest cause instead of always asserting "MTM feed required".
//
// Authority: D-FX-MTM-REVAL-ON-BOOKING; D-TRUSTED-FIGURES-PROGRAM-V1.
// Author: Rohan (Market risk engineer, engineering).

import { describe, expect, it } from "bun:test";

import { type TradeDetailRow, classifyUnmarkable } from "../platform/product-control/daily-pnl";

/** Minimal row — classifyUnmarkable only reads tradeId + pair. */
function row(tradeId: string, pair: string): TradeDetailRow {
  return { tradeId, pair } as TradeDetailRow;
}

const trades = [row("T-USDZAR", "USD/ZAR"), row("T-GBPUSD", "GBP/USD"), row("T-EXOTIC", "TRY/ZAR")];

describe("classifyUnmarkable", () => {
  it("routes pairs WITH a production mark to awaitingReval", () => {
    const b = classifyUnmarkable(["T-USDZAR"], trades, () => true);
    expect(b.count).toBe(1);
    expect(b.awaitingReval).toEqual({
      count: 1,
      tradeIds: ["T-USDZAR"],
      pairs: ["USD/ZAR"],
    });
    expect(b.feedMissing.count).toBe(0);
  });

  it("routes pairs with NO production mark to feedMissing", () => {
    const b = classifyUnmarkable(["T-EXOTIC"], trades, () => false);
    expect(b.feedMissing).toEqual({
      count: 1,
      tradeIds: ["T-EXOTIC"],
      pairs: ["TRY/ZAR"],
    });
    expect(b.awaitingReval.count).toBe(0);
  });

  it("splits a mixed set by the probe and dedupes/sorts pairs", () => {
    const hasMark = (pair: string) => pair !== "TRY/ZAR"; // only the exotic lacks a feed
    const b = classifyUnmarkable(["T-USDZAR", "T-GBPUSD", "T-EXOTIC"], trades, hasMark);
    expect(b.count).toBe(3);
    expect(b.awaitingReval.count).toBe(2);
    expect(b.awaitingReval.pairs).toEqual(["GBP/USD", "USD/ZAR"]); // sorted
    expect(b.feedMissing.count).toBe(1);
    expect(b.feedMissing.pairs).toEqual(["TRY/ZAR"]);
  });

  it("treats an unresolvable tradeId conservatively as feed-missing", () => {
    const b = classifyUnmarkable(["T-UNKNOWN"], trades, () => true);
    expect(b.feedMissing.count).toBe(1);
    expect(b.feedMissing.tradeIds).toEqual(["T-UNKNOWN"]);
    expect(b.feedMissing.pairs).toEqual([]); // no pair could be resolved
    expect(b.awaitingReval.count).toBe(0);
  });
});
