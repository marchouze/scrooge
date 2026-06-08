// runtime/agents/rohan-market-risk-measure.test.ts
//
// Tests for the daily market-risk-measure handler core
// (computeAndEmitMarketRiskMeasure) — FX functionality domain review gap #4.
//
// Driven against isolated in-memory stores (EventStore + MarketDataStore) so
// the assertions do not depend on the composition singleton. The handler's
// idempotency contract — one MarketRiskMeasureComputed per entity per UTC day —
// is the load-bearing property the scheduled cadence relies on (a same-day
// re-run, e.g. a workflow retry, must not double-emit).
//
// Author: Rohan (Risk engineer, engineering).

import { describe, expect, it } from "bun:test";

import { EventStore } from "../../platform/event-store/store";
import { MarketDataStore } from "../../platform/market-data/store";
import { computeAndEmitMarketRiskMeasure, marketRiskMeasureId } from "./rohan-market-risk-measure";

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-06-08T18:30:00.000Z"; // Monday, post-close cadence

function stores(): { store: EventStore; md: MarketDataStore } {
  return { store: new EventStore(":memory:"), md: new MarketDataStore(":memory:") };
}

function countMeasures(store: EventStore): number {
  return [...store.replay({ type: "MarketRiskMeasureComputed" })].length;
}

describe("rohan:market-risk-measure — daily VaR / MR-1-FX core", () => {
  it("emits exactly one MarketRiskMeasureComputed on a fresh store", () => {
    const { store, md } = stores();
    const r = computeAndEmitMarketRiskMeasure({ store, marketData: md, asOf: AS_OF });
    expect(r.emitted).toBe(true);
    expect(r.measureId).toBe(marketRiskMeasureId(ENTITY, AS_OF));
    expect(countMeasures(store)).toBe(1);
  });

  it("is idempotent — a same-day re-run does NOT double-emit", () => {
    const { store, md } = stores();
    const first = computeAndEmitMarketRiskMeasure({ store, marketData: md, asOf: AS_OF });
    expect(first.emitted).toBe(true);

    // Re-run with the SAME as-of day (e.g. a workflow retry).
    const second = computeAndEmitMarketRiskMeasure({ store, marketData: md, asOf: AS_OF });
    expect(second.emitted).toBe(false);
    expect(second.status).toBe("skipped-idempotent");

    // A later timestamp on the SAME UTC day is still the same measureId → no-op.
    const sameDayLater = computeAndEmitMarketRiskMeasure({
      store,
      marketData: md,
      asOf: "2026-06-08T23:59:59.000Z",
    });
    expect(sameDayLater.emitted).toBe(false);

    expect(countMeasures(store)).toBe(1);
  });

  it("emits a new measure on the next UTC day", () => {
    const { store, md } = stores();
    computeAndEmitMarketRiskMeasure({ store, marketData: md, asOf: AS_OF });
    const nextDay = computeAndEmitMarketRiskMeasure({
      store,
      marketData: md,
      asOf: "2026-06-09T18:30:00.000Z",
    });
    expect(nextDay.emitted).toBe(true);
    expect(countMeasures(store)).toBe(2);
  });

  it("surfaces a loud status on a flat book — never a silent zero", () => {
    const { store, md } = stores();
    const r = computeAndEmitMarketRiskMeasure({ store, marketData: md, asOf: AS_OF });
    // Empty event store ⇒ no open positions ⇒ no-positions status + absent VaR.
    expect(r.status).toBe("no-positions");
    expect(r.varSummary).toContain("absent");
  });

  it("measureId is one-per-entity-per-UTC-day", () => {
    expect(marketRiskMeasureId(ENTITY, "2026-06-08T18:30:00.000Z")).toBe(
      "MR-MEASURE-LE-ZA-HOZ-BANK-2026-06-08",
    );
    expect(marketRiskMeasureId(ENTITY, "2026-06-08T18:30:00.000Z")).toBe(
      marketRiskMeasureId(ENTITY, "2026-06-08T23:00:00.000Z"),
    );
  });
});
