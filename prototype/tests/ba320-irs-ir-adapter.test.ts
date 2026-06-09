// tests/ba320-irs-ir-adapter.test.ts
//
// Unit tests for the BA 320 IRS IR general-risk MATURITY-METHOD notional
// decomposition adapter (`platform/reporting/ba-320-irs-events-adapter.ts`) and
// its integration into the BA 320 period-close subscriber.
//
// G1 (WS-BA-RETURNS-FOLLOWON): the adapter no longer feeds raw DV01 into the IR
// general-risk ladder. Each vanilla swap decomposes into a fixed-bond leg (at
// residual maturity) + an FRN leg (at time-to-next-reset), each
// `notionalMinor × bandRiskWeight` — commensurate with the bond adapter.
//
// Coverage:
//   1. Empty store → empty ladder, no missing-terms swaps (no crash)
//   2. Vanilla receive-fixed swap → long fixed-bond leg at maturity band +
//      short FRN leg at next-reset band; weighted-nominal magnitudes
//   3. Vanilla pay-fixed swap → opposite signs
//   4. Weighted-nominal magnitude is commensurate with an equivalent-notional
//      bond at the same band (dimensional coherence)
//   5. bookDesignation === "banking" excluded (IRRBB / BA 330)
//   6. absent bookDesignation ⇒ trading (Phase 1 default)
//   7. terminated swap excluded
//   8. swap missing next-reset terms → substrate gap (not dropped, not fabricated)
//   9. basis swap (pay-float/receive-float) → substrate gap (G2)
//  10. resetFrequencyMonths derives the next reset when nextResetDate absent
//  11. every emitted row carries weightingBasis = maturity-method-weighted-nominal
//  12. combineIrGeneralLadders sums commensurate ladders; REJECTS a foreign basis
//  13. combined bond + IRS charge is dimensionally coherent
//  14. integration: subscriber folds the IRS legs + surfaces missing-terms swaps
//
// Authority: WS-BA-RETURNS-FOLLOWON G1; D-IRS-DV01-BUCKETING-CALIBRATION;
//   D-BA-RETURN-NUMBERING-EXCEL-CANONICAL; Regulations Relating to Banks
//   Reg 28(3)(a) Table A, Reg 28(5)(b); BCBS D352 §718(b);
//   Principles/1-events-are-truth.md.
//
// Author: Mira (Regulatory reporting engineer, engineering)

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { makeBondTradeExecuted } from "../platform/event-store/event-types/bond-accounting";
import {
  makeIrdSwapTerminated,
  makeIrdSwapTradeExecuted,
} from "../platform/event-store/event-types/ird-accounting";
import { EventStore } from "../platform/event-store/store";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import { buildBondIrGeneralLadder } from "../platform/reporting/ba-320-bond-events-adapter";
import { MATURITY_METHOD_WEIGHTED_NOMINAL } from "../platform/reporting/ba-320-ir-maturity-bands";
import {
  buildIrsIrGeneralLadder,
  combineIrGeneralLadders,
} from "../platform/reporting/ba-320-irs-events-adapter";
import type { IrMaturityBandRow } from "../platform/reporting/ba-320-market-risk";
import { ba310PeriodCloseSubscriber } from "../platform/returns/ba320/period-close-subscriber";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:Mira" };
const CITATIONS = ["D-BA-RETURNS-P1-SOURCING-WORKSTREAM", "D-TRADE-LIFECYCLE-IFRS-CHAIN"];

const PERIOD_END = "2026-06-30T23:59:59.999Z";

// Reg 28(3)(a) Table A risk weights used to compute expected weighted nominals.
const RW_5_7Y = 0.0325;
const RW_1_3M = 0.002;

beforeEach(() => setDefaultProvenanceModeOverride("combined"));
afterEach(() => setDefaultProvenanceModeOverride(undefined));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function appendSwap(
  store: EventStore,
  opts: {
    tradeId: string;
    role?: "pay-fixed" | "receive-fixed" | "pay-float" | "receive-float";
    instrumentType?: "irs" | "basis-swap" | "ois";
    notionalMinor?: number;
    bookDesignation?: "trading" | "banking";
    maturityDate?: string;
    startDate?: string;
    nextResetDate?: string;
    resetFrequencyMonths?: number;
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
        instrumentType: opts.instrumentType ?? "irs",
        role: opts.role ?? "receive-fixed",
        notionalMinor: opts.notionalMinor ?? 100_000_000,
        npvMinor: 0,
        fixedRatePercent: 0.0775,
        tradeDate: "2026-06-01",
        startDate: opts.startDate ?? "2026-06-03",
        // ~6 years residual from PERIOD_END → 5-7y band by default.
        maturityDate: opts.maturityDate ?? "2032-06-03",
        counterpartyLei: "LEI-TEST-IRS-001",
        currency: "ZAR",
        ...(opts.bookDesignation !== undefined ? { bookDesignation: opts.bookDesignation } : {}),
        ...(opts.nextResetDate !== undefined ? { nextResetDate: opts.nextResetDate } : {}),
        ...(opts.resetFrequencyMonths !== undefined
          ? { resetFrequencyMonths: opts.resetFrequencyMonths }
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
  it("returns empty ladder and no missing-terms swaps", () => {
    const store = new EventStore(":memory:");
    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(result.rows).toEqual([]);
    expect(result.swapsMissingTerms).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2 + 3. Vanilla swap decomposition (fixed-bond + FRN legs, signs by role)
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — maturity-method decomposition", () => {
  it("receive-fixed: LONG fixed-bond leg at maturity band, SHORT FRN leg at next-reset band", () => {
    const store = new EventStore(":memory:");
    // ~6y maturity (5-7y band) ; next reset ~2.5 months out (1-3m band).
    appendSwap(store, {
      tradeId: "IRS-RECV",
      role: "receive-fixed",
      notionalMinor: 100_000_000,
      maturityDate: "2032-06-03",
      nextResetDate: "2026-09-15",
    });

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    expect(result.swapsMissingTerms).toEqual([]);

    // Fixed leg LONG at 5-7y, weighted = 100m × 3.25%.
    const fixed = bandRow(result.rows, "5-7y");
    expect(fixed).toEqual({
      band: "5-7y",
      weightedLongMinor: Math.round(100_000_000 * RW_5_7Y),
      weightedShortMinor: 0,
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    });

    // FRN leg SHORT at 1-3m, weighted = 100m × 0.20%.
    const frn = bandRow(result.rows, "1-3m");
    expect(frn).toEqual({
      band: "1-3m",
      weightedLongMinor: 0,
      weightedShortMinor: Math.round(100_000_000 * RW_1_3M),
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    });
  });

  it("pay-fixed: SHORT fixed-bond leg, LONG FRN leg (opposite signs)", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, {
      tradeId: "IRS-PAY",
      role: "pay-fixed",
      notionalMinor: 100_000_000,
      maturityDate: "2032-06-03",
      nextResetDate: "2026-09-15",
    });

    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    const fixed = bandRow(result.rows, "5-7y");
    expect(fixed).toEqual({
      band: "5-7y",
      weightedLongMinor: 0,
      weightedShortMinor: Math.round(100_000_000 * RW_5_7Y),
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    });

    const frn = bandRow(result.rows, "1-3m");
    expect(frn).toEqual({
      band: "1-3m",
      weightedLongMinor: Math.round(100_000_000 * RW_1_3M),
      weightedShortMinor: 0,
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Commensurate with an equivalent-notional bond
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — commensurate with a bond", () => {
  it("the swap's fixed leg matches an equal-notional bond at the same band", () => {
    const store = new EventStore(":memory:");
    // Swap fixed leg → 5-7y LONG.
    appendSwap(store, {
      tradeId: "IRS-CMP",
      role: "receive-fixed",
      notionalMinor: 100_000_000,
      maturityDate: "2032-06-03",
      nextResetDate: "2026-09-15",
    });
    // An equal-notional trading-book bond maturing in the same 5-7y band.
    store.append(
      makeBondTradeExecuted({
        asOf: "2026-06-01T10:00:00.000Z",
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "BND-CMP",
          bondIsin: "ZAG000099999",
          side: "buy",
          nominalMinor: 100_000_000,
          cleanPricePercent: 100,
          accruedInterestMinor: 0,
          dirtyPricePercent: 100,
          settlementDate: "2026-06-03",
          portfolio: "trading-book",
          couponRate: 0.0775,
          maturityDate: "2032-06-03",
          currency: "ZAR",
          counterpartyLei: "LEI-TEST-BND-001",
          executedAt: "2026-06-01T10:00:00.000Z",
        },
      }),
    );

    const irs = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    const bond = buildBondIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });

    const irsFixed = bandRow(irs.rows, "5-7y");
    const bondRowAt = bandRow(bond, "5-7y");
    // Same weighted-nominal magnitude → dimensionally coherent (G1).
    expect(irsFixed?.weightedLongMinor).toBe(bondRowAt?.weightedLongMinor);
  });
});

// ---------------------------------------------------------------------------
// 5 + 6. Book designation
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — book designation", () => {
  it("excludes a banking-book IRS (IRRBB / BA 330)", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, {
      tradeId: "IRS-BANK",
      bookDesignation: "banking",
      nextResetDate: "2026-09-15",
    });
    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(result.rows).toEqual([]);
    expect(result.swapsMissingTerms).toEqual([]);
  });

  it("treats an absent bookDesignation as trading (Phase 1 default)", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-DEFAULT", nextResetDate: "2026-09-15" });
    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    // Default 5y maturity → 5-7y fixed leg present.
    expect(bandRow(result.rows, "5-7y")).toBeDefined();
    expect(result.swapsMissingTerms).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. Terminated swap excluded
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — derecognition", () => {
  it("excludes a terminated swap", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-TERM", nextResetDate: "2026-09-15" });
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
    expect(result.swapsMissingTerms).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8 + 9. Substrate gaps (missing terms / basis swap) — not fabricated
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — substrate gaps", () => {
  it("surfaces a vanilla swap missing next-reset terms (not dropped, not fabricated)", () => {
    const store = new EventStore(":memory:");
    // No nextResetDate, no resetFrequencyMonths.
    appendSwap(store, { tradeId: "IRS-NORESET" });
    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(result.rows).toEqual([]);
    expect(result.swapsMissingTerms).toEqual(["IRS-NORESET"]);
  });

  it("surfaces a basis swap (pay-float / receive-float) as a gap (G2, separate brief)", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, {
      tradeId: "IRS-BASIS",
      role: "pay-float",
      instrumentType: "basis-swap",
      nextResetDate: "2026-09-15",
    });
    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(result.rows).toEqual([]);
    expect(result.swapsMissingTerms).toEqual(["IRS-BASIS"]);
  });
});

// ---------------------------------------------------------------------------
// 10. resetFrequencyMonths derivation
// ---------------------------------------------------------------------------

describe("buildIrsIrGeneralLadder — reset frequency derivation", () => {
  it("derives the next reset from resetFrequencyMonths when nextResetDate is absent", () => {
    const store = new EventStore(":memory:");
    // start 2026-06-03, quarterly resets → next reset after 2026-06-30 is
    // 2026-09-03 (~2 months out → 1-3m band, RW 0.20%).
    appendSwap(store, {
      tradeId: "IRS-FREQ",
      role: "receive-fixed",
      notionalMinor: 100_000_000,
      startDate: "2026-06-03",
      maturityDate: "2032-06-03",
      resetFrequencyMonths: 3,
    });
    const result = buildIrsIrGeneralLadder({
      entity: ENTITY,
      periodEnd: PERIOD_END,
      eventStore: store,
    });
    expect(result.swapsMissingTerms).toEqual([]);
    // FRN leg SHORT at 1-3m (reset ~2 months out).
    const frn = bandRow(result.rows, "1-3m");
    expect(frn?.weightedShortMinor).toBe(Math.round(100_000_000 * 0.002));
    // Fixed leg LONG at 5-7y.
    expect(bandRow(result.rows, "5-7y")?.weightedLongMinor).toBe(Math.round(100_000_000 * RW_5_7Y));
  });
});

// ---------------------------------------------------------------------------
// 11 + 12. Weighting basis + combiner guard
// ---------------------------------------------------------------------------

describe("combineIrGeneralLadders — weighting basis", () => {
  it("sums weighted long/short per band across commensurate ladders", () => {
    const bondLadder: IrMaturityBandRow[] = [
      {
        band: "1-2y",
        weightedLongMinor: 1_000,
        weightedShortMinor: 200,
        weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
      },
      {
        band: "5-7y",
        weightedLongMinor: 0,
        weightedShortMinor: 500,
        weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
      },
    ];
    const irsLadder: IrMaturityBandRow[] = [
      {
        band: "1-2y",
        weightedLongMinor: 4_000,
        weightedShortMinor: 0,
        weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
      },
    ];
    const combined = combineIrGeneralLadders(bondLadder, irsLadder);
    expect(bandRow(combined, "1-2y")).toEqual({
      band: "1-2y",
      weightedLongMinor: 5_000,
      weightedShortMinor: 200,
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    });
  });

  it("accepts rows with no basis (back-compat for caller-supplied ladders)", () => {
    const ladder: IrMaturityBandRow[] = [
      { band: "1-2y", weightedLongMinor: 10, weightedShortMinor: 0 },
    ];
    expect(() => combineIrGeneralLadders(ladder)).not.toThrow();
  });

  it("THROWS on a row carrying a foreign weighting basis (a reintroduced raw-DV01 feed)", () => {
    const rawDv01Ladder: IrMaturityBandRow[] = [
      {
        band: "5-7y",
        weightedLongMinor: 45_000, // a DV01-scale magnitude, not weighted nominal
        weightedShortMinor: 0,
        weightingBasis: "raw-dv01-rand-per-bp",
      },
    ];
    expect(() => combineIrGeneralLadders(rawDv01Ladder)).toThrow(/foreign weighting basis/);
  });
});

// ---------------------------------------------------------------------------
// 13. Combined bond + IRS coherence
// ---------------------------------------------------------------------------

describe("combined bond + IRS ladder — dimensional coherence", () => {
  it("a swap fixed leg and an equal bond at the same band sum to 2× the weighted nominal", () => {
    const w = Math.round(100_000_000 * RW_5_7Y);
    const irsRow: IrMaturityBandRow = {
      band: "5-7y",
      weightedLongMinor: w,
      weightedShortMinor: 0,
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    };
    const bondRowAt: IrMaturityBandRow = {
      band: "5-7y",
      weightedLongMinor: w,
      weightedShortMinor: 0,
      weightingBasis: MATURITY_METHOD_WEIGHTED_NOMINAL,
    };
    const combined = combineIrGeneralLadders([irsRow], [bondRowAt]);
    expect(bandRow(combined, "5-7y")?.weightedLongMinor).toBe(2 * w);
  });
});

// ---------------------------------------------------------------------------
// 14. Integration via the period-close subscriber
// ---------------------------------------------------------------------------

describe("ba310PeriodCloseSubscriber — IRS IR general-risk integration", () => {
  it("folds trading-book IRS legs into the IR general ladder and excludes banking-book", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, {
      tradeId: "IRS-T",
      role: "receive-fixed",
      notionalMinor: 100_000_000,
      maturityDate: "2032-06-03",
      nextResetDate: "2026-09-15",
    });
    appendSwap(store, {
      tradeId: "IRS-BANK2",
      bookDesignation: "banking",
      notionalMinor: 999_000_000,
      nextResetDate: "2026-09-15",
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
    const fixedLeg = Math.round(100_000_000 * RW_5_7Y);
    // 5-7y line reflects the trading-book swap's fixed leg (weighted nominal),
    // not the banking-book swap's notional.
    const fiveSeven = ladder.find((l) => l.lineId === "ir-general.band.5-7y");
    expect(fiveSeven?.amountMinor).toBe(fixedLeg);
    expect(ladder.some((l) => l.note?.includes("999000000"))).toBe(false);
  });

  it("surfaces a missing-terms trading-book swap as a placeholder", () => {
    const store = new EventStore(":memory:");
    appendSwap(store, { tradeId: "IRS-GAP" }); // no reset terms

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
