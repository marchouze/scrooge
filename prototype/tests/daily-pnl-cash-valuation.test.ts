// tests/daily-pnl-cash-valuation.test.ts
//
// Regression: the daily P&L headline MUST include the valuation of the desk's
// FX cash position — the foreign-currency balance a SETTLED FX trade leaves
// behind (fi:csh:<CCY>:<book>, IAS 21 §28). Before this fix the moment a trade
// settled it dropped out of the live-reval universe and its P&L vanished from
// the headline; the desk-cash instrument was computed and shown on a separate
// table but never folded into computeDailyPnL (Marc, 2026-06-03).
//
// Cases:
//   TC-1: a settled long USD position marked below cost folds its unrealised
//         retranslation loss into totalUnrealised + byCurrency, and the figure
//         reads complete (markable).
//   TC-2: a closed-out position folds its crystallised realised P&L into
//         totalRealised (no dependency on a RealisedPnlRecognised agent event).
//   TC-3: a held cash position with NO CCY/ZAR mark is EXCLUDED from the total
//         (no silent 0), flagged incomplete, and surfaced in the unmarkable
//         ledger.
//
// Uses a stub store (replay-by-type) so the economics are pinned without
// constructing fully schema-valid CDM payloads — mirrors currency-position.test.ts.
//
// Authority: IAS 21 §23/§28; IFRS 9 §5.7.1; D-FINANCIAL-INSTRUMENT-ENTITY;
//   D-TRUSTED-FIGURES-PROGRAM-V1; CEO 2026-05-31; CEO 2026-06-03.

import { describe, expect, it } from "bun:test";

import type { EventStore } from "../platform/event-store/store";
import { computeDailyPnL } from "../platform/product-control/daily-pnl";
import { cashInstrumentId } from "../platform/projections/markets/currency-position";

const ENTITY = "LE-ZA-HOZ-BANK";
const BOOK = "BK-FX-MM-001";
const DATE = "2026-06-03";

interface StubEvent {
  type: string;
  entity: string;
  payload: Record<string, unknown>;
}

function stubStore(events: StubEvent[]): EventStore {
  return {
    replay({ type }: { type?: string } = {}) {
      return events.filter((e) => type === undefined || e.type === type);
    },
  } as unknown as EventStore;
}

/** A settled USD/ZAR trade: FxTradeExecuted (with a near leg) + two PrincipalPayment legs. */
function settledUsdZar(
  tradeId: string,
  side: "buy" | "sell",
  usdMinor: number,
  zarMinor: number,
): StubEvent[] {
  const usdNet = side === "buy" ? usdMinor : -usdMinor;
  const zarNet = side === "buy" ? -zarMinor : zarMinor;
  const rate = zarMinor / usdMinor;
  return [
    {
      type: "FxTradeExecuted",
      entity: ENTITY,
      payload: {
        tradeId: { value: tradeId },
        bookId: BOOK,
        side,
        currencyPair: { base: "USD", quote: "ZAR" },
        tradeDate: { iso: "2026-05-27", calendar: "JIHCAL" },
        counterparty: { partyId: "CP-1", name: "Test Bank" },
        legs: [
          {
            legKind: "near",
            notional: { currency: "USD", amountMinor: usdMinor },
            counterNotional: { currency: "ZAR", amountMinor: zarMinor },
            rate: { amount: rate, currency: "ZAR" },
            settlementDate: { iso: "2026-05-29", calendar: "JIHCAL" },
          },
        ],
      },
    },
    {
      type: "PrincipalPayment",
      entity: ENTITY,
      payload: {
        tradeId,
        legKind: "receive",
        currency: "USD",
        netCash: usdNet,
        settlementDate: "2026-05-29",
      },
    },
    {
      type: "PrincipalPayment",
      entity: ENTITY,
      payload: {
        tradeId,
        legKind: "deliver",
        currency: "ZAR",
        netCash: zarNet,
        settlementDate: "2026-05-29",
      },
    },
    // Marks the trade settled so daily-pnl does not treat it as a live position.
    {
      type: "SettlementConfirmed",
      entity: ENTITY,
      payload: { tradeId, realisedPnlDelta: 0 },
    },
  ];
}

function usdZarMark(rate: number): StubEvent {
  return {
    type: "OfficialMarkAdopted",
    entity: ENTITY,
    payload: { markType: "fx-rate", instrumentKey: "USD/ZAR", mark: String(rate) },
  };
}

describe("daily-pnl — desk FX cash valuation folds into the headline", () => {
  it("TC-1: a settled long USD position retranslates into totalUnrealised + byCurrency", () => {
    // Buy USD 1,000.00 @ 18.50 (cost ZAR 18,500.00), mark 16.25 → loss 100000×(16.25−18.5).
    const { payload } = computeDailyPnL(
      stubStore([...settledUsdZar("T1", "buy", 100_000, 1_850_000), usdZarMark(16.25)]),
      DATE,
    );
    const expected = Math.round(100_000 * (16.25 - 18.5)); // −225000
    expect(payload.totalUnrealisedPnlZarMinor).toBe(expected);
    expect(payload.unrealisedComplete).toBe(true);
    const usd = payload.byCurrency.find((c) => c.currency === "USD");
    expect(usd?.unrealisedPnlZarMinor).toBe(expected);
  });

  it("TC-2: a closed-out position crystallises realised P&L into totalRealised", () => {
    // Buy USD 1,000 @ 18.50, sell back @ 16.25 → realised (16.25−18.5)×100000 = −225000.
    const { payload } = computeDailyPnL(
      stubStore([
        ...settledUsdZar("T1", "buy", 100_000, 1_850_000),
        ...settledUsdZar("T2", "sell", 100_000, 1_625_000),
        usdZarMark(16.25),
      ]),
      DATE,
    );
    expect(payload.totalRealisedPnlZarMinor).toBe(Math.round((16.25 - 18.5) * 100_000));
    // Position is flat after the close-out → no residual unrealised cash mark.
    expect(payload.totalUnrealisedPnlZarMinor).toBe(0);
  });

  it("TC-3: a held cash position with no mark is excluded (no silent 0) and flagged", () => {
    const { payload } = computeDailyPnL(
      stubStore(settledUsdZar("T1", "buy", 100_000, 1_850_000)), // no mark
      DATE,
    );
    expect(payload.totalUnrealisedPnlZarMinor).toBe(0); // excluded, not folded as 0
    expect(payload.unrealisedComplete).toBe(false);
    expect(payload.unmarkableLiveTradeIds).toContain(cashInstrumentId("USD", BOOK));
  });
});
