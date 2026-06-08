// tests/rohan-bond-mtm.test.ts
//
// Unit tests for runEodBondRevaluation — the EOD bond mark-to-market engine
// wired into Rohan's daily-mtm run (BND-1).
//
// Cases:
//   TC-1: Happy path — a trading-book BondTradeExecuted + a jse-debt price tick
//         → exactly one BondPositionRevalued is emitted for that tradeId.
//   TC-2: Idempotency — second call for the same (tradeId, revalDate) produces
//         no additional BondPositionRevalued for that tradeId.
//   TC-3: Banking-book bonds are excluded (amortised-cost, IFRS 9 §4.1.2).
//   TC-4: No price tick available → zero BondPositionRevalued for the tradeId,
//         descriptive skip reason added to skipReasons.
//   TC-5: Matured bond (maturityDate ≤ revalDate) is excluded.
//   TC-6: BondSold closes the position; no reval emitted for that tradeId.
//   TC-7: P&L sign — price rises → gain (positive unrealisedPnlZarMinor) for buy.
//   TC-8: P&L sign — price falls → gain (positive unrealisedPnlZarMinor) for sell.
//   TC-9: Simulated tick used as fallback when no production tick exists.
//
// Note on shared eventStore: each test uses a globally-unique tradeId and a
// globally-unique revalDate so that prior-test events do not interfere with
// per-tradeId assertions. Aggregate result.revalued counts are NOT asserted
// (they accumulate across the shared event store within the file's process).
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION; IFRS-9-§5.7.1; JSE-RULES-BONDS.
// Author: Rohan (Market risk engineer, engineering)

import { describe, expect, it } from "bun:test";

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import {
  makeBondSold,
  makeBondTradeExecuted,
} from "../platform/event-store/event-types/bond-accounting";
import { MarketDataStore } from "../platform/market-data/store";
import { runEodBondRevaluation } from "../platform/markets/eod/bond-revaluation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { id: "rohan:test", type: "service" as const };
const CITATIONS = ["IFRS-9-§5.7.1", "D-MARKETS-SCHEMA-FOUNDATION"];

// R186 — SA Govt 10.5% due 2026-12-21 (still live as of all test dates)
const ISIN_R186 = "ZAG000030108";
// R2030 — SA Govt 7.75% due 2030-01-31
const ISIN_R2030 = "ZAG000057547";

/** A simple bond trade for the given tradeId and ISIN. */
function makeTrade(
  tradeId: string,
  isin: string,
  opts: {
    portfolio?: "trading-book" | "banking-book";
    side?: "buy" | "sell";
    nominalMinor?: number;
    cleanPricePercent?: number;
    dirtyPricePercent?: number;
    maturityDate?: string;
    asOf?: string;
  } = {},
) {
  const portfolio = opts.portfolio ?? "trading-book";
  const side = opts.side ?? "buy";
  const nominalMinor = opts.nominalMinor ?? 10_000_000_00; // R10m nominal (in ZAR cents)
  const cleanPricePercent = opts.cleanPricePercent ?? 101.5;
  const dirtyPricePercent = opts.dirtyPricePercent ?? 101.8;
  const maturityDate = opts.maturityDate ?? "2026-12-21";
  const asOf = opts.asOf ?? "2026-05-28T10:00:00.000Z";
  return makeBondTradeExecuted({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      tradeId,
      bondIsin: isin,
      side,
      nominalMinor,
      cleanPricePercent,
      accruedInterestMinor: 100_00, // 100 ZAR cents (stub)
      dirtyPricePercent,
      settlementDate: "2026-05-31",
      portfolio,
      couponRate: 0.105,
      maturityDate,
      currency: "ZAR",
      counterpartyLei: "TEST-LEI-001",
      executedAt: asOf,
    },
    eventId: newEventId(),
  });
}

/** Append a jse-debt production tick for the given ISIN + cleanPrice. */
function seedProductionTick(
  mdStore: MarketDataStore,
  isin: string,
  cleanPrice: string,
  date: string,
) {
  mdStore.append({
    id: `JSE:BOND:${isin}:${date}`,
    source: "jse-debt",
    instrument: isin,
    dataType: "bond-price",
    provenance: "production",
    asOf: `${date}T17:00:00+02:00`,
    payload: {
      cleanPrice,
      yieldToMaturity: "0.0800",
      bondCode: "R186",
      fixingVariant: "build-phase-fixture",
    },
  });
}

/** Append a simulated (bond-sim) tick for the given ISIN + cleanPrice. */
function seedSimulatedTick(
  mdStore: MarketDataStore,
  isin: string,
  cleanPrice: string,
  date: string,
) {
  mdStore.append({
    id: `SIM:BOND:${isin}:${date}`,
    source: "bond-sim",
    instrument: isin,
    dataType: "bond-price",
    provenance: "simulated",
    asOf: `${date}T12:00:00+02:00`,
    payload: {
      cleanPrice,
      yieldToMaturity: "0.0800",
      bondCode: "R186",
      fixingVariant: "simulated-walk",
    },
  });
}

/** Find all BondPositionRevalued events for a given tradeId (+ optional revalDate). */
function revalEventsFor(tradeId: string, revalDate?: string) {
  return [...eventStore.replay({ type: "BondPositionRevalued" })].filter((e) => {
    const p = e.payload as { tradeId: string; revalDate: string };
    return p.tradeId === tradeId && (revalDate === undefined || p.revalDate === revalDate);
  });
}

// ---------------------------------------------------------------------------
// TC-1: Happy path — BondPositionRevalued emitted with correct fields
// ---------------------------------------------------------------------------

describe("TC-1: happy path — BondPositionRevalued emitted for trading-book position", () => {
  it("emits one BondPositionRevalued for the tradeId with correct payload fields", () => {
    const mdStore = new MarketDataStore(":memory:");
    // Use a date well before R186 maturity (2026-12-21). Each TC uses a
    // unique revalDate so idempotency gating does not cross test boundaries.
    const revalDate = "2026-06-10";
    const tradeId = "BND-TEST-001";

    eventStore.append(
      makeTrade(tradeId, ISIN_R186, { cleanPricePercent: 101.5, dirtyPricePercent: 101.8 }),
    );
    seedProductionTick(mdStore, ISIN_R186, "102.00", revalDate);

    const result = runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );

    expect(result.errors).toHaveLength(0);

    // Per-tradeId assertion — not aggregate (shared event store across TCs).
    const events = revalEventsFor(tradeId, revalDate);
    expect(events).toHaveLength(1);

    const payload = events[0]?.payload as {
      tradeId: string;
      bondIsin: string;
      revalDate: string;
      bookCleanPricePercent: number;
      currentCleanPricePercent: number;
      unrealisedPnlZarMinor: number;
      currency: string;
    };
    expect(payload.tradeId).toBe(tradeId);
    expect(payload.bondIsin).toBe(ISIN_R186);
    expect(payload.revalDate).toBe(revalDate);
    expect(payload.bookCleanPricePercent).toBe(101.5);
    expect(payload.currentCleanPricePercent).toBe(102.0);
    expect(payload.currency).toBe("ZAR");
    // Price rose (102 > 101.5) → gain for a buy position.
    expect(payload.unrealisedPnlZarMinor).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TC-2: Idempotency — second call same date produces no additional event
// ---------------------------------------------------------------------------

describe("TC-2: idempotency — no duplicate BondPositionRevalued for the same date", () => {
  it("second run on same revalDate is a no-op for already-revalued position", () => {
    const mdStore = new MarketDataStore(":memory:");
    const revalDate = "2026-06-11"; // unique date for this TC (before R186 maturity)
    const tradeId = "BND-IDEM-002";

    eventStore.append(makeTrade(tradeId, ISIN_R186));
    seedProductionTick(mdStore, ISIN_R186, "101.5", revalDate);

    // First run — should emit one event for this tradeId.
    runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );
    expect(revalEventsFor(tradeId, revalDate)).toHaveLength(1);

    // Second run — same date; this tradeId should NOT get a second event.
    runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );
    expect(revalEventsFor(tradeId, revalDate)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TC-3: Banking-book bonds excluded
// ---------------------------------------------------------------------------

describe("TC-3: banking-book bonds excluded from FVTPL revaluation", () => {
  it("emits no BondPositionRevalued for a banking-book position", () => {
    const mdStore = new MarketDataStore(":memory:");
    const revalDate = "2026-06-12"; // unique date for this TC (before R186 maturity)
    const tradeId = "BND-BANK-003";

    eventStore.append(makeTrade(tradeId, ISIN_R186, { portfolio: "banking-book" }));
    seedProductionTick(mdStore, ISIN_R186, "101.5", revalDate);

    runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );

    // Specifically this tradeId must not have been revalued.
    expect(revalEventsFor(tradeId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-4: No price tick → zero events, descriptive skip reason
// ---------------------------------------------------------------------------

describe("TC-4: no price tick → zero BondPositionRevalued, skip reason recorded", () => {
  it("records a descriptive skip reason when no tick is available for the ISIN", () => {
    const mdStore = new MarketDataStore(":memory:"); // empty — no ticks
    const revalDate = "2026-06-13"; // unique date for this TC (before R186 maturity)
    const tradeId = "BND-NOTICK-004";

    // Explicit maturityDate > revalDate so the maturity check doesn't fire first.
    eventStore.append(makeTrade(tradeId, ISIN_R186, { maturityDate: "2026-12-21" }));

    const result = runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );

    // At least one skip reason must mention the ISIN.
    expect(result.skipReasons.some((r) => r.includes(ISIN_R186))).toBe(true);
    // The specific tradeId must not have a reval event.
    expect(revalEventsFor(tradeId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-5: Matured bond excluded
// ---------------------------------------------------------------------------

describe("TC-5: matured bond excluded from revaluation", () => {
  it("skips a position whose maturityDate is on or before the revalDate", () => {
    const mdStore = new MarketDataStore(":memory:");
    const revalDate = "2026-06-14"; // unique date for this TC
    const tradeId = "BND-MAT-005";

    // Bond matured well before the revalDate.
    eventStore.append(makeTrade(tradeId, ISIN_R186, { maturityDate: "2026-06-01" }));
    seedProductionTick(mdStore, ISIN_R186, "100.0", revalDate);

    runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );

    // Matured position must not have been revalued.
    expect(revalEventsFor(tradeId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-6: BondSold closes position — no reval emitted
// ---------------------------------------------------------------------------

describe("TC-6: sold position is excluded", () => {
  it("emits no BondPositionRevalued for a bond that has been sold", () => {
    const mdStore = new MarketDataStore(":memory:");
    const revalDate = "2026-06-15"; // unique date for this TC (before R186 maturity)
    const tradeId = "BND-SOLD-006";

    eventStore.append(makeTrade(tradeId, ISIN_R186));

    // Emit a BondSold for this trade — closes the position.
    eventStore.append(
      makeBondSold({
        asOf: "2026-06-05T09:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId,
          bondIsin: ISIN_R186,
          side: "sell",
          saleProceedsMinor: 10_180_000_00,
          carryingAmountAtSaleMinor: 10_180_000_00,
          realisedPnlMinor: 0,
          settlementDate: "2026-06-08",
          currency: "ZAR",
        },
        eventId: newEventId(),
      }),
    );

    seedProductionTick(mdStore, ISIN_R186, "101.5", revalDate);

    runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );

    // The sold position must not have been revalued.
    expect(revalEventsFor(tradeId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-7: P&L sign — price rises → gain for buy
// ---------------------------------------------------------------------------

describe("TC-7: P&L sign — buy position gains when price rises", () => {
  it("unrealisedPnlZarMinor > 0 when currentCleanPrice > bookCleanPrice for a buy", () => {
    const mdStore = new MarketDataStore(":memory:");
    const revalDate = "2026-06-16"; // unique date for this TC (R2030 matures 2030-01-31)
    const tradeId = "BND-PNL-007";

    // Booked at 100.00% clean price, current market at 102.00%.
    eventStore.append(
      makeTrade(tradeId, ISIN_R2030, {
        cleanPricePercent: 100.0,
        dirtyPricePercent: 100.5,
        side: "buy",
        maturityDate: "2030-01-31",
      }),
    );
    seedProductionTick(mdStore, ISIN_R2030, "102.00", revalDate);

    runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );

    const event = revalEventsFor(tradeId, revalDate)[0];
    expect(event).toBeDefined();
    const pnl = (event?.payload as { unrealisedPnlZarMinor: number }).unrealisedPnlZarMinor;
    expect(pnl).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TC-8: P&L sign — price falls → gain for sell
// ---------------------------------------------------------------------------

describe("TC-8: P&L sign — sell position gains when price falls", () => {
  it("unrealisedPnlZarMinor > 0 when currentCleanPrice < bookCleanPrice for a sell", () => {
    const mdStore = new MarketDataStore(":memory:");
    const revalDate = "2026-06-17"; // unique date for this TC (R2030 matures 2030-01-31)
    const tradeId = "BND-PNL-008";

    // Booked at 120.00% dirty price, current market clean at 80.00% (large drop).
    // The 40% price drop (on R10m nominal = R4m loss on position, R4m gain for short)
    // dominates any accrued interest, ensuring positive P&L for the sell position.
    eventStore.append(
      makeTrade(tradeId, ISIN_R2030, {
        cleanPricePercent: 118.0,
        dirtyPricePercent: 120.0,
        side: "sell",
        maturityDate: "2030-01-31",
      }),
    );
    seedProductionTick(mdStore, ISIN_R2030, "80.00", revalDate);

    runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );

    const event = revalEventsFor(tradeId, revalDate)[0];
    expect(event).toBeDefined();
    const pnl = (event?.payload as { unrealisedPnlZarMinor: number }).unrealisedPnlZarMinor;
    expect(pnl).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TC-9: Simulated tick used as fallback when no production tick exists
// ---------------------------------------------------------------------------

describe("TC-9: simulated tick fallback when no production tick available", () => {
  it("uses bond-sim simulated tick as fallback and emits BondPositionRevalued", () => {
    const mdStore = new MarketDataStore(":memory:");
    const revalDate = "2026-06-18"; // unique date for this TC (before R186 maturity)
    const tradeId = "BND-SIM-009";

    eventStore.append(makeTrade(tradeId, ISIN_R186, { maturityDate: "2026-12-21" }));
    // Only a simulated tick, no production tick.
    seedSimulatedTick(mdStore, ISIN_R186, "101.4", revalDate);

    const result = runEodBondRevaluation(
      eventStore as unknown as import("../platform/event-store/store").EventStore,
      mdStore,
      revalDate,
    );

    expect(result.errors).toHaveLength(0);

    // The tradeId should have been revalued using the simulated tick.
    expect(revalEventsFor(tradeId, revalDate)).toHaveLength(1);
  });
});
