// tests/ba320-irs-ir-adapter.test.ts
//
// Unit tests for the BA 320 IRS IR general-risk DV01 maturity-ladder adapter
// (`platform/reporting/ba-320-irs-events-adapter.ts`) and its integration into
// the BA 320 period-close subscriber.
//
// Coverage (per dispatch brief WS-BA-RETURNS-P1-SOURCING Phase 3):
//   1. Empty store → empty ladder, no missing-DV01 swaps (no crash)
//   2. Live trading-book IRS with known dv01ByTenorBucket → expected per-band
//      IR general-risk contribution (positive DV01 → long, negative → short)
//   3. bookDesignation === "banking" IRS is excluded (IRRBB / BA 330)
//   4. bookDesignation absent ⇒ treated as trading (Phase 1 default)
//   5. Terminated swap excluded from the ladder
//   6. Live trading-book swap with NO dv01ByTenorBucket → surfaced as a
//      substrate gap (swapsMissingDv01), not dropped, not fabricated
//   7. Latest revaluation wins when a swap is revalued more than once
//   8. combineIrGeneralLadders sums bond + IRS contributions per band
//   9. Integration: subscriber folds IRS DV01 into the IR general ladder and
//      surfaces missing-DV01 swaps as placeholders
//
// Authority: WS-BA-RETURNS-P1-SOURCING Phase 3;
//   D-BA-RETURNS-P1-SOURCING-WORKSTREAM; D-BA-RETURN-NUMBERING-EXCEL-CANONICAL;
//   Regulations Relating to Banks Reg 28(3)(a), Reg 28(5)(b); BCBS d368 §21;
//   Principles/1-events-are-truth.md.
//
// Author: Mira (Regulatory reporting engineer, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  makeIrdSwapPositionRevalued,
  makeIrdSwapTerminated,
  makeIrdSwapTradeExecuted,
} from "../platform/event-store/event-types/ird-accounting";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import {
  buildIrsIrGeneralLadder,
  combineIrGeneralLadders,
} from "../platform/reporting/ba-320-irs-events-adapter";
import type { IrMaturityBandRow } from "../platform/reporting/ba-320-market-risk";
import { ba310PeriodCloseSubscriber } from "../platform/returns/ba320/period-close-subscriber";
import type { BaselMaturityBand } from "../platform/types/basel";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:Mira" };
const CITATIONS = ["D-BA-RETURNS-P1-SOURCING-WORKSTREAM", "D-TRADE-LIFECYCLE-IFRS-CHAIN"];

const PERIOD_END = "2026-06-30T23:59:59.999Z";

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function appendSwap(
  store: EventStore,
  opts: {
    tradeId: string;
    bookDesignation?: "trading" | "banking";
    asOf?: string;
  },
): void {
  store.append(
    makeIrdSwapTradeExecuted({
      asOf: opts.asOf ?? "2026-06-01T10:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: opts.tradeId,
        instrumentType: "irs",
        role: "receive-fixed",
        notionalMinor: 100_000_000,
        npvMinor: 0,
        fixedRatePercent: 0.0775,
        tradeDate: "2026-06-01",
        startDate: "2026-06-03",
        maturityDate: "2031-06-03",
        counterpartyLei: "LEI-TEST-IRS-001",
        currency: "ZAR",
        ...(opts.bookDesignation !== undefined ? { bookDesignation: opts.bookDesignation } : {}),
      },
    }),
  );
}

function appendReval(
  store: EventStore,
  opts: {
    tradeId: string;
    revalDate: string;
    dv01ByTenorBucket?: Partial<Record<BaselMaturityBand, number>>;
    asOf?: string;
  },
): void {
  store.append(
    makeIrdSwapPositionRevalued({
      asOf: opts.asOf ?? opts.revalDate,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        tradeId: opts.tradeId,
        npvDeltaMinor: 0,
        npvClosingMinor: 0,
        npvOpeningMinor: 0,
        revalDate: opts.revalDate,
        currency: "ZAR",
        ...(opts.dv01ByTenorBucket !== undefined
          ? { dv01ByTenorBucket: opts.dv01ByTenorBucket }
          : {}),
      },
    }),
  );
}

function bandRow(rows: readonly IrMaturityBandRow[], band: string): IrMaturityBandRow | undefined {
  return rows.find((r) => r.band === band);
}

// ---------------------------------------------------------------------------
// 1. Empty store
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — empty store", () => {
  it("returns empty ladder and no missing-DV01 swaps", () => {
    const store = new EventStore(":memory:");
    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(result.rows).toEqual([]);
    expect(result.swapsMissingDv01).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Live trading-book IRS with known DV01 → expected per-band contribution
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — DV01 folding", () => {
  it("maps a known dv01ByTenorBucket into per-band long/short contributions", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-001", bookDesignation: "trading" });
    appendReval(store, {
      tradeId: "IRS-001",
      revalDate: "2026-06-30",
      dv01ByTenorBucket: {
        "1-2y": 5_000, // positive → long
        "5-7y": -3_000, // negative → short
      },
    });

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(result.swapsMissingDv01).toEqual([]);

    const oneTwoY = bandRow(result.rows, "1-2y");
    expect(oneTwoY).toEqual({ band: "1-2y", weightedLongMinor: 5_000, weightedShortMinor: 0 });

    const fiveSevenY = bandRow(result.rows, "5-7y");
    expect(fiveSevenY).toEqual({ band: "5-7y", weightedLongMinor: 0, weightedShortMinor: 3_000 });
  });

  it("sums DV01 across multiple swaps within the same band", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-A", bookDesignation: "trading" });
    appendSwap(store, { tradeId: "IRS-B", bookDesignation: "trading" });
    appendReval(store, {
      tradeId: "IRS-A",
      revalDate: "2026-06-30",
      dv01ByTenorBucket: { "2-3y": 4_000 },
    });
    appendReval(store, {
      tradeId: "IRS-B",
      revalDate: "2026-06-30",
      dv01ByTenorBucket: { "2-3y": -1_000 },
    });

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(bandRow(result.rows, "2-3y")).toEqual({
      band: "2-3y",
      weightedLongMinor: 4_000,
      weightedShortMinor: 1_000,
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Banking-book IRS excluded
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — book designation", () => {
  it("excludes a banking-book IRS (IRRBB / BA 330)", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-BANK", bookDesignation: "banking" });
    appendReval(store, {
      tradeId: "IRS-BANK",
      revalDate: "2026-06-30",
      dv01ByTenorBucket: { "1-2y": 9_999 },
    });

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(result.rows).toEqual([]);
    expect(result.swapsMissingDv01).toEqual([]);
  });

  it("treats an absent bookDesignation as trading (Phase 1 default)", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-DEFAULT" }); // no bookDesignation
    appendReval(store, {
      tradeId: "IRS-DEFAULT",
      revalDate: "2026-06-30",
      dv01ByTenorBucket: { "3-4y": 2_500 },
    });

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(bandRow(result.rows, "3-4y")).toEqual({
      band: "3-4y",
      weightedLongMinor: 2_500,
      weightedShortMinor: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Terminated swap excluded
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — derecognition", () => {
  it("excludes a terminated swap from the ladder", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-TERM", bookDesignation: "trading" });
    appendReval(store, {
      tradeId: "IRS-TERM",
      revalDate: "2026-06-15",
      dv01ByTenorBucket: { "1-2y": 7_000 },
    });
    store.append(
      makeIrdSwapTerminated({
        asOf: "2026-06-20T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "IRS-TERM",
          terminationPaymentMinor: 0,
          carryingNpvAtTerminationMinor: 0,
          realisedPnlMinor: 0,
          terminationDate: "2026-06-20",
          currency: "ZAR",
        },
      }),
    );

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(result.rows).toEqual([]);
    expect(result.swapsMissingDv01).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. Missing DV01 surfaced as substrate gap
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — missing DV01 substrate gap", () => {
  it("surfaces a live trading-book swap with no dv01ByTenorBucket (not dropped, not fabricated)", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-NODV01", bookDesignation: "trading" });
    appendReval(store, { tradeId: "IRS-NODV01", revalDate: "2026-06-30" }); // no dv01ByTenorBucket

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(result.rows).toEqual([]);
    expect(result.swapsMissingDv01).toEqual(["IRS-NODV01"]);
  });

  it("surfaces a live trading-book swap that was never revalued", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-NOREVAL", bookDesignation: "trading" });

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(result.swapsMissingDv01).toEqual(["IRS-NOREVAL"]);
  });
});

// ---------------------------------------------------------------------------
// 7. Latest revaluation wins
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — latest revaluation", () => {
  it("uses the most recent revaluation's dv01ByTenorBucket", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-MULTI", bookDesignation: "trading" });
    appendReval(store, {
      tradeId: "IRS-MULTI",
      revalDate: "2026-06-15",
      dv01ByTenorBucket: { "1-2y": 1_000 },
    });
    appendReval(store, {
      tradeId: "IRS-MULTI",
      revalDate: "2026-06-30",
      dv01ByTenorBucket: { "1-2y": 8_000 },
    });

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(bandRow(result.rows, "1-2y")).toEqual({
      band: "1-2y",
      weightedLongMinor: 8_000,
      weightedShortMinor: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// 8. combineIrGeneralLadders
// ---------------------------------------------------------------------------

describe("combineIrGeneralLadders", () => {
  it("sums weighted long/short per band across ladders", () => {
    const bondLadder: IrMaturityBandRow[] = [
      { band: "1-2y", weightedLongMinor: 1_000, weightedShortMinor: 200 },
      { band: "5-7y", weightedLongMinor: 0, weightedShortMinor: 500 },
    ];
    const irsLadder: IrMaturityBandRow[] = [
      { band: "1-2y", weightedLongMinor: 4_000, weightedShortMinor: 0 },
      { band: "2-3y", weightedLongMinor: 300, weightedShortMinor: 0 },
    ];

    const combined = combineIrGeneralLadders(bondLadder, irsLadder);

    expect(bandRow(combined, "1-2y")).toEqual({
      band: "1-2y",
      weightedLongMinor: 5_000,
      weightedShortMinor: 200,
    });
    expect(bandRow(combined, "2-3y")).toEqual({
      band: "2-3y",
      weightedLongMinor: 300,
      weightedShortMinor: 0,
    });
    expect(bandRow(combined, "5-7y")).toEqual({
      band: "5-7y",
      weightedLongMinor: 0,
      weightedShortMinor: 500,
    });
  });
});

// ---------------------------------------------------------------------------
// 9. Integration via the period-close subscriber
// ---------------------------------------------------------------------------

describe("ba310PeriodCloseSubscriber — IRS IR general-risk integration", () => {
  it("folds trading-book IRS DV01 into the IR general ladder and excludes banking-book", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-T", bookDesignation: "trading" });
    appendReval(store, {
      tradeId: "IRS-T",
      revalDate: "2026-06-30",
      dv01ByTenorBucket: { "1-2y": 6_000 },
    });
    // Banking-book swap must NOT contribute.
    appendSwap(store, { tradeId: "IRS-BANK2", bookDesignation: "banking" });
    appendReval(store, {
      tradeId: "IRS-BANK2",
      revalDate: "2026-06-30",
      dv01ByTenorBucket: { "1-2y": 99_999 },
    });

    const result = ba310PeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-bank:month:2026-06",
        closedAt: PERIOD_END,
        entity: ENTITY,
      } as never,
      entity: ENTITY,
      eventStore: store,
      actor: ACTOR,
      periodStart: "2026-06-01T00:00:00.000Z",
    });

    expect(result.skipped).toBe(false);
    const ladder = result.ba310Output.interestRateGeneral.maturityLadder;
    // The generator emits a line per non-empty band; the 1-2y band's weighted
    // net must reflect the trading-book swap only (6_000), not the banking one.
    const oneTwoY = ladder.find((l) => l.note?.includes("long=6000"));
    expect(oneTwoY).toBeDefined();
    expect(ladder.some((l) => l.note?.includes("99999"))).toBe(false);
  });

  it("surfaces a missing-DV01 trading-book swap as a placeholder", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-GAP", bookDesignation: "trading" });
    appendReval(store, { tradeId: "IRS-GAP", revalDate: "2026-06-30" }); // no DV01

    const result = ba310PeriodCloseSubscriber({
      closedPayload: {
        periodId: "period:hoz-bank:month:2026-06",
        closedAt: PERIOD_END,
        entity: ENTITY,
      } as never,
      entity: ENTITY,
      eventStore: store,
      actor: ACTOR,
      periodStart: "2026-06-01T00:00:00.000Z",
    });

    const hasGap = result.ba310Output.placeholders.some(
      (p) => p.includes("substrate-gap") && p.includes("IRS-GAP"),
    );
    expect(hasGap).toBe(true);
  });
});
